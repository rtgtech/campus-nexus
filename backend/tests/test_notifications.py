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


class NotificationsTest(unittest.TestCase):
    def setUp(self) -> None:
        if backend_app.engine.dialect.name != "sqlite":
            raise AssertionError("notification tests must run against sqlite")

        backend_app.Base.metadata.drop_all(backend_app.engine)
        backend_app.Base.metadata.create_all(backend_app.engine)
        backend_app.ensure_app_schema()
        backend_app.ensure_app_indexes()
        backend_app._database_initialized = True
        self.client = backend_app.app.test_client()
        self.user_ids: dict[str, int] = {}

    def add_user(self, session, label: str, username: str, name: str) -> backend_app.User:
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
        self.user_ids[label] = user.user_id
        return user

    def add_token(self, session, token: str, label: str) -> None:
        session.add(backend_app.AuthSession(token=token, user_id=self.user_ids[label]))

    def auth(self, token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {token}"}

    def notifications(self, token: str) -> dict:
        response = self.client.get("/api/notifications", headers=self.auth(token))
        self.assertEqual(response.status_code, 200)
        return response.get_json()

    def create_post(self, token: str, caption: str = "Campus update", extra: dict | None = None) -> dict:
        payload = {"type": 0, "caption": caption, **(extra or {})}
        response = self.client.post("/api/posts", json=payload, headers=self.auth(token))
        self.assertEqual(response.status_code, 201, response.get_data(as_text=True))
        return response.get_json()

    def test_auth_required_for_notifications_and_comments(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "owner", "owner", "Owner User")
            session.add(backend_app.Post(author_id=self.user_ids["owner"], content="Post"))
            session.commit()
            post_id = session.scalar(backend_app.select(backend_app.Post.post_id))

        self.assertEqual(self.client.get("/api/notifications").status_code, 401)
        self.assertEqual(self.client.delete("/api/notifications/1").status_code, 401)
        self.assertEqual(self.client.post(f"/api/posts/{post_id}/comments", json={"content": "Hi"}).status_code, 401)

    def test_follow_creates_friend_request_notification(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "actor", "actor", "Actor User")
            self.add_user(session, "target", "target", "Target User")
            self.add_token(session, "actor-token", "actor")
            self.add_token(session, "target-token", "target")
            session.commit()

        response = self.client.post(f"/api/users/{self.user_ids['target']}/friends", headers=self.auth("actor-token"))

        self.assertEqual(response.status_code, 201)
        payload = self.notifications("target-token")
        self.assertEqual(payload["total"], 1)
        self.assertEqual(payload["unreadCount"], 1)
        self.assertEqual(payload["items"][0]["type"], "friend_request")
        self.assertEqual(payload["items"][0]["actionLabel"], "View profile")

    def test_normal_post_notifies_followers_not_author(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "author", "author", "Author User")
            self.add_user(session, "follower", "follower", "Follower User")
            self.add_token(session, "author-token", "author")
            self.add_token(session, "follower-token", "follower")
            session.add(
                backend_app.Friendship(
                    requester_id=self.user_ids["follower"],
                    receiver_id=self.user_ids["author"],
                    status="accepted",
                )
            )
            session.commit()

        self.create_post("author-token")

        follower_payload = self.notifications("follower-token")
        author_payload = self.notifications("author-token")
        self.assertEqual([item["type"] for item in follower_payload["items"]], ["friend_post"])
        self.assertEqual(author_payload["total"], 0)

    def test_club_post_notifies_deduped_club_audience_not_author(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "author", "author", "Author User")
            self.add_user(session, "member", "member", "Member User")
            self.add_user(session, "follower", "follower", "Follower User")
            self.add_token(session, "author-token", "author")
            self.add_token(session, "member-token", "member")
            self.add_token(session, "follower-token", "follower")
            club = backend_app.Club(name="Robotics", slug="robotics", description="", status="Open")
            session.add(club)
            session.flush()
            session.add_all(
                [
                    backend_app.ClubMember(club_id=club.club_id, user_id=self.user_ids["author"], status="active"),
                    backend_app.ClubMember(club_id=club.club_id, user_id=self.user_ids["member"], status="active"),
                    backend_app.ClubFollower(club_id=club.club_id, user_id=self.user_ids["member"]),
                    backend_app.ClubFollower(club_id=club.club_id, user_id=self.user_ids["follower"]),
                ]
            )
            session.commit()
            club_id = club.club_id

        self.create_post("author-token", "Robotics update", {"type": 1, "club_id": club_id})

        self.assertEqual([item["type"] for item in self.notifications("member-token")["items"]], ["club_post"])
        self.assertEqual([item["type"] for item in self.notifications("follower-token")["items"]], ["club_post"])
        self.assertEqual(self.notifications("author-token")["total"], 0)

    def test_like_creates_one_notification_excluding_self_likes(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "owner", "owner", "Owner User")
            self.add_user(session, "actor", "actor", "Actor User")
            self.add_token(session, "owner-token", "owner")
            self.add_token(session, "actor-token", "actor")
            session.commit()

        post = self.create_post("owner-token")
        post_id = post["post_id"]

        self.assertEqual(self.client.post(f"/api/posts/{post_id}/like", headers=self.auth("actor-token")).status_code, 201)
        self.assertEqual(self.client.post(f"/api/posts/{post_id}/like", headers=self.auth("actor-token")).status_code, 200)
        self.assertEqual(self.client.post(f"/api/posts/{post_id}/like", headers=self.auth("owner-token")).status_code, 201)

        payload = self.notifications("owner-token")
        self.assertEqual([item["type"] for item in payload["items"]], ["post_like"])

    def test_comment_creates_notification_and_increments_count(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "owner", "owner", "Owner User")
            self.add_user(session, "actor", "actor", "Actor User")
            self.add_token(session, "owner-token", "owner")
            self.add_token(session, "actor-token", "actor")
            session.commit()

        post = self.create_post("owner-token")
        post_id = post["post_id"]

        response = self.client.post(
            f"/api/posts/{post_id}/comments",
            json={"content": "Nice post"},
            headers=self.auth("actor-token"),
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["comments"], 1)
        self.assertEqual(self.client.get(f"/api/posts/{post_id}/comments").get_json()["total"], 1)
        self.assertEqual([item["type"] for item in self.notifications("owner-token")["items"]], ["post_comment"])

    def test_delete_notification_only_works_for_owner(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "owner", "owner", "Owner User")
            self.add_user(session, "actor", "actor", "Actor User")
            self.add_user(session, "other", "other", "Other User")
            self.add_token(session, "owner-token", "owner")
            self.add_token(session, "actor-token", "actor")
            self.add_token(session, "other-token", "other")
            session.commit()

        post = self.create_post("owner-token")
        self.client.post(f"/api/posts/{post['post_id']}/like", headers=self.auth("actor-token"))
        notification_id = self.notifications("owner-token")["items"][0]["id"]

        self.assertEqual(
            self.client.delete(f"/api/notifications/{notification_id}", headers=self.auth("other-token")).status_code,
            404,
        )
        self.assertEqual(
            self.client.delete(f"/api/notifications/{notification_id}", headers=self.auth("owner-token")).status_code,
            204,
        )
        self.assertEqual(self.notifications("owner-token")["total"], 0)


if __name__ == "__main__":
    unittest.main()
