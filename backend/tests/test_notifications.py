from __future__ import annotations

import os
import sys
import unittest
from datetime import datetime
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET"] = "test-secret-that-is-at-least-32-characters"

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app as backend_app  # noqa: E402
import schema_app as backend_schema  # noqa: E402
from fake_graph import FakeGraph  # noqa: E402


class NotificationsTest(unittest.TestCase):
    def setUp(self) -> None:
        if backend_app.engine.dialect.name != "sqlite":
            raise AssertionError("notification tests must run against sqlite")

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

    def add_user(self, session, label: str, username: str, name: str) -> backend_app.User:
        user = backend_app.User(
            fullName=name,
            username=username,
            email=f"{username}@example.edu",
            dateOfBirth=datetime(2000, 1, 1).date(),
            semester=2,
            department="CS",
            passwordHash="test",
        )
        session.add(user)
        session.flush()
        self.user_ids[label] = user.userId
        return user

    def add_token(self, session, token: str, label: str) -> None:
        self.tokens[token] = backend_app.create_auth_token(session.get(backend_app.User, self.user_ids[label]))

    def auth(self, token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.tokens.get(token, token)}"}

    def notifications(self, token: str) -> dict:
        response = self.client.get("/api/notifications", headers=self.auth(token))
        self.assertEqual(response.status_code, 200)
        return response.get_json()

    def create_post(self, token: str, caption: str = "Campus update", extra: dict | None = None) -> dict:
        payload = {"type": 0, "caption": caption, **(extra or {})}
        response = self.client.post("/api/posts", json=payload, headers=self.auth(token))
        self.assertEqual(response.status_code, 201, response.get_data(as_text=True))
        post = response.get_json()
        self.assertTrue(post["createdAt"].endswith("+00:00"))
        return post

    def test_auth_required_for_notifications_and_comments(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "owner", "owner", "Owner User")
            session.add(backend_app.Post(authorId=self.user_ids["owner"], content="Post"))
            session.commit()
            postId = session.scalar(backend_app.select(backend_app.Post.postId))

        self.assertEqual(self.client.get("/api/notifications").status_code, 401)
        self.assertEqual(self.client.delete("/api/notifications/1").status_code, 401)
        self.assertEqual(self.client.post(f"/api/posts/{postId}/comments", json={"content": "Hi"}).status_code, 401)

    def test_notifications_return_utc_timestamps_and_cors_headers(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "owner", "owner", "Owner User")
            self.add_user(session, "actor", "actor", "Actor User")
            self.add_token(session, "owner-token", "owner")
            session.add(
                backend_app.Notification(
                    userId=self.user_ids["owner"],
                    actorId=self.user_ids["actor"],
                    type="friend_accept",
                    targetType="user",
                    targetId=str(self.user_ids["actor"]),
                    message="You are now connected.",
                    createdAt=datetime(2026, 8, 11, 8, 0, 0),
                )
            )
            session.commit()

        headers = {**self.auth("owner-token"), "Origin": backend_app.CORS_ORIGIN}
        response = self.client.get("/api/notifications", headers=headers)

        self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
        self.assertEqual(response.headers["Access-Control-Allow-Origin"], backend_app.CORS_ORIGIN)
        self.assertEqual(response.headers["Access-Control-Allow-Credentials"], "true")
        self.assertEqual(response.get_json()["items"][0]["createdAt"], "2026-08-11T08:00:00+00:00")

        preflight = self.client.options(
            "/api/notifications",
            headers={"Origin": backend_app.CORS_ORIGIN, "Access-Control-Request-Method": "GET"},
        )
        self.assertEqual(preflight.status_code, 204)
        self.assertEqual(preflight.headers["Access-Control-Allow-Origin"], backend_app.CORS_ORIGIN)

    def test_adding_friend_creates_notification(self) -> None:
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
        self.assertEqual(payload["items"][0]["type"], "friend_accept")
        self.assertEqual(payload["items"][0]["actionLabel"], "View profile")

    def test_friendship_is_bidirectional_and_lists_mutuals(self) -> None:
        with backend_app.SessionLocal() as session:
            for label in ("alice", "bob", "mutual"):
                self.add_user(session, label, label, f"{label.title()} User")
                self.add_token(session, f"{label}-token", label)
            session.commit()

        self.client.post(f"/api/users/{self.user_ids['bob']}/friends", headers=self.auth("alice-token"))
        self.client.post(f"/api/users/{self.user_ids['mutual']}/friends", headers=self.auth("alice-token"))
        self.client.post(f"/api/users/{self.user_ids['mutual']}/friends", headers=self.auth("bob-token"))

        bob_view = self.client.get(
            f"/api/users/{self.user_ids['alice']}/friends?includeLists=true",
            headers=self.auth("bob-token"),
        ).get_json()
        self.assertTrue(bob_view["isFriend"])
        self.assertEqual(bob_view["friends"], 2)
        self.assertEqual({user["username"] for user in bob_view["mutualsList"]}, {"mutual"})

        self_view = self.client.get(
            f"/api/users/{self.user_ids['alice']}/friends?includeLists=true",
            headers=self.auth("alice-token"),
        ).get_json()
        self.assertTrue(self_view["isSelf"])
        self.assertEqual(len(self_view["friendsList"]), 2)

        response = self.client.delete(f"/api/users/{self.user_ids['alice']}/friends", headers=self.auth("bob-token"))
        self.assertFalse(response.get_json()["isFriend"])

    def test_normal_post_notifies_friends_not_author(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "author", "author", "Author User")
            self.add_user(session, "friend", "friend", "Friend User")
            self.add_token(session, "author-token", "author")
            self.add_token(session, "friend-token", "friend")
            session.commit()
        self.graph.create_friendship(self.user_ids["friend"], self.user_ids["author"])

        self.create_post("author-token")

        friend_payload = self.notifications("friend-token")
        author_payload = self.notifications("author-token")
        self.assertEqual([item["type"] for item in friend_payload["items"]], ["friend_post"])
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
                    backend_app.ClubMember(clubId=club.clubId, userId=self.user_ids["author"], role="president", status="active"),
                    backend_app.ClubMember(clubId=club.clubId, userId=self.user_ids["member"], status="active"),
                    backend_app.ClubFollower(clubId=club.clubId, userId=self.user_ids["member"]),
                    backend_app.ClubFollower(clubId=club.clubId, userId=self.user_ids["follower"]),
                ]
            )
            session.commit()
            clubId = club.clubId

        self.create_post("author-token", "Robotics update", {"type": 1, "clubId": clubId})

        self.assertEqual([item["type"] for item in self.notifications("member-token")["items"]], ["club_post"])
        self.assertEqual([item["type"] for item in self.notifications("follower-token")["items"]], ["club_post"])
        self.assertEqual(self.notifications("author-token")["total"], 0)

    def test_admin_can_grant_a_member_posting_privilege(self) -> None:
        with backend_app.SessionLocal() as session:
            for role in ("president", "chairman", "secretary", "member"):
                self.add_user(session, role, role, role.title())
                self.add_token(session, f"{role}-token", role)
            club = backend_app.Club(name="Robotics", slug="robotics", description="", status="Open")
            session.add(club)
            session.flush()
            members = []
            for role in ("president", "chairman", "secretary", "member"):
                member = backend_app.ClubMember(clubId=club.clubId, userId=self.user_ids[role], role=role, status="active")
                session.add(member)
                members.append(member)
            session.flush()
            member_id = members[-1].clubMemberId
            session.commit()

        created_posts = []
        for role, postType, mediaUrls in (
            ("president", 1, ["data:image/png;base64,cGhvdG8=", "data:video/mp4;base64,dmlkZW8="]),
            ("chairman", 3, ["data:image/png;base64,cG9zdGVy"]),
            ("secretary", 1, []),
        ):
            payload = {
                "type": postType,
                "clubSlug": "robotics",
                "caption": f"{role} update",
                "mediaUrls": mediaUrls,
            }
            if postType == 3:
                payload["registrationLink"] = "https://register.events.example.edu/robotics"
            response = self.client.post(
                "/api/posts",
                json=payload,
                headers=self.auth(f"{role}-token"),
            )
            self.assertEqual(response.status_code, 201, response.get_data(as_text=True))
            created_posts.append(response.get_json())

        self.assertEqual(created_posts[0]["mediaUrls"], ["data:image/png;base64,cGhvdG8=", "data:video/mp4;base64,dmlkZW8="])
        self.assertEqual(created_posts[1]["registrationLink"], "https://register.events.example.edu/robotics")

        invalid_announcement = self.client.post(
            "/api/posts",
            json={
                "type": 3,
                "clubSlug": "robotics",
                "caption": "Too many posters",
                "mediaUrls": ["one.jpg", "two.jpg"],
                "registrationLink": "https://register.events.example.edu/robotics",
            },
            headers=self.auth("president-token"),
        )
        self.assertEqual(invalid_announcement.status_code, 400)

        missing_link_response = self.client.post(
            "/api/posts",
            json={
                "type": 3,
                "clubSlug": "robotics",
                "caption": "Missing registration link",
                "mediaUrls": ["poster.jpg"],
            },
            headers=self.auth("president-token"),
        )
        self.assertEqual(missing_link_response.status_code, 400)

        for invalid_link in (
            "register.events.example.edu/robotics",
            "https:/register.events.example.edu/robotics",
            "https://registration",
            "https://-register.example.edu/robotics",
        ):
            invalid_link_response = self.client.post(
                "/api/posts",
                json={
                    "type": 3,
                    "clubSlug": "robotics",
                    "caption": "Invalid registration link",
                    "mediaUrls": ["poster.jpg"],
                    "registrationLink": invalid_link,
                },
                headers=self.auth("president-token"),
            )
            self.assertEqual(invalid_link_response.status_code, 400, invalid_link)

        denied = self.client.post(
            "/api/posts",
            json={"type": 1, "clubSlug": "robotics", "caption": "member update"},
            headers=self.auth("member-token"),
        )
        self.assertEqual(denied.status_code, 403)

        admin_token = backend_app.create_auth_token(backend_app.AdminIdentity())
        granted = self.client.patch(
            f"/api/clubs/robotics/members/{member_id}",
            json={"canPost": True},
            headers=self.auth(admin_token),
        )
        self.assertEqual(granted.status_code, 200)
        self.assertTrue(granted.get_json()["canPost"])
        self.assertEqual(
            self.client.post(
                "/api/posts",
                json={"type": 1, "clubSlug": "robotics", "caption": "member update"},
                headers=self.auth("member-token"),
            ).status_code,
            201,
        )
        self.assertEqual(
            self.client.post(
                "/api/posts",
                json={"type": 3, "clubSlug": "robotics", "caption": "member announcement", "mediaUrls": ["poster.jpg"]},
                headers=self.auth("member-token"),
            ).status_code,
            403,
        )

        posts = self.client.get("/api/clubs/robotics").get_json()["posts"]
        self.assertEqual({post["type"] for post in posts}, {1, 3})
        self.assertEqual(len(posts), 4)

        announcement_endpoint = f"/api/posts/{created_posts[1]['postId']}"
        self.assertEqual(
            self.client.delete(announcement_endpoint, headers=self.auth("member-token")).status_code,
            403,
        )
        self.assertEqual(
            self.client.delete(announcement_endpoint, headers=self.auth("chairman-token")).status_code,
            204,
        )
        remaining_posts = self.client.get("/api/clubs/robotics").get_json()["posts"]
        self.assertNotIn(3, {post["type"] for post in remaining_posts})

    def test_only_admin_can_delete_a_club(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "student", "student", "Student User")
            self.add_token(session, "student-token", "student")
            club = backend_app.Club(name="Robotics", slug="robotics", description="", status="Open")
            session.add(club)
            session.commit()
            clubId = club.clubId

        endpoint = f"/api/clubs/items/{clubId}"
        self.assertEqual(self.client.delete(endpoint, headers=self.auth("student-token")).status_code, 403)

        admin_token = backend_app.create_auth_token(backend_app.AdminIdentity())
        self.assertEqual(self.client.delete(endpoint, headers=self.auth(admin_token)).status_code, 204)
        self.assertEqual(self.client.get("/api/clubs/robotics").status_code, 404)

    def test_like_creates_one_notification_excluding_self_likes(self) -> None:
        with backend_app.SessionLocal() as session:
            self.add_user(session, "owner", "owner", "Owner User")
            self.add_user(session, "actor", "actor", "Actor User")
            self.add_token(session, "owner-token", "owner")
            self.add_token(session, "actor-token", "actor")
            session.commit()

        post = self.create_post("owner-token")
        postId = post["postId"]

        self.assertEqual(self.client.post(f"/api/posts/{postId}/like", headers=self.auth("actor-token")).status_code, 201)
        self.assertEqual(self.client.post(f"/api/posts/{postId}/like", headers=self.auth("actor-token")).status_code, 200)
        self.assertEqual(self.client.post(f"/api/posts/{postId}/like", headers=self.auth("owner-token")).status_code, 201)

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
        postId = post["postId"]

        response = self.client.post(
            f"/api/posts/{postId}/comments",
            json={"content": "Nice post"},
            headers=self.auth("actor-token"),
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["comments"], 1)
        self.assertEqual(self.client.get(f"/api/posts/{postId}/comments").get_json()["total"], 1)
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
        self.client.post(f"/api/posts/{post['postId']}/like", headers=self.auth("actor-token"))
        notificationId = self.notifications("owner-token")["items"][0]["id"]

        self.assertEqual(
            self.client.delete(f"/api/notifications/{notificationId}", headers=self.auth("other-token")).status_code,
            404,
        )
        self.assertEqual(
            self.client.delete(f"/api/notifications/{notificationId}", headers=self.auth("owner-token")).status_code,
            204,
        )
        self.assertEqual(self.notifications("owner-token")["total"], 0)


if __name__ == "__main__":
    unittest.main()
