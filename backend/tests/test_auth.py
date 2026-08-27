from __future__ import annotations

import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET"] = "test-secret-that-is-at-least-32-characters"
os.environ["ALLOWED_EMAIL_DOMAINS"] = "example.edu,@campus.example"

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

    def test_account_creation_does_not_touch_neo4j(self) -> None:
        payload = {
            "name": "Test User",
            "username": "tester",
            "email": "tester@example.edu",
            "dateOfBirth": "2000-01-01",
            "yearOfStudy": 2,
            "department": "CS",
            "password": "secret123",
        }

        with patch("graph_store._get_driver", side_effect=AssertionError("account creation touched Neo4j")):
            self.assertEqual(self.client.post("/api/auth/signup", json=payload).status_code, 201)
            public_client = backend_app.app.test_client()
            self.assertEqual(
                public_client.post(
                    "/api/users",
                    json={**payload, "username": "blocked", "email": "blocked@example.edu"},
                ).status_code,
                401,
            )
            self.assertEqual(
                self.client.post(
                    "/api/users",
                    json={**payload, "username": "second", "email": "second@example.edu"},
                    headers={
                        "Authorization": f"Bearer {backend_app.create_auth_token(backend_app.AdminIdentity())}",
                        "Origin": backend_app.CORS_ORIGIN,
                    },
                ).status_code,
                201,
            )

    def test_signup_returns_a_verified_jwt_and_rejects_tampering(self) -> None:
        response = self.client.post(
            "/api/auth/signup",
            json={
                "name": "Test User",
                "username": "tester",
                "email": "tester@example.edu",
                "dateOfBirth": "2000-01-01",
                "yearOfStudy": 2,
                "department": "CS",
                "password": "secret123",
            },
        )
        self.assertEqual(response.status_code, 201)
        self.assertNotIn("token", response.get_json())
        self.assertIn("HttpOnly", response.headers["Set-Cookie"])
        self.assertIn("SameSite=Lax", response.headers["Set-Cookie"])
        self.assertEqual(self.client.get("/api/auth/me").status_code, 200)

        token = self.client.get_cookie(backend_app.JWT_COOKIE_NAME).value
        bad_client = backend_app.app.test_client()
        bad_client.set_cookie(backend_app.JWT_COOKIE_NAME, f"{token}x")
        self.assertEqual(bad_client.get("/api/auth/me").status_code, 401)

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
        expired_client = backend_app.app.test_client()
        expired_client.set_cookie(backend_app.JWT_COOKIE_NAME, expired)
        self.assertEqual(expired_client.get("/api/auth/me").status_code, 401)

        response = self.client.post("/api/auth/login", json={"login": "admin", "password": "12345678"})
        self.assertEqual(response.status_code, 200)
        me = self.client.get("/api/auth/me")
        self.assertEqual(me.get_json()["user"]["userId"], "admin")

        self.assertEqual(self.client.post("/api/auth/logout").status_code, 403)
        logout = self.client.post("/api/auth/logout", headers={"Origin": backend_app.CORS_ORIGIN})
        self.assertEqual(logout.status_code, 204)
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)

    def test_signup_rejects_years_over_four_and_removed_departments(self) -> None:
        payload = {
            "name": "Test User",
            "username": "tester",
            "email": "tester@example.edu",
            "dateOfBirth": "2000-01-01",
            "yearOfStudy": 2,
            "department": "CS",
            "password": "secret123",
        }

        self.assertEqual(self.client.post("/api/auth/signup", json={**payload, "yearOfStudy": 5}).status_code, 400)
        for department in ("Architecture", "Design", "Business", "Civil"):
            self.assertEqual(self.client.post("/api/auth/signup", json={**payload, "department": department}).status_code, 400)

    def test_signup_accepts_aiml_and_information_science_departments(self) -> None:
        for index, department in enumerate(("AIML", "Information Science"), start=1):
            response = self.client.post(
                "/api/auth/signup",
                headers={"Origin": backend_app.CORS_ORIGIN},
                json={
                    "name": f"Department User {index}",
                    "username": f"department-user-{index}",
                    "email": f"department-user-{index}@example.edu",
                    "dateOfBirth": "2000-01-01",
                    "yearOfStudy": 2,
                    "department": department,
                    "password": "secret123",
                },
            )

            self.assertEqual(response.status_code, 201, response.get_data(as_text=True))
            self.assertEqual(response.get_json()["user"]["department"], department)

    def test_signup_only_allows_configured_email_domains(self) -> None:
        payload = {
            "name": "Test User",
            "username": "tester",
            "email": "tester@campus.example",
            "dateOfBirth": "2000-01-01",
            "yearOfStudy": 2,
            "department": "CS",
            "password": "secret123",
        }

        self.assertEqual(self.client.post("/api/auth/signup", json=payload).status_code, 201)
        rejected = self.client.post(
            "/api/auth/signup",
            json={**payload, "username": "outsider", "email": "outsider@other.example"},
            headers={"Origin": backend_app.CORS_ORIGIN},
        )
        self.assertEqual(rejected.status_code, 400)
        self.assertEqual(rejected.get_json()["error"], "email domain is not allowed")

    def test_only_admin_can_list_all_users(self) -> None:
        signup = self.client.post(
            "/api/auth/signup",
            json={
                "name": "Test User",
                "username": "tester",
                "email": "tester@example.edu",
                "dateOfBirth": "2000-01-01",
                "yearOfStudy": 2,
                "department": "CS",
                "password": "secret123",
            },
        )
        self.assertEqual(signup.status_code, 201)
        self.assertEqual(self.client.get("/api/users").status_code, 403)
        self.assertEqual(self.client.get("/api/users?username=tester").status_code, 200)

        admin_client = backend_app.app.test_client()
        self.assertEqual(admin_client.post("/api/auth/login", json={"login": "admin", "password": "12345678"}).status_code, 200)
        users = admin_client.get("/api/users")
        self.assertEqual(users.status_code, 200)
        self.assertEqual(users.get_json()[0]["username"], "tester")


if __name__ == "__main__":
    unittest.main()
