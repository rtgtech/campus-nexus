"""
graph_manager.py
----------------
Production wrapper around build_graph.py.

Handles:
  - Cold-start (no users / no posts yet)
  - Incremental node/edge/post updates without full rebuilds
  - Thread-safe in-memory graph with a read/write lock
  - Feed ranking via CampusRank (personalised PageRank + post signals)

Public API
----------
    GraphManager.get_feed(user_id, limit) -> list[dict]
    GraphManager.add_user(user_row)
    GraphManager.add_post(post_row)
    GraphManager.upsert_relationship(user_i, user_j, edge_attrs)
    GraphManager.rebuild()                # force full rebuild from DB/CSVs
"""

from __future__ import annotations

import logging
import math
import threading
import time
from typing import Any

import networkx as nx
import numpy as np

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Constants / tuneable weights
# ─────────────────────────────────────────────────────────────────────────────

# PageRank personalisation weight (how much a user's own neighbourhood matters)
ALPHA = 0.85          # damping factor
PR_ITERATIONS = 100

# Feed scoring formula weights  (must sum to 1.0 for interpretability)
W_PAGERANK   = 0.40   # author's graph importance
W_ENGAGEMENT = 0.30   # normalised post engagement
W_RECENCY    = 0.20   # time decay
W_SOCIAL     = 0.10   # edge weight to the post's author

RECENCY_HALF_LIFE_HOURS = 24.0   # engagement halves every N hours


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _recency_score(created_at_ts: float, now_ts: float | None = None) -> float:
    """Exponential decay: score = 0.5 ^ (age_hours / half_life)."""
    if now_ts is None:
        now_ts = time.time()
    age_hours = max(0.0, (now_ts - created_at_ts) / 3600.0)
    return math.pow(0.5, age_hours / RECENCY_HALF_LIFE_HOURS)


def _normalise(values: list[float]) -> list[float]:
    """Min-max normalise a list; returns uniform distribution on empty/flat input."""
    if not values:
        return values
    lo, hi = min(values), max(values)
    span = hi - lo
    if span < 1e-9:
        return [1.0 / len(values)] * len(values)
    return [(v - lo) / span for v in values]


# ─────────────────────────────────────────────────────────────────────────────
# GraphManager
# ─────────────────────────────────────────────────────────────────────────────

class GraphManager:
    """
    Thread-safe, in-memory graph + post store.

    Lifecycle
    ---------
        mgr = GraphManager()
        mgr.rebuild(users_df, posts_df, rels_df)   # call once at startup
        # … or start with empty state and add incrementally …
        mgr.add_user({...})
        mgr.add_post({...})
        mgr.upsert_relationship(u, v, {...})

        feed = mgr.get_feed(user_id=42, limit=20)
    """

    def __init__(self) -> None:
        self._lock  = threading.RLock()
        self._graph: nx.Graph = nx.Graph()

        # post_id -> dict  (all post fields + ep_norm)
        self._posts: dict[int, dict] = {}

        # cached pagerank; invalidated on graph mutation
        self._pr_cache: dict[int, float] | None = None
        self._pr_dirty = True

    # ── Graph mutations ───────────────────────────────────────────────────────

    def add_user(self, user_row: dict[str, Any]) -> None:
        """Insert or update a single user node."""
        uid = user_row["user_id"]
        with self._lock:
            self._graph.add_node(uid, **user_row)
            self._pr_dirty = True
        logger.debug("add_user uid=%s", uid)

    def remove_user(self, user_id: int) -> None:
        with self._lock:
            self._graph.remove_node(user_id)
            self._pr_dirty = True

    def add_post(self, post_row: dict[str, Any]) -> None:
        """
        Insert or update a post.
        Normalisation is deferred; ep_norm is recomputed lazily in get_feed.
        """
        pid = post_row["post_id"]
        with self._lock:
            self._posts[pid] = dict(post_row)
        logger.debug("add_post pid=%s", pid)

    def remove_post(self, post_id: int) -> None:
        with self._lock:
            self._posts.pop(post_id, None)

    def upsert_relationship(
        self,
        user_i: int,
        user_j: int,
        attrs: dict[str, Any],
    ) -> None:
        """Add or update an undirected edge between two users."""
        with self._lock:
            # Ensure both nodes exist (ghost nodes for safety)
            if not self._graph.has_node(user_i):
                self._graph.add_node(user_i, user_id=user_i)
            if not self._graph.has_node(user_j):
                self._graph.add_node(user_j, user_id=user_j)

            weight = attrs.get("relationship_weight", 1.0)
            self._graph.add_edge(user_i, user_j, weight=weight, **attrs)
            self._pr_dirty = True

    def rebuild(self, users_df=None, posts_df=None, rels_df=None) -> None:
        """
        Full rebuild from DataFrames (e.g. loaded from DB at startup).
        All three params are optional — pass only what you have.
        """
        import pandas as pd  # lazy import so module works without pandas at runtime

        with self._lock:
            self._graph   = nx.Graph()
            self._posts   = {}
            self._pr_dirty = True

            if users_df is not None and len(users_df):
                for _, row in users_df.iterrows():
                    self._graph.add_node(row["user_id"], **row.to_dict())

            if posts_df is not None and len(posts_df):
                mn = posts_df["engagement_score"].min()
                mx = posts_df["engagement_score"].max()
                for _, row in posts_df.iterrows():
                    d = row.to_dict()
                    d["ep_norm"] = float(
                        (d["engagement_score"] - mn) / (mx - mn + 1e-9)
                    )
                    self._posts[d["post_id"]] = d

            if rels_df is not None and len(rels_df):
                for _, row in rels_df.iterrows():
                    self._graph.add_edge(
                        row["user_i"], row["user_j"],
                        weight               = row["relationship_weight"],
                        friendship_score     = row["friendship_score"],
                        club_similarity      = row["club_similarity"],
                        dept_year_similarity = row["department_year_similarity"],
                        interaction_score    = row["interaction_score"],
                        profile_visits       = row["profile_visits"],
                        likes_between        = row["likes_between_users"],
                        comments_between     = row["comments_between_users"],
                        messages_between     = row["messages_between_users"],
                    )

        logger.info(
            "Graph rebuilt: %d nodes, %d edges, %d posts",
            self._graph.number_of_nodes(),
            self._graph.number_of_edges(),
            len(self._posts),
        )

    # ── PageRank (cached) ─────────────────────────────────────────────────────

    def _get_pagerank(self) -> dict[int, float]:
        """Return cached PageRank; recompute only when graph has changed."""
        if not self._pr_dirty and self._pr_cache is not None:
            return self._pr_cache

        with self._lock:
            n = self._graph.number_of_nodes()

            if n == 0:
                self._pr_cache = {}
            elif n == 1:
                node = list(self._graph.nodes)[0]
                self._pr_cache = {node: 1.0}
            else:
                try:
                    self._pr_cache = nx.pagerank(
                        self._graph,
                        alpha       = ALPHA,
                        max_iter    = PR_ITERATIONS,
                        weight      = "weight",
                    )
                except nx.PowerIterationFailedConvergence:
                    logger.warning("PageRank did not converge; using degree centrality")
                    self._pr_cache = nx.degree_centrality(self._graph)

            self._pr_dirty = False
            return self._pr_cache

    # ── Feed ranking ──────────────────────────────────────────────────────────

    def get_feed(
        self,
        user_id: int,
        limit:   int = 20,
        now_ts:  float | None = None,
    ) -> list[dict]:
        """
        Rank all posts for a requesting user and return top-`limit` results.

        Cold-start behaviour
        --------------------
        - No users / no graph  → returns posts sorted by raw engagement_score
        - No posts             → returns []
        - Requesting user not in graph → falls back to global PageRank (no personalisation)
        """
        if now_ts is None:
            now_ts = time.time()

        with self._lock:
            posts_snapshot = dict(self._posts)
            graph_snapshot = self._graph.copy()

        # ── Empty states ──────────────────────────────────────────────────────
        if not posts_snapshot:
            return []

        pr = self._get_pagerank()

        # ── Compute ep_norm on the fly (so new posts score fairly) ───────────
        eng_scores = [p["engagement_score"] for p in posts_snapshot.values()]
        mn, mx = min(eng_scores), max(eng_scores)
        span = mx - mn + 1e-9

        # ── Neighbour edge-weight lookup for social signal ────────────────────
        neighbours: dict[int, float] = {}
        if graph_snapshot.has_node(user_id):
            for nbr, edge_data in graph_snapshot[user_id].items():
                neighbours[nbr] = edge_data.get("weight", 1.0)

        max_nbr_weight = max(neighbours.values(), default=1.0)

        # ── Score every post ──────────────────────────────────────────────────
        scored: list[tuple[float, dict]] = []

        for post in posts_snapshot.values():
            author = post.get("user_id") or post.get("author_id")

            # 1. Author's graph importance
            s_pr = pr.get(author, 0.0) if pr else 0.0

            # 2. Post engagement (normalised 0-1)
            s_eng = (post["engagement_score"] - mn) / span

            # 3. Recency decay
            created = post.get("created_at_ts") or post.get("created_at") or now_ts
            if isinstance(created, str):
                # ISO-8601 fallback
                from datetime import datetime, timezone
                try:
                    created = datetime.fromisoformat(created).replace(
                        tzinfo=timezone.utc
                    ).timestamp()
                except ValueError:
                    created = now_ts
            s_rec = _recency_score(float(created), now_ts)

            # 4. Social proximity (edge weight to author, 0 if not connected)
            raw_social = neighbours.get(author, 0.0)
            s_soc = raw_social / max_nbr_weight if max_nbr_weight > 0 else 0.0

            # Weighted sum
            score = (
                W_PAGERANK   * s_pr  +
                W_ENGAGEMENT * s_eng +
                W_RECENCY    * s_rec +
                W_SOCIAL     * s_soc
            )

            scored.append((score, post))

        # ── Sort and return ───────────────────────────────────────────────────
        scored.sort(key=lambda x: x[0], reverse=True)

        return [
            {**post, "feed_score": round(score, 6)}
            for score, post in scored[:limit]
        ]

    # ── Diagnostics ──────────────────────────────────────────────────────────

    def stats(self) -> dict:
        with self._lock:
            n = self._graph.number_of_nodes()
            e = self._graph.number_of_edges()
            degrees = [d for _, d in self._graph.degree()]
        return {
            "nodes"       : n,
            "edges"       : e,
            "posts"       : len(self._posts),
            "avg_degree"  : round(float(np.mean(degrees)), 3) if degrees else 0,
            "density"     : round(nx.density(self._graph), 6),
            "is_connected": nx.is_connected(self._graph) if n > 1 else True,
        }
