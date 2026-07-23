from __future__ import annotations

import math
import time
from datetime import datetime, timezone
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

def _user_node(userId: Any) -> str:
    return f"user:{str(userId)}"


def _club_node(clubId: Any) -> str:
    return f"club:{str(clubId)}"


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


def _recency_score(createdAt: Any, now_ts: float) -> float:
    created_ts = _timestamp(createdAt, default=now_ts)
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
    if keys and all(abs(values[key]) < 1e-9 for key in keys):
        return {key: 0.0 for key in keys}
    normalised_values = _normalise([values[key] for key in keys])
    return dict(zip(keys, normalised_values))


def _engagement_score(post: Mapping[str, Any]) -> float:
    if "engagementScore" in post:
        return _number(post.get("engagementScore"))
    likes = _number(post.get("likes"))
    shares = _number(post.get("shares"))
    return likes + (shares * 2.0)


def _post_target_node(post: Mapping[str, Any]) -> Optional[str]:
    postType = int(_number(post.get("type", post.get("postType")), 0.0))
    clubId = _read_id(post, "clubId")
    if postType == 1 and clubId is not None:
        return _club_node(clubId)

    authorId = _read_id(post, "authorId", "userId")
    if authorId is None:
        return None
    return _user_node(authorId)


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
        userId
        for user in users
        if (userId := _read_id(user, "userId", "id")) is not None and userId not in admin_user_ids
    }
    club_ids = {
        clubId
        for club in clubs
        if (clubId := _read_id(club, "id", "clubId")) is not None
    }

    for userId in user_ids:
        graph.add_node(_user_node(userId), kind="user")

    for clubId in club_ids:
        graph.add_node(_club_node(clubId), kind="club")

    member_pairs = {
        (str(clubId), str(userId))
        for clubId, userId in club_memberships
        if str(userId) in user_ids and str(clubId) in club_ids and str(userId) not in admin_user_ids
    }
    follower_pairs = {
        (str(clubId), str(userId))
        for clubId, userId in club_followers
        if str(userId) in user_ids and str(clubId) in club_ids and str(userId) not in admin_user_ids
    }

    for userId in user_ids:
        for clubId in club_ids:
            weight = (
                CLUB_MEMBER_EDGE_WEIGHT
                if (clubId, userId) in member_pairs or (clubId, userId) in follower_pairs
                else DEFAULT_CLUB_EDGE_WEIGHT
            )
            graph.add_edge(_user_node(userId), _club_node(clubId), weight=weight)

    friendship_pairs: set[tuple[str, str]] = set()
    for userAId, userBId in friendships:
        user_a = str(userAId)
        user_b = str(userBId)
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
        admin_user_ids={str(userId) for userId in admin_user_ids},
    )
    nx.set_node_attributes(graph, _pagerank(graph), "pagerank")
    graph.graph["generatedAt"] = datetime.now(timezone.utc).isoformat()
    return graph


def rank_feed_posts(
    *,
    posts: Sequence[Mapping[str, Any]],
    viewerUserId: Optional[str],
    pagerank_scores: Optional[Mapping[str, float]] = None,
    social_scores: Optional[Mapping[str, float]] = None,
    limit: Optional[int] = None,
    now_ts: Optional[float] = None,
) -> list[dict[str, Any]]:
    if not posts:
        return []

    if now_ts is None:
        now_ts = time.time()
    pagerank_scores = pagerank_scores or {}
    social_scores = social_scores or {}

    engagement_values = [_engagement_score(post) for post in posts]
    engagement_norms = _normalise(engagement_values)

    target_nodes = [_post_target_node(post) for post in posts]
    target_pagerank = _normalise_map(
        {
            target_node: _number(pagerank_scores.get(target_node))
            for target_node in set(target_nodes)
            if target_node is not None
        }
    )
    scored: list[tuple[float, float, str, dict[str, Any]]] = []

    for post, target_node, engagement_norm in zip(posts, target_nodes, engagement_norms):
        createdAt = post.get("createdAt")
        created_ts = _timestamp(createdAt, default=now_ts)

        s_pr = target_pagerank.get(target_node, 0.0) if target_node is not None else 0.0
        s_rec = _recency_score(createdAt, now_ts)
        s_social = min(max(_number(social_scores.get(target_node)) if target_node else 0.0, 0.0), 1.0)

        feedScore = (
            W_PAGERANK * s_pr
            + W_ENGAGEMENT * engagement_norm
            + W_RECENCY * s_rec
            + W_SOCIAL * s_social
        )

        ranked_post = dict(post)
        rounded_score = round(feedScore, 6)
        ranked_post["feedScore"] = rounded_score
        ranked_post["rankingSignals"] = {
            "pagerank": round(s_pr, 6),
            "engagement": round(engagement_norm, 6),
            "recency": round(s_rec, 6),
            "social": round(s_social, 6),
        }
        scored.append((feedScore, created_ts, str(ranked_post.get("postId", ranked_post.get("id", ""))), ranked_post))

    scored.sort(key=lambda item: (-item[0], -item[1], item[2]))
    ranked_posts = [post for _, _, _, post in scored]
    if limit is not None:
        return ranked_posts[:limit]
    return ranked_posts
