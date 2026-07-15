from __future__ import annotations

import os
import sys
import tempfile
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
from feed_ranker import _build_graph, load_feed_graph, reset_feed_graph_cache  # noqa: E402


class FeedRankingTest(unittest.TestCase):
    def setUp(self) -> None:
        if backend_app.engine.dialect.name != "sqlite":
            raise AssertionError("feed ranking tests must run against sqlite")

        backend_app.Base.metadata.drop_all(backend_app.engine)
        backend_app.Base.metadata.create_all(backend_app.engine)
        backend_app.ensure_app_schema()
        backend_app.ensure_app_indexes()

        with backend_app.SessionLocal() as session:
            backend_app.seed_admin_user(session)
            session.commit()

        backend_app._database_initialized = True
        self.graph_directory = tempfile.TemporaryDirectory()
        os.environ["FEED_GRAPH_PATH"] = str(Path(self.graph_directory.name) / "feed_graph.gpickle")
        reset_feed_graph_cache()
        self.client = backend_app.app.test_client()
        self.user_ids: dict[str, int] = {}
        self.post_ids: dict[str, str] = {}
        self.tokens: dict[str, str] = {}

    def tearDown(self) -> None:
        reset_feed_graph_cache()
        os.environ.pop("FEED_GRAPH_PATH", None)
        self.graph_directory.cleanup()

    def user_id(self, label: str) -> int:
        return self.user_ids[label]

    def post_id(self, label: str) -> str:
        return self.post_ids[label]

    def add_user(self, session, user_id: str, username: str, name: str) -> backend_app.User:
        user = backend_app.User(
            full_name=name,
            username=username,
            email=f"{username}@example.edu",
            date_of_birth=datetime(2000, 1, 1).date(),
            semester=2,
            department="CS",
            password_hash="test",
        )
        session.add(user)
        session.flush()
        self.user_ids[user_id] = user.user_id
        return user

    def add_club(self, session, club_id: int, slug: str, title: str) -> backend_app.ClubCard:
        club = backend_app.ClubCard(
            club_id=club_id,
            name=title,
            slug=slug,
            description=f"{title} club",
            status="Open",
            logo_url="",
            created_by_service="admin",
        )
        session.add(club)
        return club

    def add_member(self, session, club_id: int, user_id: str) -> None:
        session.add(backend_app.ClubMember(club_id=club_id, user_id=self.user_id(user_id), role="member"))

    def add_post(
        self,
        session,
        post_id: str,
        author_id: str,
        caption: str,
        *,
        club_id: int | None = None,
        post_type: int = 0,
        likes: int = 0,
        shares: int = 0,
    ) -> None:
        post = backend_app.Post(
            author_id=self.user_id(author_id),
            club_id=club_id,
            post_type="club_post" if post_type == 1 else "normal",
            media_url="",
            content=caption,
            like_count=likes,
            share_count=shares,
            engagement_score=likes + shares * 2,
            created_at=datetime(2026, 6, 3, 12, 0, 0),
        )
        session.add(post)
        session.flush()
        self.post_ids[post_id] = str(post.post_id)

    def add_token(self, session, token: str, user_id: str) -> None:
        self.tokens[token] = backend_app.create_auth_token(session.get(backend_app.User, self.user_id(user_id)))

    def test_feed_contains_ranked_user_and_club_posts(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "user_viewer", "viewer", "Viewer User")
            self.add_user(session, "user_friend", "friend", "Friend User")
            self.add_user(session, "user_member", "member", "Member User")
            self.add_club(session, 1, "robotics", "Robotics")
            self.add_member(session, 1, "user_viewer")
            self.add_member(session, 1, "user_member")
            self.add_token(session, "viewer-token", "user_viewer")
            self.add_post(session, "post_user", "user_friend", "User post", likes=2)
            self.add_post(session, "post_club", "user_member", "Club post", club_id=1, post_type=1, likes=2)
            session.commit()

        response = self.client.get("/api/feed", headers={"Authorization": f"Bearer {self.tokens['viewer-token']}"})

        self.assertEqual(response.status_code, 200)
        feed_cards = response.get_json()["feedCards"]
        self.assertEqual({post["post_id"] for post in feed_cards}, {self.post_id("post_user"), self.post_id("post_club")})
        self.assertGreaterEqual(feed_cards[0]["feedScore"], feed_cards[1]["feedScore"])
        self.assertEqual(set(feed_cards[0]["rankingSignals"]), {"pagerank", "engagement", "recency", "social"})

    def test_member_club_post_ranks_above_unrelated_club_post(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "user_viewer", "viewer", "Viewer User")
            self.add_user(session, "user_robotics", "robotics_member", "Robotics Member")
            self.add_user(session, "user_arts", "arts_member", "Arts Member")
            self.add_club(session, 1, "robotics", "Robotics")
            self.add_club(session, 2, "arts", "Arts")
            self.add_member(session, 1, "user_viewer")
            self.add_member(session, 1, "user_robotics")
            self.add_member(session, 2, "user_arts")
            self.add_token(session, "viewer-token", "user_viewer")
            self.add_post(session, "post_robotics", "user_robotics", "Robotics update", club_id=1, post_type=1)
            self.add_post(session, "post_arts", "user_arts", "Arts update", club_id=2, post_type=1)
            session.commit()

        response = self.client.get("/api/feed", headers={"Authorization": f"Bearer {self.tokens['viewer-token']}"})

        self.assertEqual(response.status_code, 200)
        feed_cards = response.get_json()["feedCards"]
        self.assertEqual(feed_cards[0]["post_id"], self.post_id("post_robotics"))

    def test_new_users_and_new_clubs_get_default_club_relationships(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "user_author", "author", "Author User")
            self.add_club(session, 1, "robotics", "Robotics")
            self.add_post(session, "post_robotics", "user_author", "Robotics update", club_id=1, post_type=1)
            session.commit()

        self.assertEqual(
            self.client.get("/api/feed?user_id=user_new").get_json()["feedCards"][0]["post_id"],
            self.post_id("post_robotics"),
        )

        with backend_app.SessionLocal() as session:
            self.add_user(session, "user_new", "new_user", "New User")
            self.add_club(session, 2, "new-club", "New Club")
            self.add_post(session, "post_new_club", "user_author", "New club update", club_id=2, post_type=1)
            session.commit()

        response = self.client.get(f"/api/feed?user_id={self.user_id('user_new')}")

        self.assertEqual(response.status_code, 200)
        post_ids = {post["post_id"] for post in response.get_json()["feedCards"]}
        self.assertEqual(post_ids, {self.post_id("post_robotics"), self.post_id("post_new_club")})

    def test_empty_posts_return_empty_feed(self) -> None:
        response = self.client.get("/api/feed")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["feedCards"], [])

    def test_admin_is_not_added_to_relationship_graph(self) -> None:
        graph = _build_graph(
            users=[{"user_id": "admin_user"}, {"user_id": "student_user"}],
            clubs=[{"id": 1}],
            club_memberships=[(1, "admin_user"), (1, "student_user")],
            friendships=[("admin_user", "student_user"), ("student_user", "admin_user")],
            admin_user_ids={"admin_user"},
        )

        self.assertNotIn("user:admin_user", graph.nodes)
        self.assertIn("user:student_user", graph.nodes)
        self.assertFalse(any("admin_user" in node for edge in graph.edges for node in edge))

    def test_friendship_boosts_social_signal(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "user_viewer", "viewer", "Viewer User")
            self.add_user(session, "user_followed", "followed", "Followed User")
            self.add_user(session, "user_unrelated", "unrelated", "Unrelated User")
            self.add_token(session, "viewer-token", "user_viewer")
            session.add(
                backend_app.UserFriendship(
                    requester_id=self.user_id("user_viewer"),
                    receiver_id=self.user_id("user_followed"),
                    status="accepted",
                )
            )
            self.add_post(session, "post_followed", "user_followed", "Followed post")
            self.add_post(session, "post_unrelated", "user_unrelated", "Unrelated post")
            session.commit()

        response = self.client.get("/api/feed", headers={"Authorization": f"Bearer {self.tokens['viewer-token']}"})

        self.assertEqual(response.status_code, 200)
        feed_cards = response.get_json()["feedCards"]
        by_id = {post["post_id"]: post for post in feed_cards}
        self.assertGreater(
            by_id[self.post_id("post_followed")]["rankingSignals"]["social"],
            by_id[self.post_id("post_unrelated")]["rankingSignals"]["social"],
        )

    def test_repeated_feed_requests_reuse_persisted_graph(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "user_author", "author", "Author User")
            self.add_post(session, "post_author", "user_author", "Author post")
            session.commit()

        self.assertEqual(self.client.get("/api/feed").status_code, 200)
        with patch("schema_app.build_database_feed_graph", side_effect=AssertionError("graph rebuilt")):
            self.assertEqual(self.client.get("/api/feed").status_code, 200)

    def test_friendship_mutations_refresh_persisted_graph_and_feed(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "user_viewer", "viewer", "Viewer User")
            self.add_user(session, "user_author", "author", "Author User")
            self.add_token(session, "viewer-token", "user_viewer")
            self.add_token(session, "author-token", "user_author")
            self.add_post(session, "post_author", "user_author", "Author post")
            session.commit()

        self.assertEqual(self.client.get("/api/feed").status_code, 200)
        response = self.client.post(
            f"/api/users/{self.user_id('user_author')}/friends",
            headers={"Authorization": f"Bearer {self.tokens['viewer-token']}"},
        )

        self.assertEqual(response.status_code, 201)
        graph = load_feed_graph()
        viewer_node = f"user:{self.user_id('user_viewer')}"
        author_node = f"user:{self.user_id('user_author')}"
        self.assertEqual(graph[viewer_node][author_node]["weight"], 1.0)
        feed_post = self.client.get(
            "/api/feed", headers={"Authorization": f"Bearer {self.tokens['viewer-token']}"}
        ).get_json()["feedCards"][0]
        self.assertEqual(feed_post["rankingSignals"]["social"], 1.0)

        response = self.client.post(
            f"/api/users/{self.user_id('user_viewer')}/friends",
            headers={"Authorization": f"Bearer {self.tokens['author-token']}"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(load_feed_graph()[viewer_node][author_node]["weight"], 1.0)

    def test_club_follow_and_membership_refresh_the_same_edge(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "user_viewer", "viewer", "Viewer User")
            self.add_user(session, "user_president", "president", "President User")
            self.add_club(session, 1, "robotics", "Robotics")
            president = backend_app.ClubMember(
                club_id=1,
                user_id=self.user_id("user_president"),
                role="president",
                status="active",
            )
            session.add(president)
            self.add_token(session, "viewer-token", "user_viewer")
            self.add_token(session, "president-token", "user_president")
            session.commit()

        self.assertEqual(self.client.get("/api/feed").status_code, 200)
        edge = (f"user:{self.user_id('user_viewer')}", "club:1")
        self.assertEqual(load_feed_graph()[edge[0]][edge[1]]["weight"], 0.05)

        response = self.client.post(
            "/api/clubs/robotics/follow",
            headers={"Authorization": f"Bearer {self.tokens['viewer-token']}"},
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(load_feed_graph()[edge[0]][edge[1]]["weight"], 1.0)

        response = self.client.post(
            "/api/clubs/robotics/members",
            json={"user_id": self.user_id("user_viewer"), "role": "member"},
            headers={"Authorization": f"Bearer {self.tokens['president-token']}"},
        )
        self.assertEqual(response.status_code, 201)
        member_id = response.get_json()["id"]
        self.client.delete(
            "/api/clubs/robotics/follow",
            headers={"Authorization": f"Bearer {self.tokens['viewer-token']}"},
        )
        self.assertEqual(load_feed_graph()[edge[0]][edge[1]]["weight"], 1.0)

        response = self.client.delete(
            f"/api/clubs/robotics/members/{member_id}",
            headers={"Authorization": f"Bearer {self.tokens['president-token']}"},
        )
        self.assertEqual(response.status_code, 204)
        self.assertEqual(load_feed_graph()[edge[0]][edge[1]]["weight"], 0.05)

    def test_rebuild_repairs_stale_or_corrupt_graph(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "user_viewer", "viewer", "Viewer User")
            self.add_club(session, 1, "robotics", "Robotics")
            session.commit()

        self.assertEqual(self.client.get("/api/feed").status_code, 200)
        with backend_app.SessionLocal() as session:
            session.add(backend_app.ClubFollower(club_id=1, user_id=self.user_id("user_viewer")))
            session.commit()
            backend_app.rebuild_persisted_feed_graph(session)
        edge = (f"user:{self.user_id('user_viewer')}", "club:1")
        self.assertEqual(load_feed_graph()[edge[0]][edge[1]]["weight"], 1.0)

        Path(os.environ["FEED_GRAPH_PATH"]).write_bytes(b"not a pickle")
        reset_feed_graph_cache()
        self.assertEqual(self.client.get("/api/feed").status_code, 200)
        self.assertEqual(load_feed_graph()[edge[0]][edge[1]]["weight"], 1.0)

    def test_graph_staging_failure_rolls_back_relationship(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "user_viewer", "viewer", "Viewer User")
            self.add_user(session, "user_author", "author", "Author User")
            self.add_token(session, "viewer-token", "user_viewer")
            session.commit()

        with patch("schema_app.stage_feed_graph", side_effect=OSError("disk unavailable")):
            with self.assertRaises(OSError):
                self.client.post(
                    f"/api/users/{self.user_id('user_author')}/friends",
                    headers={"Authorization": f"Bearer {self.tokens['viewer-token']}"},
                )
        with backend_app.SessionLocal() as session:
            self.assertIsNone(
                session.scalar(
                    backend_app.select(backend_app.Friendship).where(
                        backend_app.Friendship.requester_id == self.user_id("user_viewer")
                    )
                )
            )


if __name__ == "__main__":
    unittest.main()
