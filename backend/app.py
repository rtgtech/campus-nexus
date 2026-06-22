from __future__ import annotations

import os
import re
import secrets
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Any, Callable, Optional, Sequence, TypeVar

from flask import Flask, g, jsonify, request
from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    func,
    select,
    text,
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

DEFAULT_POST_IMAGE = ""
DEFAULT_CLUB_IMAGE = ""
PROFILE_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' rx='64' fill='%23e9e7f3'/%3E%3Ccircle cx='64' cy='48' r='24' fill='%23777d86'/%3E%3Cpath d='M24 116c6-27 22-41 40-41s34 14 40 41' fill='%23777d86'/%3E%3C/svg%3E"

app = Flask(__name__)


class Base(DeclarativeBase):
    pass


class OrderedResourceMixin:
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class Post(Base):
    __tablename__ = "posts"

    post_id: Mapped[str] = mapped_column(String(32), primary_key=True, unique=True)
    author_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.user_id"), index=True, nullable=False)
    club_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("club_cards.id"), index=True, nullable=True)
    post_type: Mapped[int] = mapped_column("type", Integer, default=0, nullable=False)
    media_url: Mapped[str] = mapped_column(Text, default="", nullable=False)
    caption: Mapped[str] = mapped_column(Text, default="", nullable=False)
    likes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    shares: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    hashtags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    mentions: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    price: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    def to_dict(self, author_name: Optional[str] = None, club_slug: Optional[str] = None) -> dict[str, Any]:
        created_at = self.created_at.isoformat()
        tags = self.hashtags or []
        caption = self.caption or ""
        title = caption[:72] or ("Marketplace listing" if self.post_type == 2 else "Untitled post")

        return {
            "post_id": self.post_id,
            "id": self.post_id,
            "author_id": self.author_id,
            "authorId": self.author_id,
            "author": author_name or self.author_id,
            "club_id": self.club_id,
            "clubId": self.club_id,
            "clubSlug": club_slug,
            "type": self.post_type,
            "media_url": self.media_url,
            "mediaUrl": self.media_url,
            "caption": caption,
            "likes": self.likes,
            "shares": self.shares,
            "hashtags": tags,
            "mentions": self.mentions or [],
            "price": self.price,
            "description": self.description,
            "created_at": created_at,
            "createdAt": created_at,
            "meta": created_at,
            "title": title,
            "body": self.description if self.post_type == 2 and self.description else caption,
            "image": self.media_url,
            "tag": tags[0] if tags else "#campusnexus",
            "comments": "0",
        }


class PostLike(Base):
    __tablename__ = "post_likes"
    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_post_likes_post_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    post_id: Mapped[str] = mapped_column(String(32), ForeignKey("posts.post_id"), index=True, nullable=False)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.user_id"), index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "post_id": self.post_id,
            "postId": self.post_id,
            "user_id": self.user_id,
            "userId": self.user_id,
            "created_at": self.created_at.isoformat(),
            "createdAt": self.created_at.isoformat(),
        }



class TrendingTopic(OrderedResourceMixin, Base):
    __tablename__ = "trending_topics"

    label: Mapped[str] = mapped_column(String(120), nullable=False)
    tag: Mapped[str] = mapped_column(String(120), nullable=False)
    posts: Mapped[str] = mapped_column(String(120), nullable=False)

    def to_dict(self) -> dict[str, Any]:
        return {"id": self.id, "label": self.label, "tag": self.tag, "posts": self.posts}


class SuggestedPerson(OrderedResourceMixin, Base):
    __tablename__ = "suggested_people"

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    subtitle: Mapped[str] = mapped_column(String(180), nullable=False)

    def to_dict(self) -> dict[str, Any]:
        return {"id": self.id, "name": self.name, "subtitle": self.subtitle}


class ClubCard(OrderedResourceMixin, Base):
    __tablename__ = "club_cards"

    title: Mapped[str] = mapped_column(String(180), nullable=False)
    slug: Mapped[str] = mapped_column(String(220), unique=True, index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(120), nullable=False)
    icon: Mapped[str] = mapped_column(String(80), nullable=False)
    icon_bg: Mapped[str] = mapped_column(String(120), nullable=False)
    banner_bg: Mapped[str] = mapped_column(String(120), nullable=False)
    banner_image: Mapped[str] = mapped_column(Text, nullable=False)
    extra_members: Mapped[str] = mapped_column(String(80), nullable=False)
    extra_members_class: Mapped[str] = mapped_column(String(160), nullable=False)
    avatars: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    status_class: Mapped[str] = mapped_column(String(160), nullable=False)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "slug": self.slug,
            "description": self.description,
            "status": self.status,
            "icon": self.icon,
            "iconBg": self.icon_bg,
            "bannerBg": self.banner_bg,
            "bannerImage": self.banner_image,
            "extraMembers": self.extra_members,
            "extraMembersClass": self.extra_members_class,
            "avatars": self.avatars or [],
            "statusClass": self.status_class,
        }


class ClubMember(Base):
    __tablename__ = "club_members"
    __table_args__ = (UniqueConstraint("club_id", "user_id", name="uq_club_members_club_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    club_id: Mapped[int] = mapped_column(Integer, ForeignKey("club_cards.id"), index=True, nullable=False)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.user_id"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class ClubFollower(Base):
    __tablename__ = "club_followers"
    __table_args__ = (UniqueConstraint("club_id", "user_id", name="uq_club_followers_club_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    club_id: Mapped[int] = mapped_column(Integer, ForeignKey("club_cards.id"), index=True, nullable=False)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.user_id"), index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "club_id": self.club_id,
            "clubId": self.club_id,
            "user_id": self.user_id,
            "userId": self.user_id,
            "created_at": self.created_at.isoformat(),
            "createdAt": self.created_at.isoformat(),
        }


class SpotlightClub(OrderedResourceMixin, Base):
    __tablename__ = "spotlight_clubs"

    badge: Mapped[str] = mapped_column(String(80), nullable=False)
    badge_fill: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    badge_class: Mapped[str] = mapped_column(String(160), nullable=False)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    image: Mapped[str] = mapped_column(Text, nullable=False)
    icon: Mapped[str] = mapped_column(String(80), nullable=False)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "badge": self.badge,
            "badgeFill": self.badge_fill,
            "badgeClass": self.badge_class,
            "title": self.title,
            "description": self.description,
            "image": self.image,
            "icon": self.icon,
        }


class ClubStat(OrderedResourceMixin, Base):
    __tablename__ = "club_stats"

    value: Mapped[str] = mapped_column(String(80), nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    class_name: Mapped[str] = mapped_column(String(240), nullable=False)
    value_class: Mapped[str] = mapped_column(String(180), nullable=False)
    label_class: Mapped[str] = mapped_column(String(180), nullable=False)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "value": self.value,
            "label": self.label,
            "className": self.class_name,
            "valueClass": self.value_class,
            "labelClass": self.label_class,
        }


class GameCard(OrderedResourceMixin, Base):
    __tablename__ = "game_cards"

    title: Mapped[str] = mapped_column(String(160), nullable=False)
    image: Mapped[str] = mapped_column(Text, nullable=False)
    online: Mapped[str] = mapped_column(String(80), nullable=False)
    rating: Mapped[str] = mapped_column(String(40), nullable=False)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "image": self.image,
            "online": self.online,
            "rating": self.rating,
        }


class TopRatedGame(OrderedResourceMixin, Base):
    __tablename__ = "top_rated_games"

    rank: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    subtitle: Mapped[str] = mapped_column(String(180), nullable=False)
    rating: Mapped[str] = mapped_column(String(40), nullable=False)
    badge: Mapped[str] = mapped_column(String(80), nullable=False)
    image: Mapped[str] = mapped_column(Text, nullable=False)
    badge_class: Mapped[str] = mapped_column(String(160), nullable=False)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "rank": self.rank,
            "title": self.title,
            "subtitle": self.subtitle,
            "rating": self.rating,
            "badge": self.badge,
            "image": self.image,
            "badgeClass": self.badge_class,
        }


class RecentGameActivity(OrderedResourceMixin, Base):
    __tablename__ = "recent_game_activity"

    title: Mapped[str] = mapped_column(String(160), nullable=False)
    subtitle: Mapped[str] = mapped_column(String(180), nullable=False)
    image: Mapped[str] = mapped_column(Text, nullable=False)

    def to_dict(self) -> dict[str, Any]:
        return {"id": self.id, "title": self.title, "subtitle": self.subtitle, "image": self.image}


class MarketplaceItem(OrderedResourceMixin, Base):
    __tablename__ = "marketplace_items"

    title: Mapped[str] = mapped_column(String(180), nullable=False)
    owner: Mapped[str] = mapped_column(String(160), nullable=False)
    mode: Mapped[str] = mapped_column(String(80), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    condition: Mapped[str] = mapped_column(String(120), nullable=False)
    price: Mapped[str] = mapped_column(String(80), nullable=False)
    location: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    image: Mapped[str] = mapped_column(Text, nullable=False)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    contact: Mapped[str] = mapped_column(String(160), nullable=False)
    preferred_exchange: Mapped[str] = mapped_column(String(180), nullable=False)
    created_at_label: Mapped[str] = mapped_column(String(80), nullable=False)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "owner": self.owner,
            "mode": self.mode,
            "category": self.category,
            "condition": self.condition,
            "price": self.price,
            "location": self.location,
            "description": self.description,
            "image": self.image,
            "tags": self.tags or [],
            "contact": self.contact,
            "preferredExchange": self.preferred_exchange,
            "createdAt": self.created_at_label,
        }


class Conversation(OrderedResourceMixin, Base):
    __tablename__ = "conversations"

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    preview: Mapped[str] = mapped_column(Text, nullable=False)
    time: Mapped[str] = mapped_column(String(80), nullable=False)
    active: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    avatar: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    role: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    unread: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    typing: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    def to_dict(self) -> dict[str, Any]:
        return omit_none(
            {
                "id": self.id,
                "name": self.name,
                "preview": self.preview,
                "time": self.time,
                "active": self.active,
                "avatar": self.avatar,
                "role": self.role,
                "unread": self.unread,
                "typing": self.typing,
            }
        )


class ChatMessage(OrderedResourceMixin, Base):
    __tablename__ = "chat_messages"

    side: Mapped[str] = mapped_column(String(20), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    time: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    status: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)

    def to_dict(self) -> dict[str, Any]:
        return omit_none(
            {"id": self.id, "side": self.side, "text": self.text, "time": self.time, "status": self.status}
        )


class Profile(Base):
    __tablename__ = "profiles"

    user: Mapped[str] = mapped_column(String(160), primary_key=True)
    avatar: Mapped[str] = mapped_column(Text, nullable=False)
    major: Mapped[str] = mapped_column(String(220), nullable=False)
    bio: Mapped[str] = mapped_column(Text, nullable=False)

    def to_dict(self, include_user: bool = True) -> dict[str, Any]:
        payload = {"avatar": self.avatar, "major": self.major, "bio": self.bio}
        if include_user:
            return {"user": self.user, **payload}
        return payload


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[str] = mapped_column(String(32), primary_key=True, unique=True)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    mail: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    dob: Mapped[str] = mapped_column(String(20), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    department: Mapped[str] = mapped_column(String(80), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self) -> dict[str, Any]:
        acronym = initials_for_name(self.name)
        return {
            "user_id": self.user_id,
            "userId": self.user_id,
            "id": self.user_id,
            "name": self.name,
            "username": self.username,
            "mail": self.mail,
            "email": self.mail,
            "DOB": self.dob,
            "dateOfBirth": self.dob,
            "year": self.year,
            "yearOfStudy": self.year,
            "department": self.department,
            "acronym": acronym,
            "initials": acronym,
        }


AuthUser = User


class UserXp(Base):
    __tablename__ = "user_xp"

    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.user_id"), primary_key=True)
    total_xp: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self, user: Optional[User] = None, rank: Optional[int] = None) -> dict[str, Any]:
        name = user.name if user is not None else self.user_id
        acronym = initials_for_name(name)
        return omit_none(
            {
                "rank": rank,
                "user_id": self.user_id,
                "userId": self.user_id,
                "id": self.user_id,
                "name": name,
                "username": user.username if user is not None else "",
                "acronym": acronym,
                "initials": acronym,
                "total_xp": self.total_xp,
                "totalXp": self.total_xp,
                "updatedAt": self.updated_at.isoformat(),
            }
        )


class UserFriendship(Base):
    __tablename__ = "user_friendships"
    __table_args__ = (UniqueConstraint("follower_id", "following_id", name="uq_user_friendships_follower_following"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    follower_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.user_id"), index=True, nullable=False)
    following_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.user_id"), index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "follower_id": self.follower_id,
            "followerId": self.follower_id,
            "following_id": self.following_id,
            "followingId": self.following_id,
            "created_at": self.created_at.isoformat(),
            "createdAt": self.created_at.isoformat(),
        }


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    token: Mapped[str] = mapped_column(String(120), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.user_id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


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
_database_initialized = False
_database_lock = Lock()

T = TypeVar("T")
Serializer = Callable[[Any], dict[str, Any]]
Factory = Callable[[dict[str, Any]], Any]
Transformer = Callable[[Any], Any]
FieldSpec = tuple[Sequence[str], str, Transformer]
MISSING = object()


SEED_FEED_CARDS: list[dict[str, Any]] = []
SEED_TRENDING: list[dict[str, Any]] = []
SEED_SUGGESTED_PEOPLE: list[dict[str, Any]] = []
SEED_SPOTLIGHT_CLUBS: list[dict[str, Any]] = []
SEED_CLUB_CARDS: list[dict[str, Any]] = []
SEED_CLUB_STATS: list[dict[str, Any]] = []
SEED_GAME_CARDS: list[dict[str, Any]] = []
SEED_TOP_RATED_GAMES: list[dict[str, Any]] = []
SEED_RECENT_GAME_ACTIVITY: list[dict[str, Any]] = []
SEED_MARKETPLACE_ITEMS: list[dict[str, Any]] = []
SEED_CONVERSATIONS: list[dict[str, Any]] = []
SEED_MESSAGES: list[dict[str, Any]] = []
SEED_PROFILES: list[dict[str, Any]] = []

DEFAULT_PROFILE = {"avatar": PROFILE_AVATAR, "major": "", "bio": ""}
DEFAULT_ADMIN_USER = {
    "mail": "admin@cn.nhce",
    "username": "admin",
    "name": "Admin",
    "DOB": "2000-01-01",
    "department": "CS",
    "year": 1,
    "password": "12345678",
}


def omit_none(payload: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in payload.items() if value is not None}


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
    if value is None:
        return None
    return str(value).strip() or None


def read_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y", "on"}
    return bool(value)


def optional_bool(value: Any) -> Optional[bool]:
    if value is None:
        return None
    return read_bool(value)


def optional_int(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def read_tags(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(tag).strip().lstrip("#") for tag in value if str(tag).strip()]
    if isinstance(value, str):
        return [tag.strip().lstrip("#") for tag in value.split(",") if tag.strip()]
    return []


def read_string_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    return []


def read_price(value: Any) -> str:
    return text_value(value)


def normalize_side(value: Any) -> str:
    return "right" if text_value(value).lower() == "right" else "left"


def get_first(data: dict[str, Any], *keys: str, default: Any = None) -> Any:
    for key in keys:
        if key in data:
            return data[key]
    return default


def generate_backend_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_urlsafe(12).replace('-', '').replace('_', '')[:16].lower()}"


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


def unique_backend_id(model: type[Any], field_name: str, prefix: str) -> str:
    field = getattr(model, field_name)
    for _ in range(10):
        candidate = generate_backend_id(prefix)
        if db().scalar(select(model).where(field == candidate)) is None:
            return candidate
    raise RuntimeError("could not generate unique id")


def unique_club_slug(value: Any, current_club_id: Optional[int] = None) -> str:
    base_slug = slugify(value)
    candidate = base_slug
    suffix = 2

    while True:
        existing = db().scalar(select(ClubCard).where(ClubCard.slug == candidate))
        if existing is None or existing.id == current_club_id:
            return candidate
        candidate = f"{base_slug}-{suffix}"
        suffix += 1


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


HASHTAG_RE = re.compile(r"(?<![\w])#([A-Za-z0-9_]+)")
MENTION_RE = re.compile(r"(?<![\w])@([A-Za-z0-9_.-]+)")
IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg")
VIDEO_EXTENSIONS = (".mp4",)


def unique_preserving_order(values: Sequence[str]) -> list[str]:
    seen: set[str] = set()
    unique_values: list[str] = []
    for value in values:
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        unique_values.append(value)
    return unique_values


def normalize_hashtag(value: Any) -> Optional[str]:
    tag = text_value(value).lstrip("#")
    if not tag:
        return None
    return f"#{tag}"


def normalize_mention(value: Any) -> Optional[str]:
    mention = text_value(value).lstrip("@")
    if not mention:
        return None
    return f"@{mention}"


def read_hashtags(value: Any) -> list[str]:
    if isinstance(value, list):
        return [tag for tag in (normalize_hashtag(item) for item in value) if tag]
    if isinstance(value, str):
        return [tag for tag in (normalize_hashtag(item) for item in re.split(r"[\s,]+", value)) if tag]
    return []


def read_mentions(value: Any) -> list[str]:
    if isinstance(value, list):
        return [mention for mention in (normalize_mention(item) for item in value) if mention]
    if isinstance(value, str):
        return [mention for mention in (normalize_mention(item) for item in re.split(r"[\s,]+", value)) if mention]
    return []


def extract_hashtags(caption: str) -> list[str]:
    return unique_preserving_order(f"#{match.group(1)}" for match in HASHTAG_RE.finditer(caption))


def extract_mentions(caption: str) -> list[str]:
    return unique_preserving_order(f"@{match.group(1)}" for match in MENTION_RE.finditer(caption))


def read_post_type(value: Any, default: int = 0) -> Optional[int]:
    if value is None or value == "":
        return default
    post_type = optional_int(value)
    if post_type is None or post_type not in {0, 1, 2, 3}:
        return None
    return post_type


def media_kind(media_url: str) -> Optional[str]:
    url = media_url.strip().lower().split("?", 1)[0].split("#", 1)[0]
    if not url:
        return None
    if url.startswith("data:image/") or url.endswith(IMAGE_EXTENSIONS):
        return "image"
    if url.startswith("data:video/mp4") or url.endswith(VIDEO_EXTENSIONS):
        return "video"
    return "unknown"


def media_error(media_url: str, post_type: int) -> Optional[str]:
    kind = media_kind(media_url)
    if kind is None:
        return None
    if kind == "unknown":
        return "media url must be an image or mp4"
    if post_type == 2 and kind != "image":
        return "marketplace posts only allow image media"
    return None


def create_auth_session(user: AuthUser) -> str:
    token = secrets.token_urlsafe(32)
    db().add(AuthSession(token=token, user_id=user.user_id))
    return token


def find_auth_user_by_login(login: str) -> Optional[AuthUser]:
    return db().scalar(select(AuthUser).where((AuthUser.mail == login) | (AuthUser.username == login)))


def auth_payload(user: AuthUser, token: str) -> dict[str, Any]:
    return {"token": token, "user": user.to_dict()}


def bearer_token() -> Optional[str]:
    header = request.headers.get("Authorization", "")
    prefix = "Bearer "
    if header.startswith(prefix):
        return header[len(prefix) :].strip() or None
    return None


def current_auth_user() -> Optional[AuthUser]:
    token = bearer_token()
    if token is None:
        return None
    session = db().get(AuthSession, token)
    if session is None:
        return None
    return db().get(AuthUser, session.user_id)


def is_admin_user(user: Optional[AuthUser]) -> bool:
    return (
        user is not None
        and user.username == normalize_username(DEFAULT_ADMIN_USER["username"])
        and user.mail == normalize_email(DEFAULT_ADMIN_USER["mail"])
    )


def require_admin_user():
    user = current_auth_user()
    if user is None:
        return jsonify({"error": "unauthorized"}), 401
    if not is_admin_user(user):
        return jsonify({"error": "admin access required"}), 403
    return None


def post_like_for_user(post_id: str, user_id: str) -> Optional[PostLike]:
    return db().scalar(select(PostLike).where((PostLike.post_id == post_id) & (PostLike.user_id == user_id)))


def serialize_post(post: Post, viewer_user_id: Optional[str] = None) -> dict[str, Any]:
    author = db().get(User, post.author_id)
    club = db().get(ClubCard, post.club_id) if post.club_id is not None else None
    liked_by_current_user = viewer_user_id is not None and post_like_for_user(post.post_id, viewer_user_id) is not None
    return {
        **post.to_dict(author.name if author is not None else None, club.slug if club is not None else None),
        "likedByCurrentUser": liked_by_current_user,
        "liked_by_current_user": liked_by_current_user,
        "viewerHasLiked": liked_by_current_user,
    }


def post_caption_from_data(data: dict[str, Any]) -> str:
    return text_value(get_first(data, "caption", "body", "title"))


def resolve_post_author_id(data: dict[str, Any]) -> str:
    explicit_author_id = text_value(get_first(data, "author_id", "authorId"))
    if explicit_author_id:
        return explicit_author_id

    current_user = current_auth_user()
    if current_user is not None:
        return current_user.user_id

    username = normalize_username(data.get("author"))
    if username:
        user = db().scalar(select(User).where(User.username == username))
        if user is not None:
            return user.user_id

    return ""


def resolve_post_club_id(data: dict[str, Any]) -> Optional[int]:
    explicit_club_id = optional_int(get_first(data, "club_id", "clubId"))
    if explicit_club_id is not None:
        return explicit_club_id

    club_slug = optional_text(get_first(data, "clubSlug", "club_slug"))
    if club_slug is None:
        return None

    club = db().scalar(select(ClubCard).where(ClubCard.slug == slugify(club_slug)))
    return club.id if club is not None else None


def make_post(data: dict[str, Any], sort_order: int = 0) -> Post:
    caption = post_caption_from_data(data)
    post_type = read_post_type(get_first(data, "type", "postType", "post_type"), default=0) or 0
    explicit_hashtags = read_hashtags(get_first(data, "hashtags", "tag"))
    explicit_mentions = read_mentions(get_first(data, "mentions", "taggedPeople", "tagged_people"))

    return Post(
        post_id=unique_backend_id(Post, "post_id", "post"),
        author_id=resolve_post_author_id(data),
        club_id=resolve_post_club_id(data),
        post_type=post_type,
        media_url=text_value(get_first(data, "media_url", "mediaUrl", "image"), DEFAULT_POST_IMAGE),
        caption=caption,
        likes=optional_int(data.get("likes")) or 0,
        shares=optional_int(data.get("shares")) or 0,
        hashtags=unique_preserving_order([*explicit_hashtags, *extract_hashtags(caption)]),
        mentions=unique_preserving_order([*explicit_mentions, *extract_mentions(caption)]),
        price=optional_text(data.get("price")),
        description=optional_text(data.get("description")),
        sort_order=sort_order,
    )


def make_trending_topic(data: dict[str, Any], sort_order: int = 0) -> TrendingTopic:
    return TrendingTopic(
        label=text_value(data.get("label")),
        tag=text_value(data.get("tag")),
        posts=text_value(data.get("posts"), "0"),
        sort_order=sort_order,
    )


def make_suggested_person(data: dict[str, Any], sort_order: int = 0) -> SuggestedPerson:
    return SuggestedPerson(
        name=text_value(data.get("name")),
        subtitle=text_value(data.get("subtitle")),
        sort_order=sort_order,
    )


def make_club_card(data: dict[str, Any], sort_order: int = 0) -> ClubCard:
    title = text_value(data.get("title"))
    return ClubCard(
        title=title,
        slug=slugify(get_first(data, "slug", default=title)),
        description=text_value(data.get("description")),
        status=text_value(data.get("status")),
        icon=text_value(data.get("icon"), "groups"),
        icon_bg=text_value(get_first(data, "iconBg", "icon_bg"), "bg-primary"),
        banner_bg=text_value(get_first(data, "bannerBg", "banner_bg"), "bg-primary-fixed/20"),
        banner_image=text_value(get_first(data, "bannerImage", "banner_image"), DEFAULT_CLUB_IMAGE),
        extra_members=text_value(get_first(data, "extraMembers", "extra_members"), "0"),
        extra_members_class=text_value(
            get_first(data, "extraMembersClass", "extra_members_class"), "bg-primary-container text-white"
        ),
        avatars=read_string_list(data.get("avatars")),
        status_class=text_value(get_first(data, "statusClass", "status_class"), "text-secondary"),
        sort_order=sort_order,
    )


def make_spotlight_club(data: dict[str, Any], sort_order: int = 0) -> SpotlightClub:
    return SpotlightClub(
        badge=text_value(data.get("badge")),
        badge_fill=read_bool(get_first(data, "badgeFill", "badge_fill", default=False)),
        badge_class=text_value(get_first(data, "badgeClass", "badge_class"), "bg-primary-container"),
        title=text_value(data.get("title")),
        description=text_value(data.get("description")),
        image=text_value(data.get("image"), DEFAULT_CLUB_IMAGE),
        icon=text_value(data.get("icon"), "groups"),
        sort_order=sort_order,
    )


def make_club_stat(data: dict[str, Any], sort_order: int = 0) -> ClubStat:
    return ClubStat(
        value=text_value(data.get("value"), "0"),
        label=text_value(data.get("label"), "Metric"),
        class_name=text_value(get_first(data, "className", "class_name"), "rounded-[24px] bg-white p-6 text-center"),
        value_class=text_value(get_first(data, "valueClass", "value_class"), "text-display-lg"),
        label_class=text_value(get_first(data, "labelClass", "label_class"), "text-xs"),
        sort_order=sort_order,
    )


def make_game_card(data: dict[str, Any], sort_order: int = 0) -> GameCard:
    return GameCard(
        title=text_value(data.get("title")),
        image=text_value(data.get("image"), DEFAULT_POST_IMAGE),
        online=text_value(data.get("online"), "0"),
        rating=text_value(data.get("rating"), "0"),
        sort_order=sort_order,
    )


def make_top_rated_game(data: dict[str, Any], sort_order: int = 0) -> TopRatedGame:
    return TopRatedGame(
        rank=text_value(data.get("rank")),
        title=text_value(data.get("title")),
        subtitle=text_value(data.get("subtitle")),
        rating=text_value(data.get("rating"), "0"),
        badge=text_value(data.get("badge")),
        image=text_value(data.get("image"), DEFAULT_POST_IMAGE),
        badge_class=text_value(get_first(data, "badgeClass", "badge_class")),
        sort_order=sort_order,
    )


def make_recent_game_activity(data: dict[str, Any], sort_order: int = 0) -> RecentGameActivity:
    return RecentGameActivity(
        title=text_value(data.get("title")),
        subtitle=text_value(data.get("subtitle")),
        image=text_value(data.get("image"), DEFAULT_POST_IMAGE),
        sort_order=sort_order,
    )


def make_marketplace_item(data: dict[str, Any], sort_order: int = 0) -> MarketplaceItem:
    return MarketplaceItem(
        title=text_value(get_first(data, "title", "itemName")),
        owner=text_value(data.get("owner")),
        mode=text_value(get_first(data, "mode", "listingType")),
        category=text_value(data.get("category")),
        condition=text_value(data.get("condition")),
        price=read_price(data.get("price")),
        location=text_value(get_first(data, "location", "pickupLocation")),
        description=text_value(data.get("description")),
        image=text_value(get_first(data, "image", "photoUrl"), DEFAULT_POST_IMAGE),
        tags=read_tags(data.get("tags")),
        contact=text_value(data.get("contact")),
        preferred_exchange=text_value(get_first(data, "preferredExchange", "preferred_exchange"), ""),
        created_at_label=text_value(get_first(data, "createdAt", "created_at_label")),
        sort_order=sort_order,
    )


def make_conversation(data: dict[str, Any], sort_order: int = 0) -> Conversation:
    return Conversation(
        name=text_value(data.get("name")),
        preview=text_value(data.get("preview"), ""),
        time=text_value(data.get("time")),
        active=optional_bool(data.get("active")) if "active" in data else None,
        avatar=optional_text(data.get("avatar")),
        role=optional_text(data.get("role")),
        unread=optional_int(data.get("unread")),
        typing=optional_bool(data.get("typing")) if "typing" in data else None,
        sort_order=sort_order,
    )


def make_chat_message(data: dict[str, Any], sort_order: int = 0) -> ChatMessage:
    return ChatMessage(
        side=normalize_side(data.get("side")),
        text=text_value(data.get("text"), ""),
        time=optional_text(data.get("time")),
        status=optional_text(data.get("status")),
        sort_order=sort_order,
    )


def make_profile(data: dict[str, Any]) -> Profile:
    return Profile(
        user=text_value(get_first(data, "user", "username"), ""),
        avatar=text_value(data.get("avatar"), PROFILE_AVATAR),
        major=text_value(data.get("major"), DEFAULT_PROFILE["major"]),
        bio=text_value(data.get("bio"), DEFAULT_PROFILE["bio"]),
    )


POST_UPDATE_FIELDS: list[FieldSpec] = [
    (("author_id", "authorId"), "author_id", text_value),
    (("club_id", "clubId"), "club_id", optional_int),
    (("type", "postType", "post_type"), "post_type", lambda value: read_post_type(value, default=0) or 0),
    (("media_url", "mediaUrl", "image"), "media_url", text_value),
    (("caption", "body", "title"), "caption", text_value),
    (("likes",), "likes", lambda value: optional_int(value) or 0),
    (("shares",), "shares", lambda value: optional_int(value) or 0),
    (("hashtags", "tag"), "hashtags", read_hashtags),
    (("mentions", "taggedPeople", "tagged_people"), "mentions", read_mentions),
    (("price",), "price", optional_text),
    (("description",), "description", optional_text),
]

TRENDING_UPDATE_FIELDS: list[FieldSpec] = [
    (("label",), "label", text_value),
    (("tag",), "tag", text_value),
    (("posts",), "posts", text_value),
]

SUGGESTED_PERSON_UPDATE_FIELDS: list[FieldSpec] = [
    (("name",), "name", text_value),
    (("subtitle",), "subtitle", text_value),
]

CLUB_UPDATE_FIELDS: list[FieldSpec] = [
    (("title",), "title", text_value),
    (("description",), "description", text_value),
    (("status",), "status", text_value),
    (("icon",), "icon", text_value),
    (("iconBg", "icon_bg"), "icon_bg", text_value),
    (("bannerBg", "banner_bg"), "banner_bg", text_value),
    (("bannerImage", "banner_image"), "banner_image", text_value),
    (("extraMembers", "extra_members"), "extra_members", text_value),
    (("extraMembersClass", "extra_members_class"), "extra_members_class", text_value),
    (("avatars",), "avatars", read_string_list),
    (("statusClass", "status_class"), "status_class", text_value),
]

SPOTLIGHT_UPDATE_FIELDS: list[FieldSpec] = [
    (("badge",), "badge", text_value),
    (("badgeFill", "badge_fill"), "badge_fill", read_bool),
    (("badgeClass", "badge_class"), "badge_class", text_value),
    (("title",), "title", text_value),
    (("description",), "description", text_value),
    (("image",), "image", text_value),
    (("icon",), "icon", text_value),
]

CLUB_STAT_UPDATE_FIELDS: list[FieldSpec] = [
    (("value",), "value", text_value),
    (("label",), "label", text_value),
    (("className", "class_name"), "class_name", text_value),
    (("valueClass", "value_class"), "value_class", text_value),
    (("labelClass", "label_class"), "label_class", text_value),
]

GAME_UPDATE_FIELDS: list[FieldSpec] = [
    (("title",), "title", text_value),
    (("image",), "image", text_value),
    (("online",), "online", text_value),
    (("rating",), "rating", text_value),
]

TOP_RATED_GAME_UPDATE_FIELDS: list[FieldSpec] = [
    (("rank",), "rank", text_value),
    (("title",), "title", text_value),
    (("subtitle",), "subtitle", text_value),
    (("rating",), "rating", text_value),
    (("badge",), "badge", text_value),
    (("image",), "image", text_value),
    (("badgeClass", "badge_class"), "badge_class", text_value),
]

RECENT_GAME_ACTIVITY_UPDATE_FIELDS: list[FieldSpec] = [
    (("title",), "title", text_value),
    (("subtitle",), "subtitle", text_value),
    (("image",), "image", text_value),
]

MARKETPLACE_UPDATE_FIELDS: list[FieldSpec] = [
    (("title", "itemName"), "title", text_value),
    (("owner",), "owner", text_value),
    (("mode", "listingType"), "mode", text_value),
    (("category",), "category", text_value),
    (("condition",), "condition", text_value),
    (("price",), "price", read_price),
    (("location", "pickupLocation"), "location", text_value),
    (("description",), "description", text_value),
    (("image", "photoUrl"), "image", text_value),
    (("tags",), "tags", read_tags),
    (("contact",), "contact", text_value),
    (("preferredExchange", "preferred_exchange"), "preferred_exchange", text_value),
    (("createdAt", "created_at_label"), "created_at_label", text_value),
]

CONVERSATION_UPDATE_FIELDS: list[FieldSpec] = [
    (("name",), "name", text_value),
    (("preview",), "preview", text_value),
    (("time",), "time", text_value),
    (("active",), "active", optional_bool),
    (("avatar",), "avatar", optional_text),
    (("role",), "role", optional_text),
    (("unread",), "unread", optional_int),
    (("typing",), "typing", optional_bool),
]

MESSAGE_UPDATE_FIELDS: list[FieldSpec] = [
    (("side",), "side", normalize_side),
    (("text",), "text", text_value),
    (("time",), "time", optional_text),
    (("status",), "status", optional_text),
]

PROFILE_UPDATE_FIELDS: list[FieldSpec] = [
    (("avatar",), "avatar", text_value),
    (("major",), "major", text_value),
    (("bio",), "bio", text_value),
]


def db() -> Session:
    session = g.get("db")
    if session is None:
        raise RuntimeError("Database session is not available for this request")
    return session


def table_is_empty(session: Session, model: type[Any]) -> bool:
    return session.scalar(select(func.count()).select_from(model)) == 0


def seed_collection(session: Session, model: type[Any], rows: list[dict[str, Any]], factory: Callable[..., Any]) -> None:
    if not table_is_empty(session, model):
        return
    for index, row in enumerate(rows):
        session.add(factory(row, sort_order=100 + index))


def seed_profiles(session: Session) -> None:
    if not table_is_empty(session, Profile):
        return
    for row in SEED_PROFILES:
        session.add(make_profile(row))


def ensure_app_schema() -> None:
    if engine.dialect.name == "postgresql":
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE club_cards ADD COLUMN IF NOT EXISTS slug VARCHAR(220)"))
            connection.execute(text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS club_id INTEGER"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_posts_club_id ON posts (club_id)"))
        return

    if engine.dialect.name == "sqlite":
        with engine.begin() as connection:
            club_columns = {row[1] for row in connection.exec_driver_sql("PRAGMA table_info(club_cards)").all()}
            if "slug" not in club_columns:
                connection.execute(text("ALTER TABLE club_cards ADD COLUMN slug VARCHAR(220)"))

            post_columns = {row[1] for row in connection.exec_driver_sql("PRAGMA table_info(posts)").all()}
            if "club_id" not in post_columns:
                connection.execute(text("ALTER TABLE posts ADD COLUMN club_id INTEGER"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_posts_club_id ON posts (club_id)"))


def ensure_app_indexes() -> None:
    if engine.dialect.name == "postgresql":
        with engine.begin() as connection:
            connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_club_cards_slug ON club_cards (slug)"))
        return

    if engine.dialect.name == "sqlite":
        with engine.begin() as connection:
            connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_club_cards_slug ON club_cards (slug)"))


def unique_club_slug_for_session(session: Session, value: Any, current_club_id: Optional[int] = None) -> str:
    base_slug = slugify(value)
    candidate = base_slug
    suffix = 2

    while True:
        existing = session.scalar(select(ClubCard).where(ClubCard.slug == candidate))
        if existing is None or existing.id == current_club_id:
            return candidate
        candidate = f"{base_slug}-{suffix}"
        suffix += 1


def backfill_club_slugs(session: Session) -> None:
    for club in session.scalars(select(ClubCard).order_by(ClubCard.id.asc())).all():
        if not club.slug:
            club.slug = unique_club_slug_for_session(session, club.title, club.id)


def seed_admin_user(session: Session) -> None:
    mail = normalize_email(DEFAULT_ADMIN_USER["mail"])
    username = normalize_username(DEFAULT_ADMIN_USER["username"])
    user = session.scalar(select(AuthUser).where((AuthUser.mail == mail) | (AuthUser.username == username)))

    if user is None:
        session.add(
            AuthUser(
                user_id=generate_backend_id("user"),
                mail=mail,
                username=username or "admin",
                name=text_value(DEFAULT_ADMIN_USER["name"], "Admin"),
                dob=text_value(DEFAULT_ADMIN_USER["DOB"], "2000-01-01"),
                department=text_value(DEFAULT_ADMIN_USER["department"], "CS"),
                year=read_year_of_study(DEFAULT_ADMIN_USER["year"]) or 1,
                password_hash=generate_password_hash(text_value(DEFAULT_ADMIN_USER["password"], "12345678")),
            )
        )
        return

    user.username = username or user.username
    user.mail = mail
    user.name = text_value(user.name, text_value(DEFAULT_ADMIN_USER["name"], "Admin"))
    user.dob = text_value(user.dob, text_value(DEFAULT_ADMIN_USER["DOB"], "2000-01-01"))
    user.department = text_value(user.department, text_value(DEFAULT_ADMIN_USER["department"], "CS"))
    user.year = user.year or read_year_of_study(DEFAULT_ADMIN_USER["year"]) or 1
    user.password_hash = generate_password_hash(text_value(DEFAULT_ADMIN_USER["password"], "12345678"))


def seed_database(session: Session) -> None:
    seed_collection(session, Post, SEED_FEED_CARDS, make_post)
    seed_collection(session, TrendingTopic, SEED_TRENDING, make_trending_topic)
    seed_collection(session, SuggestedPerson, SEED_SUGGESTED_PEOPLE, make_suggested_person)
    seed_collection(session, ClubCard, SEED_CLUB_CARDS, make_club_card)
    seed_collection(session, SpotlightClub, SEED_SPOTLIGHT_CLUBS, make_spotlight_club)
    seed_collection(session, ClubStat, SEED_CLUB_STATS, make_club_stat)
    seed_collection(session, GameCard, SEED_GAME_CARDS, make_game_card)
    seed_collection(session, TopRatedGame, SEED_TOP_RATED_GAMES, make_top_rated_game)
    seed_collection(session, RecentGameActivity, SEED_RECENT_GAME_ACTIVITY, make_recent_game_activity)
    seed_collection(session, MarketplaceItem, SEED_MARKETPLACE_ITEMS, make_marketplace_item)
    seed_collection(session, Conversation, SEED_CONVERSATIONS, make_conversation)
    seed_collection(session, ChatMessage, SEED_MESSAGES, make_chat_message)
    seed_profiles(session)
    seed_admin_user(session)


def ensure_database_initialized() -> None:
    global _database_initialized
    if _database_initialized:
        return

    with _database_lock:
        if _database_initialized:
            return
        Base.metadata.create_all(engine)
        ensure_app_schema()
        with SessionLocal() as session:
            backfill_club_slugs(session)
            seed_database(session)
            backfill_club_slugs(session)
            session.commit()
        ensure_app_indexes()
        _database_initialized = True


def ordered_statement(model: type[T]):
    statement = select(model)
    if model is Post:
        return statement.order_by(Post.created_at.desc(), Post.post_id.asc())
    if hasattr(model, "sort_order") and hasattr(model, "id"):
        return statement.order_by(model.sort_order.asc(), model.id.desc())
    if hasattr(model, "user"):
        return statement.order_by(model.user.asc())
    if hasattr(model, "id"):
        return statement.order_by(model.id.asc())
    return statement


def serialize_all(model: type[Any], serializer: Optional[Serializer] = None) -> list[dict[str, Any]]:
    rows = db().scalars(ordered_statement(model)).all()
    return [(serializer or (lambda item: item.to_dict()))(row) for row in rows]


def create_resource(factory: Factory, serializer: Optional[Serializer] = None):
    item = factory(read_json())
    db().add(item)
    db().commit()
    db().refresh(item)
    return jsonify((serializer or (lambda model: model.to_dict()))(item)), 201


def create_club_card_resource():
    data = read_json()
    item = make_club_card(data)
    item.slug = unique_club_slug(get_first(data, "slug", default=item.slug or item.title))
    db().add(item)
    db().commit()
    db().refresh(item)
    return jsonify(item.to_dict()), 201


def apply_updates(item: Any, data: dict[str, Any], fields: list[FieldSpec]) -> None:
    for keys, attribute, transform in fields:
        value = MISSING
        for key in keys:
            if key in data:
                value = data[key]
                break
        if value is not MISSING:
            setattr(item, attribute, transform(value))


def resource_detail(model: type[Any], item_id: int, fields: list[FieldSpec], serializer: Optional[Serializer] = None):
    item = db().get(model, item_id)
    if item is None:
        return jsonify({"error": "not found"}), 404

    to_payload = serializer or (lambda model_item: model_item.to_dict())
    if request.method == "GET":
        return jsonify(to_payload(item))
    if request.method == "DELETE":
        db().delete(item)
        db().commit()
        return ("", 204)

    apply_updates(item, read_json(), fields)
    db().commit()
    db().refresh(item)
    return jsonify(to_payload(item))


def club_by_slug(slug: str) -> Optional[ClubCard]:
    return db().scalar(select(ClubCard).where(ClubCard.slug == slugify(slug)))


def club_members_for_club(club: ClubCard) -> list[ClubMember]:
    return db().scalars(select(ClubMember).where(ClubMember.club_id == club.id).order_by(ClubMember.id.asc())).all()


def club_posts_for_club(club: ClubCard) -> list[Post]:
    return db().scalars(
        select(Post)
        .where((Post.club_id == club.id) & (Post.post_type == 1))
        .order_by(Post.created_at.desc(), Post.post_id.asc())
    ).all()


def club_posts_count(club: ClubCard) -> int:
    count = db().scalar(
        select(func.count()).select_from(Post).where((Post.club_id == club.id) & (Post.post_type == 1))
    )
    return int(count or 0)


def club_followers_count(club: ClubCard) -> int:
    count = db().scalar(select(func.count()).select_from(ClubFollower).where(ClubFollower.club_id == club.id))
    return int(count or 0)


def club_follow_for_user(club: ClubCard, user_id: str) -> Optional[ClubFollower]:
    return db().scalar(select(ClubFollower).where((ClubFollower.club_id == club.id) & (ClubFollower.user_id == user_id)))


def club_follow_payload(club: ClubCard, user: User) -> dict[str, Any]:
    follower = club_follow_for_user(club, user.user_id)
    return {
        "club_id": club.id,
        "clubId": club.id,
        "clubSlug": club.slug,
        "user_id": user.user_id,
        "userId": user.user_id,
        "isFollowing": follower is not None,
        "followers": club_followers_count(club),
        "postsCount": club_posts_count(club),
        "follow": follower.to_dict() if follower is not None else None,
    }


def serialize_club_member(member: ClubMember) -> dict[str, Any]:
    user = db().get(User, member.user_id)
    created_at = member.created_at.isoformat()
    return {
        "id": member.id,
        "club_id": member.club_id,
        "clubId": member.club_id,
        "user_id": member.user_id,
        "userId": member.user_id,
        "title": member.title,
        "created_at": created_at,
        "createdAt": created_at,
        "user": user.to_dict() if user is not None else None,
        "name": user.name if user is not None else member.user_id,
        "username": user.username if user is not None else "",
        "mail": user.mail if user is not None else "",
        "initials": initials_for_name(user.name if user is not None else member.user_id),
    }


def serialize_club_detail(club: ClubCard) -> dict[str, Any]:
    posts = club_posts_for_club(club)
    followers = club_followers_count(club)
    posts_count = len(posts)
    viewer = current_auth_user()
    viewer_user_id = viewer.user_id if viewer is not None else None
    return {
        "club": {
            **club.to_dict(),
            "followers": followers,
            "postsCount": posts_count,
        },
        "members": [serialize_club_member(member) for member in club_members_for_club(club)],
        "posts": [serialize_post(post, viewer_user_id) for post in posts],
        "followers": followers,
        "postsCount": posts_count,
    }


def search_user_payload(user: User) -> dict[str, Any]:
    initials = initials_for_name(user.name)
    return {
        "type": "user",
        "id": user.user_id,
        "title": user.name,
        "subtitle": f"@{user.username}",
        "href": f"/{user.username}",
        "icon": "person",
        "initials": initials,
        "user_id": user.user_id,
        "userId": user.user_id,
        "username": user.username,
    }


def search_club_payload(club: ClubCard) -> dict[str, Any]:
    return {
        "type": "club",
        "id": club.id,
        "title": club.title,
        "subtitle": club.status or "Club",
        "href": f"/clubs/{club.slug}",
        "icon": club.icon or "groups",
        "slug": club.slug,
    }


def search_post_payload(post: Post) -> dict[str, Any]:
    author = db().get(User, post.author_id)
    title = text_value(post.caption)[:72] or "Untitled post"
    return {
        "type": "post",
        "id": post.post_id,
        "title": title,
        "subtitle": author.name if author is not None else "Post",
        "href": f"/#{post.post_id}",
        "icon": "article",
        "post_id": post.post_id,
        "postId": post.post_id,
    }


def search_marketplace_payload(post: Post) -> dict[str, Any]:
    item = serialize_marketplace_post(post)
    return {
        "type": "product",
        "id": item["id"],
        "title": item["title"],
        "subtitle": item["price"] or item["owner"],
        "href": f"/marketplace#{item['post_id']}",
        "icon": "storefront",
        "post_id": item["post_id"],
        "postId": item["post_id"],
    }


def search_results(query: str, limit: int, types: Optional[set[str]] = None) -> dict[str, Any]:
    normalized_query = query.lower()
    requested_types = {value for value in (types or {"user", "club", "post"}) if value}
    users = (
        db().scalars(
            select(User)
            .where((func.lower(User.username).contains(normalized_query)) | (func.lower(User.name).contains(normalized_query)))
            .order_by(User.username.asc())
            .limit(limit)
        )
        .all()
        if "user" in requested_types
        else []
    )
    clubs = (
        db().scalars(
            select(ClubCard)
            .where(
                (func.lower(ClubCard.title).contains(normalized_query))
                | (func.lower(ClubCard.slug).contains(normalized_query))
                | (func.lower(ClubCard.description).contains(normalized_query))
            )
            .order_by(ClubCard.title.asc())
            .limit(limit)
        )
        .all()
        if "club" in requested_types
        else []
    )
    posts = (
        db().scalars(
            select(Post)
            .where(func.lower(Post.caption).contains(normalized_query))
            .order_by(Post.created_at.desc(), Post.post_id.asc())
            .limit(limit)
        )
        .all()
        if "post" in requested_types
        else []
    )
    products = (
        db().scalars(
            select(Post)
            .where(
                (Post.post_type == 2)
                & (
                    func.lower(func.coalesce(Post.caption, "")).contains(normalized_query)
                    | func.lower(func.coalesce(Post.description, "")).contains(normalized_query)
                )
            )
            .order_by(Post.created_at.desc(), Post.post_id.asc())
            .limit(limit)
        )
        .all()
        if "product" in requested_types
        else []
    )

    return {
        "query": query,
        "users": [search_user_payload(user) for user in users],
        "clubs": [search_club_payload(club) for club in clubs],
        "posts": [search_post_payload(post) for post in posts],
        "products": [search_marketplace_payload(post) for post in products],
    }


def feed_viewer_user_id() -> Optional[str]:
    current_user = current_auth_user()
    if current_user is not None:
        return None if is_admin_user(current_user) else current_user.user_id

    requested_user_id = text_value(request.args.get("user_id") or request.args.get("userId"))
    if not requested_user_id:
        return None

    requested_user = db().get(User, requested_user_id)
    if requested_user is None or is_admin_user(requested_user):
        return None
    return requested_user.user_id


def feed_limit() -> Optional[int]:
    requested_limit = optional_int(request.args.get("limit"))
    if requested_limit is None:
        return None
    return max(1, min(requested_limit, 100))


def ranked_feed_cards(viewer_user_id: Optional[str], limit: Optional[int]) -> list[dict[str, Any]]:
    users = db().scalars(select(User).order_by(User.user_id.asc())).all()
    clubs = db().scalars(select(ClubCard).order_by(ClubCard.id.asc())).all()
    memberships = db().scalars(select(ClubMember).order_by(ClubMember.id.asc())).all()
    friendships = db().scalars(select(UserFriendship).order_by(UserFriendship.id.asc())).all()
    posts = db().scalars(ordered_statement(Post)).all()
    admin_user_ids = {user.user_id for user in users if is_admin_user(user)}

    return rank_feed_posts(
        users=[{"user_id": user.user_id} for user in users],
        clubs=[{"id": club.id} for club in clubs],
        club_memberships=[(member.club_id, member.user_id) for member in memberships],
        friendships=[(friendship.follower_id, friendship.following_id) for friendship in friendships],
        posts=[serialize_post(post, viewer_user_id) for post in posts],
        viewer_user_id=viewer_user_id,
        admin_user_ids=admin_user_ids,
        limit=limit,
    )


def leaderboard_entries() -> list[dict[str, Any]]:
    admin_username = normalize_username(DEFAULT_ADMIN_USER["username"])
    admin_mail = normalize_email(DEFAULT_ADMIN_USER["mail"])
    rows = db().execute(
        select(User, UserXp)
        .join(UserXp, UserXp.user_id == User.user_id)
        .where(UserXp.total_xp > 0)
        .where(User.username != admin_username)
        .where(User.mail != admin_mail)
        .order_by(UserXp.total_xp.desc(), User.username.asc())
    ).all()
    return [xp.to_dict(user, rank=index + 1) for index, (user, xp) in enumerate(rows)]


def award_user_xp(user: User, xp: int) -> UserXp:
    row = db().get(UserXp, user.user_id)
    now = datetime.utcnow()

    if row is None:
        row = UserXp(user_id=user.user_id, total_xp=0, created_at=now, updated_at=now)
        db().add(row)

    row.total_xp += xp
    row.updated_at = now
    db().commit()
    db().refresh(row)
    return row


def friendship_between(follower_id: str, following_id: str) -> Optional[UserFriendship]:
    return db().scalar(
        select(UserFriendship).where(
            (UserFriendship.follower_id == follower_id) & (UserFriendship.following_id == following_id)
        )
    )


def friendship_counts(user_id: str) -> dict[str, int]:
    followers = db().scalar(
        select(func.count()).select_from(UserFriendship).where(UserFriendship.following_id == user_id)
    )
    following = db().scalar(
        select(func.count()).select_from(UserFriendship).where(UserFriendship.follower_id == user_id)
    )
    return {"followers": int(followers or 0), "following": int(following or 0)}


def friendship_user_payload(user: User, friendship: UserFriendship) -> dict[str, Any]:
    acronym = initials_for_name(user.name)
    return {
        "user_id": user.user_id,
        "userId": user.user_id,
        "id": user.user_id,
        "name": user.name,
        "username": user.username,
        "acronym": acronym,
        "initials": acronym,
        "friendship_id": friendship.id,
        "friendshipId": friendship.id,
        "created_at": friendship.created_at.isoformat(),
        "createdAt": friendship.created_at.isoformat(),
    }


def friendship_list_rows(
    user_id: str, list_name: str, limit: Optional[int] = None, offset: int = 0
) -> tuple[list[tuple[User, UserFriendship]], int]:
    if list_name == "followers":
        total = db().scalar(
            select(func.count()).select_from(UserFriendship).where(UserFriendship.following_id == user_id)
        )
        statement = (
            select(User, UserFriendship)
            .join(UserFriendship, UserFriendship.follower_id == User.user_id)
            .where(UserFriendship.following_id == user_id)
        )
    else:
        total = db().scalar(
            select(func.count()).select_from(UserFriendship).where(UserFriendship.follower_id == user_id)
        )
        statement = (
            select(User, UserFriendship)
            .join(UserFriendship, UserFriendship.following_id == User.user_id)
            .where(UserFriendship.follower_id == user_id)
        )

    statement = statement.order_by(UserFriendship.created_at.desc(), User.username.asc()).offset(max(offset, 0))
    if limit is not None:
        statement = statement.limit(limit)

    return db().execute(statement).all(), int(total or 0)


def friendship_list_payload(user_id: str, list_name: str, limit: int = 50, offset: int = 0) -> dict[str, Any]:
    rows, total = friendship_list_rows(user_id, list_name, limit, offset)
    return {
        "items": [friendship_user_payload(user, friendship) for user, friendship in rows],
        "total": total,
        "limit": limit,
        "offset": max(offset, 0),
    }


def friendship_lists(user_id: str) -> dict[str, list[dict[str, Any]]]:
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
        "follower_id": current_user.user_id,
        "followerId": current_user.user_id,
        "following_id": target_user.user_id,
        "followingId": target_user.user_id,
        **friendship_counts(target_user.user_id),
        "friendship": friendship.to_dict() if friendship is not None else None,
    }
    if include_lists:
        payload.update(friendship_lists(target_user.user_id))
    return payload


def resolve_member_user(data: dict[str, Any]) -> Optional[User]:
    user_id = text_value(get_first(data, "user_id", "userId"))
    if user_id:
        return db().get(User, user_id)

    username = normalize_username(data.get("username"))
    if username:
        return db().scalar(select(User).where(User.username == username))

    mail = normalize_email(get_first(data, "mail", "email"))
    if mail:
        return db().scalar(select(User).where(User.mail == mail))

    return None


def create_club_member_resource(club: ClubCard):
    data = read_json()
    user = resolve_member_user(data)
    if user is None:
        return jsonify({"error": "user_id, username, or mail must reference an existing user"}), 400

    existing = db().scalar(select(ClubMember).where((ClubMember.club_id == club.id) & (ClubMember.user_id == user.user_id)))
    if existing is not None:
        return jsonify({"error": "user is already a club member"}), 409

    member = ClubMember(
        club_id=club.id,
        user_id=user.user_id,
        title=text_value(data.get("title"), "Member"),
    )
    db().add(member)
    db().commit()
    db().refresh(member)
    return jsonify(serialize_club_member(member)), 201


def user_values(data: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": text_value(data.get("name")),
        "username": normalize_username(data.get("username")),
        "mail": normalize_email(get_first(data, "mail", "email")),
        "dob": text_value(get_first(data, "DOB", "dob", "dateOfBirth", "date_of_birth")),
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
    if not values["dob"]:
        return "DOB is required"
    if values["year"] is None:
        return "year is required"
    if not values["department"]:
        return "department is required"
    return None


def validate_unique_user(username: str, mail: str, current_user_id: Optional[str] = None):
    existing_username = db().scalar(select(User).where(User.username == username))
    if existing_username is not None and existing_username.user_id != current_user_id:
        return jsonify({"error": "username already exists"}), 409

    existing_mail = db().scalar(select(User).where(User.mail == mail))
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
        user_id=unique_backend_id(User, "user_id", "user"),
        name=values["name"],
        username=values["username"],
        mail=values["mail"],
        dob=values["dob"],
        year=values["year"],
        department=values["department"],
        password_hash=generate_password_hash(password or secrets.token_urlsafe(32)),
    )
    return user, None, None


def update_user_from_payload(user: User, data: dict[str, Any]):
    values = user_values(
        {
            "name": get_first(data, "name", default=user.name),
            "username": get_first(data, "username", default=user.username),
            "mail": get_first(data, "mail", "email", default=user.mail),
            "DOB": get_first(data, "DOB", "dob", "dateOfBirth", "date_of_birth", default=user.dob),
            "year": get_first(data, "year", "yearOfStudy", "year_of_study", default=user.year),
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

    user.name = values["name"]
    user.username = values["username"]
    user.mail = values["mail"]
    user.dob = values["dob"]
    user.year = values["year"]
    user.department = values["department"]
    return None


def requested_post_type(data: dict[str, Any], default: int) -> Optional[int]:
    value = get_first(data, "type", "postType", "post_type", default=MISSING)
    if value is MISSING:
        return default
    return read_post_type(value, default=default)


def is_club_member(club_id: int, user_id: str) -> bool:
    return (
        db().scalar(
            select(ClubMember).where((ClubMember.club_id == club_id) & (ClubMember.user_id == user_id))
        )
        is not None
    )


def validate_post(post: Post):
    if post.post_type not in {0, 1, 2, 3}:
        return jsonify({"error": "type must be 0, 1, 2, or 3"}), 400
    if not post.author_id or db().get(User, post.author_id) is None:
        return jsonify({"error": "author_id must reference an existing user"}), 400

    if post.post_type == 1:
        if post.club_id is None or db().get(ClubCard, post.club_id) is None:
            return jsonify({"error": "club_id or clubSlug must reference an existing club for club posts"}), 400
        if not is_club_member(post.club_id, post.author_id):
            return jsonify({"error": "club posts require club membership"}), 403
    else:
        post.club_id = None

    error = media_error(post.media_url, post.post_type)
    if error is not None:
        return jsonify({"error": error}), 400

    if post.post_type == 2:
        if not post.price:
            return jsonify({"error": "price is required for marketplace posts"}), 400
        if not post.description:
            return jsonify({"error": "description is required for marketplace posts"}), 400
    else:
        post.price = None
        post.description = None

    return None


def create_post_from_payload(data: dict[str, Any]):
    post_type = requested_post_type(data, default=0)
    if post_type is None:
        return jsonify({"error": "type must be 0, 1, 2, or 3"}), 400

    post_data = {**data, "type": post_type}
    post = make_post(post_data)
    validation_error = validate_post(post)
    if validation_error is not None:
        return validation_error

    db().add(post)
    db().commit()
    db().refresh(post)
    return jsonify(serialize_post(post)), 201


def update_post_from_payload(post: Post, data: dict[str, Any]):
    post_type = requested_post_type(data, default=post.post_type)
    if post_type is None:
        return jsonify({"error": "type must be 0, 1, 2, or 3"}), 400
    post.post_type = post_type

    if "author_id" in data or "authorId" in data:
        post.author_id = text_value(get_first(data, "author_id", "authorId"))

    if "club_id" in data or "clubId" in data or "clubSlug" in data or "club_slug" in data:
        post.club_id = resolve_post_club_id(data)

    if "media_url" in data or "mediaUrl" in data or "image" in data:
        post.media_url = text_value(get_first(data, "media_url", "mediaUrl", "image"))

    caption_changed = any(key in data for key in ("caption", "body", "title"))
    if caption_changed:
        post.caption = post_caption_from_data(data)

    if "likes" in data:
        likes = optional_int(data.get("likes"))
        if likes is None or likes < 0:
            return jsonify({"error": "likes must be a non-negative integer"}), 400
        post.likes = likes

    if "shares" in data:
        shares = optional_int(data.get("shares"))
        if shares is None or shares < 0:
            return jsonify({"error": "shares must be a non-negative integer"}), 400
        post.shares = shares

    if "price" in data:
        post.price = optional_text(data.get("price"))
    if "description" in data:
        post.description = optional_text(data.get("description"))

    if caption_changed or "hashtags" in data or "tag" in data:
        explicit_hashtags = read_hashtags(get_first(data, "hashtags", "tag", default=[]))
        post.hashtags = unique_preserving_order([*explicit_hashtags, *extract_hashtags(post.caption)])

    if caption_changed or "mentions" in data or "taggedPeople" in data or "tagged_people" in data:
        explicit_mentions = read_mentions(get_first(data, "mentions", "taggedPeople", "tagged_people", default=[]))
        post.mentions = unique_preserving_order([*explicit_mentions, *extract_mentions(post.caption)])

    validation_error = validate_post(post)
    if validation_error is not None:
        return validation_error

    db().commit()
    db().refresh(post)
    return jsonify(serialize_post(post))


def require_post_owner_or_admin(post: Post):
    user = current_auth_user()
    if user is None:
        return jsonify({"error": "unauthorized"}), 401
    if post.author_id != user.user_id and not is_admin_user(user):
        return jsonify({"error": "only the post author can delete this post"}), 403
    return None


def delete_post_likes(post_id: str) -> None:
    for like in db().scalars(select(PostLike).where(PostLike.post_id == post_id)).all():
        db().delete(like)


def post_like_payload(post: Post, user: User) -> dict[str, Any]:
    return {
        "post": serialize_post(post, user.user_id),
        "post_id": post.post_id,
        "postId": post.post_id,
        "likes": post.likes,
        "liked": post_like_for_user(post.post_id, user.user_id) is not None,
        "likedByCurrentUser": post_like_for_user(post.post_id, user.user_id) is not None,
    }


def marketplace_post_payload(data: dict[str, Any]) -> dict[str, Any]:
    return {
        **data,
        "type": 2,
        "caption": text_value(get_first(data, "caption", "title", "itemName")),
        "mediaUrl": text_value(get_first(data, "mediaUrl", "media_url", "image", "photoUrl")),
        "hashtags": get_first(data, "hashtags", "tags", default=[]),
    }


def marketplace_posts() -> list[Post]:
    return db().scalars(select(Post).where(Post.post_type == 2).order_by(Post.created_at.desc(), Post.post_id.asc())).all()


def serialize_marketplace_post(post: Post) -> dict[str, Any]:
    user = db().get(User, post.author_id)
    created_at = post.created_at.isoformat()
    return {
        "id": post.post_id,
        "post_id": post.post_id,
        "title": post.caption or "Marketplace listing",
        "owner": user.name if user is not None else post.author_id,
        "mode": "Sell",
        "category": "Marketplace",
        "condition": "",
        "price": post.price or "",
        "location": "",
        "description": post.description or "",
        "image": post.media_url,
        "tags": [tag.lstrip("#") for tag in post.hashtags or []],
        "contact": user.mail if user is not None else "",
        "preferredExchange": "",
        "createdAt": created_at,
    }


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
    return jsonify(
        {
            "feedCards": ranked_feed_cards(feed_viewer_user_id(), feed_limit()),
            "trending": serialize_all(TrendingTopic),
            "suggestedPeople": serialize_all(SuggestedPerson),
        }
    )


@app.route("/api/search")
def global_search():
    query = text_value(request.args.get("q") or request.args.get("query"))[:80]
    limit = optional_int(request.args.get("limit")) or 5
    limit = max(1, min(limit, 10))
    requested_types = {
        value.strip().lower()
        for value in text_value(request.args.get("types")).split(",")
        if value.strip()
    }

    if len(query) < 2:
        return jsonify({"query": query, "users": [], "clubs": [], "posts": [], "products": []})

    return jsonify(search_results(query, limit, requested_types or None))


@app.route("/api/users", methods=["GET", "POST"])
def users_collection():
    if request.method == "GET":
        username_query = normalize_username(request.args.get("username"))
        if username_query:
            users = db().scalars(
                select(User)
                .where(User.username.contains(username_query))
                .order_by(User.username.asc())
                .limit(10)
            ).all()
            return jsonify([user.to_dict() for user in users])

        return jsonify(serialize_all(User))

    user, error_response, status = create_user_from_payload(read_json())
    if error_response is not None:
        return error_response, status

    db().add(user)
    db().commit()
    db().refresh(user)
    return jsonify(user.to_dict()), 201


@app.route("/api/users/<user_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def users_item(user_id: str):
    user = db().get(User, user_id)
    if user is None:
        return jsonify({"error": "not found"}), 404

    if request.method == "GET":
        return jsonify(user.to_dict())

    if request.method == "DELETE":
        for session in db().scalars(select(AuthSession).where(AuthSession.user_id == user.user_id)).all():
            db().delete(session)
        for post in db().scalars(select(Post).where(Post.author_id == user.user_id)).all():
            db().delete(post)
        for friendship in db().scalars(
            select(UserFriendship).where(
                (UserFriendship.follower_id == user.user_id) | (UserFriendship.following_id == user.user_id)
            )
        ).all():
            db().delete(friendship)
        for club_follow in db().scalars(select(ClubFollower).where(ClubFollower.user_id == user.user_id)).all():
            db().delete(club_follow)
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
    target_user = db().get(User, user_id)
    if target_user is None:
        return jsonify({"error": "not found"}), 404

    current_user = current_auth_user()
    if current_user is None:
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
        existing = UserFriendship(follower_id=current_user.user_id, following_id=target_user.user_id)
        db().add(existing)
        db().commit()
        db().refresh(existing)
        return jsonify(friendship_status_payload(current_user, target_user)), 201

    return jsonify(friendship_status_payload(current_user, target_user))


@app.route("/api/users/<user_id>/friends/<list_name>", methods=["GET"])
def user_friendship_list(user_id: str, list_name: str):
    target_user = db().get(User, user_id)
    if target_user is None:
        return jsonify({"error": "not found"}), 404

    current_user = current_auth_user()
    if current_user is None:
        return jsonify({"error": "unauthorized"}), 401

    if list_name not in {"followers", "following"}:
        return jsonify({"error": "not found"}), 404

    limit = optional_int(request.args.get("limit")) or 50
    offset = optional_int(request.args.get("offset")) or 0
    limit = max(1, min(limit, 100))
    offset = max(offset, 0)
    return jsonify(friendship_list_payload(target_user.user_id, list_name, limit, offset))


@app.route("/api/posts", methods=["GET", "POST"])
def posts_collection():
    if request.method == "POST":
        return create_post_from_payload(read_json())
    return jsonify(serialize_all(Post, serialize_post))


@app.route("/api/posts/<post_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def posts_item(post_id: str):
    post = db().get(Post, post_id)
    if post is None:
        return jsonify({"error": "not found"}), 404

    if request.method == "GET":
        return jsonify(serialize_post(post))
    if request.method == "DELETE":
        owner_error = require_post_owner_or_admin(post)
        if owner_error is not None:
            return owner_error
        db().delete(post)
        db().commit()
        return ("", 204)

    return update_post_from_payload(post, read_json())


@app.route("/api/posts/<post_id>/like", methods=["GET", "POST", "DELETE"])
def posts_like_item(post_id: str):
    post = db().get(Post, post_id)
    if post is None:
        return jsonify({"error": "not found"}), 404

    user = current_auth_user()
    if user is None:
        return jsonify({"error": "unauthorized"}), 401

    existing = post_like_for_user(post_id, user.user_id)

    if request.method == "GET":
        return jsonify(post_like_payload(post, user))

    if request.method == "DELETE":
        if existing is not None:
            db().delete(existing)
            post.likes = max(0, post.likes - 1)
            db().commit()
            db().refresh(post)
        return jsonify(post_like_payload(post, user))

    if existing is None:
        existing = PostLike(post_id=post_id, user_id=user.user_id)
        db().add(existing)
        post.likes += 1
        db().commit()
        db().refresh(post)
        return jsonify(post_like_payload(post, user)), 201

    return jsonify(post_like_payload(post, user))


@app.route("/api/feed/trending", methods=["GET", "POST"])
def trending_collection():
    if request.method == "POST":
        return create_resource(make_trending_topic)
    return jsonify(serialize_all(TrendingTopic))


@app.route("/api/feed/trending/<int:item_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def trending_item(item_id: int):
    return resource_detail(TrendingTopic, item_id, TRENDING_UPDATE_FIELDS)


@app.route("/api/feed/suggested-people", methods=["GET", "POST"])
def suggested_people_collection():
    if request.method == "POST":
        return create_resource(make_suggested_person)
    return jsonify(serialize_all(SuggestedPerson))


@app.route("/api/feed/suggested-people/<int:item_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def suggested_people_item(item_id: int):
    return resource_detail(SuggestedPerson, item_id, SUGGESTED_PERSON_UPDATE_FIELDS)


@app.route("/api/clubs")
def clubs():
    return jsonify(
        {
            "spotlightClubs": serialize_all(SpotlightClub),
            "clubCards": serialize_all(ClubCard),
            "stats": serialize_all(ClubStat),
        }
    )


@app.route("/api/clubs", methods=["POST"])
def create_club_alias():
    admin_error = require_admin_user()
    if admin_error is not None:
        return admin_error
    return create_club_card_resource()


@app.route("/api/clubs/items", methods=["GET", "POST"])
def club_items_collection():
    if request.method == "POST":
        admin_error = require_admin_user()
        if admin_error is not None:
            return admin_error
        return create_club_card_resource()
    return jsonify(serialize_all(ClubCard))


@app.route("/api/clubs/items/<int:item_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def club_item(item_id: int):
    if request.method != "GET":
        admin_error = require_admin_user()
        if admin_error is not None:
            return admin_error
    return resource_detail(ClubCard, item_id, CLUB_UPDATE_FIELDS)


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
    if user is None:
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
        existing = ClubFollower(club_id=club.id, user_id=user.user_id)
        db().add(existing)
        db().commit()
        db().refresh(existing)
        return jsonify(club_follow_payload(club, user)), 201

    return jsonify(club_follow_payload(club, user))


@app.route("/api/clubs/<slug>/members", methods=["GET", "POST"])
def club_members_collection(slug: str):
    club = club_by_slug(slug)
    if club is None:
        return jsonify({"error": "not found"}), 404

    if request.method == "POST":
        admin_error = require_admin_user()
        if admin_error is not None:
            return admin_error
        return create_club_member_resource(club)

    return jsonify([serialize_club_member(member) for member in club_members_for_club(club)])


@app.route("/api/clubs/<slug>/members/<int:member_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def club_member_item(slug: str, member_id: int):
    club = club_by_slug(slug)
    if club is None:
        return jsonify({"error": "not found"}), 404

    member = db().get(ClubMember, member_id)
    if member is None or member.club_id != club.id:
        return jsonify({"error": "not found"}), 404

    if request.method == "GET":
        return jsonify(serialize_club_member(member))

    admin_error = require_admin_user()
    if admin_error is not None:
        return admin_error

    if request.method == "DELETE":
        db().delete(member)
        db().commit()
        return ("", 204)

    data = read_json()
    if "title" in data:
        member.title = text_value(data.get("title"), "Member")
    db().commit()
    db().refresh(member)
    return jsonify(serialize_club_member(member))


@app.route("/api/clubs/spotlight", methods=["GET", "POST"])
def spotlight_collection():
    if request.method == "POST":
        admin_error = require_admin_user()
        if admin_error is not None:
            return admin_error
        return create_resource(make_spotlight_club)
    return jsonify(serialize_all(SpotlightClub))


@app.route("/api/clubs/spotlight/<int:item_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def spotlight_item(item_id: int):
    if request.method != "GET":
        admin_error = require_admin_user()
        if admin_error is not None:
            return admin_error
    return resource_detail(SpotlightClub, item_id, SPOTLIGHT_UPDATE_FIELDS)


@app.route("/api/clubs/stats", methods=["GET", "POST"])
def club_stats_collection():
    if request.method == "POST":
        admin_error = require_admin_user()
        if admin_error is not None:
            return admin_error
        return create_resource(make_club_stat)
    return jsonify(serialize_all(ClubStat))


@app.route("/api/clubs/stats/<int:item_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def club_stats_item(item_id: int):
    if request.method != "GET":
        admin_error = require_admin_user()
        if admin_error is not None:
            return admin_error
    return resource_detail(ClubStat, item_id, CLUB_STAT_UPDATE_FIELDS)


@app.route("/api/games")
def games():
    return jsonify(
        {
            "gameCards": serialize_all(GameCard),
            "topRated": serialize_all(TopRatedGame),
            "recentActivity": serialize_all(RecentGameActivity),
        }
    )


@app.route("/api/games/leaderboards")
def game_leaderboards():
    entries = leaderboard_entries()
    return jsonify(
        {
            "entries": entries,
            "totalPlayers": len(entries),
            "generatedAt": datetime.utcnow().isoformat(),
        }
    )


@app.route("/api/games/xp", methods=["POST"])
def award_game_xp():
    user = current_auth_user()
    if user is None:
        return jsonify({"error": "unauthorized"}), 401

    if is_admin_user(user):
        return jsonify({"error": "admin is not ranked"}), 403

    xp = optional_int(get_first(read_json(), "xp", "score", "points"))
    if xp is None or xp <= 0:
        return jsonify({"error": "xp must be a positive integer"}), 400

    row = award_user_xp(user, xp)
    return jsonify(
        {
            "userId": user.user_id,
            "user_id": user.user_id,
            "awardedXp": xp,
            "awarded_xp": xp,
            "totalXp": row.total_xp,
            "total_xp": row.total_xp,
        }
    )


@app.route("/api/games/items", methods=["GET", "POST"])
def game_items_collection():
    if request.method == "POST":
        return create_resource(make_game_card)
    return jsonify(serialize_all(GameCard))


@app.route("/api/games/items/<int:item_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def game_item(item_id: int):
    return resource_detail(GameCard, item_id, GAME_UPDATE_FIELDS)


@app.route("/api/games/top-rated", methods=["GET", "POST"])
def top_rated_games_collection():
    if request.method == "POST":
        return create_resource(make_top_rated_game)
    return jsonify(serialize_all(TopRatedGame))


@app.route("/api/games/top-rated/<int:item_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def top_rated_games_item(item_id: int):
    return resource_detail(TopRatedGame, item_id, TOP_RATED_GAME_UPDATE_FIELDS)


@app.route("/api/games/recent-activity", methods=["GET", "POST"])
def recent_game_activity_collection():
    if request.method == "POST":
        return create_resource(make_recent_game_activity)
    return jsonify(serialize_all(RecentGameActivity))


@app.route("/api/games/recent-activity/<int:item_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def recent_game_activity_item(item_id: int):
    return resource_detail(RecentGameActivity, item_id, RECENT_GAME_ACTIVITY_UPDATE_FIELDS)


@app.route("/api/marketplace")
def marketplace():
    return jsonify({"items": [serialize_marketplace_post(post) for post in marketplace_posts()]})


@app.route("/api/marketplace", methods=["POST"])
@app.route("/api/marketplace/items", methods=["POST"])
def create_marketplace_item():
    return create_post_from_payload(marketplace_post_payload(read_json()))


@app.route("/api/marketplace/items", methods=["GET"])
def marketplace_items_collection():
    return jsonify([serialize_marketplace_post(post) for post in marketplace_posts()])


@app.route("/api/marketplace/items/<post_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def marketplace_item(post_id: str):
    post = db().get(Post, post_id)
    if post is None or post.post_type != 2:
        return jsonify({"error": "not found"}), 404

    if request.method == "GET":
        return jsonify(serialize_marketplace_post(post))
    if request.method == "DELETE":
        owner_error = require_post_owner_or_admin(post)
        if owner_error is not None:
            return owner_error
        db().delete(post)
        db().commit()
        return ("", 204)

    return update_post_from_payload(post, marketplace_post_payload(read_json()))


@app.route("/api/messages")
def messages():
    return jsonify({"conversations": serialize_all(Conversation), "messages": serialize_all(ChatMessage)})


@app.route("/api/messages/conversations", methods=["GET", "POST"])
def conversations_collection():
    if request.method == "POST":
        return create_resource(make_conversation)
    return jsonify(serialize_all(Conversation))


@app.route("/api/messages/conversations/<int:item_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def conversation_item(item_id: int):
    return resource_detail(Conversation, item_id, CONVERSATION_UPDATE_FIELDS)


@app.route("/api/messages/items", methods=["GET", "POST"])
def messages_collection():
    if request.method == "POST":
        return create_resource(make_chat_message)
    return jsonify(serialize_all(ChatMessage))


@app.route("/api/messages/items/<int:item_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def message_item(item_id: int):
    return resource_detail(ChatMessage, item_id, MESSAGE_UPDATE_FIELDS)


@app.route("/api/auth/signup", methods=["POST"])
def auth_signup():
    data = read_json()
    user, error_response, status = create_user_from_payload(data, require_password=True)
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
        session = db().get(AuthSession, token)
        if session is not None:
            db().delete(session)
            db().commit()
    return ("", 204)


@app.route("/api/profile/<user>")
def profile(user: str):
    stored_profile = db().get(Profile, user)
    if stored_profile is None:
        return jsonify(DEFAULT_PROFILE)
    return jsonify(stored_profile.to_dict(include_user=False))


@app.route("/api/profiles", methods=["GET", "POST"])
def profiles_collection():
    if request.method == "GET":
        return jsonify(serialize_all(Profile))

    profile_item = make_profile(read_json())
    if not profile_item.user:
        return jsonify({"error": "user is required"}), 400
    if db().get(Profile, profile_item.user) is not None:
        return jsonify({"error": "profile already exists"}), 409

    db().add(profile_item)
    db().commit()
    db().refresh(profile_item)
    return jsonify(profile_item.to_dict()), 201


@app.route("/api/profiles/<user>", methods=["GET", "PATCH", "PUT", "DELETE"])
def profile_item(user: str):
    profile_record = db().get(Profile, user)
    if profile_record is None:
        return jsonify({"error": "not found"}), 404

    if request.method == "GET":
        return jsonify(profile_record.to_dict())
    if request.method == "DELETE":
        db().delete(profile_record)
        db().commit()
        return ("", 204)

    apply_updates(profile_record, read_json(), PROFILE_UPDATE_FIELDS)
    db().commit()
    db().refresh(profile_record)
    return jsonify(profile_record.to_dict())


if __name__ == "__main__":
    ensure_database_initialized()
    port = int(os.getenv("PORT", "5000"))
    app.run(
        host="127.0.0.1",
        port=port,
        debug=os.getenv("FLASK_DEBUG") == "1",
        use_reloader=False,
    )

