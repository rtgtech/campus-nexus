from __future__ import annotations

import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET"] = "test-secret-that-is-at-least-32-characters"

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app as backend_app  # noqa: E402


class AuthTest(unittest.TestCase):
    def setUp(self) -> None:
        backend_app.Base.metadata.drop_all(backend_app.engine)
        backend_app.Base.metadata.create_all(backend_app.engine)
        backend_app._database_initialized = True
        self.client = backend_app.app.test_client()

    def test_signup_returns_a_verified_jwt_and_rejects_tampering(self) -> None:
        response = self.client.post(
            "/api/auth/signup",
            json={
                "name": "Test User",
                "username": "tester",
                "mail": "tester@example.edu",
                "DOB": "2000-01-01",
                "year": 2,
                "department": "CS",
                "password": "secret123",
            },
        )
        self.assertEqual(response.status_code, 201)
        token = response.get_json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        self.assertEqual(self.client.get("/api/auth/me", headers=headers).status_code, 200)
        self.assertEqual(self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}x"}).status_code, 401)

    def test_rejects_expired_tokens_and_accepts_admin_tokens(self) -> None:
        now = datetime.now(timezone.utc)
        expired = backend_app.jwt.encode(
            {
                "sub": "1",
                "role": "student",
                "iss": backend_app.JWT_ISSUER,
                "iat": now - timedelta(hours=2),
                "exp": now - timedelta(hours=1),
            },
            backend_app.JWT_SECRET,
            algorithm=backend_app.JWT_ALGORITHM,
        )
        self.assertEqual(self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired}"}).status_code, 401)

        response = self.client.post("/api/auth/login", json={"login": "admin", "password": "12345678"})
        self.assertEqual(response.status_code, 200)
        token = response.get_json()["token"]
        me = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me.get_json()["user"]["user_id"], "admin")


if __name__ == "__main__":
    unittest.main()
