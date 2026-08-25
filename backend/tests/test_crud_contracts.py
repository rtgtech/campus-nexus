from __future__ import annotations

import os
import sys
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET"] = "test-secret-that-is-at-least-32-characters"
os.environ["ALLOWED_EMAIL_DOMAINS"] = "example.edu,@campus.example"

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app as backend_app  # noqa: E402
import schema_app as backend_schema  # noqa: E402


class CrudContractsTest(unittest.TestCase):
    def setUp(self) -> None:
        backend_app.Base.metadata.drop_all(backend_app.engine)
        backend_app.Base.metadata.create_all(backend_app.engine)
        backend_app._database_initialized = True
        self.client = backend_app.app.test_client()

    @staticmethod
    def auth(token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {token}"}

    def admin_auth(self) -> dict[str, str]:
        return self.auth(backend_app.create_auth_token(backend_app.AdminIdentity()))

    def add_user(self, username: str) -> tuple[int, str]:
        with backend_app.SessionLocal() as session:
            user = backend_app.User(
                fullName=username.replace("-", " ").title(),
                username=username,
                email=f"{username}@example.edu",
                passwordHash="unused",
                dateOfBirth=date(2000, 1, 1),
                department="CS",
                semester=2,
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            return user.userId, backend_app.create_auth_token(user)

    def test_users_and_profiles_complete_their_documented_crud_lifecycle(self) -> None:
        created = self.client.post(
            "/api/users",
            json={
                "name": "CRUD Student",
                "username": "crud-student",
                "email": "crud-student@example.edu",
                "dateOfBirth": "2000-01-01",
                "department": "CS",
                "yearOfStudy": 2,
            },
            headers=self.admin_auth(),
        )
        self.assertEqual(created.status_code, 201, created.get_data(as_text=True))
        user_id = created.get_json()["userId"]
        with backend_app.SessionLocal() as session:
            token = backend_app.create_auth_token(session.get(backend_app.User, int(user_id)))

        self.assertEqual(self.client.get(f"/api/users/{user_id}").status_code, 200)
        listed = self.client.get("/api/users", headers=self.admin_auth()).get_json()
        self.assertIn(user_id, [item["userId"] for item in listed])

        patched = self.client.patch(
            f"/api/users/{user_id}",
            json={"name": "Patched Student"},
            headers=self.auth(token),
        )
        self.assertEqual(patched.status_code, 200)
        self.assertEqual(patched.get_json()["name"], "Patched Student")
        replaced = self.client.put(
            f"/api/users/{user_id}",
            json={"department": "ECE", "batchYear": 2028},
            headers=self.auth(token),
        )
        self.assertEqual(replaced.status_code, 200)
        self.assertEqual(replaced.get_json()["department"], "ECE")
        self.assertEqual(replaced.get_json()["batchYear"], 2028)

        profile_created = self.client.post(
            "/api/profiles",
            json={"userId": user_id, "bio": "Created profile", "interests": ["Testing"]},
            headers=self.auth(token),
        )
        self.assertEqual(profile_created.status_code, 201)
        self.assertEqual(profile_created.get_json()["bio"], "Created profile")
        profile_patched = self.client.patch(
            f"/api/profiles/{user_id}",
            json={"bio": "Patched profile"},
            headers=self.auth(token),
        )
        self.assertEqual(profile_patched.status_code, 200)
        profile_replaced = self.client.put(
            f"/api/profiles/{user_id}",
            json={"interests": ["Contracts", "CRUD"]},
            headers=self.auth(token),
        )
        self.assertEqual(profile_replaced.status_code, 200)
        self.assertEqual(profile_replaced.get_json()["interests"], ["CRUD", "Contracts"])
        self.assertEqual(
            self.client.delete(f"/api/profiles/{user_id}", headers=self.auth(token)).status_code,
            204,
        )
        reset_profile = self.client.get(f"/api/profiles/{user_id}").get_json()
        self.assertEqual(reset_profile["bio"], "")
        self.assertEqual(reset_profile["interests"], [])

        self.assertEqual(
            self.client.delete(f"/api/users/{user_id}", headers=self.auth(token)).status_code,
            204,
        )
        self.assertEqual(self.client.get(f"/api/users/{user_id}").status_code, 404)
        listed_after_delete = self.client.get("/api/users", headers=self.admin_auth()).get_json()
        self.assertNotIn(user_id, [item["userId"] for item in listed_after_delete])

    def test_posts_complete_create_read_update_and_soft_delete(self) -> None:
        _, token = self.add_user("post-owner")
        with patch.object(backend_schema, "friend_user_ids", return_value=[]):
            created = self.client.post(
                "/api/posts",
                json={"caption": "Created #contract", "mediaUrls": ["https://example.edu/image.png"]},
                headers=self.auth(token),
            )
        self.assertEqual(created.status_code, 201, created.get_data(as_text=True))
        post_id = created.get_json()["postId"]
        self.assertEqual(created.get_json()["caption"], "Created #contract")

        self.assertEqual(self.client.get(f"/api/posts/{post_id}").status_code, 200)
        self.assertIn(post_id, [item["postId"] for item in self.client.get("/api/posts").get_json()])
        patched = self.client.patch(
            f"/api/posts/{post_id}",
            json={"caption": "Patched #contract"},
            headers=self.auth(token),
        )
        self.assertEqual(patched.status_code, 200)
        self.assertEqual(patched.get_json()["caption"], "Patched #contract")
        replaced = self.client.put(
            f"/api/posts/{post_id}",
            json={"caption": "Put update", "shares": 2},
            headers=self.auth(token),
        )
        self.assertEqual(replaced.status_code, 200)
        self.assertEqual(replaced.get_json()["shares"], 2)

        self.assertEqual(
            self.client.delete(f"/api/posts/{post_id}", headers=self.auth(token)).status_code,
            204,
        )
        self.assertEqual(self.client.get(f"/api/posts/{post_id}").status_code, 404)
        self.assertNotIn(post_id, [item["postId"] for item in self.client.get("/api/posts").get_json()])

    def test_clubs_and_members_complete_crud_and_allow_readding_a_removed_member(self) -> None:
        user_id, _ = self.add_user("club-member")
        created = self.client.post(
            "/api/clubs/items",
            json={"title": "CRUD Club", "slug": "crud-club", "description": "Created"},
            headers=self.admin_auth(),
        )
        self.assertEqual(created.status_code, 201)
        club_id = created.get_json()["id"]
        self.assertEqual(self.client.get(f"/api/clubs/items/{club_id}").status_code, 200)
        self.assertIn(club_id, [item["id"] for item in self.client.get("/api/clubs/items").get_json()])

        patched = self.client.patch(
            f"/api/clubs/items/{club_id}",
            json={"description": "Patched"},
            headers=self.admin_auth(),
        )
        self.assertEqual(patched.status_code, 200)
        replaced = self.client.put(
            f"/api/clubs/items/{club_id}",
            json={"status": "Recruiting"},
            headers=self.admin_auth(),
        )
        self.assertEqual(replaced.status_code, 200)
        self.assertEqual(replaced.get_json()["status"], "Recruiting")

        member = self.client.post(
            "/api/clubs/crud-club/members",
            json={"userId": user_id, "title": "Member"},
            headers=self.admin_auth(),
        )
        self.assertEqual(member.status_code, 201, member.get_data(as_text=True))
        member_id = member.get_json()["id"]
        self.assertEqual(self.client.get(f"/api/clubs/crud-club/members/{member_id}").status_code, 200)
        member_update = self.client.patch(
            f"/api/clubs/crud-club/members/{member_id}",
            json={"title": "Secretary"},
            headers=self.admin_auth(),
        )
        self.assertEqual(member_update.status_code, 200)
        self.assertEqual(member_update.get_json()["title"], "Secretary")
        member_put = self.client.put(
            f"/api/clubs/crud-club/members/{member_id}",
            json={"title": "Member", "canPost": False},
            headers=self.admin_auth(),
        )
        self.assertEqual(member_put.status_code, 200)
        self.assertFalse(member_put.get_json()["canPost"])
        self.assertEqual(
            self.client.delete(
                f"/api/clubs/crud-club/members/{member_id}",
                headers=self.admin_auth(),
            ).status_code,
            204,
        )
        self.assertEqual(self.client.get(f"/api/clubs/crud-club/members/{member_id}").status_code, 404)
        self.assertEqual(self.client.get("/api/clubs/crud-club/members").get_json(), [])

        restored = self.client.post(
            "/api/clubs/crud-club/members",
            json={"userId": user_id, "title": "Member"},
            headers=self.admin_auth(),
        )
        self.assertEqual(restored.status_code, 201, restored.get_data(as_text=True))
        self.assertEqual(restored.get_json()["id"], member_id)

        self.assertEqual(
            self.client.delete(f"/api/clubs/items/{club_id}", headers=self.admin_auth()).status_code,
            204,
        )
        self.assertEqual(self.client.get(f"/api/clubs/items/{club_id}").status_code, 404)
        self.assertNotIn(club_id, [item["id"] for item in self.client.get("/api/clubs/items").get_json()])

    def test_games_complete_create_read_update_and_soft_delete(self) -> None:
        created = self.client.post(
            "/api/games/items",
            json={"title": "CRUD Game", "description": "Created"},
            headers=self.admin_auth(),
        )
        self.assertEqual(created.status_code, 201)
        game_id = created.get_json()["id"]
        self.assertEqual(self.client.get(f"/api/games/items/{game_id}").status_code, 200)
        self.assertIn(game_id, [item["id"] for item in self.client.get("/api/games/items").get_json()])
        self.assertEqual(
            self.client.patch(
                f"/api/games/items/{game_id}",
                json={"title": "Patched Game"},
                headers=self.admin_auth(),
            ).status_code,
            200,
        )
        replaced = self.client.put(
            f"/api/games/items/{game_id}",
            json={"description": "Put update"},
            headers=self.admin_auth(),
        )
        self.assertEqual(replaced.status_code, 200)
        self.assertEqual(
            self.client.delete(f"/api/games/items/{game_id}", headers=self.admin_auth()).status_code,
            204,
        )
        self.assertEqual(self.client.get(f"/api/games/items/{game_id}").status_code, 404)
        self.assertNotIn(game_id, [item["id"] for item in self.client.get("/api/games/items").get_json()])
        self.assertNotIn(game_id, [item["id"] for item in self.client.get("/api/games").get_json()["gameCards"]])

    def test_marketplace_items_complete_create_read_update_and_soft_delete(self) -> None:
        _, token = self.add_user("seller")
        created = self.client.post(
            "/api/marketplace/items",
            json={"title": "CRUD Listing", "description": "Created", "price": "10.50"},
            headers=self.auth(token),
        )
        self.assertEqual(created.status_code, 201)
        item_id = created.get_json()["id"]
        self.assertEqual(self.client.get(f"/api/marketplace/items/{item_id}").status_code, 200)
        self.assertIn(item_id, [item["id"] for item in self.client.get("/api/marketplace/items").get_json()])
        patched = self.client.patch(
            f"/api/marketplace/items/{item_id}",
            json={"title": "Patched Listing"},
            headers=self.auth(token),
        )
        self.assertEqual(patched.status_code, 200)
        self.assertEqual(patched.get_json()["title"], "Patched Listing")
        replaced = self.client.put(
            f"/api/marketplace/items/{item_id}",
            json={"description": "Put update", "price": 12},
            headers=self.auth(token),
        )
        self.assertEqual(replaced.status_code, 200)
        self.assertEqual(replaced.get_json()["description"], "Put update")
        self.assertEqual(
            self.client.delete(f"/api/marketplace/items/{item_id}", headers=self.auth(token)).status_code,
            204,
        )
        self.assertEqual(self.client.get(f"/api/marketplace/items/{item_id}").status_code, 404)
        self.assertNotIn(item_id, [item["id"] for item in self.client.get("/api/marketplace/items").get_json()])

    def test_conversations_and_messages_complete_their_supported_crud_lifecycle(self) -> None:
        first_id, first_token = self.add_user("chat-first")
        second_id, _ = self.add_user("chat-second")
        conversation = self.client.post(
            "/api/messages/conversations",
            json={"participantUserId": second_id, "threadType": "direct"},
            headers=self.auth(first_token),
        )
        self.assertEqual(conversation.status_code, 201)
        thread_id = conversation.get_json()["threadId"]
        self.assertEqual(
            self.client.get(
                f"/api/messages/conversations/{thread_id}",
                headers=self.auth(first_token),
            ).status_code,
            200,
        )
        self.assertIn(
            thread_id,
            [
                item["threadId"]
                for item in self.client.get(
                    "/api/messages/conversations",
                    headers=self.auth(first_token),
                ).get_json()
            ],
        )
        self.assertEqual(
            self.client.patch(
                f"/api/messages/conversations/{thread_id}",
                json={"name": "Unsupported"},
                headers=self.auth(first_token),
            ).status_code,
            405,
        )

        message = self.client.post(
            "/api/messages/items",
            json={"threadId": thread_id, "content": f"Hello from {first_id}"},
            headers=self.auth(first_token),
        )
        self.assertEqual(message.status_code, 201)
        self.assertEqual(message.get_json()["threadId"], thread_id)
        self.assertIn("status", message.get_json())
        message_id = message.get_json()["id"]
        self.assertEqual(
            self.client.get(f"/api/messages/items/{message_id}", headers=self.auth(first_token)).status_code,
            200,
        )
        patched = self.client.patch(
            f"/api/messages/items/{message_id}",
            json={"text": "Patched message"},
            headers=self.auth(first_token),
        )
        self.assertEqual(patched.status_code, 200)
        self.assertEqual(patched.get_json()["text"], "Patched message")
        replaced = self.client.put(
            f"/api/messages/items/{message_id}",
            json={"content": "Put message"},
            headers=self.auth(first_token),
        )
        self.assertEqual(replaced.status_code, 200)
        self.assertEqual(replaced.get_json()["text"], "Put message")
        self.assertEqual(
            self.client.delete(f"/api/messages/items/{message_id}", headers=self.auth(first_token)).status_code,
            204,
        )
        self.assertEqual(
            self.client.get(f"/api/messages/items/{message_id}", headers=self.auth(first_token)).status_code,
            404,
        )
        self.assertEqual(
            self.client.get(
                f"/api/messages/items?threadId={thread_id}",
                headers=self.auth(first_token),
            ).get_json(),
            [],
        )

        self.assertEqual(
            self.client.delete(
                f"/api/messages/conversations/{thread_id}",
                headers=self.auth(first_token),
            ).status_code,
            204,
        )
        self.assertEqual(
            self.client.get(
                f"/api/messages/conversations/{thread_id}",
                headers=self.auth(first_token),
            ).status_code,
            404,
        )

    def test_removed_denormalized_resources_are_explicitly_not_crud_endpoints(self) -> None:
        collections = (
            "/api/feed/trending",
            "/api/feed/suggested-people",
            "/api/clubs/spotlight",
            "/api/clubs/stats",
            "/api/games/top-rated",
            "/api/games/recent-activity",
        )
        for endpoint in collections:
            with self.subTest(endpoint=endpoint):
                self.assertEqual(self.client.get(endpoint).get_json(), [])
                self.assertEqual(self.client.post(endpoint, json={}).status_code, 410)
                self.assertEqual(self.client.get(f"{endpoint}/1").status_code, 410)
                self.assertEqual(self.client.patch(f"{endpoint}/1", json={}).status_code, 410)
                self.assertEqual(self.client.put(f"{endpoint}/1", json={}).status_code, 410)
                self.assertEqual(self.client.delete(f"{endpoint}/1").status_code, 410)


if __name__ == "__main__":
    unittest.main()
