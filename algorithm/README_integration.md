# CampusRank – Integration Guide

## Files

| File | Purpose |
|------|---------|
| `build_graph.py` | Original pipeline script (CSV → .gpickle) |
| `graph_manager.py` | Production wrapper – thread-safe, cold-start-safe |
| `app.py` | FastAPI server with all endpoints |

---

## 1. Install dependencies

```bash
pip install fastapi uvicorn networkx numpy pandas
```

---

## 2. Run the server

```bash
uvicorn app:app --reload
```

On startup the server will:
1. Try to load CSVs (`sample_users.csv`, `sample_posts.csv`, `sample_relationships.csv`)
2. If CSVs are missing → start with an **empty graph** (cold start, works fine)
3. Serve `GET /feed` immediately

Override CSV paths via env vars:
```bash
USERS_CSV=data/users.csv POSTS_CSV=data/posts.csv uvicorn app:app --reload
```

---

## 3. Endpoints

### `GET /feed?user_id=42&limit=20`
Returns ranked posts for user 42.

```json
[
  {
    "post_id": 7,
    "user_id": 3,
    "engagement_score": 91.4,
    "content": "...",
    "feed_score": 0.712341
  },
  ...
]
```

**Cold-start behaviour (no crash, graceful degradation):**

| State | Feed behaviour |
|-------|---------------|
| No users, no edges | Posts sorted by raw `engagement_score` |
| No posts | Returns `[]` |
| User not in graph | Uses global PageRank (no personalisation) |
| Single user | Returns posts ranked by engagement + recency |

---

### `POST /users`
Add a user (call this when a new user signs up):
```json
{ "user_id": 1, "name": "Alice", "department": "CS", "year": 2 }
```

### `POST /posts`
Add a post (call this when a user creates a post):
```json
{ "post_id": 101, "user_id": 1, "engagement_score": 0, "created_at_ts": 1718000000 }
```

### `POST /relationships`
Add/update an edge (call when users follow each other, interact, etc.):
```json
{
  "user_i": 1, "user_j": 2,
  "relationship_weight": 0.8,
  "friendship_score": 0.6,
  "interaction_score": 0.7,
  ...
}
```

### `DELETE /users/{user_id}` / `DELETE /posts/{post_id}`
Remove a user or post.

### `GET /graph/stats`
```json
{ "nodes": 120, "edges": 430, "posts": 88, "avg_degree": 7.16, "density": 0.06 }
```

---

## 4. Swap in your real database

In `app.py`, replace the CSV block in `_load_initial_data()`:

```python
def _load_initial_data():
    import sqlalchemy as sa
    engine = sa.create_engine(os.getenv("DATABASE_URL"))

    users_df = pd.read_sql("SELECT * FROM users", engine)
    posts_df = pd.read_sql("SELECT * FROM posts", engine)
    rels_df  = pd.read_sql("SELECT * FROM relationships", engine)

    graph_mgr.rebuild(users_df, posts_df, rels_df)
```

Then call `graph_mgr.add_user()`, `graph_mgr.add_post()`, `graph_mgr.upsert_relationship()`
from your existing DB write paths so the in-memory graph stays in sync.

---

## 5. Feed scoring formula

```
feed_score = 0.40 × pagerank(author)
           + 0.30 × normalised_engagement
           + 0.20 × recency_decay          # half-life = 24 h
           + 0.10 × social_proximity       # edge weight to author
```

Tune the four `W_*` constants at the top of `graph_manager.py`.

---

## 6. Keeping the graph in sync (recommended pattern)

```
User signs up    → POST /users
User creates post → POST /posts  (engagement_score = 0 initially)
User gets a like  → POST /posts  (with updated engagement_score)
Users follow each other → POST /relationships
```

PageRank is **cached** and only recomputed when the graph changes (edges/nodes added/removed).
Post scores are recomputed on every `/feed` call (cheap, O(posts)).
