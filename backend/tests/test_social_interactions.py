import os
import sys
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET"] = "test-secret-that-is-at-least-32-characters"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import schema_app as s
from fake_graph import FakeGraph


class SocialInteractionsTest(unittest.TestCase):
    def setUp(self):
        s.Base.metadata.drop_all(s.engine)
        s.Base.metadata.create_all(s.engine)
        s._database_initialized = True
        self.graph = FakeGraph()
        graph_patch = self.graph.patch_backend(s)
        graph_patch.start()
        self.addCleanup(graph_patch.stop)
        self.client = s.app.test_client()
        with s.SessionLocal() as db:
            users = [s.User(fullName=name, username=name, email=f"{name}@example.edu", passwordHash="unused",
                            dateOfBirth=date(2000, 1, 1), semester=2, department="CS") for name in ("viewer", "friend", "stranger")]
            db.add_all(users)
            db.flush()
            self.viewer, self.friend, self.stranger = [user.userId for user in users]
            self.tokens = {user.username: s.create_auth_token(user) for user in users}
            self.auth = self.auth_for("viewer")
            post = s.Post(authorId=self.friend, content="A campus conversation", visibility="campus")
            db.add(post)
            db.commit()
            self.post = post.postId
        self.comments = f"/api/posts/{self.post}/comments"

    def auth_for(self, username):
        return {"Authorization": "Bearer " + self.tokens[username]}

    def create_thread(self):
        self.graph.create_friendship(self.viewer, self.friend)
        response = self.client.post("/api/messages/conversations", headers=self.auth, json={"participantUserId": self.friend})
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.get_json()["canMessage"])
        return response.get_json()["threadId"]

    def test_nonfriends_can_create_threads_without_spoofing_identity(self):
        response = self.client.post("/api/messages/conversations", headers=self.auth,
            json={"participantUserId": self.friend, "userId": self.stranger})
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.get_json()["canMessage"])
        self.assertFalse(response.get_json()["isFriend"])
        with s.SessionLocal() as db:
            participant_ids = {row.userId for row in db.query(s.ChatParticipant).all()}
            self.assertEqual(participant_ids, {self.viewer, self.friend})

    def test_unfriending_preserves_nonfriend_messaging_and_history(self):
        thread = self.create_thread()
        data = {"threadId": thread, "text": "Hello friend"}
        sent = self.client.post("/api/messages/items", headers=self.auth, json=data)
        self.assertEqual(sent.status_code, 201)
        self.graph.delete_friendship(self.viewer, self.friend)
        self.assertEqual(self.client.post("/api/messages/items", headers=self.auth, json=data).status_code, 201)
        self.assertEqual(self.client.patch(f"/api/messages/items/{sent.get_json()['id']}", headers=self.auth, json={"text": "Edited"}).status_code, 200)
        self.assertEqual(self.client.post("/api/messages/conversations", headers=self.auth, json={"participantUserId": self.friend}).status_code, 200)
        conversation = self.client.get(f"/api/messages/conversations/{thread}", headers=self.auth).get_json()
        self.assertTrue(conversation["canMessage"])
        self.assertFalse(conversation["isFriend"])
        self.assertEqual(self.client.get(f"/api/messages/items?threadId={thread}", headers=self.auth).get_json()[0]["text"], "Edited")

    def test_graph_outage_does_not_disable_safe_nonfriend_messaging(self):
        thread = self.create_thread()
        with patch.object(s, "graph_get_friendship", side_effect=s.GraphUnavailable("offline")):
            self.assertEqual(self.client.post("/api/messages/items", headers=self.auth, json={"threadId": thread, "text": "Delivered"}).status_code, 201)
            conversation = self.client.get(f"/api/messages/conversations/{thread}", headers=self.auth).get_json()
            self.assertTrue(conversation["canMessage"])
            self.assertFalse(conversation["isFriend"])

    def test_nonparticipant_cannot_send_to_an_existing_thread(self):
        thread = self.create_thread()
        self.assertEqual(self.client.post("/api/messages/items", headers=self.auth_for("stranger"), json={"threadId": thread, "text": "Blocked"}).status_code, 400)

    def test_incoming_nonfriend_message_is_a_blockable_message_request(self):
        created = self.client.post(
            "/api/messages/conversations",
            headers=self.auth_for("stranger"),
            json={"participantUserId": self.viewer},
        )
        self.assertEqual(created.status_code, 201)
        thread = created.get_json()["threadId"]
        self.assertFalse(created.get_json()["isMessageRequest"])
        sent = self.client.post(
            "/api/messages/items",
            headers=self.auth_for("stranger"),
            json={"threadId": thread, "text": "Hello from a non-friend"},
        )
        self.assertEqual(sent.status_code, 201)

        request_view = self.client.get(f"/api/messages/conversations/{thread}", headers=self.auth).get_json()
        self.assertTrue(request_view["isMessageRequest"])
        self.assertFalse(request_view["isFriend"])

        blocked = self.client.post(f"/api/users/{self.stranger}/block", headers=self.auth)
        self.assertEqual(blocked.status_code, 201)
        self.assertTrue(blocked.get_json()["isBlocked"])
        self.assertEqual(self.client.post(
            "/api/messages/items",
            headers=self.auth_for("stranger"),
            json={"threadId": thread, "text": "Cannot deliver"},
        ).status_code, 403)
        after_block = self.client.get(f"/api/messages/conversations/{thread}", headers=self.auth).get_json()
        self.assertFalse(after_block["canMessage"])
        self.assertTrue(after_block["isBlocked"])
        self.assertFalse(after_block["isMessageRequest"])

        unblocked = self.client.delete(f"/api/users/{self.stranger}/block", headers=self.auth)
        self.assertEqual(unblocked.status_code, 200)
        self.assertFalse(unblocked.get_json()["isBlocked"])
        self.assertEqual(self.client.post(
            "/api/messages/items",
            headers=self.auth_for("stranger"),
            json={"threadId": thread, "text": "Allowed again"},
        ).status_code, 201)

    def test_blocking_a_friend_removes_friendship_and_prevents_refriending(self):
        self.graph.create_friendship(self.viewer, self.friend)
        blocked = self.client.post(f"/api/users/{self.friend}/block", headers=self.auth)
        self.assertEqual(blocked.status_code, 201)
        self.assertIsNone(self.graph.get_friendship(self.viewer, self.friend))
        status = self.client.get(f"/api/users/{self.friend}/friends", headers=self.auth).get_json()
        self.assertTrue(status["isBlocked"])
        self.assertFalse(status["isFriend"])
        self.assertEqual(self.client.post(f"/api/users/{self.friend}/friends", headers=self.auth).status_code, 403)

    def test_comments_persist_with_authenticated_author_and_count(self):
        created = self.client.post(self.comments, headers=self.auth, json={"content": "  Great idea!\nSee you there.  ", "userId": self.stranger})
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.get_json()["comment"]["userId"], str(self.viewer))
        self.assertEqual(created.get_json()["comments"], 1)
        listed = s.app.test_client().get(self.comments, headers=self.auth).get_json()
        self.assertEqual(listed["total"], 1)
        self.assertEqual(listed["items"][0]["content"], "Great idea!\nSee you there.")
        with s.SessionLocal() as db:
            self.assertEqual(db.query(s.FeedEvent).filter_by(kind="comment").count(), 1)

    def test_comments_require_auth_and_valid_content(self):
        self.assertEqual(self.client.post(self.comments, json={"content": "Hello"}).status_code, 401)
        for content in ("", " \n ", "x" * 2001):
            self.assertEqual(self.client.post(self.comments, headers=self.auth, json={"content": content}).status_code, 400)
        with s.SessionLocal() as db:
            self.assertEqual(db.query(s.Comment).count(), 0)

    def test_private_and_deleted_posts_protect_comments(self):
        with s.SessionLocal() as db:
            db.get(s.Post, self.post).visibility = "friends"
            db.commit()
        self.assertEqual(self.client.get(self.comments, headers=self.auth).status_code, 404)
        self.assertEqual(self.client.post(self.comments, headers=self.auth, json={"content": "No"}).status_code, 404)
        self.graph.create_friendship(self.viewer, self.friend)
        self.assertEqual(self.client.get(self.comments, headers=self.auth).status_code, 200)
        with s.SessionLocal() as db:
            db.get(s.Post, self.post).isDeleted = True
            db.commit()
        self.assertEqual(self.client.get(self.comments, headers=self.auth).status_code, 404)


if __name__ == "__main__":
    unittest.main()
