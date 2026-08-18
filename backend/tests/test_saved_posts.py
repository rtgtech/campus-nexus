from __future__ import annotations

import os
import sys
import unittest
from datetime import date
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET"] = "test-secret-that-is-at-least-32-characters"
os.environ["ALLOWED_EMAIL_DOMAINS"] = "example.edu"

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app as backend_app  # noqa: E402


class SavedPostsTest(unittest.TestCase):
    def setUp(self) -> None:
        backend_app.Base.metadata.drop_all(backend_app.engine)
        backend_app.Base.metadata.create_all(backend_app.engine)
        backend_app._database_initialized = True
        self.client = backend_app.app.test_client()

        with backend_app.SessionLocal() as session:
            owner = backend_app.User(
                fullName="Post Owner",
                username="owner",
                email="owner@example.edu",
                passwordHash="unused",
                dateOfBirth=date(2000, 1, 1),
                department="CS",
                semester=2,
            )
            viewer = backend_app.User(
                fullName="Saved Viewer",
                username="viewer",
                email="viewer@example.edu",
                passwordHash="unused",
                dateOfBirth=date(2000, 1, 1),
                department="CS",
                semester=2,
            )
            other = backend_app.User(
                fullName="Other Viewer",
                username="other",
                email="other@example.edu",
                passwordHash="unused",
                dateOfBirth=date(2000, 1, 1),
                department="CS",
                semester=2,
            )
            session.add_all([owner, viewer, other])
            session.flush()
            first = backend_app.Post(authorId=owner.userId, content="First saved post")
            second = backend_app.Post(authorId=owner.userId, content="Second saved post")
            session.add_all([first, second])
            session.commit()
            session.refresh(viewer)
            session.refresh(other)
            self.first_post_id = first.postId
            self.second_post_id = second.postId
            self.viewer_token = backend_app.create_auth_token(viewer)
            self.other_token = backend_app.create_auth_token(other)

    @staticmethod
    def auth(token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {token}"}

    def test_saved_posts_require_authentication(self) -> None:
        self.assertEqual(self.client.get("/api/saved-posts").status_code, 401)
        self.assertEqual(self.client.post(f"/api/posts/{self.first_post_id}/save").status_code, 401)

    def test_save_list_and_unsave_posts(self) -> None:
        first_save = self.client.post(
            f"/api/posts/{self.first_post_id}/save",
            headers=self.auth(self.viewer_token),
        )
        self.assertEqual(first_save.status_code, 201)
        self.assertTrue(first_save.get_json()["saved"])

        repeated_save = self.client.post(
            f"/api/posts/{self.first_post_id}/save",
            headers=self.auth(self.viewer_token),
        )
        self.assertEqual(repeated_save.status_code, 200)
        self.assertEqual(repeated_save.get_json()["bookmarks"], 1)

        self.client.post(
            f"/api/posts/{self.second_post_id}/save",
            headers=self.auth(self.viewer_token),
        )
        saved = self.client.get("/api/saved-posts", headers=self.auth(self.viewer_token))
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.get_json()["total"], 2)
        self.assertEqual(
            [item["postId"] for item in saved.get_json()["items"]],
            [str(self.second_post_id), str(self.first_post_id)],
        )
        self.assertTrue(all(item["savedByCurrentUser"] for item in saved.get_json()["items"]))

        viewer_posts = self.client.get("/api/posts", headers=self.auth(self.viewer_token)).get_json()
        other_posts = self.client.get("/api/posts", headers=self.auth(self.other_token)).get_json()
        self.assertTrue(next(item for item in viewer_posts if item["postId"] == str(self.first_post_id))["savedByCurrentUser"])
        self.assertFalse(next(item for item in other_posts if item["postId"] == str(self.first_post_id))["savedByCurrentUser"])

        removed = self.client.delete(
            f"/api/posts/{self.first_post_id}/save",
            headers=self.auth(self.viewer_token),
        )
        self.assertEqual(removed.status_code, 200)
        self.assertFalse(removed.get_json()["saved"])
        remaining = self.client.get("/api/saved-posts", headers=self.auth(self.viewer_token)).get_json()
        self.assertEqual([item["postId"] for item in remaining["items"]], [str(self.second_post_id)])

    def test_missing_post_cannot_be_saved(self) -> None:
        response = self.client.post("/api/posts/99999/save", headers=self.auth(self.viewer_token))
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
