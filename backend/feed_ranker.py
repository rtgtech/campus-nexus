from __future__ import annotations

import math
import os
import pickle
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any, Iterable, Mapping, Optional, Sequence

import networkx as nx

ALPHA = 0.85
PR_ITERATIONS = 100

W_PAGERANK = 0.40
W_ENGAGEMENT = 0.30
W_RECENCY = 0.20
W_SOCIAL = 0.10

RECENCY_HALF_LIFE_HOURS = 24.0

DEFAULT_CLUB_EDGE_WEIGHT = 0.05
CLUB_MEMBER_EDGE_WEIGHT = 1.0
FRIENDSHIP_EDGE_WEIGHT = 1.0

GRAPH_SCHEMA_VERSION = 1
DEFAULT_GRAPH_PATH = Path(__file__).resolve().parent / ".cache" / "feed_graph.gpickle"

_graph_cache_lock = Lock()
_cached_graph: Optional[nx.Graph] = None
_cached_graph_path: Optional[Path] = None
_cached_graph_mtime_ns: Optional[int] = None


def _user_node(user_id: Any) -> str:
    return f"user:{str(user_id)}"


def _club_node(club_id: Any) -> str:
    return f"club:{str(club_id)}"


def _read_id(row: Mapping[str, Any], *keys: str) -> Optional[str]:
    for key in keys:
        value = row.get(key)
        if value is not None and str(value):
            return str(value)
    return None


def _number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _timestamp(value: Any, default: Optional[float] = None) -> float:
    if default is None:
        default = time.time()

    if value is None:
        return default

    if isinstance(value, (int, float)):
        return float(value)

    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.timestamp()

    if isinstance(value, str):
        normalized = value.strip()
        if not normalized:
            return default
        if normalized.endswith("Z"):
            normalized = f"{normalized[:-1]}+00:00"
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            return default
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.timestamp()

    return default


def _recency_score(created_at: Any, now_ts: float) -> float:
    created_ts = _timestamp(created_at, default=now_ts)
    age_hours = max(0.0, (now_ts - created_ts) / 3600.0)
    return math.pow(0.5, age_hours / RECENCY_HALF_LIFE_HOURS)


def _normalise(values: Sequence[float]) -> list[float]:
    if not values:
        return []
    lo = min(values)
    hi = max(values)
    span = hi - lo
    if span < 1e-9:
        return [0.5 for _ in values]
    return [(value - lo) / span for value in values]


def _normalise_map(values: Mapping[str, float]) -> dict[str, float]:
    keys = list(values.keys())
    normalised_values = _normalise([values[key] for key in keys])
    return dict(zip(keys, normalised_values))


def _engagement_score(post: Mapping[str, Any]) -> float:
    if "engagement_score" in post:
        return _number(post.get("engagement_score"))
    likes = _number(post.get("likes"))
    shares = _number(post.get("shares"))
    return likes + (shares * 2.0)


def _post_target_node(post: Mapping[str, Any]) -> Optional[str]:
    post_type = int(_number(post.get("type", post.get("post_type")), 0.0))
    club_id = _read_id(post, "club_id", "clubId")
    if post_type == 1 and club_id is not None:
        return _club_node(club_id)

    author_id = _read_id(post, "author_id", "authorId", "user_id", "userId")
    if author_id is None:
        return None
    return _user_node(author_id)


def _build_graph(
    *,
    users: Iterable[Mapping[str, Any]],
    clubs: Iterable[Mapping[str, Any]],
    club_memberships: Iterable[tuple[Any, Any]],
    friendships: Iterable[tuple[Any, Any]],
    admin_user_ids: set[str],
    club_followers: Iterable[tuple[Any, Any]] = (),
) -> nx.Graph:
    graph = nx.Graph()

    user_ids = {
        user_id
        for user in users
        if (user_id := _read_id(user, "user_id", "userId", "id")) is not None and user_id not in admin_user_ids
    }
    club_ids = {
        club_id
        for club in clubs
        if (club_id := _read_id(club, "id", "club_id", "clubId")) is not None
    }

    for user_id in user_ids:
        graph.add_node(_user_node(user_id), kind="user")

    for club_id in club_ids:
        graph.add_node(_club_node(club_id), kind="club")

    member_pairs = {
        (str(club_id), str(user_id))
        for club_id, user_id in club_memberships
        if str(user_id) in user_ids and str(club_id) in club_ids and str(user_id) not in admin_user_ids
    }
    follower_pairs = {
        (str(club_id), str(user_id))
        for club_id, user_id in club_followers
        if str(user_id) in user_ids and str(club_id) in club_ids and str(user_id) not in admin_user_ids
    }

    for user_id in user_ids:
        for club_id in club_ids:
            weight = (
                CLUB_MEMBER_EDGE_WEIGHT
                if (club_id, user_id) in member_pairs or (club_id, user_id) in follower_pairs
                else DEFAULT_CLUB_EDGE_WEIGHT
            )
            graph.add_edge(_user_node(user_id), _club_node(club_id), weight=weight)

    friendship_pairs: set[tuple[str, str]] = set()
    for user_a_id, user_b_id in friendships:
        user_a = str(user_a_id)
        user_b = str(user_b_id)
        if user_a == user_b:
            continue
        if user_a not in user_ids or user_b not in user_ids:
            continue
        if user_a in admin_user_ids or user_b in admin_user_ids:
            continue
        friendship_pairs.add(tuple(sorted((user_a, user_b))))

    for user_a, user_b in friendship_pairs:
        graph.add_edge(
            _user_node(user_a),
            _user_node(user_b),
            weight=FRIENDSHIP_EDGE_WEIGHT,
        )

    return graph


def _pagerank(graph: nx.Graph) -> dict[str, float]:
    node_count = graph.number_of_nodes()
    if node_count == 0:
        return {}
    if node_count == 1:
        return {next(iter(graph.nodes)): 1.0}

    nodes = list(graph.nodes)
    rank = {node: 1.0 / node_count for node in nodes}
    base_score = (1.0 - ALPHA) / node_count
    tolerance = 1e-6 * node_count

    for _ in range(PR_ITERATIONS):
        next_rank = {node: base_score for node in nodes}
        dangling_rank = 0.0

        for node in nodes:
            weighted_degree = sum(_number(edge_data.get("weight"), 1.0) for edge_data in graph[node].values())
            if weighted_degree <= 0:
                dangling_rank += rank[node]
                continue

            weighted_share = ALPHA * rank[node] / weighted_degree
            for neighbour, edge_data in graph[node].items():
                next_rank[neighbour] += weighted_share * _number(edge_data.get("weight"), 1.0)

        if dangling_rank:
            dangling_share = ALPHA * dangling_rank / node_count
            for node in nodes:
                next_rank[node] += dangling_share

        error = sum(abs(next_rank[node] - rank[node]) for node in nodes)
        rank = next_rank
        if error < tolerance:
            return rank

    return nx.degree_centrality(graph)


def build_feed_graph(
    *,
    users: Iterable[Mapping[str, Any]],
    clubs: Iterable[Mapping[str, Any]],
    club_memberships: Iterable[tuple[Any, Any]],
    club_followers: Iterable[tuple[Any, Any]],
    friendships: Iterable[tuple[Any, Any]],
    admin_user_ids: Iterable[str] = (),
) -> nx.Graph:
    graph = _build_graph(
        users=users,
        clubs=clubs,
        club_memberships=club_memberships,
        club_followers=club_followers,
        friendships=friendships,
        admin_user_ids={str(user_id) for user_id in admin_user_ids},
    )
    nx.set_node_attributes(graph, _pagerank(graph), "pagerank")
    graph.graph["schema_version"] = GRAPH_SCHEMA_VERSION
    graph.graph["generated_at"] = datetime.now(timezone.utc).isoformat()
    return graph


def feed_graph_path() -> Path:
    configured = os.getenv("FEED_GRAPH_PATH")
    return Path(configured).expanduser().resolve() if configured else DEFAULT_GRAPH_PATH


def stage_feed_graph(graph: nx.Graph, path: Optional[Path] = None) -> tuple[Path, Path]:
    destination = (path or feed_graph_path()).resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{destination.name}.", suffix=".tmp", dir=destination.parent)
    temporary_path = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as output:
            pickle.dump(graph, output, protocol=pickle.HIGHEST_PROTOCOL)
            output.flush()
            os.fsync(output.fileno())
    except Exception:
        temporary_path.unlink(missing_ok=True)
        raise
    return temporary_path, destination


def publish_staged_feed_graph(graph: nx.Graph, staged_path: Path, destination: Path) -> None:
    global _cached_graph, _cached_graph_path, _cached_graph_mtime_ns
    with _graph_cache_lock:
        os.replace(staged_path, destination)
        _cached_graph = graph
        _cached_graph_path = destination
        _cached_graph_mtime_ns = destination.stat().st_mtime_ns


def persist_feed_graph(graph: nx.Graph, path: Optional[Path] = None) -> Path:
    staged_path, destination = stage_feed_graph(graph, path)
    try:
        publish_staged_feed_graph(graph, staged_path, destination)
    finally:
        staged_path.unlink(missing_ok=True)
    return destination


def load_feed_graph(path: Optional[Path] = None) -> nx.Graph:
    global _cached_graph, _cached_graph_path, _cached_graph_mtime_ns
    graph_path = (path or feed_graph_path()).resolve()
    current_mtime_ns = graph_path.stat().st_mtime_ns
    with _graph_cache_lock:
        if (
            _cached_graph is not None
            and _cached_graph_path == graph_path
            and _cached_graph_mtime_ns == current_mtime_ns
        ):
            return _cached_graph
        with graph_path.open("rb") as source:
            graph = pickle.load(source)
            loaded_mtime_ns = os.fstat(source.fileno()).st_mtime_ns
        if not isinstance(graph, nx.Graph) or graph.is_directed():
            raise ValueError("feed graph file does not contain an undirected NetworkX graph")
        if graph.graph.get("schema_version") != GRAPH_SCHEMA_VERSION:
            raise ValueError("feed graph schema version is not supported")
        _cached_graph = graph
        _cached_graph_path = graph_path
        _cached_graph_mtime_ns = loaded_mtime_ns
        return graph


def reset_feed_graph_cache() -> None:
    global _cached_graph, _cached_graph_path, _cached_graph_mtime_ns
    with _graph_cache_lock:
        _cached_graph = None
        _cached_graph_path = None
        _cached_graph_mtime_ns = None


def rank_feed_posts(
    *,
    graph: nx.Graph,
    posts: Sequence[Mapping[str, Any]],
    viewer_user_id: Optional[str],
    limit: Optional[int] = None,
    now_ts: Optional[float] = None,
) -> list[dict[str, Any]]:
    if not posts:
        return []

    if now_ts is None:
        now_ts = time.time()

    pagerank = {node: _number(value) for node, value in nx.get_node_attributes(graph, "pagerank").items()}

    engagement_values = [_engagement_score(post) for post in posts]
    engagement_norms = _normalise(engagement_values)

    viewer_node = _user_node(viewer_user_id) if viewer_user_id else None
    target_nodes = [_post_target_node(post) for post in posts]
    target_pagerank = _normalise_map(
        {
            target_node: pagerank.get(target_node, 0.0)
            for target_node in set(target_nodes)
            if target_node is not None
        }
    )
    scored: list[tuple[float, float, str, dict[str, Any]]] = []

    for post, target_node, engagement_norm in zip(posts, target_nodes, engagement_norms):
        created_at = post.get("created_at", post.get("createdAt"))
        created_ts = _timestamp(created_at, default=now_ts)

        s_pr = target_pagerank.get(target_node, 0.0) if target_node is not None else 0.0
        s_rec = _recency_score(created_at, now_ts)
        s_social = 0.0

        if viewer_node is not None and target_node is not None:
            if viewer_node == target_node:
                s_social = 1.0
            elif target_node.startswith("user:") and viewer_user_id:
                s_social = FRIENDSHIP_EDGE_WEIGHT if graph.has_edge(viewer_node, target_node) else 0.0
            elif graph.has_edge(viewer_node, target_node):
                s_social = min(max(_number(graph[viewer_node][target_node].get("weight")), 0.0), 1.0)

        feed_score = (
            W_PAGERANK * s_pr
            + W_ENGAGEMENT * engagement_norm
            + W_RECENCY * s_rec
            + W_SOCIAL * s_social
        )

        ranked_post = dict(post)
        rounded_score = round(feed_score, 6)
        ranked_post["feed_score"] = rounded_score
        ranked_post["feedScore"] = rounded_score
        ranked_post["rankingSignals"] = {
            "pagerank": round(s_pr, 6),
            "engagement": round(engagement_norm, 6),
            "recency": round(s_rec, 6),
            "social": round(s_social, 6),
        }
        scored.append((feed_score, created_ts, str(ranked_post.get("post_id", ranked_post.get("id", ""))), ranked_post))

    scored.sort(key=lambda item: (-item[0], -item[1], item[2]))
    ranked_posts = [post for _, _, _, post in scored]
    if limit is not None:
        return ranked_posts[:limit]
    return ranked_posts
