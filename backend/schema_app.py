from __future__ import annotations

import os
import re
import secrets
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from threading import Lock
from typing import Any, Optional, Sequence

from flask import Flask, g, jsonify, request
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    func,
    select,
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker
from sqlalchemy.pool import StaticPool
from werkzeug.security import check_password_hash, generate_password_hash

try:
    from .feed_ranker import rank_feed_posts
except ImportError:
    from feed_ranker import rank_feed_posts

BACKEND_DIR = Path(__file__).resolve().parent

try:
    from dotenv import load_dotenv

    load_dotenv(BACKEND_DIR / ".env")
except ImportError:
    pass

DEFAULT_DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/campus_nexus"
PROFILE_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' rx='64' fill='%23e9e7f3'/%3E%3Ccircle cx='64' cy='48' r='24' fill='%23777d86'/%3E%3Cpath d='M24 116c6-27 22-41 40-41s34 14 40 41' fill='%23777d86'/%3E%3C/svg%3E"

DEFAULT_ADMIN_USER = {
    "mail": "admin@cn.nhce",
    "username": "admin",
    "name": "Admin",
    "DOB": "2000-01-01",
    "department": "CS",
    "year": 1,
    "password": "12345678",
}

POST_TYPE_TO_CODE = {"normal": 0, "club_post": 1, "announcement": 3, "event": 3, "repost": 0}
CODE_TO_POST_TYPE = {0: "normal", 1: "club_post", 2: "normal", 3: "announcement"}
CLUB_MEMBER_ROLES = {"president", "vice_president", "chairman", "vice_chairman", "secretary", "treasurer", "member"}
SINGLE_CLUB_MEMBER_ROLES = CLUB_MEMBER_ROLES - {"member"}
CLUB_PUBLISHER_ROLES = {"president", "chairman", "secretary"}
CLUB_POST_TYPES = {"club_post", "announcement"}
IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg")
VIDEO_EXTENSIONS = (".mp4",)
HASHTAG_RE = re.compile(r"(?<![\w])#([A-Za-z0-9_]+)")
MENTION_RE = re.compile(r"(?<![\w])@([A-Za-z0-9_.-]+)")

app = Flask(__name__)
_database_initialized = False
_database_lock = Lock()
_admin_tokens: set[str] = set()


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    return datetime.utcnow()


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    username: Mapped[str] = mapped_column(Text, unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(Text, unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    account_role: Mapped[str] = mapped_column(Text, default="student", nullable=False)
    date_of_birth: Mapped[Optional[date]] = mapped_column(nullable=True)
    department: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    semester: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    batch_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    profile_photo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    profile_visibility: Mapped[str] = mapped_column(Text, default="public", nullable=False)
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    reputation_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    safety_score: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    def to_dict(self) -> dict[str, Any]:
        name = self.full_name
        dob = self.date_of_birth.isoformat() if self.date_of_birth else ""
        year = self.semester or 1
        return {
            "user_id": str(self.user_id),
            "userId": str(self.user_id),
            "id": str(self.user_id),
            "name": name,
            "username": self.username,
            "mail": self.email,
            "email": self.email,
            "DOB": dob,
            "dateOfBirth": dob,
            "year": year,
            "yearOfStudy": year,
            "department": self.department or "",
            "acronym": initials_for_name(name),
            "initials": initials_for_name(name),
        }


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    token: Mapped[str] = mapped_column(Text, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.user_id"), index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class Friendship(Base):
    __tablename__ = "friendships"
    __table_args__ = (UniqueConstraint("requester_id", "receiver_id", name="uq_friendships_requester_receiver"),)

    friendship_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    requester_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.user_id"), index=True, nullable=False)
    receiver_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.user_id"), index=True, nullable=False)
    status: Mapped[str] = mapped_column(Text, default="accepted", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    @property
    def id(self) -> int:
        return self.friendship_id

    @property
    def follower_id(self) -> str:
        return str(self.requester_id)

    @property
    def following_id(self) -> str:
        return str(self.receiver_id)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.friendship_id,
            "follower_id": str(self.requester_id),
            "followerId": str(self.requester_id),
            "following_id": str(self.receiver_id),
            "followingId": str(self.receiver_id),
            "created_at": self.created_at.isoformat(),
            "createdAt": self.created_at.isoformat(),
        }


UserFriendship = Friendship


class Club(Base):
    __tablename__ = "clubs"

    club_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(Text, unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, default="Open", nullable=False)
    created_by_service: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    @property
    def id(self) -> int:
        return self.club_id

    @property
    def title(self) -> str:
        return self.name

    @title.setter
    def title(self, value: str) -> None:
        self.name = value

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.club_id,
            "title": self.name,
            "slug": self.slug,
            "description": self.description or "",
            "status": self.status or "Open",
            "icon": "groups",
            "iconBg": "bg-primary",
            "bannerBg": "bg-primary-fixed/20",
            "bannerImage": self.logo_url or "",
            "extraMembers": "0",
            "extraMembersClass": "bg-primary-container text-white",
            "avatars": [],
            "statusClass": "text-secondary",
        }


ClubCard = Club


class ClubMember(Base):
    __tablename__ = "club_members"
    __table_args__ = (UniqueConstraint("club_id", "user_id", name="uq_club_members_club_user"),)

    club_member_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    club_id: Mapped[int] = mapped_column(Integer, ForeignKey("clubs.club_id"), index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.user_id"), index=True, nullable=False)
    role: Mapped[str] = mapped_column(Text, default="member", nullable=False)
    can_post: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_publish_event: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_create_announcement: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_manage_members: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[str] = mapped_column(Text, default="active", nullable=False)
    added_by_service: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    @property
    def id(self) -> int:
        return self.club_member_id

    @property
    def title(self) -> str:
        return role_label(self.role)

    @title.setter
    def title(self, value: str) -> None:
        self.role = role_value(value)

    @property
    def created_at(self) -> datetime:
        return self.joined_at


class ClubFollower(Base):
    __tablename__ = "club_followers"

    club_id: Mapped[int] = mapped_column(Integer, ForeignKey("clubs.club_id"), primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.user_id"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    @property
    def id(self) -> str:
        return f"{self.club_id}:{self.user_id}"

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "club_id": self.club_id,
            "clubId": self.club_id,
            "user_id": str(self.user_id),
            "userId": str(self.user_id),
            "created_at": self.created_at.isoformat(),
            "createdAt": self.created_at.isoformat(),
        }


class Post(Base):
    __tablename__ = "posts"

    post_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    author_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.user_id"), index=True, nullable=False)
    club_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("clubs.club_id"), index=True, nullable=True)
    post_type: Mapped[str] = mapped_column(Text, default="normal", nullable=False)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    media_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    media_type: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    original_post_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("posts.post_id"), nullable=True)
    visibility: Mapped[str] = mapped_column(Text, default="public", nullable=False)
    event_title: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    event_start_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    event_end_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    event_location: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    registration_link: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    like_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    comment_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    share_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    bookmark_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    repost_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    report_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    engagement_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    @property
    def type_code(self) -> int:
        return POST_TYPE_TO_CODE.get(self.post_type, 0)

    @property
    def caption(self) -> str:
        return self.content or ""

    @caption.setter
    def caption(self, value: str) -> None:
        self.content = value

    @property
    def likes(self) -> int:
        return self.like_count

    @likes.setter
    def likes(self, value: int) -> None:
        self.like_count = max(int(value), 0)

    @property
    def shares(self) -> int:
        return self.share_count

    @shares.setter
    def shares(self, value: int) -> None:
        self.share_count = max(int(value), 0)

    def to_dict(
        self,
        author_name: Optional[str] = None,
        club_slug: Optional[str] = None,
        media_urls: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        created_at = self.created_at.isoformat()
        caption = self.caption
        hashtags = extract_hashtags(caption)
        title = caption[:72] or "Untitled post"
        media_urls = media_urls if media_urls is not None else ([self.media_url] if self.media_url else [])
        primary_media = media_urls[0] if media_urls else ""
        return {
            "post_id": str(self.post_id),
            "postId": str(self.post_id),
            "id": str(self.post_id),
            "author_id": str(self.author_id),
            "authorId": str(self.author_id),
            "author": author_name or str(self.author_id),
            "club_id": self.club_id,
            "clubId": self.club_id,
            "clubSlug": club_slug,
            "type": self.type_code,
            "postType": self.post_type,
            "media_url": primary_media,
            "mediaUrl": primary_media,
            "media_urls": media_urls,
            "mediaUrls": media_urls,
            "caption": caption,
            "likes": self.like_count,
            "shares": self.share_count,
            "hashtags": hashtags,
            "mentions": extract_mentions(caption),
            "price": None,
            "description": None,
            "created_at": created_at,
            "createdAt": created_at,
            "meta": created_at,
            "title": title,
            "body": caption,
            "image": primary_media,
            "tag": hashtags[0] if hashtags else "#campusnexus",
            "comments": self.comment_count,
            "engagement_score": self.engagement_score or float(self.like_count + self.share_count * 2),
        }


class PostMedia(Base):
    __tablename__ = "post_media"

    media_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(Integer, ForeignKey("posts.post_id", ondelete="CASCADE"), index=True, nullable=False)
    media_url: Mapped[str] = mapped_column(Text, nullable=False)
    media_type: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class PostLike(Base):
    __tablename__ = "post_likes"

    post_id: Mapped[int] = mapped_column(Integer, ForeignKey("posts.post_id"), primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.user_id"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    @property
    def id(self) -> str:
        return f"{self.post_id}:{self.user_id}"

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "post_id": str(self.post_id),
            "postId": str(self.post_id),
            "user_id": str(self.user_id),
            "userId": str(self.user_id),
            "created_at": self.created_at.isoformat(),
            "createdAt": self.created_at.isoformat(),
        }


class Comment(Base):
    __tablename__ = "comments"

    comment_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(Integer, ForeignKey("posts.post_id"), index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.user_id"), index=True, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class Notification(Base):
    __tablename__ = "notifications"

    notification_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.user_id"), index=True, nullable=False)
    actor_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.user_id"), index=True, nullable=False)
    type: Mapped[str] = mapped_column(Text, index=True, nullable=False)
    target_type: Mapped[str] = mapped_column(Text, nullable=False)
    target_id: Mapped[str] = mapped_column(Text, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class MarketplaceItem(Base):
    __tablename__ = "marketplace_items"

    item_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    seller_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.user_id"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    price: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, default="available", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class Game(Base):
    __tablename__ = "games"

    game_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    start_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    @property
    def id(self) -> int:
        return self.game_id

    def to_dict(self) -> dict[str, Any]:
        return {"id": self.game_id, "title": self.name, "image": "", "online": "0", "rating": "0"}


class UserPoint(Base):
    __tablename__ = "user_points"

    point_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.user_id"), index=True, nullable=False)
    game_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("games.game_id"), nullable=True)
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class ChatThread(Base):
    __tablename__ = "chat_threads"

    thread_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    thread_type: Mapped[str] = mapped_column(Text, default="direct", nullable=False)
    club_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("clubs.club_id"), nullable=True)
    marketplace_item_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("marketplace_items.item_id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class ChatParticipant(Base):
    __tablename__ = "chat_participants"

    thread_id: Mapped[int] = mapped_column(Integer, ForeignKey("chat_threads.thread_id"), primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.user_id"), primary_key=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    last_read_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    message_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    thread_id: Mapped[int] = mapped_column(Integer, ForeignKey("chat_threads.thread_id"), index=True, nullable=False)
    sender_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.user_id"), nullable=False)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


@dataclass(frozen=True)
class AdminIdentity:
    user_id: str = "admin"
    username: str = "admin"
    email: str = "admin@cn.nhce"
    full_name: str = "Admin"
    department: str = "CS"
    semester: int = 1

    def to_dict(self) -> dict[str, Any]:
        return {
            "user_id": self.user_id,
            "userId": self.user_id,
            "id": self.user_id,
            "name": self.full_name,
            "username": self.username,
            "mail": self.email,
            "email": self.email,
            "DOB": DEFAULT_ADMIN_USER["DOB"],
            "dateOfBirth": DEFAULT_ADMIN_USER["DOB"],
            "year": self.semester,
            "yearOfStudy": self.semester,
            "department": self.department,
            "acronym": "AD",
            "initials": "AD",
        }


AuthUser = User | AdminIdentity


def build_engine_options(database_url: str) -> dict[str, Any]:
    options: dict[str, Any] = {"pool_pre_ping": True}
    if database_url.startswith("sqlite"):
        options["connect_args"] = {"check_same_thread": False}
        if ":memory:" in database_url:
            options["poolclass"] = StaticPool
    return options


DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)
engine = create_engine(DATABASE_URL, **build_engine_options(DATABASE_URL))
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def db() -> Session:
    session = g.get("db")
    if session is None:
        raise RuntimeError("Database session is not available for this request")
    return session


def ensure_database_initialized() -> None:
    global _database_initialized
    if _database_initialized:
        return
    with _database_lock:
        if _database_initialized:
            return
        Base.metadata.create_all(engine)
        _database_initialized = True


def ensure_app_schema() -> None:
    Base.metadata.create_all(engine)


def ensure_app_indexes() -> None:
    return None


def seed_admin_user(session: Session) -> None:
    return None


def read_json() -> dict[str, Any]:
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def text_value(value: Any, default: str = "") -> str:
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip() or default
    return str(value)


def optional_text(value: Any) -> Optional[str]:
    value = text_value(value)
    return value or None


def optional_int(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def read_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y", "on"}
    return bool(value)


def get_first(data: dict[str, Any], *keys: str, default: Any = None) -> Any:
    for key in keys:
        if key in data:
            return data[key]
    return default


def initials_for_name(name: str) -> str:
    parts = [part for part in re.split(r"\s+", text_value(name)) if part]
    if not parts:
        return "CN"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return "".join(part[0] for part in parts[:2]).upper()


def slugify(value: Any, fallback: str = "club") -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text_value(value).lower()).strip("-")
    return slug or fallback


def normalize_email(value: Any) -> str:
    return text_value(value).lower()


def normalize_username(value: Any) -> Optional[str]:
    username = re.sub(r"[^a-z0-9_.-]", "", text_value(value).lower())
    return username or None


def normalize_login(value: Any) -> str:
    return text_value(value).lower()


def valid_email(value: str) -> bool:
    return "@" in value and "." in value.rsplit("@", 1)[-1]


def edu_email(value: str) -> bool:
    if not valid_email(value):
        return False
    domain = value.rsplit("@", 1)[-1].lower()
    return domain == "edu" or domain.endswith(".edu")


def read_year_of_study(value: Any) -> Optional[int]:
    year = optional_int(value)
    if year is None or year < 1 or year > 8:
        return None
    return year


def parse_date(value: Any) -> Optional[date]:
    raw = text_value(value)
    if not raw:
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError:
        return None


def parse_price(value: Any) -> Optional[float]:
    raw = text_value(value)
    if not raw:
        return None
    cleaned = re.sub(r"[^0-9.]", "", raw)
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def format_price(value: Any) -> str:
    if value is None:
        return ""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return text_value(value)
    return str(int(number)) if number.is_integer() else f"{number:.2f}"


def unique_preserving_order(values: Sequence[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        output.append(value)
    return output


def normalize_hashtag(value: Any) -> Optional[str]:
    tag = text_value(value).lstrip("#")
    return f"#{tag}" if tag else None


def normalize_mention(value: Any) -> Optional[str]:
    mention = text_value(value).lstrip("@")
    return f"@{mention}" if mention else None


def read_string_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [text_value(item) for item in value if text_value(item)]
    if isinstance(value, str):
        return [item.strip() for item in re.split(r"[\s,]+", value) if item.strip()]
    return []


def read_hashtags(value: Any) -> list[str]:
    return [tag for tag in (normalize_hashtag(item) for item in read_string_list(value)) if tag]


def read_mentions(value: Any) -> list[str]:
    return [mention for mention in (normalize_mention(item) for item in read_string_list(value)) if mention]


def extract_hashtags(caption: str) -> list[str]:
    return unique_preserving_order(f"#{match.group(1)}" for match in HASHTAG_RE.finditer(caption))


def extract_mentions(caption: str) -> list[str]:
    return unique_preserving_order(f"@{match.group(1)}" for match in MENTION_RE.finditer(caption))


def media_kind(media_url: str) -> Optional[str]:
    url = media_url.strip().lower().split("?", 1)[0].split("#", 1)[0]
    if not url:
        return None
    if url.startswith("data:image/") or url.endswith(IMAGE_EXTENSIONS):
        return "image"
    if url.startswith("data:video/mp4") or url.endswith(VIDEO_EXTENSIONS):
        return "video"
    return "unknown"


def media_error(media_url: str, post_type_code: int) -> Optional[str]:
    kind = media_kind(media_url)
    if kind is None:
        return None
    if kind == "unknown":
        return "media url must be an image or mp4"
    if post_type_code == 2 and kind != "image":
        return "marketplace posts only allow image media"
    return None


def read_media_urls(data: dict[str, Any]) -> list[str]:
    if "mediaUrls" in data or "media_urls" in data:
        return read_string_list(get_first(data, "mediaUrls", "media_urls"))
    media_url = text_value(get_first(data, "media_url", "mediaUrl", "image"))
    return [media_url] if media_url else []


def post_media_urls(post: Post) -> list[str]:
    # ponytail: per-post lookup is sufficient at current feed size; eager-load if feed volume grows.
    rows = db().scalars(
        select(PostMedia).where(PostMedia.post_id == post.post_id).order_by(PostMedia.sort_order.asc(), PostMedia.media_id.asc())
    ).all()
    return [row.media_url for row in rows] or ([post.media_url] if post.media_url else [])


def replace_post_media(post: Post, media_urls: list[str]) -> None:
    for row in db().scalars(select(PostMedia).where(PostMedia.post_id == post.post_id)).all():
        db().delete(row)
    for index, media_url in enumerate(media_urls):
        db().add(PostMedia(post_id=post.post_id, media_url=media_url, media_type=media_kind(media_url) or "", sort_order=index))
    post.media_url = media_urls[0] if media_urls else None
    post.media_type = media_kind(post.media_url or "")


def post_type_code(value: Any, default: int = 0) -> Optional[int]:
    if value is None or value == "":
        return default
    if isinstance(value, str) and value in POST_TYPE_TO_CODE:
        return POST_TYPE_TO_CODE[value]
    code = optional_int(value)
    return code if code in {0, 1, 2, 3} else None


def role_value(value: Any) -> str:
    role = slugify(value, "member").replace("-", "_")
    if role == "vice_chariman":
        role = "vice_chairman"
    return role if role in CLUB_MEMBER_ROLES else "member"


def role_label(value: Any) -> str:
    return text_value(value, "member").replace("_", " ").title()


def user_pk(value: Any) -> Optional[int]:
    return optional_int(value)


def get_user(user_id: Any) -> Optional[User]:
    pk = user_pk(user_id)
    return db().get(User, pk) if pk is not None else None


def unique_club_slug(value: Any, current_club_id: Optional[int] = None) -> str:
    base_slug = slugify(value)
    candidate = base_slug
    suffix = 2
    while True:
        existing = db().scalar(select(Club).where(Club.slug == candidate))
        if existing is None or existing.club_id == current_club_id:
            return candidate
        candidate = f"{base_slug}-{suffix}"
        suffix += 1


def current_auth_user() -> Optional[AuthUser]:
    token = bearer_token()
    if token is None:
        return None
    if token in _admin_tokens:
        return AdminIdentity()
    session = db().get(AuthSession, token)
    if session is None:
        return None
    return db().get(User, session.user_id)


def bearer_token() -> Optional[str]:
    header = request.headers.get("Authorization", "")
    prefix = "Bearer "
    if header.startswith(prefix):
        return header[len(prefix) :].strip() or None
    return None


def is_admin_user(user: Optional[AuthUser]) -> bool:
    return isinstance(user, AdminIdentity)


def require_admin_user():
    user = current_auth_user()
    if user is None:
        return jsonify({"error": "unauthorized"}), 401
    if not is_admin_user(user):
        return jsonify({"error": "admin access required"}), 403
    return None


def create_auth_session(user: User) -> str:
    token = secrets.token_urlsafe(32)
    db().add(AuthSession(token=token, user_id=user.user_id))
    return token


def create_admin_session() -> str:
    token = secrets.token_urlsafe(32)
    _admin_tokens.add(token)
    return token


def auth_payload(user: AuthUser, token: str) -> dict[str, Any]:
    return {"token": token, "user": user.to_dict()}


def find_auth_user_by_login(login: str) -> Optional[User]:
    return db().scalar(select(User).where((User.email == login) | (User.username == login)))


def admin_login_matches(login: str, password: str) -> bool:
    username = normalize_username(DEFAULT_ADMIN_USER["username"])
    mail = normalize_email(DEFAULT_ADMIN_USER["mail"])
    return login in {username, mail} and password == text_value(DEFAULT_ADMIN_USER["password"])


def serialize_post(post: Post, viewer_user_id: Optional[str] = None) -> dict[str, Any]:
    author = db().get(User, post.author_id)
    club = db().get(Club, post.club_id) if post.club_id is not None else None
    liked_by_current_user = False
    viewer_pk = user_pk(viewer_user_id)
    if viewer_pk is not None:
        liked_by_current_user = post_like_for_user(post.post_id, viewer_pk) is not None
    return {
        **post.to_dict(
            author.full_name if author is not None else None,
            club.slug if club is not None else None,
            post_media_urls(post),
        ),
        "likedByCurrentUser": liked_by_current_user,
        "liked_by_current_user": liked_by_current_user,
        "viewerHasLiked": liked_by_current_user,
    }


def post_like_for_user(post_id: Any, user_id: Any) -> Optional[PostLike]:
    post_pk = optional_int(post_id)
    user_id_pk = optional_int(user_id)
    if post_pk is None or user_id_pk is None:
        return None
    return db().get(PostLike, {"post_id": post_pk, "user_id": user_id_pk})


def resolve_post_author_id(data: dict[str, Any]) -> Optional[int]:
    explicit_author_id = optional_int(get_first(data, "author_id", "authorId"))
    if explicit_author_id is not None:
        return explicit_author_id
    current_user = current_auth_user()
    if isinstance(current_user, User):
        return current_user.user_id
    username = normalize_username(data.get("author"))
    if username:
        user = db().scalar(select(User).where(User.username == username))
        if user is not None:
            return user.user_id
    return None


def resolve_post_club_id(data: dict[str, Any]) -> Optional[int]:
    explicit_club_id = optional_int(get_first(data, "club_id", "clubId"))
    if explicit_club_id is not None:
        return explicit_club_id
    club_slug = optional_text(get_first(data, "clubSlug", "club_slug"))
    if club_slug is None:
        return None
    club = db().scalar(select(Club).where(Club.slug == slugify(club_slug)))
    return club.club_id if club is not None else None


def post_caption_from_data(data: dict[str, Any]) -> str:
    return text_value(get_first(data, "caption", "body", "title"))


def make_post(data: dict[str, Any]) -> Post:
    caption = post_caption_from_data(data)
    explicit_hashtags = read_hashtags(get_first(data, "hashtags", "tag"))
    explicit_mentions = read_mentions(get_first(data, "mentions", "taggedPeople", "tagged_people"))
    tags = unique_preserving_order([*explicit_hashtags, *extract_hashtags(caption)])
    mentions = unique_preserving_order([*explicit_mentions, *extract_mentions(caption)])
    decorated_caption = " ".join([caption, *tags, *mentions]).strip()
    media_urls = read_media_urls(data)
    media_url = media_urls[0] if media_urls else ""
    code = post_type_code(get_first(data, "type", "postType", "post_type"), default=0) or 0
    return Post(
        author_id=resolve_post_author_id(data) or 0,
        club_id=resolve_post_club_id(data),
        post_type=CODE_TO_POST_TYPE[code],
        content=decorated_caption,
        media_url=media_url,
        media_type=media_kind(media_url),
        like_count=optional_int(data.get("likes")) or 0,
        share_count=optional_int(data.get("shares")) or 0,
    )


def validate_post(post: Post, media_urls: Optional[list[str]] = None):
    if db().get(User, post.author_id) is None:
        return jsonify({"error": "author_id must reference an existing user"}), 400
    if post.post_type in CLUB_POST_TYPES:
        if post.club_id is None or db().get(Club, post.club_id) is None:
            return jsonify({"error": "club_id or clubSlug must reference an existing club"}), 400
        actor = current_auth_user()
        if not isinstance(actor, User):
            return jsonify({"error": "unauthorized"}), 401
        if actor.user_id != post.author_id:
            return jsonify({"error": "club post author must match the authenticated user"}), 403
        if not can_publish_club_content(post.club_id, post.author_id):
            return jsonify({"error": "club posts and announcements require a president, chairman, or secretary role"}), 403
    else:
        post.club_id = None
    media_urls = media_urls if media_urls is not None else post_media_urls(post)
    for media_url in media_urls:
        error = media_error(media_url, post.type_code)
        if error is not None:
            return jsonify({"error": error}), 400
    if post.post_type == "announcement" and (len(media_urls) != 1 or media_kind(media_urls[0]) != "image"):
        return jsonify({"error": "announcements require exactly one poster image"}), 400
    return None


def create_post_from_payload(data: dict[str, Any]):
    code = post_type_code(get_first(data, "type", "postType", "post_type"), default=0)
    if code is None:
        return jsonify({"error": "type must be 0, 1, 2, or 3"}), 400
    if code == 2:
        return create_marketplace_item_from_payload(data)
    post = make_post({**data, "type": code})
    media_urls = read_media_urls(data)
    validation_error = validate_post(post, media_urls)
    if validation_error is not None:
        return validation_error
    post.engagement_score = float(post.like_count + post.share_count * 2)
    db().add(post)
    db().flush()
    replace_post_media(post, media_urls)
    notify_new_post(post)
    db().commit()
    db().refresh(post)
    return jsonify(serialize_post(post)), 201


def update_post_from_payload(post: Post, data: dict[str, Any]):
    code = post_type_code(get_first(data, "type", "postType", "post_type"), default=post.type_code)
    if code is None or code == 2:
        return jsonify({"error": "type must be 0, 1, or 3 for feed posts"}), 400
    post.post_type = CODE_TO_POST_TYPE[code]
    if "author_id" in data or "authorId" in data:
        author_id = optional_int(get_first(data, "author_id", "authorId"))
        if author_id is not None:
            post.author_id = author_id
    if "club_id" in data or "clubId" in data or "clubSlug" in data or "club_slug" in data:
        post.club_id = resolve_post_club_id(data)
    media_changed = any(key in data for key in ("media_url", "mediaUrl", "media_urls", "mediaUrls", "image"))
    media_urls = read_media_urls(data) if media_changed else post_media_urls(post)
    if media_changed:
        post.media_url = media_urls[0] if media_urls else None
        post.media_type = media_kind(post.media_url or "")
    if any(key in data for key in ("caption", "body", "title", "hashtags", "tag", "mentions", "taggedPeople", "tagged_people")):
        post.content = make_post({**post.to_dict(), **data, "author_id": post.author_id}).content
    if "likes" in data:
        post.like_count = max(optional_int(data.get("likes")) or 0, 0)
    if "shares" in data:
        post.share_count = max(optional_int(data.get("shares")) or 0, 0)
    post.engagement_score = float(post.like_count + post.share_count * 2)
    validation_error = validate_post(post, media_urls)
    if validation_error is not None:
        return validation_error
    if media_changed:
        replace_post_media(post, media_urls)
    db().commit()
    db().refresh(post)
    return jsonify(serialize_post(post))


def club_by_slug(slug: str) -> Optional[Club]:
    return db().scalar(select(Club).where(Club.slug == slugify(slug)))


def make_club_card(data: dict[str, Any]) -> Club:
    title = text_value(get_first(data, "title", "name"))
    return Club(
        name=title,
        slug=unique_club_slug(get_first(data, "slug", default=title)),
        description=text_value(data.get("description")),
        logo_url=text_value(get_first(data, "bannerImage", "banner_image", "logo_url", "image")),
        status=text_value(data.get("status"), "Open"),
        created_by_service="admin",
    )


def serialize_club_member(member: ClubMember) -> dict[str, Any]:
    user = db().get(User, member.user_id)
    name = user.full_name if user is not None else str(member.user_id)
    return {
        "id": member.club_member_id,
        "club_id": member.club_id,
        "clubId": member.club_id,
        "user_id": str(member.user_id),
        "userId": str(member.user_id),
        "title": member.title,
        "created_at": member.joined_at.isoformat(),
        "createdAt": member.joined_at.isoformat(),
        "user": user.to_dict() if user is not None else None,
        "name": name,
        "username": user.username if user is not None else "",
        "mail": user.email if user is not None else "",
        "initials": initials_for_name(name),
    }


def club_members_for_club(club: Club) -> list[ClubMember]:
    return db().scalars(
        select(ClubMember).where((ClubMember.club_id == club.club_id) & (ClubMember.status == "active")).order_by(ClubMember.club_member_id.asc())
    ).all()


def club_member_role_error(club: Club, role: str, member_id: Optional[int] = None) -> Optional[str]:
    if role not in SINGLE_CLUB_MEMBER_ROLES:
        return None
    query = select(ClubMember).where(
        (ClubMember.club_id == club.club_id)
        & (ClubMember.status == "active")
        & (ClubMember.role == role)
    )
    if member_id is not None:
        query = query.where(ClubMember.club_member_id != member_id)
    return f"{role_label(role)} is already assigned" if db().scalar(query) is not None else None


def is_club_president(club: Club, user: Optional[AuthUser]) -> bool:
    return isinstance(user, User) and db().scalar(
        select(ClubMember).where(
            (ClubMember.club_id == club.club_id)
            & (ClubMember.user_id == user.user_id)
            & (ClubMember.status == "active")
            & (ClubMember.role == "president")
        )
    ) is not None


def can_add_club_member(club: Club, user: Optional[AuthUser], role: str) -> bool:
    return is_admin_user(user) or (role == "member" and is_club_president(club, user))


def can_remove_club_member(club: Club, user: Optional[AuthUser], member: ClubMember) -> bool:
    return is_admin_user(user) or (member.role == "member" and is_club_president(club, user))


def club_posts_for_club(club: Club) -> list[Post]:
    return db().scalars(
        select(Post)
        .where((Post.club_id == club.club_id) & (Post.post_type.in_(CLUB_POST_TYPES)) & (Post.is_deleted.is_(False)))
        .order_by(Post.created_at.desc(), Post.post_id.asc())
    ).all()


def club_posts_count(club: Club) -> int:
    return len(club_posts_for_club(club))


def club_followers_count(club: Club) -> int:
    count = db().scalar(select(func.count()).select_from(ClubFollower).where(ClubFollower.club_id == club.club_id))
    return int(count or 0)


def club_follow_for_user(club: Club, user_id: Any) -> Optional[ClubFollower]:
    pk = user_pk(user_id)
    if pk is None:
        return None
    return db().get(ClubFollower, {"club_id": club.club_id, "user_id": pk})


def club_follow_payload(club: Club, user: User) -> dict[str, Any]:
    follower = club_follow_for_user(club, user.user_id)
    return {
        "club_id": club.club_id,
        "clubId": club.club_id,
        "clubSlug": club.slug,
        "user_id": str(user.user_id),
        "userId": str(user.user_id),
        "isFollowing": follower is not None,
        "followers": club_followers_count(club),
        "postsCount": club_posts_count(club),
        "follow": follower.to_dict() if follower is not None else None,
    }


def serialize_club_detail(club: Club) -> dict[str, Any]:
    posts = club_posts_for_club(club)
    followers = club_followers_count(club)
    viewer = current_auth_user()
    viewer_user_id = str(viewer.user_id) if isinstance(viewer, User) else None
    return {
        "club": {**club.to_dict(), "followers": followers, "postsCount": len(posts)},
        "members": [serialize_club_member(member) for member in club_members_for_club(club)],
        "posts": [serialize_post(post, viewer_user_id) for post in posts],
        "followers": followers,
        "postsCount": len(posts),
    }


def is_club_member(club_id: int, user_id: Any) -> bool:
    pk = user_pk(user_id)
    if pk is None:
        return False
    return (
        db().scalar(
            select(ClubMember).where(
                (ClubMember.club_id == club_id)
                & (ClubMember.user_id == pk)
                & (ClubMember.status == "active")
            )
        )
        is not None
    )


def can_publish_club_content(club_id: int, user_id: Any) -> bool:
    pk = user_pk(user_id)
    return pk is not None and db().scalar(
        select(ClubMember).where(
            (ClubMember.club_id == club_id)
            & (ClubMember.user_id == pk)
            & (ClubMember.status == "active")
            & (ClubMember.role.in_(CLUB_PUBLISHER_ROLES))
        )
    ) is not None


def resolve_member_user(data: dict[str, Any]) -> Optional[User]:
    user_id = optional_int(get_first(data, "user_id", "userId"))
    if user_id is not None:
        return db().get(User, user_id)
    username = normalize_username(data.get("username"))
    if username:
        return db().scalar(select(User).where(User.username == username))
    mail = normalize_email(get_first(data, "mail", "email"))
    if mail:
        return db().scalar(select(User).where(User.email == mail))
    return None


def create_club_member_resource(club: Club, actor: Optional[AuthUser]):
    data = read_json()
    user = resolve_member_user(data)
    if user is None:
        return jsonify({"error": "user_id, username, or mail must reference an existing user"}), 400
    role = role_value(data.get("title") or data.get("role"))
    if not can_add_club_member(club, actor, role):
        return jsonify({"error": "admin or club president access required"}), 403
    existing = db().scalar(select(ClubMember).where((ClubMember.club_id == club.club_id) & (ClubMember.user_id == user.user_id)))
    if existing is not None:
        return jsonify({"error": "user is already a club member"}), 409
    role_error = club_member_role_error(club, role)
    if role_error is not None:
        return jsonify({"error": role_error}), 409
    member = ClubMember(
        club_id=club.club_id,
        user_id=user.user_id,
        role=role,
        can_post=role in CLUB_PUBLISHER_ROLES,
        can_create_announcement=role in CLUB_PUBLISHER_ROLES,
        added_by_service="admin",
    )
    db().add(member)
    db().commit()
    db().refresh(member)
    return jsonify(serialize_club_member(member)), 201


def search_user_payload(user: User) -> dict[str, Any]:
    return {
        "type": "user",
        "id": str(user.user_id),
        "title": user.full_name,
        "subtitle": f"@{user.username}",
        "href": f"/{user.user_id}",
        "icon": "person",
        "initials": initials_for_name(user.full_name),
        "user_id": str(user.user_id),
        "userId": str(user.user_id),
        "username": user.username,
    }


def search_club_payload(club: Club) -> dict[str, Any]:
    return {
        "type": "club",
        "id": club.club_id,
        "title": club.name,
        "subtitle": club.status or "Club",
        "href": f"/clubs/{club.slug}",
        "icon": "groups",
        "slug": club.slug,
    }


def search_post_payload(post: Post) -> dict[str, Any]:
    author = db().get(User, post.author_id)
    return {
        "type": "post",
        "id": str(post.post_id),
        "title": post.caption[:72] or "Untitled post",
        "subtitle": author.full_name if author is not None else "Post",
        "href": f"/#{post.post_id}",
        "icon": "article",
        "post_id": str(post.post_id),
        "postId": str(post.post_id),
    }


def search_marketplace_payload(item: MarketplaceItem) -> dict[str, Any]:
    payload = serialize_marketplace_item(item)
    return {
        "type": "product",
        "id": payload["id"],
        "title": payload["title"],
        "subtitle": payload["price"] or payload["owner"],
        "href": f"/marketplace#{payload['post_id']}",
        "icon": "storefront",
        "post_id": payload["post_id"],
        "postId": payload["post_id"],
    }


def search_results(query: str, limit: int, types: Optional[set[str]] = None) -> dict[str, Any]:
    normalized = query.lower()
    requested = {value for value in (types or {"user", "club", "post", "product"}) if value}
    users = (
        db().scalars(
            select(User)
            .where((func.lower(User.username).contains(normalized)) | (func.lower(User.full_name).contains(normalized)))
            .order_by(User.username.asc())
            .limit(limit)
        ).all()
        if "user" in requested
        else []
    )
    clubs = (
        db().scalars(
            select(Club)
            .where((func.lower(Club.name).contains(normalized)) | (func.lower(Club.slug).contains(normalized)))
            .order_by(Club.name.asc())
            .limit(limit)
        ).all()
        if "club" in requested
        else []
    )
    posts = (
        db().scalars(
            select(Post)
            .where((Post.is_deleted.is_(False)) & func.lower(func.coalesce(Post.content, "")).contains(normalized))
            .order_by(Post.created_at.desc(), Post.post_id.asc())
            .limit(limit)
        ).all()
        if "post" in requested
        else []
    )
    products = (
        db().scalars(
            select(MarketplaceItem)
            .where(
                (MarketplaceItem.status != "removed")
                & (
                    func.lower(func.coalesce(MarketplaceItem.title, "")).contains(normalized)
                    | func.lower(func.coalesce(MarketplaceItem.description, "")).contains(normalized)
                )
            )
            .order_by(MarketplaceItem.created_at.desc(), MarketplaceItem.item_id.asc())
            .limit(limit)
        ).all()
        if "product" in requested
        else []
    )
    return {
        "query": query,
        "users": [search_user_payload(user) for user in users],
        "clubs": [search_club_payload(club) for club in clubs],
        "posts": [search_post_payload(post) for post in posts],
        "products": [search_marketplace_payload(item) for item in products],
    }


def feed_viewer_user_id() -> Optional[str]:
    current_user = current_auth_user()
    if isinstance(current_user, User):
        return str(current_user.user_id)
    requested_user_id = optional_int(request.args.get("user_id") or request.args.get("userId"))
    if requested_user_id is None:
        return None
    return str(requested_user_id) if db().get(User, requested_user_id) is not None else None


def feed_limit() -> Optional[int]:
    limit = optional_int(request.args.get("limit"))
    return max(1, min(limit, 100)) if limit is not None else None


def ranked_feed_cards(viewer_user_id: Optional[str], limit: Optional[int]) -> list[dict[str, Any]]:
    users = db().scalars(select(User).where(User.is_active.is_(True)).order_by(User.user_id.asc())).all()
    clubs = db().scalars(select(Club).where(Club.is_active.is_(True)).order_by(Club.club_id.asc())).all()
    memberships = db().scalars(select(ClubMember).where(ClubMember.status == "active").order_by(ClubMember.club_member_id.asc())).all()
    friendships = db().scalars(select(Friendship).where(Friendship.status == "accepted").order_by(Friendship.friendship_id.asc())).all()
    posts = db().scalars(
        select(Post)
        .where(Post.is_deleted.is_(False))
        .order_by(Post.created_at.desc(), Post.post_id.asc())
    ).all()
    return rank_feed_posts(
        users=[{"user_id": str(user.user_id)} for user in users],
        clubs=[{"id": club.club_id} for club in clubs],
        club_memberships=[(member.club_id, str(member.user_id)) for member in memberships],
        friendships=[(str(friendship.requester_id), str(friendship.receiver_id)) for friendship in friendships],
        posts=[serialize_post(post, viewer_user_id) for post in posts],
        viewer_user_id=viewer_user_id,
        admin_user_ids=set(),
        limit=limit,
    )


def friendship_between(follower_id: Any, following_id: Any) -> Optional[Friendship]:
    follower = user_pk(follower_id)
    following = user_pk(following_id)
    if follower is None or following is None:
        return None
    return db().scalar(
        select(Friendship).where(
            (Friendship.requester_id == follower)
            & (Friendship.receiver_id == following)
            & (Friendship.status == "accepted")
        )
    )


def friendship_counts(user_id: Any) -> dict[str, int]:
    pk = user_pk(user_id)
    if pk is None:
        return {"followers": 0, "following": 0}
    followers = db().scalar(select(func.count()).select_from(Friendship).where((Friendship.receiver_id == pk) & (Friendship.status == "accepted")))
    following = db().scalar(select(func.count()).select_from(Friendship).where((Friendship.requester_id == pk) & (Friendship.status == "accepted")))
    return {"followers": int(followers or 0), "following": int(following or 0)}


def friendship_user_payload(user: User, friendship: Friendship) -> dict[str, Any]:
    return {
        "user_id": str(user.user_id),
        "userId": str(user.user_id),
        "id": str(user.user_id),
        "name": user.full_name,
        "username": user.username,
        "acronym": initials_for_name(user.full_name),
        "initials": initials_for_name(user.full_name),
        "friendship_id": friendship.friendship_id,
        "friendshipId": friendship.friendship_id,
        "created_at": friendship.created_at.isoformat(),
        "createdAt": friendship.created_at.isoformat(),
    }


def friendship_list_rows(user_id: Any, list_name: str, limit: Optional[int] = None, offset: int = 0):
    pk = user_pk(user_id)
    if pk is None:
        return [], 0
    if list_name == "followers":
        total = db().scalar(select(func.count()).select_from(Friendship).where((Friendship.receiver_id == pk) & (Friendship.status == "accepted")))
        statement = select(User, Friendship).join(Friendship, Friendship.requester_id == User.user_id).where((Friendship.receiver_id == pk) & (Friendship.status == "accepted"))
    else:
        total = db().scalar(select(func.count()).select_from(Friendship).where((Friendship.requester_id == pk) & (Friendship.status == "accepted")))
        statement = select(User, Friendship).join(Friendship, Friendship.receiver_id == User.user_id).where((Friendship.requester_id == pk) & (Friendship.status == "accepted"))
    statement = statement.order_by(Friendship.created_at.desc(), User.username.asc()).offset(max(offset, 0))
    if limit is not None:
        statement = statement.limit(limit)
    return db().execute(statement).all(), int(total or 0)


def friendship_list_payload(user_id: Any, list_name: str, limit: int = 50, offset: int = 0) -> dict[str, Any]:
    rows, total = friendship_list_rows(user_id, list_name, limit, offset)
    return {"items": [friendship_user_payload(user, friendship) for user, friendship in rows], "total": total, "limit": limit, "offset": max(offset, 0)}


def friendship_lists(user_id: Any) -> dict[str, list[dict[str, Any]]]:
    followers, _ = friendship_list_rows(user_id, "followers")
    following, _ = friendship_list_rows(user_id, "following")
    return {
        "followersList": [friendship_user_payload(user, friendship) for user, friendship in followers],
        "followingList": [friendship_user_payload(user, friendship) for user, friendship in following],
    }


def friendship_status_payload(current_user: User, target_user: User, include_lists: bool = False) -> dict[str, Any]:
    friendship = friendship_between(current_user.user_id, target_user.user_id)
    payload = {
        "isFollowing": friendship is not None,
        "isSelf": current_user.user_id == target_user.user_id,
        "follower_id": str(current_user.user_id),
        "followerId": str(current_user.user_id),
        "following_id": str(target_user.user_id),
        "followingId": str(target_user.user_id),
        **friendship_counts(target_user.user_id),
        "friendship": friendship.to_dict() if friendship is not None else None,
    }
    if include_lists:
        payload.update(friendship_lists(target_user.user_id))
    return payload


def user_values(data: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": text_value(data.get("name")),
        "username": normalize_username(data.get("username")),
        "mail": normalize_email(get_first(data, "mail", "email")),
        "dob": parse_date(get_first(data, "DOB", "dob", "dateOfBirth", "date_of_birth")),
        "year": read_year_of_study(get_first(data, "year", "yearOfStudy", "year_of_study")),
        "department": text_value(data.get("department")),
    }


def validate_user_values(values: dict[str, Any]) -> Optional[str]:
    if not values["name"]:
        return "name is required"
    if not values["username"]:
        return "username is required"
    if not values["mail"] or not valid_email(values["mail"]):
        return "valid mail is required"
    if not edu_email(values["mail"]):
        return "mail must use a .edu domain"
    if values["dob"] is None:
        return "DOB is required"
    if values["year"] is None:
        return "year is required"
    if not values["department"]:
        return "department is required"
    return None


def validate_unique_user(username: str, mail: str, current_user_id: Optional[int] = None):
    existing_username = db().scalar(select(User).where(User.username == username))
    if existing_username is not None and existing_username.user_id != current_user_id:
        return jsonify({"error": "username already exists"}), 409
    existing_mail = db().scalar(select(User).where(User.email == mail))
    if existing_mail is not None and existing_mail.user_id != current_user_id:
        return jsonify({"error": "mail already exists"}), 409
    return None


def create_user_from_payload(data: dict[str, Any], require_password: bool = False):
    values = user_values(data)
    validation_error = validate_user_values(values)
    if validation_error is not None:
        return None, jsonify({"error": validation_error}), 400
    unique_error = validate_unique_user(values["username"], values["mail"])
    if unique_error is not None:
        return None, *unique_error
    password = text_value(data.get("password"))
    if require_password and len(password) < 6:
        return None, jsonify({"error": "password must be at least 6 characters"}), 400
    user = User(
        full_name=values["name"],
        username=values["username"],
        email=values["mail"],
        date_of_birth=values["dob"],
        semester=values["year"],
        department=values["department"],
        password_hash=generate_password_hash(password or secrets.token_urlsafe(32)),
    )
    return user, None, None


def update_user_from_payload(user: User, data: dict[str, Any]):
    values = user_values(
        {
            "name": get_first(data, "name", default=user.full_name),
            "username": get_first(data, "username", default=user.username),
            "mail": get_first(data, "mail", "email", default=user.email),
            "DOB": get_first(data, "DOB", "dob", "dateOfBirth", "date_of_birth", default=user.date_of_birth.isoformat() if user.date_of_birth else ""),
            "year": get_first(data, "year", "yearOfStudy", "year_of_study", default=user.semester),
            "department": get_first(data, "department", default=user.department),
        }
    )
    validation_error = validate_user_values(values)
    if validation_error is not None:
        return jsonify({"error": validation_error}), 400
    unique_error = validate_unique_user(values["username"], values["mail"], current_user_id=user.user_id)
    if unique_error is not None:
        return unique_error
    if "password" in data:
        password = text_value(data.get("password"))
        if len(password) < 6:
            return jsonify({"error": "password must be at least 6 characters"}), 400
        user.password_hash = generate_password_hash(password)
    user.full_name = values["name"]
    user.username = values["username"]
    user.email = values["mail"]
    user.date_of_birth = values["dob"]
    user.semester = values["year"]
    user.department = values["department"]
    return None


def require_post_owner_or_admin(post: Post):
    user = current_auth_user()
    if user is None:
        return jsonify({"error": "unauthorized"}), 401
    if isinstance(user, User) and post.author_id == user.user_id:
        return None
    if is_admin_user(user):
        return None
    return jsonify({"error": "only the post author can delete this post"}), 403


def post_like_payload(post: Post, user: User) -> dict[str, Any]:
    liked = post_like_for_user(post.post_id, user.user_id) is not None
    return {
        "post": serialize_post(post, str(user.user_id)),
        "post_id": str(post.post_id),
        "postId": str(post.post_id),
        "likes": post.like_count,
        "liked": liked,
        "likedByCurrentUser": liked,
    }


def comment_payload(comment: Comment) -> dict[str, Any]:
    user = db().get(User, comment.user_id)
    name = user.full_name if user is not None else str(comment.user_id)
    created_at = comment.created_at.isoformat()
    return {
        "id": str(comment.comment_id),
        "comment_id": str(comment.comment_id),
        "commentId": str(comment.comment_id),
        "post_id": str(comment.post_id),
        "postId": str(comment.post_id),
        "user_id": str(comment.user_id),
        "userId": str(comment.user_id),
        "author": name,
        "username": user.username if user is not None else "",
        "initials": initials_for_name(name),
        "content": comment.content,
        "body": comment.content,
        "created_at": created_at,
        "createdAt": created_at,
    }


def compact_text(value: str, fallback: str = "View the latest campus activity.") -> str:
    text = re.sub(r"\s+", " ", text_value(value)).strip()
    if not text:
        return fallback
    return text if len(text) <= 140 else f"{text[:137].rstrip()}..."


def relative_time(value: datetime) -> str:
    elapsed_seconds = max(0, int((utcnow() - value).total_seconds()))
    if elapsed_seconds < 60:
        return "Just now"
    elapsed_minutes = elapsed_seconds // 60
    if elapsed_minutes < 60:
        return f"{elapsed_minutes}m ago"
    elapsed_hours = elapsed_minutes // 60
    if elapsed_hours < 24:
        return f"{elapsed_hours}h ago"
    elapsed_days = elapsed_hours // 24
    if elapsed_days < 30:
        return f"{elapsed_days}d ago"
    elapsed_months = elapsed_days // 30
    if elapsed_months < 12:
        return f"{elapsed_months}mo ago"
    return f"{elapsed_days // 365}y ago"


def add_notification(
    user_id: int,
    actor_id: int,
    notification_type: str,
    target_type: str,
    target_id: Any,
    message: str,
) -> None:
    if user_id == actor_id:
        return
    if db().get(User, user_id) is None or db().get(User, actor_id) is None:
        return
    db().add(
        Notification(
            user_id=user_id,
            actor_id=actor_id,
            type=notification_type,
            target_type=target_type,
            target_id=text_value(target_id),
            message=compact_text(message),
        )
    )


def add_notifications_for_users(
    user_ids: Sequence[int],
    actor_id: int,
    notification_type: str,
    target_type: str,
    target_id: Any,
    message: str,
) -> None:
    seen: set[int] = set()
    for user_id in user_ids:
        if user_id in seen:
            continue
        seen.add(user_id)
        add_notification(user_id, actor_id, notification_type, target_type, target_id, message)


def follower_user_ids_for_author(author_id: int) -> list[int]:
    return list(
        db().scalars(
            select(Friendship.requester_id).where(
                (Friendship.receiver_id == author_id) & (Friendship.status == "accepted")
            )
        ).all()
    )


def club_audience_user_ids(club_id: int) -> list[int]:
    follower_ids = db().scalars(select(ClubFollower.user_id).where(ClubFollower.club_id == club_id)).all()
    member_ids = db().scalars(
        select(ClubMember.user_id).where((ClubMember.club_id == club_id) & (ClubMember.status == "active"))
    ).all()
    return [*follower_ids, *member_ids]


def notify_new_post(post: Post) -> None:
    author = db().get(User, post.author_id)
    if author is None:
        return
    if post.post_type in CLUB_POST_TYPES and post.club_id is not None:
        club = db().get(Club, post.club_id)
        club_name = club.name if club is not None else "a club"
        add_notifications_for_users(
            club_audience_user_ids(post.club_id),
            post.author_id,
            "club_post",
            "post",
            post.post_id,
            f"{author.full_name} posted in {club_name}: {post.content or 'View the club update.'}",
        )
        return
    add_notifications_for_users(
        follower_user_ids_for_author(post.author_id),
        post.author_id,
        "friend_post",
        "post",
        post.post_id,
        f"{author.full_name} shared a new post: {post.content or 'View the post.'}",
    )


def notification_href(notification: Notification, actor: Optional[User], post: Optional[Post], club: Optional[Club]) -> str:
    if notification.type == "friend_request":
        return f"/{actor.username}" if actor is not None else "/"
    if notification.type == "club_post" and club is not None:
        return f"/clubs/{club.slug}#{notification.target_id}"
    return f"/#{notification.target_id}" if notification.target_id else "/"


def notification_title(notification: Notification, actor: Optional[User], post: Optional[Post], club: Optional[Club]) -> str:
    actor_name = actor.full_name if actor is not None else "Someone"
    if notification.type == "friend_request":
        return f"{actor_name} followed you"
    if notification.type == "friend_post":
        return f"{actor_name} shared a post"
    if notification.type == "club_post":
        return f"New post in {club.name if club is not None else 'your club'}"
    if notification.type == "post_like":
        return f"{actor_name} liked your post"
    if notification.type == "post_comment":
        return f"{actor_name} commented on your post"
    return "Campus notification"


def notification_body(notification: Notification, post: Optional[Post]) -> str:
    if notification.type in {"post_like", "post_comment"} and post is not None:
        return compact_text(notification.message or post.content or "Open the post to view the activity.")
    return compact_text(notification.message)


def serialize_notification(notification: Notification) -> dict[str, Any]:
    actor = db().get(User, notification.actor_id)
    post = db().get(Post, optional_int(notification.target_id)) if notification.target_type == "post" else None
    club = db().get(Club, post.club_id) if post is not None and post.club_id is not None else None
    source = "club" if notification.type == "club_post" else "friend"
    actor_name = actor.full_name if actor is not None else "Campus Nexus"
    return {
        "id": str(notification.notification_id),
        "notification_id": str(notification.notification_id),
        "notificationId": str(notification.notification_id),
        "type": notification.type,
        "source": source,
        "title": notification_title(notification, actor, post, club),
        "body": notification_body(notification, post),
        "time": relative_time(notification.created_at),
        "createdAt": notification.created_at.isoformat(),
        "href": notification_href(notification, actor, post, club),
        "actionLabel": "View profile" if notification.type == "friend_request" else "View post",
        "iconText": initials_for_name(actor_name),
        "iconName": "groups" if source == "club" else {"post_like": "favorite", "post_comment": "chat_bubble", "friend_post": "post_add"}.get(notification.type, "person"),
        "isRead": notification.is_read,
        "unread": not notification.is_read,
    }


def create_marketplace_item_from_payload(data: dict[str, Any]):
    user = current_auth_user()
    if not isinstance(user, User):
        return jsonify({"error": "unauthorized"}), 401
    item = MarketplaceItem(
        seller_id=user.user_id,
        title=text_value(get_first(data, "title", "itemName", "caption"), "Marketplace listing"),
        description=text_value(data.get("description")),
        category=text_value(data.get("category"), "Marketplace"),
        price=parse_price(data.get("price")),
        image_url=text_value(get_first(data, "image", "photoUrl", "mediaUrl", "media_url")),
    )
    if not item.title:
        return jsonify({"error": "title is required"}), 400
    db().add(item)
    db().commit()
    db().refresh(item)
    return jsonify(serialize_marketplace_item(item)), 201


def marketplace_posts() -> list[MarketplaceItem]:
    return db().scalars(
        select(MarketplaceItem)
        .where(MarketplaceItem.status != "removed")
        .order_by(MarketplaceItem.created_at.desc(), MarketplaceItem.item_id.asc())
    ).all()


def serialize_marketplace_item(item: MarketplaceItem) -> dict[str, Any]:
    user = db().get(User, item.seller_id)
    created_at = item.created_at.isoformat()
    return {
        "id": str(item.item_id),
        "post_id": str(item.item_id),
        "postId": str(item.item_id),
        "title": item.title,
        "owner": user.full_name if user is not None else str(item.seller_id),
        "mode": "Sell",
        "category": item.category or "Marketplace",
        "condition": "",
        "price": format_price(item.price),
        "location": "",
        "description": item.description or "",
        "image": item.image_url or "",
        "tags": [],
        "contact": user.email if user is not None else "",
        "preferredExchange": "",
        "createdAt": created_at,
    }


def leaderboard_entries() -> list[dict[str, Any]]:
    rows = db().execute(
        select(User, func.coalesce(func.sum(UserPoint.points), 0).label("total_xp"))
        .join(UserPoint, UserPoint.user_id == User.user_id)
        .group_by(User.user_id)
        .having(func.sum(UserPoint.points) > 0)
        .order_by(func.sum(UserPoint.points).desc(), User.username.asc())
    ).all()
    entries: list[dict[str, Any]] = []
    for index, (user, total_xp) in enumerate(rows, start=1):
        entries.append(
            {
                "rank": index,
                "user_id": str(user.user_id),
                "userId": str(user.user_id),
                "id": str(user.user_id),
                "name": user.full_name,
                "username": user.username,
                "acronym": initials_for_name(user.full_name),
                "initials": initials_for_name(user.full_name),
                "total_xp": int(total_xp or 0),
                "totalXp": int(total_xp or 0),
            }
        )
    return entries


def award_user_xp(user: User, xp: int) -> int:
    db().add(UserPoint(user_id=user.user_id, points=xp, reason="game_xp"))
    db().commit()
    total = db().scalar(select(func.coalesce(func.sum(UserPoint.points), 0)).where(UserPoint.user_id == user.user_id))
    return int(total or 0)


def serialize_conversations() -> list[dict[str, Any]]:
    threads = db().scalars(select(ChatThread).order_by(ChatThread.created_at.desc(), ChatThread.thread_id.asc())).all()
    return [
        {
            "id": thread.thread_id,
            "name": f"{thread.thread_type.title()} Chat",
            "preview": "",
            "time": thread.created_at.isoformat(),
            "active": index == 0,
        }
        for index, thread in enumerate(threads)
    ]


def serialize_messages() -> list[dict[str, Any]]:
    messages = db().scalars(select(ChatMessage).where(ChatMessage.is_deleted.is_(False)).order_by(ChatMessage.created_at.asc(), ChatMessage.message_id.asc())).all()
    current_user = current_auth_user()
    current_user_id = current_user.user_id if isinstance(current_user, User) else None
    return [
        {
            "id": message.message_id,
            "side": "right" if current_user_id is not None and message.sender_id == current_user_id else "left",
            "text": message.content or "",
            "time": message.created_at.isoformat(),
            "status": None,
        }
        for message in messages
    ]


def profile_payload(user: User) -> dict[str, Any]:
    return {"avatar": user.profile_photo_url or PROFILE_AVATAR, "major": user.department or "", "bio": user.bio or ""}


def profile_user(identifier: str) -> Optional[User]:
    pk = optional_int(identifier)
    if pk is not None:
        user = db().get(User, pk)
        if user is not None:
            return user
    username = normalize_username(identifier)
    return db().scalar(select(User).where(User.username == username)) if username else None


def empty_resource_collection() -> list[dict[str, Any]]:
    return []


@app.before_request
def handle_options():
    if request.method == "OPTIONS":
        return ("", 204)
    return None


@app.before_request
def prepare_database_session():
    if request.path == "/health":
        return None
    ensure_database_initialized()
    g.db = SessionLocal()
    return None


@app.teardown_request
def close_database_session(error):
    session = g.pop("db", None)
    if session is None:
        return
    if error is not None:
        session.rollback()
    session.close()


@app.errorhandler(SQLAlchemyError)
def handle_database_error(error):
    session = g.get("db")
    if session is not None:
        session.rollback()
    return jsonify({"error": "database error"}), 500


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = os.getenv("CORS_ORIGIN", "*")
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    return response


@app.route("/health")
def health():
    return jsonify({"ok": True, "service": "campus-nexus-backend"})


@app.route("/api/feed")
def feed():
    return jsonify({"feedCards": ranked_feed_cards(feed_viewer_user_id(), feed_limit()), "trending": [], "suggestedPeople": []})


@app.route("/api/search")
def global_search():
    query = text_value(request.args.get("q") or request.args.get("query"))[:80]
    limit = max(1, min(optional_int(request.args.get("limit")) or 5, 10))
    requested_types = {value.strip().lower() for value in text_value(request.args.get("types")).split(",") if value.strip()}
    if len(query) < 2:
        return jsonify({"query": query, "users": [], "clubs": [], "posts": [], "products": []})
    return jsonify(search_results(query, limit, requested_types or None))


@app.route("/api/users", methods=["GET", "POST"])
def users_collection():
    if request.method == "GET":
        username_query = normalize_username(request.args.get("username"))
        statement = select(User).where(User.is_active.is_(True))
        if username_query:
            statement = statement.where(User.username.contains(username_query)).limit(10)
        return jsonify([user.to_dict() for user in db().scalars(statement.order_by(User.username.asc())).all()])
    user, error_response, status = create_user_from_payload(read_json())
    if error_response is not None:
        return error_response, status
    db().add(user)
    db().commit()
    db().refresh(user)
    return jsonify(user.to_dict()), 201


@app.route("/api/users/<user_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def users_item(user_id: str):
    user = get_user(user_id)
    if user is None:
        return jsonify({"error": "not found"}), 404
    if request.method == "GET":
        return jsonify(user.to_dict())
    if request.method == "DELETE":
        db().delete(user)
        db().commit()
        return ("", 204)
    update_error = update_user_from_payload(user, read_json())
    if update_error is not None:
        return update_error
    db().commit()
    db().refresh(user)
    return jsonify(user.to_dict())


@app.route("/api/users/<user_id>/friends", methods=["GET", "POST", "DELETE"])
def user_friendship_collection(user_id: str):
    target_user = get_user(user_id)
    if target_user is None:
        return jsonify({"error": "not found"}), 404
    current_user = current_auth_user()
    if not isinstance(current_user, User):
        return jsonify({"error": "unauthorized"}), 401
    if request.method == "GET":
        include_lists = read_bool(request.args.get("includeLists") or request.args.get("include_lists"))
        return jsonify(friendship_status_payload(current_user, target_user, include_lists))
    if current_user.user_id == target_user.user_id:
        return jsonify({"error": "users cannot follow themselves"}), 400
    existing = friendship_between(current_user.user_id, target_user.user_id)
    if request.method == "DELETE":
        if existing is not None:
            db().delete(existing)
            db().commit()
        return jsonify(friendship_status_payload(current_user, target_user))
    if existing is None:
        db().add(Friendship(requester_id=current_user.user_id, receiver_id=target_user.user_id, status="accepted"))
        add_notification(
            target_user.user_id,
            current_user.user_id,
            "friend_request",
            "user",
            current_user.user_id,
            f"{current_user.full_name} started following you.",
        )
        db().commit()
        return jsonify(friendship_status_payload(current_user, target_user)), 201
    return jsonify(friendship_status_payload(current_user, target_user))


@app.route("/api/users/<user_id>/friends/<list_name>", methods=["GET"])
def user_friendship_list(user_id: str, list_name: str):
    target_user = get_user(user_id)
    if target_user is None or list_name not in {"followers", "following"}:
        return jsonify({"error": "not found"}), 404
    if current_auth_user() is None:
        return jsonify({"error": "unauthorized"}), 401
    limit = max(1, min(optional_int(request.args.get("limit")) or 50, 100))
    offset = max(optional_int(request.args.get("offset")) or 0, 0)
    return jsonify(friendship_list_payload(target_user.user_id, list_name, limit, offset))


@app.route("/api/posts", methods=["GET", "POST"])
def posts_collection():
    if request.method == "POST":
        return create_post_from_payload(read_json())
    posts = db().scalars(select(Post).where(Post.is_deleted.is_(False)).order_by(Post.created_at.desc(), Post.post_id.asc())).all()
    return jsonify([serialize_post(post) for post in posts])


@app.route("/api/posts/<post_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def posts_item(post_id: str):
    post = db().get(Post, optional_int(post_id))
    if post is None or post.is_deleted:
        return jsonify({"error": "not found"}), 404
    if request.method == "GET":
        return jsonify(serialize_post(post))
    if request.method == "DELETE":
        owner_error = require_post_owner_or_admin(post)
        if owner_error is not None:
            return owner_error
        post.is_deleted = True
        db().commit()
        return ("", 204)
    return update_post_from_payload(post, read_json())


@app.route("/api/posts/<post_id>/like", methods=["GET", "POST", "DELETE"])
def posts_like_item(post_id: str):
    post = db().get(Post, optional_int(post_id))
    if post is None or post.is_deleted:
        return jsonify({"error": "not found"}), 404
    user = current_auth_user()
    if not isinstance(user, User):
        return jsonify({"error": "unauthorized"}), 401
    existing = post_like_for_user(post.post_id, user.user_id)
    if request.method == "GET":
        return jsonify(post_like_payload(post, user))
    if request.method == "DELETE":
        if existing is not None:
            db().delete(existing)
            post.like_count = max(post.like_count - 1, 0)
            post.engagement_score = float(post.like_count + post.share_count * 2)
            db().commit()
            db().refresh(post)
        return jsonify(post_like_payload(post, user))
    if existing is None:
        db().add(PostLike(post_id=post.post_id, user_id=user.user_id))
        post.like_count += 1
        post.engagement_score = float(post.like_count + post.share_count * 2)
        owner = db().get(User, post.author_id)
        if owner is not None and owner.user_id != user.user_id:
            add_notification(
                owner.user_id,
                user.user_id,
                "post_like",
                "post",
                post.post_id,
                f"{user.full_name} liked your post: {post.content or 'View the post.'}",
            )
        db().commit()
        db().refresh(post)
        return jsonify(post_like_payload(post, user)), 201
    return jsonify(post_like_payload(post, user))


@app.route("/api/notifications", methods=["GET"])
def notifications_collection():
    user = current_auth_user()
    if not isinstance(user, User):
        return jsonify({"error": "unauthorized"}), 401
    items = db().scalars(
        select(Notification)
        .where(Notification.user_id == user.user_id)
        .order_by(Notification.created_at.desc(), Notification.notification_id.desc())
    ).all()
    unread_count = sum(1 for item in items if not item.is_read)
    return jsonify({"items": [serialize_notification(item) for item in items], "total": len(items), "unreadCount": unread_count})


@app.route("/api/notifications/<notification_id>", methods=["DELETE"])
def notification_item(notification_id: str):
    user = current_auth_user()
    if not isinstance(user, User):
        return jsonify({"error": "unauthorized"}), 401
    notification = db().get(Notification, optional_int(notification_id))
    if notification is None or notification.user_id != user.user_id:
        return jsonify({"error": "not found"}), 404
    db().delete(notification)
    db().commit()
    return ("", 204)


@app.route("/api/posts/<post_id>/comments", methods=["GET", "POST"])
def post_comments_collection(post_id: str):
    post = db().get(Post, optional_int(post_id))
    if post is None or post.is_deleted:
        return jsonify({"error": "not found"}), 404
    if request.method == "GET":
        comments = db().scalars(
            select(Comment)
            .where((Comment.post_id == post.post_id) & (Comment.is_deleted.is_(False)))
            .order_by(Comment.created_at.asc(), Comment.comment_id.asc())
        ).all()
        return jsonify({"items": [comment_payload(comment) for comment in comments], "total": len(comments)})
    user = current_auth_user()
    if not isinstance(user, User):
        return jsonify({"error": "unauthorized"}), 401
    content = text_value(get_first(read_json(), "content", "body", "text"))
    if not content:
        return jsonify({"error": "content is required"}), 400
    comment = Comment(post_id=post.post_id, user_id=user.user_id, content=content)
    db().add(comment)
    post.comment_count += 1
    post.engagement_score = float(post.like_count + post.share_count * 2 + post.comment_count)
    if post.author_id != user.user_id:
        add_notification(
            post.author_id,
            user.user_id,
            "post_comment",
            "post",
            post.post_id,
            f"{user.full_name} commented: {content}",
        )
    db().commit()
    db().refresh(comment)
    db().refresh(post)
    return jsonify({"comment": comment_payload(comment), "post": serialize_post(post), "comments": post.comment_count}), 201


@app.route("/api/feed/trending", methods=["GET", "POST"])
@app.route("/api/feed/suggested-people", methods=["GET", "POST"])
@app.route("/api/clubs/spotlight", methods=["GET", "POST"])
@app.route("/api/clubs/stats", methods=["GET", "POST"])
@app.route("/api/games/top-rated", methods=["GET", "POST"])
@app.route("/api/games/recent-activity", methods=["GET", "POST"])
def schema_removed_collection():
    if request.method != "GET":
        return jsonify({"error": "resource is not part of the normalized schema"}), 410
    return jsonify(empty_resource_collection())


@app.route("/api/feed/trending/<int:item_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
@app.route("/api/feed/suggested-people/<int:item_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
@app.route("/api/clubs/spotlight/<int:item_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
@app.route("/api/clubs/stats/<int:item_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
@app.route("/api/games/top-rated/<int:item_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
@app.route("/api/games/recent-activity/<int:item_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def schema_removed_item(item_id: int):
    return jsonify({"error": "resource is not part of the normalized schema"}), 410


@app.route("/api/clubs")
def clubs():
    return jsonify({"spotlightClubs": [], "clubCards": [club.to_dict() for club in db().scalars(select(Club).where(Club.is_active.is_(True)).order_by(Club.name.asc())).all()], "stats": []})


@app.route("/api/clubs", methods=["POST"])
@app.route("/api/clubs/items", methods=["POST"])
def create_club_alias():
    admin_error = require_admin_user()
    if admin_error is not None:
        return admin_error
    item = make_club_card(read_json())
    db().add(item)
    db().commit()
    db().refresh(item)
    return jsonify(item.to_dict()), 201


@app.route("/api/clubs/items", methods=["GET"])
def club_items_collection():
    return jsonify([club.to_dict() for club in db().scalars(select(Club).where(Club.is_active.is_(True)).order_by(Club.name.asc())).all()])


@app.route("/api/clubs/items/<int:item_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def club_item(item_id: int):
    club = db().get(Club, item_id)
    if club is None:
        return jsonify({"error": "not found"}), 404
    if request.method == "GET":
        return jsonify(club.to_dict())
    admin_error = require_admin_user()
    if admin_error is not None:
        return admin_error
    if request.method == "DELETE":
        club.is_active = False
        db().commit()
        return ("", 204)
    data = read_json()
    if "title" in data or "name" in data:
        club.name = text_value(get_first(data, "title", "name"), club.name)
    if "slug" in data:
        club.slug = unique_club_slug(data.get("slug"), club.club_id)
    if "description" in data:
        club.description = text_value(data.get("description"))
    if "status" in data:
        club.status = text_value(data.get("status"), "Open")
    if "bannerImage" in data or "logo_url" in data:
        club.logo_url = text_value(get_first(data, "bannerImage", "logo_url"))
    db().commit()
    db().refresh(club)
    return jsonify(club.to_dict())


@app.route("/api/clubs/<slug>", methods=["GET"])
def club_detail(slug: str):
    club = club_by_slug(slug)
    if club is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(serialize_club_detail(club))


@app.route("/api/clubs/<slug>/follow", methods=["GET", "POST", "DELETE"])
def club_follow(slug: str):
    club = club_by_slug(slug)
    if club is None:
        return jsonify({"error": "not found"}), 404
    user = current_auth_user()
    if not isinstance(user, User):
        return jsonify({"error": "unauthorized"}), 401
    existing = club_follow_for_user(club, user.user_id)
    if request.method == "GET":
        return jsonify(club_follow_payload(club, user))
    if request.method == "DELETE":
        if existing is not None:
            db().delete(existing)
            db().commit()
        return jsonify(club_follow_payload(club, user))
    if existing is None:
        db().add(ClubFollower(club_id=club.club_id, user_id=user.user_id))
        db().commit()
        return jsonify(club_follow_payload(club, user)), 201
    return jsonify(club_follow_payload(club, user))


@app.route("/api/clubs/<slug>/members", methods=["GET", "POST"])
def club_members_collection(slug: str):
    club = club_by_slug(slug)
    if club is None:
        return jsonify({"error": "not found"}), 404
    if request.method == "POST":
        user = current_auth_user()
        if user is None:
            return jsonify({"error": "unauthorized"}), 401
        return create_club_member_resource(club, user)
    return jsonify([serialize_club_member(member) for member in club_members_for_club(club)])


@app.route("/api/clubs/<slug>/members/<int:member_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def club_member_item(slug: str, member_id: int):
    club = club_by_slug(slug)
    if club is None:
        return jsonify({"error": "not found"}), 404
    member = db().get(ClubMember, member_id)
    if member is None or member.club_id != club.club_id:
        return jsonify({"error": "not found"}), 404
    if request.method == "GET":
        return jsonify(serialize_club_member(member))
    if request.method == "DELETE":
        user = current_auth_user()
        if user is None:
            return jsonify({"error": "unauthorized"}), 401
        if not can_remove_club_member(club, user, member):
            return jsonify({"error": "admin or club president access required"}), 403
        member.status = "removed"
        db().commit()
        return ("", 204)
    admin_error = require_admin_user()
    if admin_error is not None:
        return admin_error
    data = read_json()
    if "title" in data or "role" in data:
        role = role_value(data.get("title") or data.get("role"))
        role_error = club_member_role_error(club, role, member.club_member_id)
        if role_error is not None:
            return jsonify({"error": role_error}), 409
        member.role = role
        member.can_post = role in CLUB_PUBLISHER_ROLES
        member.can_create_announcement = role in CLUB_PUBLISHER_ROLES
    db().commit()
    db().refresh(member)
    return jsonify(serialize_club_member(member))


@app.route("/api/games")
def games():
    game_cards = [game.to_dict() for game in db().scalars(select(Game).where(Game.is_active.is_(True)).order_by(Game.created_at.desc(), Game.game_id.asc())).all()]
    return jsonify({"gameCards": game_cards, "topRated": [], "recentActivity": []})


@app.route("/api/games/leaderboards")
def game_leaderboards():
    entries = leaderboard_entries()
    return jsonify({"entries": entries, "totalPlayers": len(entries), "generatedAt": datetime.utcnow().isoformat()})


@app.route("/api/games/xp", methods=["POST"])
def award_game_xp():
    user = current_auth_user()
    if user is None:
        return jsonify({"error": "unauthorized"}), 401
    if is_admin_user(user):
        return jsonify({"error": "admin is not ranked"}), 403
    assert isinstance(user, User)
    xp = optional_int(get_first(read_json(), "xp", "score", "points"))
    if xp is None or xp <= 0:
        return jsonify({"error": "xp must be a positive integer"}), 400
    total = award_user_xp(user, xp)
    return jsonify({"userId": str(user.user_id), "user_id": str(user.user_id), "awardedXp": xp, "awarded_xp": xp, "totalXp": total, "total_xp": total})


@app.route("/api/games/items", methods=["GET", "POST"])
def game_items_collection():
    if request.method == "POST":
        data = read_json()
        item = Game(name=text_value(get_first(data, "title", "name")), description=optional_text(data.get("description")))
        if not item.name:
            return jsonify({"error": "title is required"}), 400
        db().add(item)
        db().commit()
        db().refresh(item)
        return jsonify(item.to_dict()), 201
    return jsonify([game.to_dict() for game in db().scalars(select(Game).order_by(Game.created_at.desc(), Game.game_id.asc())).all()])


@app.route("/api/games/items/<int:item_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def game_item(item_id: int):
    item = db().get(Game, item_id)
    if item is None:
        return jsonify({"error": "not found"}), 404
    if request.method == "GET":
        return jsonify(item.to_dict())
    if request.method == "DELETE":
        item.is_active = False
        db().commit()
        return ("", 204)
    data = read_json()
    if "title" in data or "name" in data:
        item.name = text_value(get_first(data, "title", "name"), item.name)
    if "description" in data:
        item.description = optional_text(data.get("description"))
    db().commit()
    db().refresh(item)
    return jsonify(item.to_dict())


@app.route("/api/marketplace")
def marketplace():
    return jsonify({"items": [serialize_marketplace_item(item) for item in marketplace_posts()]})


@app.route("/api/marketplace", methods=["POST"])
@app.route("/api/marketplace/items", methods=["POST"])
def create_marketplace_item():
    return create_marketplace_item_from_payload(read_json())


@app.route("/api/marketplace/items", methods=["GET"])
def marketplace_items_collection():
    return jsonify([serialize_marketplace_item(item) for item in marketplace_posts()])


@app.route("/api/marketplace/items/<post_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def marketplace_item(post_id: str):
    item = db().get(MarketplaceItem, optional_int(post_id))
    if item is None or item.status == "removed":
        return jsonify({"error": "not found"}), 404
    if request.method == "GET":
        return jsonify(serialize_marketplace_item(item))
    user = current_auth_user()
    if not (is_admin_user(user) or (isinstance(user, User) and item.seller_id == user.user_id)):
        return jsonify({"error": "unauthorized"}), 401
    if request.method == "DELETE":
        item.status = "removed"
        db().commit()
        return ("", 204)
    data = read_json()
    if "title" in data or "itemName" in data:
        item.title = text_value(get_first(data, "title", "itemName"), item.title)
    if "description" in data:
        item.description = optional_text(data.get("description"))
    if "category" in data:
        item.category = optional_text(data.get("category"))
    if "price" in data:
        item.price = parse_price(data.get("price"))
    if "image" in data or "photoUrl" in data:
        item.image_url = text_value(get_first(data, "image", "photoUrl"))
    db().commit()
    db().refresh(item)
    return jsonify(serialize_marketplace_item(item))


@app.route("/api/messages")
def messages():
    return jsonify({"conversations": serialize_conversations(), "messages": serialize_messages()})


@app.route("/api/messages/conversations", methods=["GET", "POST"])
def conversations_collection():
    if request.method == "POST":
        thread = ChatThread(thread_type=text_value(read_json().get("threadType"), "direct"))
        db().add(thread)
        db().commit()
        db().refresh(thread)
        return jsonify(serialize_conversations()[0] if serialize_conversations() else {"id": thread.thread_id}), 201
    return jsonify(serialize_conversations())


@app.route("/api/messages/conversations/<int:item_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def conversation_item(item_id: int):
    item = db().get(ChatThread, item_id)
    if item is None:
        return jsonify({"error": "not found"}), 404
    if request.method == "DELETE":
        db().delete(item)
        db().commit()
        return ("", 204)
    return jsonify({"id": item.thread_id, "name": f"{item.thread_type.title()} Chat", "preview": "", "time": item.created_at.isoformat()})


@app.route("/api/messages/items", methods=["GET", "POST"])
def messages_collection():
    if request.method == "POST":
        user = current_auth_user()
        if not isinstance(user, User):
            return jsonify({"error": "unauthorized"}), 401
        data = read_json()
        thread_id = optional_int(data.get("thread_id")) or optional_int(data.get("threadId"))
        if thread_id is None:
            thread = ChatThread(thread_type="direct")
            db().add(thread)
            db().flush()
            thread_id = thread.thread_id
        item = ChatMessage(thread_id=thread_id, sender_id=user.user_id, content=text_value(get_first(data, "text", "content")))
        db().add(item)
        db().commit()
        db().refresh(item)
        return jsonify({"id": item.message_id, "side": "right", "text": item.content or "", "time": item.created_at.isoformat()}), 201
    return jsonify(serialize_messages())


@app.route("/api/messages/items/<int:item_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def message_item(item_id: int):
    item = db().get(ChatMessage, item_id)
    if item is None:
        return jsonify({"error": "not found"}), 404
    if request.method == "DELETE":
        item.is_deleted = True
        db().commit()
        return ("", 204)
    if request.method in {"PATCH", "PUT"}:
        item.content = text_value(get_first(read_json(), "text", "content"), item.content or "")
        db().commit()
        db().refresh(item)
    return jsonify({"id": item.message_id, "side": "left", "text": item.content or "", "time": item.created_at.isoformat()})


@app.route("/api/auth/signup", methods=["POST"])
def auth_signup():
    user, error_response, status = create_user_from_payload(read_json(), require_password=True)
    if error_response is not None:
        return error_response, status
    db().add(user)
    db().flush()
    token = create_auth_session(user)
    db().commit()
    db().refresh(user)
    return jsonify(auth_payload(user, token)), 201


@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = read_json()
    login = normalize_login(get_first(data, "login", "username", "email"))
    password = text_value(data.get("password"))
    if not login or not password:
        return jsonify({"error": "login and password are required"}), 400
    if admin_login_matches(login, password):
        admin = AdminIdentity()
        return jsonify(auth_payload(admin, create_admin_session()))
    user = find_auth_user_by_login(login)
    if user is None or not check_password_hash(user.password_hash, password):
        return jsonify({"error": "invalid login or password"}), 401
    token = create_auth_session(user)
    db().commit()
    return jsonify(auth_payload(user, token))


@app.route("/api/auth/me")
def auth_me():
    user = current_auth_user()
    if user is None:
        return jsonify({"error": "unauthorized"}), 401
    return jsonify({"user": user.to_dict()})


@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    token = bearer_token()
    if token is not None:
        _admin_tokens.discard(token)
        session = db().get(AuthSession, token)
        if session is not None:
            db().delete(session)
            db().commit()
    return ("", 204)


@app.route("/api/profile/<user>")
def profile(user: str):
    row = profile_user(user)
    return jsonify(profile_payload(row) if row is not None else {"avatar": PROFILE_AVATAR, "major": "", "bio": ""})


@app.route("/api/profiles", methods=["GET", "POST"])
def profiles_collection():
    if request.method == "GET":
        return jsonify([{"user": row.username, **profile_payload(row)} for row in db().scalars(select(User).order_by(User.username.asc())).all()])
    user = profile_user(text_value(get_first(read_json(), "user", "username")))
    if user is None:
        return jsonify({"error": "user is required"}), 400
    data = read_json()
    user.profile_photo_url = text_value(data.get("avatar"), user.profile_photo_url or PROFILE_AVATAR)
    user.department = text_value(data.get("major"), user.department or "")
    user.bio = text_value(data.get("bio"), user.bio or "")
    db().commit()
    return jsonify({"user": user.username, **profile_payload(user)}), 201


@app.route("/api/profiles/<user>", methods=["GET", "PATCH", "PUT", "DELETE"])
def profile_item(user: str):
    row = profile_user(user)
    if row is None:
        return jsonify({"error": "not found"}), 404
    if request.method == "GET":
        return jsonify({"user": row.username, **profile_payload(row)})
    if request.method == "DELETE":
        row.profile_photo_url = None
        row.bio = None
        db().commit()
        return ("", 204)
    data = read_json()
    if "avatar" in data:
        row.profile_photo_url = text_value(data.get("avatar"), PROFILE_AVATAR)
    if "major" in data:
        row.department = text_value(data.get("major"))
    if "bio" in data:
        row.bio = text_value(data.get("bio"))
    db().commit()
    return jsonify({"user": row.username, **profile_payload(row)})


if __name__ == "__main__":
    ensure_database_initialized()
    port = int(os.getenv("PORT", "5000"))
    app.run(host="127.0.0.1", port=port, debug=os.getenv("FLASK_DEBUG") == "1", use_reloader=False)
