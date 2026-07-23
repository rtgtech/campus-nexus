from __future__ import annotations

import os
import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET"] = "test-secret-that-is-at-least-32-characters"

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app as backend_app  # noqa: E402
import schema_app as backend_schema  # noqa: E402
from fake_graph import FakeGraph  # noqa: E402
from feed_ranker import _build_graph  # noqa: E402


class FeedRankingTest(unittest.TestCase):
    def setUp(self) -> None:
        backend_app.Base.metadata.drop_all(backend_app.engine)
        backend_app.Base.metadata.create_all(backend_app.engine)
        backend_app._database_initialized = True
        self.graph = FakeGraph()
        self.graph_patcher = self.graph.patch_backend(backend_schema)
        self.graph_patcher.start()
        self.client = backend_app.app.test_client()
        self.user_ids: dict[str, int] = {}
        self.tokens: dict[str, str] = {}

    def tearDown(self) -> None:
        self.graph_patcher.stop()

    def add_user(self, session, label: str) -> backend_app.User:
        user = backend_app.User(
            fullName=f"{label.title()} User",
            username=label,
            email=f"{label}@example.edu",
            dateOfBirth=datetime(2000, 1, 1).date(),
            semester=2,
            department="CS",
            passwordHash="test",
        )
        session.add(user)
        session.flush()
        self.user_ids[label] = user.userId
        return user

    def add_token(self, session, label: str) -> None:
        self.tokens[label] = backend_app.create_auth_token(session.get(backend_app.User, self.user_ids[label]))

    def add_post(self, session, author: str, *, clubId: int | None = None, likes: int = 0) -> backend_app.Post:
        post = backend_app.Post(
            authorId=self.user_ids[author],
            clubId=clubId,
            postType="club_post" if clubId is not None else "normal",
            content=f"{author} update",
            likeCount=likes,
            engagementScore=float(likes),
            createdAt=datetime(2026, 6, 3, 12, 0, 0),
        )
        session.add(post)
        session.flush()
        return post

    def auth(self, label: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.tokens[label]}"}

    def test_feed_uses_neo4j_pagerank_and_social_signals(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "viewer")
            self.add_user(session, "friend")
            self.add_user(session, "other")
            self.add_token(session, "viewer")
            friend_post = self.add_post(session, "friend")
            other_post = self.add_post(session, "other")
            session.commit()

        self.graph.create_friendship(self.user_ids["viewer"], self.user_ids["friend"])
        self.graph.pagerank[f"user:{self.user_ids['friend']}"] = 0.9
        self.graph.pagerank[f"user:{self.user_ids['other']}"] = 0.1
        cards = self.client.get("/api/feed", headers=self.auth("viewer")).get_json()["feedCards"]
        by_id = {card["postId"]: card for card in cards}

        self.assertEqual(cards[0]["postId"], str(friend_post.postId))
        self.assertEqual(by_id[str(friend_post.postId)]["rankingSignals"]["social"], 1.0)
        self.assertEqual(by_id[str(other_post.postId)]["rankingSignals"]["social"], 0.0)

    def test_feed_degrades_without_graph_signals(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "author")
            self.add_post(session, "author")
            session.commit()

        with patch.object(backend_schema, "feed_signals", side_effect=backend_schema.GraphUnavailable("offline")):
            response = self.client.get("/api/feed")

        self.assertEqual(response.status_code, 200)
        signals = response.get_json()["feedCards"][0]["rankingSignals"]
        self.assertEqual(signals["pagerank"], 0.0)
        self.assertEqual(signals["social"], 0.0)

    def test_friendship_mutations_are_immediate_and_idempotent(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "viewer")
            self.add_user(session, "author")
            self.add_token(session, "viewer")
            self.add_post(session, "author")
            session.commit()

        url = f"/api/users/{self.user_ids['author']}/friends"
        self.assertEqual(self.client.post(url, headers=self.auth("viewer")).status_code, 201)
        self.assertEqual(self.client.post(url, headers=self.auth("viewer")).status_code, 200)
        feed = self.client.get("/api/feed", headers=self.auth("viewer")).get_json()["feedCards"]
        self.assertEqual(feed[0]["rankingSignals"]["social"], 1.0)
        self.assertEqual(self.client.delete(url, headers=self.auth("viewer")).status_code, 200)
        self.assertFalse(self.client.get(url, headers=self.auth("viewer")).get_json()["isFriend"])

    def test_friendship_api_returns_503_when_neo4j_is_down(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "viewer")
            self.add_user(session, "author")
            self.add_token(session, "viewer")
            session.commit()

        with patch.object(backend_schema, "graph_create_friendship", side_effect=backend_schema.GraphUnavailable("offline")):
            response = self.client.post(
                f"/api/users/{self.user_ids['author']}/friends",
                headers=self.auth("viewer"),
            )
        self.assertEqual(response.status_code, 503)

    def test_bootstrap_imports_sql_friendships(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "alice")
            self.add_user(session, "bob")
            session.add(
                backend_app.Friendship(
                    requesterId=min(self.user_ids.values()),
                    receiverId=max(self.user_ids.values()),
                    status="accepted",
                )
            )
            session.commit()
            with patch.object(backend_schema, "ensure_graph_constraints"), patch.object(backend_schema, "replace_graph") as replace:
                backend_app.update_neo4j_graph(session, bootstrap=True)

        arguments = replace.call_args.kwargs
        self.assertTrue(arguments["bootstrap"])
        self.assertEqual(len(arguments["bootstrap_friendships"]), 1)
        self.assertEqual(arguments["bootstrap_friendships"][0]["friendshipId"], "1:2")

    def test_periodic_update_reads_friendships_from_neo4j_and_reconciles_club_weight(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "viewer")
            self.add_user(session, "friend")
            club = backend_app.Club(name="Robotics", slug="robotics", status="Open")
            session.add(club)
            session.flush()
            session.add(backend_app.ClubFollower(clubId=club.clubId, userId=self.user_ids["viewer"]))
            session.commit()
            friendship, _ = self.graph.create_friendship(self.user_ids["viewer"], self.user_ids["friend"])
            with patch.object(backend_schema, "stored_friendships", return_value=[friendship]), patch.object(
                backend_schema, "ensure_graph_constraints"
            ), patch.object(backend_schema, "replace_graph") as replace:
                graph = backend_app.update_neo4j_graph(session)

        arguments = replace.call_args.kwargs
        viewer_relation = next(row for row in arguments["relationships"] if row["userId"] == self.user_ids["viewer"])
        self.assertEqual(viewer_relation["weight"], 1.0)
        self.assertTrue(viewer_relation["isFollower"])
        self.assertTrue(graph.has_edge(f"user:{self.user_ids['viewer']}", f"user:{self.user_ids['friend']}"))

    def test_non_friend_topology_waits_for_the_script(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "viewer")
            self.add_token(session, "viewer")
            club = backend_app.Club(name="Robotics", slug="robotics", status="Open")
            session.add(club)
            session.commit()

        self.assertEqual(self.client.post("/api/clubs/robotics/follow", headers=self.auth("viewer")).status_code, 201)
        self.assertNotIn((self.user_ids["viewer"], club.clubId), self.graph.related)

    def test_admin_is_not_added_to_relationship_graph(self) -> None:
        graph = _build_graph(
            users=[{"userId": "admin"}, {"userId": "student"}],
            clubs=[{"id": 1}],
            club_memberships=[(1, "admin"), (1, "student")],
            friendships=[("admin", "student")],
            admin_user_ids={"admin"},
        )
        self.assertNotIn("user:admin", graph)
        self.assertIn("user:student", graph)


if __name__ == "__main__":
    unittest.main()
