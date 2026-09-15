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
            self.auth = {"Authorization": "Bearer " + s.create_auth_token(users[0])}
            post = s.Post(authorId=self.friend, content="A campus conversation", visibility="campus")
            db.add(post)
            db.commit()
            self.post = post.postId
        self.comments = f"/api/posts/{self.post}/comments"

    def create_thread(self):
        self.graph.create_friendship(self.viewer, self.friend)
        response = self.client.post("/api/messages/conversations", headers=self.auth, json={"participantUserId": self.friend})
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.get_json()["canMessage"])
        return response.get_json()["threadId"]

    def test_strangers_cannot_create_threads_even_with_spoofed_identity(self):
        response = self.client.post("/api/messages/conversations", headers=self.auth,
            json={"participantUserId": self.friend, "userId": self.stranger})
        self.assertEqual(response.status_code, 403)
        with s.SessionLocal() as db:
            self.assertEqual(db.query(s.ChatThread).count(), 0)

    def test_unfriending_blocks_send_edit_and_reopening_but_preserves_history(self):
        thread = self.create_thread()
        data = {"threadId": thread, "text": "Hello friend"}
        sent = self.client.post("/api/messages/items", headers=self.auth, json=data)
        self.assertEqual(sent.status_code, 201)
        self.graph.delete_friendship(self.viewer, self.friend)
        self.assertEqual(self.client.post("/api/messages/items", headers=self.auth, json=data).status_code, 403)
        self.assertEqual(self.client.patch(f"/api/messages/items/{sent.get_json()['id']}", headers=self.auth, json={"text": "Edited"}).status_code, 403)
        self.assertEqual(self.client.post("/api/messages/conversations", headers=self.auth, json={"participantUserId": self.friend}).status_code, 403)
        conversation = self.client.get(f"/api/messages/conversations/{thread}", headers=self.auth).get_json()
        self.assertFalse(conversation["canMessage"])
        self.assertEqual(self.client.get(f"/api/messages/items?threadId={thread}", headers=self.auth).get_json()[0]["text"], "Hello friend")
        self.graph.create_friendship(self.viewer, self.friend)
        self.assertEqual(self.client.post("/api/messages/items", headers=self.auth, json=data).status_code, 201)

    def test_graph_outage_fails_closed_for_messaging(self):
        thread = self.create_thread()
        with patch.object(s, "graph_get_friendship", side_effect=s.GraphUnavailable("offline")):
            self.assertEqual(self.client.post("/api/messages/items", headers=self.auth, json={"threadId": thread, "text": "Blocked"}).status_code, 503)
            self.assertFalse(self.client.get(f"/api/messages/conversations/{thread}", headers=self.auth).get_json()["canMessage"])

    def test_legacy_thread_with_nonfriend_cannot_bypass_creation_check(self):
        thread = self.create_thread()
        with s.SessionLocal() as db:
            db.add(s.ChatParticipant(threadId=thread, userId=self.stranger))
            db.commit()
        self.assertEqual(self.client.post("/api/messages/items", headers=self.auth, json={"threadId": thread, "text": "Blocked"}).status_code, 403)

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
