"""Repeatable local benchmark: in-memory SQLite, synthetic graph, no live data."""
import json
import logging
import os
import statistics
import sys
import time
from datetime import date, timedelta
from pathlib import Path

os.environ.update(DATABASE_URL="sqlite:///:memory:", JWT_SECRET="benchmark-secret-at-least-32-characters-long",
                  NEO4J_URI="", PYTHON_DOTENV_DISABLED="1", FEED_RANKER="v2", FEED_V2_PERCENT="100")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import schema_app as s
from fake_graph import FakeGraph
from sqlalchemy import insert

s.Base.metadata.create_all(s.engine)
s._database_initialized = True
s.app.logger.setLevel(logging.WARNING)
now = s.utcnow()
with s.SessionLocal() as db:
    users = [s.User(fullName=f"Fixture {i}", username=f"fixture-{i}", email=f"fixture-{i}@example.edu",
                    dateOfBirth=date(2000, 1, 1), semester=2, department="CS", passwordHash="unused") for i in range(4)]
    db.add_all(users)
    db.flush()
    viewer = users[0].userId
    token = s.create_auth_token(users[0])
    db.execute(insert(s.Post), [dict(authorId=users[1 + i % 3].userId, content=f"Synthetic campus post {i}",
        createdAt=now - timedelta(hours=(48 if i % 3 == 0 else 24 if i % 3 == 1 else 0) + i / 10000)) for i in range(10000)])
    db.add(s.FeedAffinity(userId=viewer, target=f"author:{users[2].userId}", day=now.date().isoformat(), weight=10))
    db.commit()
graph = FakeGraph()
graph.create_friendship(viewer, users[1].userId)
durations = []
with graph.patch_backend(s):
    client = s.app.test_client()
    for index in range(22):
        start = time.perf_counter()
        response = client.get("/api/feed?limit=20", headers={"Authorization": "Bearer " + token})
        elapsed = (time.perf_counter() - start) * 1000
        assert response.status_code == 200, response.get_json()
        with s.SessionLocal() as db:
            snapshot = db.get(s.FeedSnapshot, response.get_json()["snapshotId"])
            assert len(json.loads(snapshot.records)) == 600
        if index >= 2:
            durations.append(elapsed)
p95 = sorted(durations)[18]
print(json.dumps({"posts": 10000, "candidates": 600, "samples": len(durations),
                  "medianMs": round(statistics.median(durations), 2), "p95Ms": round(p95, 2),
                  "targetMs": 500, "passed": p95 < 500, "graph": "in-process FakeGraph", "sqlite": "in-memory"}, indent=2))
sys.exit(0 if p95 < 500 else 1)
