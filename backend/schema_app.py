from __future__ import annotations

import os
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from threading import Lock
from typing import Any, Optional, Sequence

from flask import Flask, g, jsonify, request
import jwt
from sqlalchemy import (
    Boolean,
    CheckConstraint,
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
    from .feed_ranker import (
        build_feed_graph,
        rank_feed_posts,
    )
    from .graph_store import (
        GraphUnavailable,
        create_friendship as graph_create_friendship,
        delete_friendship as graph_delete_friendship,
        ensure_constraints as ensure_graph_constraints,
        feed_signals,
        friend_rows as graph_friend_rows,
        get_friendship as graph_get_friendship,
        replace_graph,
        stored_friendships,
    )
except ImportError:
    from feed_ranker import (
        build_feed_graph,
        rank_feed_posts,
    )
    from graph_store import (
        GraphUnavailable,
        create_friendship as graph_create_friendship,
        delete_friendship as graph_delete_friendship,
        ensure_constraints as ensure_graph_constraints,
        feed_signals,
        friend_rows as graph_friend_rows,
        get_friendship as graph_get_friendship,
        replace_graph,
        stored_friendships,
    )

BACKEND_DIR = Path(__file__).resolve().parent

try:
    from dotenv import load_dotenv

    load_dotenv(BACKEND_DIR / ".env")
except ImportError:
    pass

ALLOWED_EMAIL_DOMAINS = frozenset(
    entry.strip().lower().rsplit("@", 1)[-1]
    for entry in os.getenv("ALLOWED_EMAIL_DOMAINS", "").split(",")
    if entry.strip()
)

DEFAULT_DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/campus_nexus"
PROFILE_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' rx='64' fill='%23e9e7f3'/%3E%3Ccircle cx='64' cy='48' r='24' fill='%23777d86'/%3E%3Cpath d='M24 116c6-27 22-41 40-41s34 14 40 41' fill='%23777d86'/%3E%3C/svg%3E"

DEFAULT_ADMIN_USER = {
    "email": "admin@cn.nhce",
    "username": "admin",
    "name": "Admin",
    "dateOfBirth": "2000-01-01",
    "department": "CS",
    "yearOfStudy": 1,
    "password": "12345678",
}

POST_TYPE_TO_CODE = {"normal": 0, "club_post": 1, "announcement": 3, "event": 3, "repost": 0}
CODE_TO_POST_TYPE = {0: "normal", 1: "club_post", 2: "normal", 3: "announcement"}
CLUB_MEMBER_ROLES = {"president", "vice_president", "chairman", "vice_chairman", "secretary", "treasurer", "member"}
SINGLE_CLUB_MEMBER_ROLES = CLUB_MEMBER_ROLES - {"member"}
CLUB_PUBLISHER_ROLES = {"president", "chairman", "secretary"}
CLUB_POST_TYPES = {"club_post", "announcement"}
DEPARTMENTS = {"CS", "Mech", "ECE", "Electrical"}
IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg")
VIDEO_EXTENSIONS = (".mp4",)
HASHTAG_RE = re.compile(r"(?<![\w])#([A-Za-z0-9_]+)")
MENTION_RE = re.compile(r"(?<![\w])@([A-Za-z0-9_.-]+)")

app = Flask(__name__)
_database_initialized = False
_database_lock = Lock()

JWT_SECRET = os.getenv("JWT_SECRET", "")
JWT_ALGORITHM = "HS256"
JWT_ISSUER = "campus-nexus"
JWT_EXPIRES_HOURS = int(os.getenv("JWT_EXPIRES_HOURS", "24"))
JWT_COOKIE_NAME = "campusNexusToken"
JWT_COOKIE_SECURE = os.getenv("JWT_COOKIE_SECURE", "0") == "1"
CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:3000")
if len(JWT_SECRET) < 32:
    raise RuntimeError("JWT_SECRET must be set to at least 32 characters")
if JWT_EXPIRES_HOURS <= 0:
    raise RuntimeError("JWT_EXPIRES_HOURS must be positive")


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    return datetime.utcnow()


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("semester IS NULL OR semester BETWEEN 1 AND 4", name="ck_users_year"),
        CheckConstraint("department IS NULL OR department IN ('CS', 'Mech', 'ECE', 'Electrical')", name="ck_users_department"),
    )

    userId: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fullName: Mapped[str] = mapped_column(Text, nullable=False)
    username: Mapped[str] = mapped_column(Text, unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(Text, unique=True, index=True, nullable=False)
    passwordHash: Mapped[str] = mapped_column(Text, nullable=False)
    accountRole: Mapped[str] = mapped_column(Text, default="student", nullable=False)
    dateOfBirth: Mapped[Optional[date]] = mapped_column(nullable=True)
    department: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    semester: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    batchYear: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    profilePhotoUrl: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    profileVisibility: Mapped[str] = mapped_column(Text, default="public", nullable=False)
    notificationsEnabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    reputationScore: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    safetyScore: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    isActive: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    def to_dict(self) -> dict[str, Any]:
        name = self.fullName
        dob = self.dateOfBirth.isoformat() if self.dateOfBirth else ""
        year = self.semester or 1
        return {
            "userId": str(self.userId),
            "name": name,
            "username": self.username,
            "email": self.email,
            "dateOfBirth": dob,
            "yearOfStudy": year,
            "department": self.department or "",
            "initials": initials_for_name(name),
        }


class Friendship(Base):
    __tablename__ = "friendships"
    __table_args__ = (
        CheckConstraint('"requesterId" < "receiverId"', name="ck_friendships_canonical_pair"),
        UniqueConstraint("requesterId", "receiverId", name="uq_friendships_requester_receiver"),
    )

    friendshipId: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    requesterId: Mapped[int] = mapped_column(Integer, ForeignKey("users.userId"), index=True, nullable=False)
    receiverId: Mapped[int] = mapped_column(Integer, ForeignKey("users.userId"), index=True, nullable=False)
    status: Mapped[str] = mapped_column(Text, default="accepted", nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    @property
    def id(self) -> int:
        return self.friendshipId

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.friendshipId,
            "userAId": str(self.requesterId),
            "userBId": str(self.receiverId),
            "createdAt": self.createdAt.isoformat(),
        }


UserFriendship = Friendship


class Club(Base):
    __tablename__ = "clubs"

    clubId: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(Text, unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    logoUrl: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, default="Open", nullable=False)
    createdByService: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    isActive: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    @property
    def id(self) -> int:
        return self.clubId

    @property
    def title(self) -> str:
        return self.name

    @title.setter
    def title(self, value: str) -> None:
        self.name = value

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.clubId,
            "title": self.name,
            "slug": self.slug,
            "description": self.description or "",
            "status": self.status or "Open",
            "icon": "groups",
            "iconBg": "bg-primary",
            "bannerBg": "bg-primary-fixed/20",
            "bannerImage": self.logoUrl or "",
            "extraMembers": "0",
            "extraMembersClass": "bg-primary-container text-white",
            "avatars": [],
            "statusClass": "text-secondary",
        }


ClubCard = Club


class ClubMember(Base):
    __tablename__ = "club_members"
    __table_args__ = (UniqueConstraint("clubId", "userId", name="uq_club_members_club_user"),)

    clubMemberId: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    clubId: Mapped[int] = mapped_column(Integer, ForeignKey("clubs.clubId"), index=True, nullable=False)
    userId: Mapped[int] = mapped_column(Integer, ForeignKey("users.userId"), index=True, nullable=False)
    role: Mapped[str] = mapped_column(Text, default="member", nullable=False)
    canPost: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    canPublishEvent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    canCreateAnnouncement: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    canManageMembers: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[str] = mapped_column(Text, default="active", nullable=False)
    addedByService: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    joinedAt: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    @property
    def id(self) -> int:
        return self.clubMemberId

    @property
    def title(self) -> str:
        return role_label(self.role)

    @title.setter
    def title(self, value: str) -> None:
        self.role = role_value(value)

    @property
    def createdAt(self) -> datetime:
        return self.joinedAt


class ClubFollower(Base):
    __tablename__ = "club_followers"

    clubId: Mapped[int] = mapped_column(Integer, ForeignKey("clubs.clubId"), primary_key=True)
    userId: Mapped[int] = mapped_column(Integer, ForeignKey("users.userId"), primary_key=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    @property
    def id(self) -> str:
        return f"{self.clubId}:{self.userId}"

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "clubId": self.clubId,
            "userId": str(self.userId),
            "createdAt": self.createdAt.isoformat(),
        }


class Post(Base):
    __tablename__ = "posts"

    postId: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    authorId: Mapped[int] = mapped_column(Integer, ForeignKey("users.userId"), index=True, nullable=False)
    clubId: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("clubs.clubId"), index=True, nullable=True)
    postType: Mapped[str] = mapped_column(Text, default="normal", nullable=False)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    mediaUrl: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    mediaType: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    originalPostId: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("posts.postId"), nullable=True)
    visibility: Mapped[str] = mapped_column(Text, default="public", nullable=False)
    eventTitle: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    eventStartTime: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    eventEndTime: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    eventLocation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    registrationLink: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    likeCount: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    commentCount: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    shareCount: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    bookmarkCount: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    repostCount: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reportCount: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    engagementScore: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    isDeleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    @property
    def type_code(self) -> int:
        return POST_TYPE_TO_CODE.get(self.postType, 0)

    @property
    def caption(self) -> str:
        return self.content or ""

    @caption.setter
    def caption(self, value: str) -> None:
        self.content = value

    @property
    def likes(self) -> int:
        return self.likeCount

    @likes.setter
    def likes(self, value: int) -> None:
        self.likeCount = max(int(value), 0)

    @property
    def shares(self) -> int:
        return self.shareCount

    @shares.setter
    def shares(self, value: int) -> None:
        self.shareCount = max(int(value), 0)

    def to_dict(
        self,
        author_name: Optional[str] = None,
        club_slug: Optional[str] = None,
        mediaUrls: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        createdAt = self.createdAt
        if createdAt.tzinfo is None:
            createdAt = createdAt.replace(tzinfo=timezone.utc)
        createdAt = createdAt.astimezone(timezone.utc).isoformat()
        caption = self.caption
        hashtags = extract_hashtags(caption)
        title = caption[:72] or "Untitled post"
        mediaUrls = mediaUrls if mediaUrls is not None else ([self.mediaUrl] if self.mediaUrl else [])
        primary_media = mediaUrls[0] if mediaUrls else ""
        return {
            "postId": str(self.postId),
            "id": str(self.postId),
            "authorId": str(self.authorId),
            "author": author_name or str(self.authorId),
            "clubId": self.clubId,
            "clubSlug": club_slug,
            "type": self.type_code,
            "postType": self.postType,
            "mediaUrl": primary_media,
            "mediaUrls": mediaUrls,
            "caption": caption,
            "likes": self.likeCount,
            "shares": self.shareCount,
            "hashtags": hashtags,
            "mentions": extract_mentions(caption),
            "price": None,
            "description": None,
            "createdAt": createdAt,
            "meta": createdAt,
            "title": title,
            "body": caption,
            "image": primary_media,
            "tag": hashtags[0] if hashtags else "#campusnexus",
            "comments": self.commentCount,
            "engagementScore": self.engagementScore or float(self.likeCount + self.shareCount * 2),
        }


class PostMedia(Base):
    __tablename__ = "post_media"

    mediaId: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    postId: Mapped[int] = mapped_column(Integer, ForeignKey("posts.postId", ondelete="CASCADE"), index=True, nullable=False)
    mediaUrl: Mapped[str] = mapped_column(Text, nullable=False)
    mediaType: Mapped[str] = mapped_column(Text, nullable=False)
    sortOrder: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class PostLike(Base):
    __tablename__ = "post_likes"

    postId: Mapped[int] = mapped_column(Integer, ForeignKey("posts.postId"), primary_key=True)
    userId: Mapped[int] = mapped_column(Integer, ForeignKey("users.userId"), primary_key=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    @property
    def id(self) -> str:
        return f"{self.postId}:{self.userId}"

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "postId": str(self.postId),
            "userId": str(self.userId),
            "createdAt": self.createdAt.isoformat(),
        }


class Comment(Base):
    __tablename__ = "comments"

    commentId: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    postId: Mapped[int] = mapped_column(Integer, ForeignKey("posts.postId"), index=True, nullable=False)
    userId: Mapped[int] = mapped_column(Integer, ForeignKey("users.userId"), index=True, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    isDeleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class Notification(Base):
    __tablename__ = "notifications"

    notificationId: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    userId: Mapped[int] = mapped_column(Integer, ForeignKey("users.userId"), index=True, nullable=False)
    actorId: Mapped[int] = mapped_column(Integer, ForeignKey("users.userId"), index=True, nullable=False)
    type: Mapped[str] = mapped_column(Text, index=True, nullable=False)
    targetType: Mapped[str] = mapped_column(Text, nullable=False)
    targetId: Mapped[str] = mapped_column(Text, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    isRead: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class MarketplaceItem(Base):
    __tablename__ = "marketplace_items"

    itemId: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sellerId: Mapped[int] = mapped_column(Integer, ForeignKey("users.userId"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    price: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)
    imageUrl: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, default="available", nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class Game(Base):
    __tablename__ = "games"

    gameId: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    startDate: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    endDate: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    isActive: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    @property
    def id(self) -> int:
        return self.gameId

    def to_dict(self) -> dict[str, Any]:
        return {"id": self.gameId, "title": self.name, "image": "", "online": "0", "rating": "0"}


class UserPoint(Base):
    __tablename__ = "user_points"

    pointId: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    userId: Mapped[int] = mapped_column(Integer, ForeignKey("users.userId"), index=True, nullable=False)
    gameId: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("games.gameId"), nullable=True)
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class ChatThread(Base):
    __tablename__ = "chat_threads"

    threadId: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    threadType: Mapped[str] = mapped_column(Text, default="direct", nullable=False)
    clubId: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("clubs.clubId"), nullable=True)
    marketplaceItemId: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("marketplace_items.itemId"), nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class ChatParticipant(Base):
    __tablename__ = "chat_participants"

    threadId: Mapped[int] = mapped_column(Integer, ForeignKey("chat_threads.threadId"), primary_key=True)
    userId: Mapped[int] = mapped_column(Integer, ForeignKey("users.userId"), primary_key=True)
    joinedAt: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    lastReadAt: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    messageId: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    threadId: Mapped[int] = mapped_column(Integer, ForeignKey("chat_threads.threadId"), index=True, nullable=False)
    senderId: Mapped[int] = mapped_column(Integer, ForeignKey("users.userId"), nullable=False)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    isDeleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


@dataclass(frozen=True)
class AdminIdentity:
    userId: str = "admin"
    username: str = "admin"
    email: str = "admin@cn.nhce"
    fullName: str = "Admin"
    department: str = "CS"
    semester: int = 1

    def to_dict(self) -> dict[str, Any]:
        return {
            "userId": self.userId,
            "name": self.fullName,
            "username": self.username,
            "email": self.email,
            "dateOfBirth": DEFAULT_ADMIN_USER["dateOfBirth"],
            "yearOfStudy": self.semester,
            "department": self.department,
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


def read_year_of_study(value: Any) -> Optional[int]:
    year = optional_int(value)
    if year is None or year < 1 or year > 4:
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


def media_kind(mediaUrl: str) -> Optional[str]:
    url = mediaUrl.strip().lower().split("?", 1)[0].split("#", 1)[0]
    if not url:
        return None
    if url.startswith("data:image/") or url.endswith(IMAGE_EXTENSIONS):
        return "image"
    if url.startswith("data:video/mp4") or url.endswith(VIDEO_EXTENSIONS):
        return "video"
    return "unknown"


def media_error(mediaUrl: str, post_type_code: int) -> Optional[str]:
    kind = media_kind(mediaUrl)
    if kind is None:
        return None
    if kind == "unknown":
        return "media url must be an image or mp4"
    if post_type_code == 2 and kind != "image":
        return "marketplace posts only allow image media"
    return None


def read_media_urls(data: dict[str, Any]) -> list[str]:
    if "mediaUrls" in data:
        return read_string_list(data.get("mediaUrls"))
    mediaUrl = text_value(get_first(data, "mediaUrl", "image"))
    return [mediaUrl] if mediaUrl else []


def post_media_urls(post: Post) -> list[str]:
    # ponytail: per-post lookup is sufficient at current feed size; eager-load if feed volume grows.
    rows = db().scalars(
        select(PostMedia).where(PostMedia.postId == post.postId).order_by(PostMedia.sortOrder.asc(), PostMedia.mediaId.asc())
    ).all()
    return [row.mediaUrl for row in rows] or ([post.mediaUrl] if post.mediaUrl else [])


def replace_post_media(post: Post, mediaUrls: list[str]) -> None:
    for row in db().scalars(select(PostMedia).where(PostMedia.postId == post.postId)).all():
        db().delete(row)
    for index, mediaUrl in enumerate(mediaUrls):
        db().add(PostMedia(postId=post.postId, mediaUrl=mediaUrl, mediaType=media_kind(mediaUrl) or "", sortOrder=index))
    post.mediaUrl = mediaUrls[0] if mediaUrls else None
    post.mediaType = media_kind(post.mediaUrl or "")


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


def get_user(userId: Any) -> Optional[User]:
    pk = user_pk(userId)
    return db().get(User, pk) if pk is not None else None


def unique_club_slug(value: Any, current_club_id: Optional[int] = None) -> str:
    base_slug = slugify(value)
    candidate = base_slug
    suffix = 2
    while True:
        existing = db().scalar(select(Club).where(Club.slug == candidate))
        if existing is None or existing.clubId == current_club_id:
            return candidate
        candidate = f"{base_slug}-{suffix}"
        suffix += 1


def current_auth_user() -> Optional[AuthUser]:
    token = bearer_token() or request.cookies.get(JWT_COOKIE_NAME)
    if token is None:
        return None
    try:
        claims = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            issuer=JWT_ISSUER,
            options={"require": ["exp", "iat", "iss", "role", "sub"]},
        )
    except jwt.InvalidTokenError:
        return None
    if claims["role"] == "admin" and claims["sub"] == AdminIdentity.userId:
        return AdminIdentity()
    if claims["role"] != "student":
        return None
    user = get_user(claims["sub"])
    return user if user is not None and user.isActive else None


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


def create_auth_token(user: AuthUser) -> str:
    now = datetime.now(timezone.utc)
    role = "admin" if is_admin_user(user) else "student"
    return jwt.encode(
        {
            "sub": str(user.userId),
            "role": role,
            "iss": JWT_ISSUER,
            "iat": now,
            "exp": now + timedelta(hours=JWT_EXPIRES_HOURS),
        },
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def auth_response(user: AuthUser, status: int = 200):
    response = jsonify({"user": user.to_dict()})
    response.status_code = status
    response.set_cookie(
        JWT_COOKIE_NAME,
        create_auth_token(user),
        max_age=JWT_EXPIRES_HOURS * 3600,
        httponly=True,
        secure=JWT_COOKIE_SECURE,
        samesite="Lax",
        path="/",
    )
    return response


def find_auth_user_by_login(login: str) -> Optional[User]:
    return db().scalar(select(User).where((User.email == login) | (User.username == login)))


def admin_login_matches(login: str, password: str) -> bool:
    username = normalize_username(DEFAULT_ADMIN_USER["username"])
    mail = normalize_email(DEFAULT_ADMIN_USER["email"])
    return login in {username, mail} and password == text_value(DEFAULT_ADMIN_USER["password"])


def serialize_post(post: Post, viewerUserId: Optional[str] = None) -> dict[str, Any]:
    author = db().get(User, post.authorId)
    club = db().get(Club, post.clubId) if post.clubId is not None else None
    likedByCurrentUser = False
    viewer_pk = user_pk(viewerUserId)
    if viewer_pk is not None:
        likedByCurrentUser = post_like_for_user(post.postId, viewer_pk) is not None
    return {
        **post.to_dict(
            author.fullName if author is not None else None,
            club.slug if club is not None else None,
            post_media_urls(post),
        ),
        "likedByCurrentUser": likedByCurrentUser,
        "viewerHasLiked": likedByCurrentUser,
    }


def post_like_for_user(postId: Any, userId: Any) -> Optional[PostLike]:
    post_pk = optional_int(postId)
    user_id_pk = optional_int(userId)
    if post_pk is None or user_id_pk is None:
        return None
    return db().get(PostLike, {"postId": post_pk, "userId": user_id_pk})


def resolve_post_author_id(data: dict[str, Any]) -> Optional[int]:
    explicit_author_id = optional_int(data.get("authorId"))
    if explicit_author_id is not None:
        return explicit_author_id
    current_user = current_auth_user()
    if isinstance(current_user, User):
        return current_user.userId
    username = normalize_username(data.get("author"))
    if username:
        user = db().scalar(select(User).where(User.username == username))
        if user is not None:
            return user.userId
    return None


def resolve_post_club_id(data: dict[str, Any]) -> Optional[int]:
    explicit_club_id = optional_int(data.get("clubId"))
    if explicit_club_id is not None:
        return explicit_club_id
    club_slug = optional_text(data.get("clubSlug"))
    if club_slug is None:
        return None
    club = db().scalar(select(Club).where(Club.slug == slugify(club_slug)))
    return club.clubId if club is not None else None


def post_caption_from_data(data: dict[str, Any]) -> str:
    return text_value(get_first(data, "caption", "body", "title"))


def make_post(data: dict[str, Any]) -> Post:
    caption = post_caption_from_data(data)
    explicit_hashtags = read_hashtags(get_first(data, "hashtags", "tag"))
    explicit_mentions = read_mentions(get_first(data, "mentions", "taggedPeople"))
    tags = unique_preserving_order([*explicit_hashtags, *extract_hashtags(caption)])
    mentions = unique_preserving_order([*explicit_mentions, *extract_mentions(caption)])
    decorated_caption = " ".join([caption, *tags, *mentions]).strip()
    mediaUrls = read_media_urls(data)
    mediaUrl = mediaUrls[0] if mediaUrls else ""
    code = post_type_code(get_first(data, "type", "postType"), default=0) or 0
    return Post(
        authorId=resolve_post_author_id(data) or 0,
        clubId=resolve_post_club_id(data),
        postType=CODE_TO_POST_TYPE[code],
        content=decorated_caption,
        mediaUrl=mediaUrl,
        mediaType=media_kind(mediaUrl),
        likeCount=optional_int(data.get("likes")) or 0,
        shareCount=optional_int(data.get("shares")) or 0,
    )


def validate_post(post: Post, mediaUrls: Optional[list[str]] = None):
    if db().get(User, post.authorId) is None:
        return jsonify({"error": "authorId must reference an existing user"}), 400
    if post.postType in CLUB_POST_TYPES:
        if post.clubId is None or db().get(Club, post.clubId) is None:
            return jsonify({"error": "clubId or clubSlug must reference an existing club"}), 400
        actor = current_auth_user()
        if not isinstance(actor, User):
            return jsonify({"error": "unauthorized"}), 401
        if actor.userId != post.authorId:
            return jsonify({"error": "club post author must match the authenticated user"}), 403
        if not can_publish_club_content(post.clubId, post.authorId, post.postType):
            return jsonify({"error": f"{post.postType.replace('_', ' ')} publishing privilege required"}), 403
    else:
        post.clubId = None
    mediaUrls = mediaUrls if mediaUrls is not None else post_media_urls(post)
    for mediaUrl in mediaUrls:
        error = media_error(mediaUrl, post.type_code)
        if error is not None:
            return jsonify({"error": error}), 400
    if post.postType == "announcement" and (len(mediaUrls) != 1 or media_kind(mediaUrls[0]) != "image"):
        return jsonify({"error": "announcements require exactly one poster image"}), 400
    return None


def create_post_from_payload(data: dict[str, Any]):
    code = post_type_code(get_first(data, "type", "postType"), default=0)
    if code is None:
        return jsonify({"error": "type must be 0, 1, 2, or 3"}), 400
    if code == 2:
        return create_marketplace_item_from_payload(data)
    post = make_post({**data, "type": code})
    mediaUrls = read_media_urls(data)
    validation_error = validate_post(post, mediaUrls)
    if validation_error is not None:
        return validation_error
    post.engagementScore = float(post.likeCount + post.shareCount * 2)
    db().add(post)
    db().flush()
    replace_post_media(post, mediaUrls)
    notify_new_post(post)
    db().commit()
    db().refresh(post)
    return jsonify(serialize_post(post)), 201


def update_post_from_payload(post: Post, data: dict[str, Any]):
    code = post_type_code(get_first(data, "type", "postType"), default=post.type_code)
    if code is None or code == 2:
        return jsonify({"error": "type must be 0, 1, or 3 for feed posts"}), 400
    post.postType = CODE_TO_POST_TYPE[code]
    if "authorId" in data:
        authorId = optional_int(data.get("authorId"))
        if authorId is not None:
            post.authorId = authorId
    if "clubId" in data or "clubSlug" in data:
        post.clubId = resolve_post_club_id(data)
    media_changed = any(key in data for key in ("mediaUrl", "mediaUrls", "image"))
    mediaUrls = read_media_urls(data) if media_changed else post_media_urls(post)
    if media_changed:
        post.mediaUrl = mediaUrls[0] if mediaUrls else None
        post.mediaType = media_kind(post.mediaUrl or "")
    if any(key in data for key in ("caption", "body", "title", "hashtags", "tag", "mentions", "taggedPeople")):
        post.content = make_post({**post.to_dict(), **data, "authorId": post.authorId}).content
    if "likes" in data:
        post.likeCount = max(optional_int(data.get("likes")) or 0, 0)
    if "shares" in data:
        post.shareCount = max(optional_int(data.get("shares")) or 0, 0)
    post.engagementScore = float(post.likeCount + post.shareCount * 2)
    validation_error = validate_post(post, mediaUrls)
    if validation_error is not None:
        return validation_error
    if media_changed:
        replace_post_media(post, mediaUrls)
    db().commit()
    db().refresh(post)
    return jsonify(serialize_post(post))


def club_by_slug(slug: str) -> Optional[Club]:
    return db().scalar(select(Club).where((Club.slug == slugify(slug)) & (Club.isActive.is_(True))))


def make_club_card(data: dict[str, Any]) -> Club:
    title = text_value(get_first(data, "title", "name"))
    return Club(
        name=title,
        slug=unique_club_slug(get_first(data, "slug", default=title)),
        description=text_value(data.get("description")),
        logoUrl=text_value(get_first(data, "bannerImage", "logoUrl", "image")),
        status=text_value(data.get("status"), "Open"),
        createdByService="admin",
    )


def serialize_club_member(member: ClubMember) -> dict[str, Any]:
    user = db().get(User, member.userId)
    name = user.fullName if user is not None else str(member.userId)
    is_publisher = member.role in CLUB_PUBLISHER_ROLES
    return {
        "id": member.clubMemberId,
        "clubId": member.clubId,
        "userId": str(member.userId),
        "title": member.title,
        "createdAt": member.joinedAt.isoformat(),
        "user": user.to_dict() if user is not None else None,
        "name": name,
        "username": user.username if user is not None else "",
        "email": user.email if user is not None else "",
        "initials": initials_for_name(name),
        "canPost": member.canPost or is_publisher,
        "canCreateAnnouncement": member.canCreateAnnouncement or is_publisher,
    }


def club_members_for_club(club: Club) -> list[ClubMember]:
    return db().scalars(
        select(ClubMember).where((ClubMember.clubId == club.clubId) & (ClubMember.status == "active")).order_by(ClubMember.clubMemberId.asc())
    ).all()


def club_member_role_error(club: Club, role: str, member_id: Optional[int] = None) -> Optional[str]:
    if role not in SINGLE_CLUB_MEMBER_ROLES:
        return None
    query = select(ClubMember).where(
        (ClubMember.clubId == club.clubId)
        & (ClubMember.status == "active")
        & (ClubMember.role == role)
    )
    if member_id is not None:
        query = query.where(ClubMember.clubMemberId != member_id)
    return f"{role_label(role)} is already assigned" if db().scalar(query) is not None else None


def is_club_president(club: Club, user: Optional[AuthUser]) -> bool:
    return isinstance(user, User) and db().scalar(
        select(ClubMember).where(
            (ClubMember.clubId == club.clubId)
            & (ClubMember.userId == user.userId)
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
        .where((Post.clubId == club.clubId) & (Post.postType.in_(CLUB_POST_TYPES)) & (Post.isDeleted.is_(False)))
        .order_by(Post.createdAt.desc(), Post.postId.asc())
    ).all()


def club_posts_count(club: Club) -> int:
    return len(club_posts_for_club(club))


def club_followers_count(club: Club) -> int:
    count = db().scalar(select(func.count()).select_from(ClubFollower).where(ClubFollower.clubId == club.clubId))
    return int(count or 0)


def club_follow_for_user(club: Club, userId: Any) -> Optional[ClubFollower]:
    pk = user_pk(userId)
    if pk is None:
        return None
    return db().get(ClubFollower, {"clubId": club.clubId, "userId": pk})


def club_follow_payload(club: Club, user: User) -> dict[str, Any]:
    follower = club_follow_for_user(club, user.userId)
    return {
        "clubId": club.clubId,
        "clubSlug": club.slug,
        "userId": str(user.userId),
        "isFollowing": follower is not None,
        "followers": club_followers_count(club),
        "postsCount": club_posts_count(club),
        "follow": follower.to_dict() if follower is not None else None,
    }


def serialize_club_detail(club: Club) -> dict[str, Any]:
    posts = club_posts_for_club(club)
    followers = club_followers_count(club)
    viewer = current_auth_user()
    viewerUserId = str(viewer.userId) if isinstance(viewer, User) else None
    return {
        "club": {**club.to_dict(), "followers": followers, "postsCount": len(posts)},
        "members": [serialize_club_member(member) for member in club_members_for_club(club)],
        "posts": [serialize_post(post, viewerUserId) for post in posts],
        "followers": followers,
        "postsCount": len(posts),
    }


def is_club_member(clubId: int, userId: Any) -> bool:
    pk = user_pk(userId)
    if pk is None:
        return False
    return (
        db().scalar(
            select(ClubMember).where(
                (ClubMember.clubId == clubId)
                & (ClubMember.userId == pk)
                & (ClubMember.status == "active")
            )
        )
        is not None
    )


def can_publish_club_content(clubId: int, userId: Any, post_type: str) -> bool:
    pk = user_pk(userId)
    permission = ClubMember.canCreateAnnouncement if post_type == "announcement" else ClubMember.canPost
    return pk is not None and db().scalar(
        select(ClubMember).where(
            (ClubMember.clubId == clubId)
            & (ClubMember.userId == pk)
            & (ClubMember.status == "active")
            & (permission.is_(True) | ClubMember.role.in_(CLUB_PUBLISHER_ROLES))
        )
    ) is not None


def resolve_member_user(data: dict[str, Any]) -> Optional[User]:
    userId = optional_int(data.get("userId"))
    if userId is not None:
        return db().get(User, userId)
    username = normalize_username(data.get("username"))
    if username:
        return db().scalar(select(User).where(User.username == username))
    mail = normalize_email(data.get("email"))
    if mail:
        return db().scalar(select(User).where(User.email == mail))
    return None


def create_club_member_resource(club: Club, actor: Optional[AuthUser]):
    data = read_json()
    user = resolve_member_user(data)
    if user is None:
        return jsonify({"error": "userId, username, or email must reference an existing user"}), 400
    role = role_value(data.get("title") or data.get("role"))
    if not can_add_club_member(club, actor, role):
        return jsonify({"error": "admin or club president access required"}), 403
    existing = db().scalar(select(ClubMember).where((ClubMember.clubId == club.clubId) & (ClubMember.userId == user.userId)))
    if existing is not None:
        return jsonify({"error": "user is already a club member"}), 409
    role_error = club_member_role_error(club, role)
    if role_error is not None:
        return jsonify({"error": role_error}), 409
    member = ClubMember(
        clubId=club.clubId,
        userId=user.userId,
        role=role,
        canPost=role in CLUB_PUBLISHER_ROLES,
        canCreateAnnouncement=role in CLUB_PUBLISHER_ROLES,
        addedByService="admin",
    )
    db().add(member)
    db().commit()
    db().refresh(member)
    return jsonify(serialize_club_member(member)), 201


def search_user_payload(user: User) -> dict[str, Any]:
    return {
        "type": "user",
        "id": str(user.userId),
        "title": user.fullName,
        "subtitle": f"@{user.username}",
        "href": f"/{user.userId}",
        "icon": "person",
        "initials": initials_for_name(user.fullName),
        "userId": str(user.userId),
        "username": user.username,
    }


def search_club_payload(club: Club) -> dict[str, Any]:
    return {
        "type": "club",
        "id": club.clubId,
        "title": club.name,
        "subtitle": club.status or "Club",
        "href": f"/clubs/{club.slug}",
        "icon": "groups",
        "slug": club.slug,
    }


def search_post_payload(post: Post) -> dict[str, Any]:
    author = db().get(User, post.authorId)
    return {
        "type": "post",
        "id": str(post.postId),
        "title": post.caption[:72] or "Untitled post",
        "subtitle": author.fullName if author is not None else "Post",
        "href": f"/#{post.postId}",
        "icon": "article",
        "postId": str(post.postId),
    }


def search_marketplace_payload(item: MarketplaceItem) -> dict[str, Any]:
    payload = serialize_marketplace_item(item)
    return {
        "type": "product",
        "id": payload["id"],
        "title": payload["title"],
        "subtitle": payload["price"] or payload["owner"],
        "href": f"/marketplace#{payload['postId']}",
        "icon": "storefront",
        "postId": payload["postId"],
    }


def search_results(query: str, limit: int, types: Optional[set[str]] = None) -> dict[str, Any]:
    normalized = query.lower()
    requested = {value for value in (types or {"user", "club", "post", "product"}) if value}
    users = (
        db().scalars(
            select(User)
            .where((func.lower(User.username).contains(normalized)) | (func.lower(User.fullName).contains(normalized)))
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
            .where((Post.isDeleted.is_(False)) & func.lower(func.coalesce(Post.content, "")).contains(normalized))
            .order_by(Post.createdAt.desc(), Post.postId.asc())
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
            .order_by(MarketplaceItem.createdAt.desc(), MarketplaceItem.itemId.asc())
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
        return str(current_user.userId)
    requested_user_id = optional_int(request.args.get("userId"))
    if requested_user_id is None:
        return None
    return str(requested_user_id) if db().get(User, requested_user_id) is not None else None


def feed_limit() -> Optional[int]:
    limit = optional_int(request.args.get("limit"))
    return max(1, min(limit, 100)) if limit is not None else None


def build_database_feed_graph(session: Session, friendship_pairs: Optional[Sequence[tuple[Any, Any]]] = None):
    users = session.scalars(
        select(User).where(User.isActive.is_(True) & (User.accountRole != "admin")).order_by(User.userId.asc())
    ).all()
    clubs = session.scalars(select(Club).where(Club.isActive.is_(True)).order_by(Club.clubId.asc())).all()
    memberships = session.scalars(select(ClubMember).where(ClubMember.status == "active").order_by(ClubMember.clubMemberId.asc())).all()
    followers = session.scalars(select(ClubFollower).order_by(ClubFollower.clubId.asc(), ClubFollower.userId.asc())).all()
    if friendship_pairs is None:
        friendships = session.scalars(select(Friendship).where(Friendship.status == "accepted").order_by(Friendship.friendshipId.asc())).all()
        friendship_pairs = [(friendship.requesterId, friendship.receiverId) for friendship in friendships]
    return build_feed_graph(
        users=[{"userId": str(user.userId)} for user in users],
        clubs=[{"id": club.clubId} for club in clubs],
        club_memberships=[(member.clubId, str(member.userId)) for member in memberships],
        club_followers=[(follower.clubId, str(follower.userId)) for follower in followers],
        friendships=friendship_pairs,
    )


def update_neo4j_graph(session: Session, *, bootstrap: bool = False):
    users = session.scalars(
        select(User).where(User.isActive.is_(True) & (User.accountRole != "admin")).order_by(User.userId.asc())
    ).all()
    clubs = session.scalars(select(Club).where(Club.isActive.is_(True)).order_by(Club.clubId.asc())).all()
    memberships = session.scalars(select(ClubMember).where(ClubMember.status == "active")).all()
    followers = session.scalars(select(ClubFollower)).all()

    if bootstrap:
        sql_friendships = session.scalars(
            select(Friendship).where(Friendship.status == "accepted").order_by(Friendship.friendshipId.asc())
        ).all()
        friendship_records = [
            {
                "friendshipId": f"{friendship.requesterId}:{friendship.receiverId}",
                "userAId": friendship.requesterId,
                "userBId": friendship.receiverId,
                "createdAt": friendship.createdAt.replace(tzinfo=timezone.utc).isoformat()
                if friendship.createdAt.tzinfo is None
                else friendship.createdAt.isoformat(),
            }
            for friendship in sql_friendships
        ]
    else:
        friendship_records = stored_friendships()

    friendship_pairs = [(row["userAId"], row["userBId"]) for row in friendship_records]
    graph = build_database_feed_graph(session, friendship_pairs)
    member_pairs = {(member.userId, member.clubId) for member in memberships}
    follower_pairs = {(follower.userId, follower.clubId) for follower in followers}

    # ponytail: the dense baseline preserves the current ranker; switch to sparse edges if user x club size becomes material.
    relationships = [
        {
            "userId": user.userId,
            "clubId": club.clubId,
            "weight": graph[f"user:{user.userId}"][f"club:{club.clubId}"]["weight"],
            "isMember": (user.userId, club.clubId) in member_pairs,
            "isFollower": (user.userId, club.clubId) in follower_pairs,
        }
        for user in users
        for club in clubs
    ]
    pagerank = {node: float(data.get("pagerank", 0.0)) for node, data in graph.nodes(data=True)}

    ensure_graph_constraints()
    replace_graph(
        user_ids=[user.userId for user in users],
        club_ids=[club.clubId for club in clubs],
        relationships=relationships,
        pagerank=pagerank,
        bootstrap_friendships=friendship_records if bootstrap else (),
        bootstrap=bootstrap,
    )
    return graph


def ranked_feed_cards(viewerUserId: Optional[str], limit: Optional[int]) -> list[dict[str, Any]]:
    posts = db().scalars(
        select(Post)
        .where(Post.isDeleted.is_(False))
        .order_by(Post.createdAt.desc(), Post.postId.asc())
    ).all()
    serialized_posts = [serialize_post(post, viewerUserId) for post in posts]
    user_ids = [post.authorId for post in posts if post.type_code != 1]
    club_ids = [post.clubId for post in posts if post.type_code == 1 and post.clubId is not None]
    try:
        pagerank, social = feed_signals(
            user_ids=user_ids,
            club_ids=club_ids,
            viewerUserId=viewerUserId,
        )
    except GraphUnavailable:
        app.logger.warning("Neo4j unavailable; serving feed without graph signals")
        pagerank, social = {}, {}
    return rank_feed_posts(
        posts=serialized_posts,
        viewerUserId=viewerUserId,
        pagerank_scores=pagerank,
        social_scores=social,
        limit=limit,
    )


def friendship_between(userAId: Any, userBId: Any) -> Optional[dict[str, Any]]:
    user_a = user_pk(userAId)
    user_b = user_pk(userBId)
    if user_a is None or user_b is None or user_a == user_b:
        return None
    return graph_get_friendship(user_a, user_b)


def friendship_rows(userId: Any) -> list[tuple[User, dict[str, Any]]]:
    pk = user_pk(userId)
    if pk is None:
        return []
    graph_rows = graph_friend_rows(pk)
    friend_ids = [row["friendUserId"] for row in graph_rows]
    if not friend_ids:
        return []
    users = {
        user.userId: user
        for user in db().scalars(select(User).where(User.userId.in_(friend_ids) & User.isActive.is_(True))).all()
    }
    return [
        (users[row["friendUserId"]], row["friendship"])
        for row in graph_rows
        if row["friendUserId"] in users
    ]


def friendship_user_payload(user: User, friendship: dict[str, Any]) -> dict[str, Any]:
    return {
        "userId": str(user.userId),
        "id": str(user.userId),
        "name": user.fullName,
        "username": user.username,
        "acronym": initials_for_name(user.fullName),
        "initials": initials_for_name(user.fullName),
        "friendshipId": friendship["friendshipId"],
        "createdAt": friendship["createdAt"],
    }


def friendship_lists(userId: Any, current_user_id: Any) -> dict[str, list[dict[str, Any]]]:
    # ponytail: load the full profile list; add pagination when friend counts become large enough to affect the UI.
    friends = friendship_rows(userId)
    current_friend_ids = set() if user_pk(userId) == user_pk(current_user_id) else {user.userId for user, _ in friendship_rows(current_user_id)}
    mutuals = [(user, friendship) for user, friendship in friends if user.userId in current_friend_ids]
    return {
        "friendsList": [friendship_user_payload(user, friendship) for user, friendship in friends],
        "mutualsList": [friendship_user_payload(user, friendship) for user, friendship in mutuals],
    }


def friendship_status_payload(current_user: User, target_user: User, include_lists: bool = False) -> dict[str, Any]:
    friendship = friendship_between(current_user.userId, target_user.userId)
    payload = {
        "isFriend": friendship is not None,
        "isSelf": current_user.userId == target_user.userId,
        "friends": len(friendship_rows(target_user.userId)),
        "friendship": friendship,
    }
    if include_lists:
        payload.update(friendship_lists(target_user.userId, current_user.userId))
    return payload


def user_values(data: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": text_value(data.get("name")),
        "username": normalize_username(data.get("username")),
        "mail": normalize_email(data.get("email")),
        "dob": parse_date(data.get("dateOfBirth")),
        "year": read_year_of_study(data.get("yearOfStudy")),
        "department": text_value(data.get("department")),
    }


def validate_user_values(values: dict[str, Any]) -> Optional[str]:
    if not values["name"]:
        return "name is required"
    if not values["username"]:
        return "username is required"
    if not values["mail"] or not valid_email(values["mail"]):
        return "valid email is required"
    if values["mail"].rsplit("@", 1)[-1] not in ALLOWED_EMAIL_DOMAINS:
        return "email domain is not allowed"
    if values["dob"] is None:
        return "dateOfBirth is required"
    if values["year"] is None:
        return "yearOfStudy is required"
    if values["department"] not in DEPARTMENTS:
        return "valid department is required"
    return None


def validate_unique_user(username: str, mail: str, current_user_id: Optional[int] = None):
    existing_username = db().scalar(select(User).where(User.username == username))
    if existing_username is not None and existing_username.userId != current_user_id:
        return jsonify({"error": "username already exists"}), 409
    existing_mail = db().scalar(select(User).where(User.email == mail))
    if existing_mail is not None and existing_mail.userId != current_user_id:
        return jsonify({"error": "email already exists"}), 409
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
        fullName=values["name"],
        username=values["username"],
        email=values["mail"],
        dateOfBirth=values["dob"],
        semester=values["year"],
        department=values["department"],
        passwordHash=generate_password_hash(password or os.urandom(32).hex()),
    )
    return user, None, None


def update_user_from_payload(user: User, data: dict[str, Any]):
    values = user_values(
        {
            "name": get_first(data, "name", default=user.fullName),
            "username": get_first(data, "username", default=user.username),
            "email": data.get("email", user.email),
            "dateOfBirth": data.get("dateOfBirth", user.dateOfBirth.isoformat() if user.dateOfBirth else ""),
            "yearOfStudy": data.get("yearOfStudy", user.semester),
            "department": get_first(data, "department", default=user.department),
        }
    )
    validation_error = validate_user_values(values)
    if validation_error is not None:
        return jsonify({"error": validation_error}), 400
    unique_error = validate_unique_user(values["username"], values["mail"], current_user_id=user.userId)
    if unique_error is not None:
        return unique_error
    if "password" in data:
        password = text_value(data.get("password"))
        if len(password) < 6:
            return jsonify({"error": "password must be at least 6 characters"}), 400
        user.passwordHash = generate_password_hash(password)
    user.fullName = values["name"]
    user.username = values["username"]
    user.email = values["mail"]
    user.dateOfBirth = values["dob"]
    user.semester = values["year"]
    user.department = values["department"]
    return None


def require_post_owner_or_admin(post: Post):
    user = current_auth_user()
    if user is None:
        return jsonify({"error": "unauthorized"}), 401
    if isinstance(user, User) and post.authorId == user.userId:
        return None
    if is_admin_user(user):
        return None
    return jsonify({"error": "only the post author can delete this post"}), 403


def post_like_payload(post: Post, user: User) -> dict[str, Any]:
    liked = post_like_for_user(post.postId, user.userId) is not None
    return {
        "post": serialize_post(post, str(user.userId)),
        "postId": str(post.postId),
        "likes": post.likeCount,
        "liked": liked,
        "likedByCurrentUser": liked,
    }


def comment_payload(comment: Comment) -> dict[str, Any]:
    user = db().get(User, comment.userId)
    name = user.fullName if user is not None else str(comment.userId)
    createdAt = comment.createdAt.isoformat()
    return {
        "id": str(comment.commentId),
        "commentId": str(comment.commentId),
        "postId": str(comment.postId),
        "userId": str(comment.userId),
        "author": name,
        "username": user.username if user is not None else "",
        "initials": initials_for_name(name),
        "content": comment.content,
        "body": comment.content,
        "createdAt": createdAt,
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
    userId: int,
    actorId: int,
    notification_type: str,
    targetType: str,
    targetId: Any,
    message: str,
) -> None:
    if userId == actorId:
        return
    if db().get(User, userId) is None or db().get(User, actorId) is None:
        return
    db().add(
        Notification(
            userId=userId,
            actorId=actorId,
            type=notification_type,
            targetType=targetType,
            targetId=text_value(targetId),
            message=compact_text(message),
        )
    )


def add_notifications_for_users(
    user_ids: Sequence[int],
    actorId: int,
    notification_type: str,
    targetType: str,
    targetId: Any,
    message: str,
) -> None:
    seen: set[int] = set()
    for userId in user_ids:
        if userId in seen:
            continue
        seen.add(userId)
        add_notification(userId, actorId, notification_type, targetType, targetId, message)


def friend_user_ids(userId: int) -> list[int]:
    return [user.userId for user, _ in friendship_rows(userId)]


def club_audience_user_ids(clubId: int) -> list[int]:
    follower_ids = db().scalars(select(ClubFollower.userId).where(ClubFollower.clubId == clubId)).all()
    member_ids = db().scalars(
        select(ClubMember.userId).where((ClubMember.clubId == clubId) & (ClubMember.status == "active"))
    ).all()
    return [*follower_ids, *member_ids]


def notify_new_post(post: Post) -> None:
    author = db().get(User, post.authorId)
    if author is None:
        return
    if post.postType in CLUB_POST_TYPES and post.clubId is not None:
        club = db().get(Club, post.clubId)
        club_name = club.name if club is not None else "a club"
        add_notifications_for_users(
            club_audience_user_ids(post.clubId),
            post.authorId,
            "club_post",
            "post",
            post.postId,
            f"{author.fullName} posted in {club_name}: {post.content or 'View the club update.'}",
        )
        return
    try:
        audience = friend_user_ids(post.authorId)
    except GraphUnavailable:
        app.logger.warning("Neo4j unavailable; skipping friend post notifications")
        return
    add_notifications_for_users(
        audience,
        post.authorId,
        "friend_post",
        "post",
        post.postId,
        f"{author.fullName} shared a new post: {post.content or 'View the post.'}",
    )


def notification_href(notification: Notification, actor: Optional[User], post: Optional[Post], club: Optional[Club]) -> str:
    if notification.type in {"friend_request", "friend_accept"}:
        return f"/{actor.username}" if actor is not None else "/"
    if notification.type == "club_post" and club is not None:
        return f"/clubs/{club.slug}#{notification.targetId}"
    return f"/#{notification.targetId}" if notification.targetId else "/"


def notification_title(notification: Notification, actor: Optional[User], post: Optional[Post], club: Optional[Club]) -> str:
    actor_name = actor.fullName if actor is not None else "Someone"
    if notification.type in {"friend_request", "friend_accept"}:
        return f"{actor_name} is now your friend"
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
    actor = db().get(User, notification.actorId)
    post = db().get(Post, optional_int(notification.targetId)) if notification.targetType == "post" else None
    club = db().get(Club, post.clubId) if post is not None and post.clubId is not None else None
    source = "club" if notification.type == "club_post" else "friend"
    actor_name = actor.fullName if actor is not None else "Campus Nexus"
    return {
        "id": str(notification.notificationId),
        "notificationId": str(notification.notificationId),
        "type": notification.type,
        "source": source,
        "title": notification_title(notification, actor, post, club),
        "body": notification_body(notification, post),
        "time": relative_time(notification.createdAt),
        "createdAt": notification.createdAt.isoformat(),
        "href": notification_href(notification, actor, post, club),
        "actionLabel": "View profile" if notification.type in {"friend_request", "friend_accept"} else "View post",
        "iconText": initials_for_name(actor_name),
        "iconName": "groups" if source == "club" else {"post_like": "favorite", "post_comment": "chat_bubble", "friend_post": "post_add"}.get(notification.type, "person"),
        "isRead": notification.isRead,
        "unread": not notification.isRead,
    }


def create_marketplace_item_from_payload(data: dict[str, Any]):
    user = current_auth_user()
    if not isinstance(user, User):
        return jsonify({"error": "unauthorized"}), 401
    item = MarketplaceItem(
        sellerId=user.userId,
        title=text_value(get_first(data, "title", "itemName", "caption"), "Marketplace listing"),
        description=text_value(data.get("description")),
        category=text_value(data.get("category"), "Marketplace"),
        price=parse_price(data.get("price")),
        imageUrl=text_value(get_first(data, "image", "photoUrl", "mediaUrl")),
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
        .order_by(MarketplaceItem.createdAt.desc(), MarketplaceItem.itemId.asc())
    ).all()


def serialize_marketplace_item(item: MarketplaceItem) -> dict[str, Any]:
    user = db().get(User, item.sellerId)
    createdAt = item.createdAt.isoformat()
    return {
        "id": str(item.itemId),
        "postId": str(item.itemId),
        "title": item.title,
        "owner": user.fullName if user is not None else str(item.sellerId),
        "mode": "Sell",
        "category": item.category or "Marketplace",
        "condition": "",
        "price": format_price(item.price),
        "location": "",
        "description": item.description or "",
        "image": item.imageUrl or "",
        "tags": [],
        "contact": user.email if user is not None else "",
        "preferredExchange": "",
        "createdAt": createdAt,
    }


def leaderboard_entries() -> list[dict[str, Any]]:
    rows = db().execute(
        select(User, func.coalesce(func.sum(UserPoint.points), 0).label("totalXp"))
        .join(UserPoint, UserPoint.userId == User.userId)
        .group_by(User.userId)
        .having(func.sum(UserPoint.points) > 0)
        .order_by(func.sum(UserPoint.points).desc(), User.username.asc())
    ).all()
    entries: list[dict[str, Any]] = []
    for index, (user, totalXp) in enumerate(rows, start=1):
        entries.append(
            {
                "rank": index,
                "userId": str(user.userId),
                "id": str(user.userId),
                "name": user.fullName,
                "username": user.username,
                "acronym": initials_for_name(user.fullName),
                "initials": initials_for_name(user.fullName),
                "totalXp": int(totalXp or 0),
            }
        )
    return entries


def award_user_xp(user: User, xp: int) -> int:
    db().add(UserPoint(userId=user.userId, points=xp, reason="game_xp"))
    db().commit()
    total = db().scalar(select(func.coalesce(func.sum(UserPoint.points), 0)).where(UserPoint.userId == user.userId))
    return int(total or 0)


def serialize_conversations() -> list[dict[str, Any]]:
    threads = db().scalars(select(ChatThread).order_by(ChatThread.createdAt.desc(), ChatThread.threadId.asc())).all()
    return [
        {
            "id": thread.threadId,
            "name": f"{thread.threadType.title()} Chat",
            "preview": "",
            "time": thread.createdAt.isoformat(),
            "active": index == 0,
        }
        for index, thread in enumerate(threads)
    ]


def serialize_messages() -> list[dict[str, Any]]:
    messages = db().scalars(select(ChatMessage).where(ChatMessage.isDeleted.is_(False)).order_by(ChatMessage.createdAt.asc(), ChatMessage.messageId.asc())).all()
    current_user = current_auth_user()
    current_user_id = current_user.userId if isinstance(current_user, User) else None
    return [
        {
            "id": message.messageId,
            "side": "right" if current_user_id is not None and message.senderId == current_user_id else "left",
            "text": message.content or "",
            "time": message.createdAt.isoformat(),
            "status": None,
        }
        for message in messages
    ]


def profile_payload(user: User) -> dict[str, Any]:
    return {"avatar": user.profilePhotoUrl or PROFILE_AVATAR, "major": user.department or "", "bio": user.bio or ""}


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
def protect_cookie_mutations():
    if (
        request.method in {"POST", "PUT", "PATCH", "DELETE"}
        and request.cookies.get(JWT_COOKIE_NAME)
        and request.headers.get("Origin") != CORS_ORIGIN
    ):
        return jsonify({"error": "invalid request origin"}), 403
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


@app.errorhandler(GraphUnavailable)
def handle_graph_error(error):
    return jsonify({"error": "relationship graph unavailable"}), 503


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = CORS_ORIGIN
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    response.headers.add("Vary", "Origin")
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
        if not username_query:
            admin_error = require_admin_user()
            if admin_error is not None:
                return admin_error
        statement = select(User).where(User.isActive.is_(True))
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


@app.route("/api/users/<userId>", methods=["GET", "PATCH", "PUT", "DELETE"])
def users_item(userId: str):
    user = get_user(userId)
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


@app.route("/api/users/<userId>/friends", methods=["GET", "POST", "DELETE"])
def user_friendship_collection(userId: str):
    target_user = get_user(userId)
    if target_user is None:
        return jsonify({"error": "not found"}), 404
    current_user = current_auth_user()
    if not isinstance(current_user, User):
        return jsonify({"error": "unauthorized"}), 401
    if request.method == "GET":
        include_lists = read_bool(request.args.get("includeLists"))
        return jsonify(friendship_status_payload(current_user, target_user, include_lists))
    if current_user.userId == target_user.userId:
        return jsonify({"error": "users cannot befriend themselves"}), 400
    if request.method == "DELETE":
        graph_delete_friendship(current_user.userId, target_user.userId)
        return jsonify(friendship_status_payload(current_user, target_user))
    _, created = graph_create_friendship(current_user.userId, target_user.userId)
    if created:
        try:
            add_notification(
                target_user.userId,
                current_user.userId,
                "friend_accept",
                "user",
                current_user.userId,
                f"{current_user.fullName} added you as a friend.",
            )
            db().commit()
        except SQLAlchemyError:
            db().rollback()
            app.logger.exception("Friendship created but notification could not be saved")
    return jsonify(friendship_status_payload(current_user, target_user)), 201 if created else 200


@app.route("/api/posts", methods=["GET", "POST"])
def posts_collection():
    if request.method == "POST":
        return create_post_from_payload(read_json())
    posts = db().scalars(select(Post).where(Post.isDeleted.is_(False)).order_by(Post.createdAt.desc(), Post.postId.asc())).all()
    return jsonify([serialize_post(post) for post in posts])


@app.route("/api/posts/<postId>", methods=["GET", "PATCH", "PUT", "DELETE"])
def posts_item(postId: str):
    post = db().get(Post, optional_int(postId))
    if post is None or post.isDeleted:
        return jsonify({"error": "not found"}), 404
    if request.method == "GET":
        return jsonify(serialize_post(post))
    if request.method == "DELETE":
        owner_error = require_post_owner_or_admin(post)
        if owner_error is not None:
            return owner_error
        post.isDeleted = True
        db().commit()
        return ("", 204)
    return update_post_from_payload(post, read_json())


@app.route("/api/posts/<postId>/like", methods=["GET", "POST", "DELETE"])
def posts_like_item(postId: str):
    post = db().get(Post, optional_int(postId))
    if post is None or post.isDeleted:
        return jsonify({"error": "not found"}), 404
    user = current_auth_user()
    if not isinstance(user, User):
        return jsonify({"error": "unauthorized"}), 401
    existing = post_like_for_user(post.postId, user.userId)
    if request.method == "GET":
        return jsonify(post_like_payload(post, user))
    if request.method == "DELETE":
        if existing is not None:
            db().delete(existing)
            post.likeCount = max(post.likeCount - 1, 0)
            post.engagementScore = float(post.likeCount + post.shareCount * 2)
            db().commit()
            db().refresh(post)
        return jsonify(post_like_payload(post, user))
    if existing is None:
        db().add(PostLike(postId=post.postId, userId=user.userId))
        post.likeCount += 1
        post.engagementScore = float(post.likeCount + post.shareCount * 2)
        owner = db().get(User, post.authorId)
        if owner is not None and owner.userId != user.userId:
            add_notification(
                owner.userId,
                user.userId,
                "post_like",
                "post",
                post.postId,
                f"{user.fullName} liked your post: {post.content or 'View the post.'}",
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
        .where(Notification.userId == user.userId)
        .order_by(Notification.createdAt.desc(), Notification.notificationId.desc())
    ).all()
    unread_count = sum(1 for item in items if not item.isRead)
    return jsonify({"items": [serialize_notification(item) for item in items], "total": len(items), "unreadCount": unread_count})


@app.route("/api/notifications/<notificationId>", methods=["DELETE"])
def notification_item(notificationId: str):
    user = current_auth_user()
    if not isinstance(user, User):
        return jsonify({"error": "unauthorized"}), 401
    notification = db().get(Notification, optional_int(notificationId))
    if notification is None or notification.userId != user.userId:
        return jsonify({"error": "not found"}), 404
    db().delete(notification)
    db().commit()
    return ("", 204)


@app.route("/api/posts/<postId>/comments", methods=["GET", "POST"])
def post_comments_collection(postId: str):
    post = db().get(Post, optional_int(postId))
    if post is None or post.isDeleted:
        return jsonify({"error": "not found"}), 404
    if request.method == "GET":
        comments = db().scalars(
            select(Comment)
            .where((Comment.postId == post.postId) & (Comment.isDeleted.is_(False)))
            .order_by(Comment.createdAt.asc(), Comment.commentId.asc())
        ).all()
        return jsonify({"items": [comment_payload(comment) for comment in comments], "total": len(comments)})
    user = current_auth_user()
    if not isinstance(user, User):
        return jsonify({"error": "unauthorized"}), 401
    content = text_value(get_first(read_json(), "content", "body", "text"))
    if not content:
        return jsonify({"error": "content is required"}), 400
    comment = Comment(postId=post.postId, userId=user.userId, content=content)
    db().add(comment)
    post.commentCount += 1
    post.engagementScore = float(post.likeCount + post.shareCount * 2 + post.commentCount)
    if post.authorId != user.userId:
        add_notification(
            post.authorId,
            user.userId,
            "post_comment",
            "post",
            post.postId,
            f"{user.fullName} commented: {content}",
        )
    db().commit()
    db().refresh(comment)
    db().refresh(post)
    return jsonify({"comment": comment_payload(comment), "post": serialize_post(post), "comments": post.commentCount}), 201


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


@app.route("/api/feed/trending/<int:itemId>", methods=["GET", "PATCH", "PUT", "DELETE"])
@app.route("/api/feed/suggested-people/<int:itemId>", methods=["GET", "PATCH", "PUT", "DELETE"])
@app.route("/api/clubs/spotlight/<int:itemId>", methods=["GET", "PATCH", "PUT", "DELETE"])
@app.route("/api/clubs/stats/<int:itemId>", methods=["GET", "PATCH", "PUT", "DELETE"])
@app.route("/api/games/top-rated/<int:itemId>", methods=["GET", "PATCH", "PUT", "DELETE"])
@app.route("/api/games/recent-activity/<int:itemId>", methods=["GET", "PATCH", "PUT", "DELETE"])
def schema_removed_item(itemId: int):
    return jsonify({"error": "resource is not part of the normalized schema"}), 410


@app.route("/api/clubs")
def clubs():
    return jsonify({"spotlightClubs": [], "clubCards": [club.to_dict() for club in db().scalars(select(Club).where(Club.isActive.is_(True)).order_by(Club.name.asc())).all()], "stats": []})


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
    return jsonify([club.to_dict() for club in db().scalars(select(Club).where(Club.isActive.is_(True)).order_by(Club.name.asc())).all()])


@app.route("/api/clubs/items/<int:itemId>", methods=["GET", "PATCH", "PUT", "DELETE"])
def club_item(itemId: int):
    club = db().get(Club, itemId)
    if club is None:
        return jsonify({"error": "not found"}), 404
    if request.method == "GET":
        return jsonify(club.to_dict())
    admin_error = require_admin_user()
    if admin_error is not None:
        return admin_error
    if request.method == "DELETE":
        club.isActive = False
        db().commit()
        return ("", 204)
    data = read_json()
    if "title" in data or "name" in data:
        club.name = text_value(get_first(data, "title", "name"), club.name)
    if "slug" in data:
        club.slug = unique_club_slug(data.get("slug"), club.clubId)
    if "description" in data:
        club.description = text_value(data.get("description"))
    if "status" in data:
        club.status = text_value(data.get("status"), "Open")
    if "bannerImage" in data or "logoUrl" in data:
        club.logoUrl = text_value(get_first(data, "bannerImage", "logoUrl"))
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
    existing = club_follow_for_user(club, user.userId)
    if request.method == "GET":
        return jsonify(club_follow_payload(club, user))
    if request.method == "DELETE":
        if existing is not None:
            db().delete(existing)
            db().commit()
        return jsonify(club_follow_payload(club, user))
    if existing is None:
        db().add(ClubFollower(clubId=club.clubId, userId=user.userId))
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
    if member is None or member.clubId != club.clubId:
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
    if "canPost" in data:
        if not isinstance(data["canPost"], bool):
            return jsonify({"error": "canPost must be a boolean"}), 400
        member.canPost = data["canPost"]
    if "title" in data or "role" in data:
        role = role_value(data.get("title") or data.get("role"))
        role_error = club_member_role_error(club, role, member.clubMemberId)
        if role_error is not None:
            return jsonify({"error": role_error}), 409
        member.role = role
        member.canPost = role in CLUB_PUBLISHER_ROLES
        member.canCreateAnnouncement = role in CLUB_PUBLISHER_ROLES
    db().commit()
    db().refresh(member)
    return jsonify(serialize_club_member(member))


@app.route("/api/games")
def games():
    game_cards = [game.to_dict() for game in db().scalars(select(Game).where(Game.isActive.is_(True)).order_by(Game.createdAt.desc(), Game.gameId.asc())).all()]
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
    return jsonify({"userId": str(user.userId), "awardedXp": xp, "totalXp": total})


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
    return jsonify([game.to_dict() for game in db().scalars(select(Game).order_by(Game.createdAt.desc(), Game.gameId.asc())).all()])


@app.route("/api/games/items/<int:itemId>", methods=["GET", "PATCH", "PUT", "DELETE"])
def game_item(itemId: int):
    item = db().get(Game, itemId)
    if item is None:
        return jsonify({"error": "not found"}), 404
    if request.method == "GET":
        return jsonify(item.to_dict())
    if request.method == "DELETE":
        item.isActive = False
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


@app.route("/api/marketplace/items/<postId>", methods=["GET", "PATCH", "PUT", "DELETE"])
def marketplace_item(postId: str):
    item = db().get(MarketplaceItem, optional_int(postId))
    if item is None or item.status == "removed":
        return jsonify({"error": "not found"}), 404
    if request.method == "GET":
        return jsonify(serialize_marketplace_item(item))
    user = current_auth_user()
    if not (is_admin_user(user) or (isinstance(user, User) and item.sellerId == user.userId)):
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
        item.imageUrl = text_value(get_first(data, "image", "photoUrl"))
    db().commit()
    db().refresh(item)
    return jsonify(serialize_marketplace_item(item))


@app.route("/api/messages")
def messages():
    return jsonify({"conversations": serialize_conversations(), "messages": serialize_messages()})


@app.route("/api/messages/conversations", methods=["GET", "POST"])
def conversations_collection():
    if request.method == "POST":
        thread = ChatThread(threadType=text_value(read_json().get("threadType"), "direct"))
        db().add(thread)
        db().commit()
        db().refresh(thread)
        return jsonify(serialize_conversations()[0] if serialize_conversations() else {"id": thread.threadId}), 201
    return jsonify(serialize_conversations())


@app.route("/api/messages/conversations/<int:itemId>", methods=["GET", "PATCH", "PUT", "DELETE"])
def conversation_item(itemId: int):
    item = db().get(ChatThread, itemId)
    if item is None:
        return jsonify({"error": "not found"}), 404
    if request.method == "DELETE":
        db().delete(item)
        db().commit()
        return ("", 204)
    return jsonify({"id": item.threadId, "name": f"{item.threadType.title()} Chat", "preview": "", "time": item.createdAt.isoformat()})


@app.route("/api/messages/items", methods=["GET", "POST"])
def messages_collection():
    if request.method == "POST":
        user = current_auth_user()
        if not isinstance(user, User):
            return jsonify({"error": "unauthorized"}), 401
        data = read_json()
        threadId = optional_int(data.get("threadId")) or optional_int(data.get("threadId"))
        if threadId is None:
            thread = ChatThread(threadType="direct")
            db().add(thread)
            db().flush()
            threadId = thread.threadId
        item = ChatMessage(threadId=threadId, senderId=user.userId, content=text_value(get_first(data, "text", "content")))
        db().add(item)
        db().commit()
        db().refresh(item)
        return jsonify({"id": item.messageId, "side": "right", "text": item.content or "", "time": item.createdAt.isoformat()}), 201
    return jsonify(serialize_messages())


@app.route("/api/messages/items/<int:itemId>", methods=["GET", "PATCH", "PUT", "DELETE"])
def message_item(itemId: int):
    item = db().get(ChatMessage, itemId)
    if item is None:
        return jsonify({"error": "not found"}), 404
    if request.method == "DELETE":
        item.isDeleted = True
        db().commit()
        return ("", 204)
    if request.method in {"PATCH", "PUT"}:
        item.content = text_value(get_first(read_json(), "text", "content"), item.content or "")
        db().commit()
        db().refresh(item)
    return jsonify({"id": item.messageId, "side": "left", "text": item.content or "", "time": item.createdAt.isoformat()})


@app.route("/api/auth/signup", methods=["POST"])
def auth_signup():
    user, error_response, status = create_user_from_payload(read_json(), require_password=True)
    if error_response is not None:
        return error_response, status
    db().add(user)
    db().flush()
    db().commit()
    db().refresh(user)
    return auth_response(user, 201)


@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = read_json()
    login = normalize_login(get_first(data, "login", "username", "email"))
    password = text_value(data.get("password"))
    if not login or not password:
        return jsonify({"error": "login and password are required"}), 400
    if admin_login_matches(login, password):
        return auth_response(AdminIdentity())
    user = find_auth_user_by_login(login)
    if user is None or not check_password_hash(user.passwordHash, password):
        return jsonify({"error": "invalid login or password"}), 401
    return auth_response(user)


@app.route("/api/auth/me")
def auth_me():
    user = current_auth_user()
    if user is None:
        return jsonify({"error": "unauthorized"}), 401
    return jsonify({"user": user.to_dict()})


@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    response = app.make_response(("", 204))
    response.delete_cookie(JWT_COOKIE_NAME, path="/", secure=JWT_COOKIE_SECURE, samesite="Lax")
    return response


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
    user.profilePhotoUrl = text_value(data.get("avatar"), user.profilePhotoUrl or PROFILE_AVATAR)
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
        row.profilePhotoUrl = None
        row.bio = None
        db().commit()
        return ("", 204)
    data = read_json()
    if "avatar" in data:
        row.profilePhotoUrl = text_value(data.get("avatar"), PROFILE_AVATAR)
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
