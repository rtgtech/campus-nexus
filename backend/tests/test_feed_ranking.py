from __future__ import annotations

import os
import sys
import unittest
from datetime import datetime
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app as backend_app  # noqa: E402
from feed_ranker import _build_graph  # noqa: E402


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
        self.client = backend_app.app.test_client()
        self.user_ids: dict[str, int] = {}
        self.post_ids: dict[str, str] = {}

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
        session.add(backend_app.AuthSession(token=token, user_id=self.user_id(user_id)))

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

        response = self.client.get("/api/feed", headers={"Authorization": "Bearer viewer-token"})

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

        response = self.client.get("/api/feed", headers={"Authorization": "Bearer viewer-token"})

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

    def test_outgoing_follow_boosts_social_signal(self) -> None:
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

        response = self.client.get("/api/feed", headers={"Authorization": "Bearer viewer-token"})

        self.assertEqual(response.status_code, 200)
        feed_cards = response.get_json()["feedCards"]
        by_id = {post["post_id"]: post for post in feed_cards}
        self.assertGreater(
            by_id[self.post_id("post_followed")]["rankingSignals"]["social"],
            by_id[self.post_id("post_unrelated")]["rankingSignals"]["social"],
        )


if __name__ == "__main__":
    unittest.main()
