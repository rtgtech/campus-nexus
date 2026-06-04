"""
app.py
------
FastAPI application that exposes the CampusRank feed algorithm.

Endpoints
---------
    GET  /feed?user_id=<int>&limit=<int>   → ranked post list
    POST /users                             → add / update a user
    POST /posts                             → add / update a post
    POST /relationships                     → add / update an edge
    DELETE /users/{user_id}                → remove user
    DELETE /posts/{post_id}                → remove post
    GET  /graph/stats                       → graph diagnostics

Startup
-------
    The app calls _load_initial_data() on startup.
    Swap that function body for your real DB queries.

Run
---
    pip install fastapi uvicorn networkx numpy pandas
    uvicorn app:app --reload
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import Any, Optional

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from graph_manager import GraphManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Singleton graph manager ───────────────────────────────────────────────────

graph_mgr = GraphManager()


# ── Startup data loader (swap body for real DB calls) ────────────────────────

def _load_initial_data() -> None:
    """
    Called once at server start.

    Priority order:
      1. Real database  ← put your SQLAlchemy / psycopg2 queries here
      2. CSV files      ← fallback for local dev
      3. Empty state    ← cold start; API still works, feed degrades gracefully
    """
    # ── Option 1: load from your database ────────────────────────────────
    # from db import session
    # users_df = pd.read_sql("SELECT * FROM users", session.bind)
    # posts_df = pd.read_sql("SELECT * FROM posts", session.bind)
    # rels_df  = pd.read_sql("SELECT * FROM relationships", session.bind)
    # graph_mgr.rebuild(users_df, posts_df, rels_df)
    # return

    # ── Option 2: CSV fallback (local dev) ────────────────────────────────
    files = {
        "users": os.getenv("USERS_CSV",         "sample_users.csv"),
        "posts": os.getenv("POSTS_CSV",          "sample_posts.csv"),
        "rels":  os.getenv("RELATIONSHIPS_CSV",  "sample_relationships.csv"),
    }

    dfs: dict[str, pd.DataFrame | None] = {}
    for key, path in files.items():
        if os.path.exists(path):
            dfs[key] = pd.read_csv(path)
            logger.info("Loaded %s from %s (%d rows)", key, path, len(dfs[key]))
        else:
            dfs[key] = None
            logger.warning("CSV not found: %s — starting without %s", path, key)

    graph_mgr.rebuild(dfs["users"], dfs["posts"], dfs["rels"])


# ── Lifespan (replaces on_event("startup")) ───────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Loading initial graph data …")
    _load_initial_data()
    logger.info("Graph ready. Stats: %s", graph_mgr.stats())
    yield
    # teardown (if needed) goes here


app = FastAPI(
    title="CampusRank API",
    version="1.0.0",
    lifespan=lifespan,
)


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class UserIn(BaseModel):
    user_id:        int
    name:           Optional[str]  = None
    department:     Optional[str]  = None
    year:           Optional[int]  = None
    clubs:          Optional[str]  = None
    follower_count: Optional[int]  = 0
    following_count: Optional[int] = 0
    # add more fields as needed; extra fields are forwarded as-is to the graph
    model_config = {"extra": "allow"}


class PostIn(BaseModel):
    post_id:          int
    user_id:          int           # author
    content:          Optional[str] = None
    engagement_score: float         = 0.0
    created_at_ts:    Optional[float] = None   # unix timestamp; None → now
    model_config = {"extra": "allow"}


class RelationshipIn(BaseModel):
    user_i:                   int
    user_j:                   int
    relationship_weight:      float = 1.0
    friendship_score:         float = 0.0
    club_similarity:          float = 0.0
    department_year_similarity: float = 0.0
    interaction_score:        float = 0.0
    profile_visits:           int   = 0
    likes_between_users:      int   = 0
    comments_between_users:   int   = 0
    messages_between_users:   int   = 0


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/feed", summary="Get ranked feed for a user")
def get_feed(
    user_id: int = Query(..., description="Requesting user's ID"),
    limit:   int = Query(20,  ge=1, le=100, description="Max posts to return"),
) -> list[dict]:
    """
    Returns posts ranked by CampusRank score (PageRank + engagement + recency + social).

    Cold-start behaviour
    --------------------
    - No users in graph    → ranked by raw engagement_score
    - No posts             → returns []
    - User not in graph    → ranked by global PageRank (no personalisation)
    """
    try:
        return graph_mgr.get_feed(user_id=user_id, limit=limit)
    except Exception as exc:
        logger.exception("get_feed failed for user_id=%s", user_id)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/users", status_code=201, summary="Add or update a user")
def create_user(user: UserIn) -> dict:
    graph_mgr.add_user(user.model_dump())
    return {"ok": True, "user_id": user.user_id}


@app.delete("/users/{user_id}", summary="Remove a user")
def delete_user(user_id: int) -> dict:
    graph_mgr.remove_user(user_id)
    return {"ok": True, "user_id": user_id}


@app.post("/posts", status_code=201, summary="Add or update a post")
def create_post(post: PostIn) -> dict:
    import time
    data = post.model_dump()
    if data.get("created_at_ts") is None:
        data["created_at_ts"] = time.time()
    graph_mgr.add_post(data)
    return {"ok": True, "post_id": post.post_id}


@app.delete("/posts/{post_id}", summary="Remove a post")
def delete_post(post_id: int) -> dict:
    graph_mgr.remove_post(post_id)
    return {"ok": True, "post_id": post_id}


@app.post("/relationships", status_code=201, summary="Add or update a relationship edge")
def create_relationship(rel: RelationshipIn) -> dict:
    data = rel.model_dump()
    graph_mgr.upsert_relationship(
        user_i = data.pop("user_i"),
        user_j = data.pop("user_j"),
        attrs  = data,
    )
    return {"ok": True}


@app.get("/graph/stats", summary="Graph diagnostics")
def get_stats() -> dict:
    return graph_mgr.stats()
