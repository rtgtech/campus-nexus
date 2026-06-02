from __future__ import annotations

import os
import secrets
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Any, Callable, Optional, Sequence, TypeVar

from flask import Flask, g, jsonify, request
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, create_engine, func, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker
from sqlalchemy.pool import StaticPool
from werkzeug.security import check_password_hash, generate_password_hash

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


class FeedPost(OrderedResourceMixin, Base):
    __tablename__ = "feed_posts"

    author: Mapped[str] = mapped_column(String(160), nullable=False)
    meta: Mapped[str] = mapped_column(String(240), nullable=False)
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    image: Mapped[str] = mapped_column(Text, nullable=False)
    tag: Mapped[str] = mapped_column(String(120), nullable=False)
    likes: Mapped[str] = mapped_column(String(40), default="0", nullable=False)
    comments: Mapped[str] = mapped_column(String(40), default="0", nullable=False)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "author": self.author,
            "meta": self.meta,
            "title": self.title,
            "body": self.body,
            "image": self.image,
            "tag": self.tag,
            "likes": self.likes,
            "comments": self.comments,
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


class AuthUser(Base):
    __tablename__ = "auth_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[Optional[str]] = mapped_column(String(80), unique=True, index=True, nullable=True)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    profile_photo: Mapped[str] = mapped_column(Text, nullable=False)
    date_of_birth: Mapped[str] = mapped_column(String(20), nullable=False)
    department: Mapped[str] = mapped_column(String(80), nullable=False)
    year_of_study: Mapped[int] = mapped_column(Integer, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "email": self.email,
            "username": self.username,
            "name": self.name,
            "profilePhoto": self.profile_photo,
            "dateOfBirth": self.date_of_birth,
            "department": self.department,
            "yearOfStudy": self.year_of_study,
        }


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    token: Mapped[str] = mapped_column(String(120), primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("auth_users.id"), nullable=False)
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
    "email": "admin@campus.local",
    "username": "admin",
    "name": "Admin",
    "profilePhoto": PROFILE_AVATAR,
    "dateOfBirth": "2000-01-01",
    "department": "CS",
    "yearOfStudy": 1,
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


def normalize_email(value: Any) -> str:
    return text_value(value).lower()


def normalize_username(value: Any) -> Optional[str]:
    username = text_value(value).lower()
    return username or None


def normalize_login(value: Any) -> str:
    return text_value(value).lower()


def valid_email(value: str) -> bool:
    return "@" in value and "." in value.rsplit("@", 1)[-1]


def read_year_of_study(value: Any) -> Optional[int]:
    year = optional_int(value)
    if year is None or year < 1 or year > 8:
        return None
    return year


def create_auth_session(user: AuthUser) -> str:
    token = secrets.token_urlsafe(32)
    db().add(AuthSession(token=token, user_id=user.id))
    return token


def find_auth_user_by_login(login: str) -> Optional[AuthUser]:
    return db().scalar(select(AuthUser).where((AuthUser.email == login) | (AuthUser.username == login)))


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


def make_post(data: dict[str, Any], sort_order: int = 0) -> FeedPost:
    return FeedPost(
        author=text_value(data.get("author")),
        meta=text_value(data.get("meta")),
        title=text_value(data.get("title")),
        body=text_value(data.get("body")),
        image=text_value(data.get("image"), DEFAULT_POST_IMAGE),
        tag=text_value(data.get("tag")),
        likes=text_value(data.get("likes"), "0"),
        comments=text_value(data.get("comments"), "0"),
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
    return ClubCard(
        title=text_value(data.get("title")),
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
    (("author",), "author", text_value),
    (("meta",), "meta", text_value),
    (("title",), "title", text_value),
    (("body",), "body", text_value),
    (("image",), "image", text_value),
    (("tag",), "tag", text_value),
    (("likes",), "likes", text_value),
    (("comments",), "comments", text_value),
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


def ensure_auth_schema() -> None:
    if engine.dialect.name == "postgresql":
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS username VARCHAR(80)"))
            connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_auth_users_username ON auth_users (username)"))
        return

    if engine.dialect.name == "sqlite":
        with engine.begin() as connection:
            columns = {row[1] for row in connection.exec_driver_sql("PRAGMA table_info(auth_users)").all()}
            if "username" not in columns:
                connection.execute(text("ALTER TABLE auth_users ADD COLUMN username VARCHAR(80)"))
            connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_auth_users_username ON auth_users (username)"))


def seed_admin_user(session: Session) -> None:
    email = normalize_email(DEFAULT_ADMIN_USER["email"])
    username = normalize_username(DEFAULT_ADMIN_USER["username"])
    user = session.scalar(select(AuthUser).where((AuthUser.email == email) | (AuthUser.username == username)))

    if user is None:
        session.add(
            AuthUser(
                email=email,
                username=username,
                name=text_value(DEFAULT_ADMIN_USER["name"], "Admin"),
                profile_photo=text_value(DEFAULT_ADMIN_USER["profilePhoto"], PROFILE_AVATAR),
                date_of_birth=text_value(DEFAULT_ADMIN_USER["dateOfBirth"], "2000-01-01"),
                department=text_value(DEFAULT_ADMIN_USER["department"], "CS"),
                year_of_study=read_year_of_study(DEFAULT_ADMIN_USER["yearOfStudy"]) or 1,
                password_hash=generate_password_hash(text_value(DEFAULT_ADMIN_USER["password"], "12345678")),
            )
        )
        return

    user.username = username
    user.email = email
    user.name = text_value(user.name, text_value(DEFAULT_ADMIN_USER["name"], "Admin"))
    user.profile_photo = text_value(user.profile_photo, text_value(DEFAULT_ADMIN_USER["profilePhoto"], PROFILE_AVATAR))
    user.date_of_birth = text_value(user.date_of_birth, text_value(DEFAULT_ADMIN_USER["dateOfBirth"], "2000-01-01"))
    user.department = text_value(user.department, text_value(DEFAULT_ADMIN_USER["department"], "CS"))
    user.year_of_study = user.year_of_study or read_year_of_study(DEFAULT_ADMIN_USER["yearOfStudy"]) or 1
    user.password_hash = generate_password_hash(text_value(DEFAULT_ADMIN_USER["password"], "12345678"))


def seed_database(session: Session) -> None:
    seed_collection(session, FeedPost, SEED_FEED_CARDS, make_post)
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
        ensure_auth_schema()
        with SessionLocal() as session:
            seed_database(session)
            session.commit()
        _database_initialized = True


def ordered_statement(model: type[T]):
    statement = select(model)
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
            "feedCards": serialize_all(FeedPost),
            "trending": serialize_all(TrendingTopic),
            "suggestedPeople": serialize_all(SuggestedPerson),
        }
    )


@app.route("/api/posts", methods=["GET", "POST"])
def posts_collection():
    if request.method == "POST":
        return create_resource(make_post)
    return jsonify(serialize_all(FeedPost))


@app.route("/api/posts/<int:item_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def posts_item(item_id: int):
    return resource_detail(FeedPost, item_id, POST_UPDATE_FIELDS)


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
    return create_resource(make_club_card)


@app.route("/api/clubs/items", methods=["GET", "POST"])
def club_items_collection():
    if request.method == "POST":
        return create_resource(make_club_card)
    return jsonify(serialize_all(ClubCard))


@app.route("/api/clubs/items/<int:item_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def club_item(item_id: int):
    return resource_detail(ClubCard, item_id, CLUB_UPDATE_FIELDS)


@app.route("/api/clubs/spotlight", methods=["GET", "POST"])
def spotlight_collection():
    if request.method == "POST":
        return create_resource(make_spotlight_club)
    return jsonify(serialize_all(SpotlightClub))


@app.route("/api/clubs/spotlight/<int:item_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def spotlight_item(item_id: int):
    return resource_detail(SpotlightClub, item_id, SPOTLIGHT_UPDATE_FIELDS)


@app.route("/api/clubs/stats", methods=["GET", "POST"])
def club_stats_collection():
    if request.method == "POST":
        return create_resource(make_club_stat)
    return jsonify(serialize_all(ClubStat))


@app.route("/api/clubs/stats/<int:item_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def club_stats_item(item_id: int):
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
    return jsonify({"items": serialize_all(MarketplaceItem)})


@app.route("/api/marketplace", methods=["POST"])
@app.route("/api/marketplace/items", methods=["POST"])
def create_marketplace_item():
    return create_resource(make_marketplace_item)


@app.route("/api/marketplace/items", methods=["GET"])
def marketplace_items_collection():
    return jsonify(serialize_all(MarketplaceItem))


@app.route("/api/marketplace/items/<int:item_id>", methods=["GET", "PATCH", "PUT", "DELETE"])
def marketplace_item(item_id: int):
    return resource_detail(MarketplaceItem, item_id, MARKETPLACE_UPDATE_FIELDS)


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
    email = normalize_email(data.get("email"))
    username = normalize_username(data.get("username"))
    password = text_value(data.get("password"))
    name = text_value(data.get("name"))
    profile_photo = text_value(get_first(data, "profilePhoto", "profile_photo"), PROFILE_AVATAR)
    date_of_birth = text_value(get_first(data, "dateOfBirth", "date_of_birth"))
    department = text_value(data.get("department"))
    year_of_study = read_year_of_study(get_first(data, "yearOfStudy", "year_of_study", "year"))

    if not valid_email(email):
        return jsonify({"error": "valid email is required"}), 400
    if not name:
        return jsonify({"error": "name is required"}), 400
    if not date_of_birth:
        return jsonify({"error": "date of birth is required"}), 400
    if not department:
        return jsonify({"error": "department is required"}), 400
    if year_of_study is None:
        return jsonify({"error": "year of study is required"}), 400
    if len(password) < 6:
        return jsonify({"error": "password must be at least 6 characters"}), 400

    if username is not None:
        existing_username = db().scalar(select(AuthUser).where(AuthUser.username == username))
        if existing_username is not None:
            return jsonify({"error": "username already exists"}), 409

    existing_user = db().scalar(select(AuthUser).where(AuthUser.email == email))
    if existing_user is not None:
        return jsonify({"error": "account already exists"}), 409

    user = AuthUser(
        email=email,
        username=username,
        name=name,
        profile_photo=profile_photo,
        date_of_birth=date_of_birth,
        department=department,
        year_of_study=year_of_study,
        password_hash=generate_password_hash(password),
    )
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

