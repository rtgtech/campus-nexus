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


class CampusEventsTest(unittest.TestCase):
    def setUp(self) -> None:
        backend_app.Base.metadata.drop_all(backend_app.engine)
        backend_app.Base.metadata.create_all(backend_app.engine)
        backend_app._database_initialized = True
        self.client = backend_app.app.test_client()
        self.admin_headers = self.auth(backend_app.create_auth_token(backend_app.AdminIdentity()))
        with backend_app.SessionLocal() as session:
            student = backend_app.User(
                fullName="Student User",
                username="student",
                email="student@example.edu",
                passwordHash="unused",
                dateOfBirth=date(2000, 1, 1),
                department="CS",
                semester=2,
            )
            session.add(student)
            session.commit()
            session.refresh(student)
            self.student_headers = self.auth(backend_app.create_auth_token(student))

    @staticmethod
    def auth(token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {token}"}

    @staticmethod
    def payload(**overrides):
        return {
            "title": "Campus Hackathon",
            "link": "https://events.example.edu/hackathon",
            "type": "Competition",
            "date": "2026-09-10",
            "place": "Main Auditorium",
            **overrides,
        }

    def test_public_list_and_admin_authorization(self) -> None:
        self.assertEqual(self.client.get("/api/events").get_json(), {"items": [], "total": 0})
        self.assertEqual(self.client.post("/api/events", json=self.payload()).status_code, 401)
        self.assertEqual(
            self.client.post("/api/events", json=self.payload(), headers=self.student_headers).status_code,
            403,
        )

    def test_event_validation(self) -> None:
        invalid_values = (
            {"title": ""},
            {"link": "/internal"},
            {"link": "javascript:alert(1)"},
            {"type": "Seminar"},
            {"date": "10/09/2026"},
            {"place": ""},
        )
        for override in invalid_values:
            with self.subTest(override=override):
                response = self.client.post(
                    "/api/events",
                    json=self.payload(**override),
                    headers=self.admin_headers,
                )
                self.assertEqual(response.status_code, 400)

    def test_admin_can_create_update_and_delete_events(self) -> None:
        created_response = self.client.post(
            "/api/events",
            json=self.payload(),
            headers=self.admin_headers,
        )
        self.assertEqual(created_response.status_code, 201)
        created = created_response.get_json()
        self.assertEqual(created["type"], "Competition")
        self.assertEqual(created["date"], "2026-09-10")

        event_id = created["id"]
        updated_response = self.client.patch(
            f"/api/events/{event_id}",
            json={"title": "Design Workshop", "type": "Workshop", "place": "Studio 2"},
            headers=self.admin_headers,
        )
        self.assertEqual(updated_response.status_code, 200)
        updated = updated_response.get_json()
        self.assertEqual(updated["title"], "Design Workshop")
        self.assertEqual(updated["type"], "Workshop")
        self.assertEqual(updated["place"], "Studio 2")

        listed = self.client.get("/api/events").get_json()
        self.assertEqual(listed["total"], 1)
        self.assertEqual(listed["items"][0]["id"], event_id)

        self.assertEqual(
            self.client.delete(f"/api/events/{event_id}", headers=self.student_headers).status_code,
            403,
        )
        self.assertEqual(
            self.client.delete(f"/api/events/{event_id}", headers=self.admin_headers).status_code,
            204,
        )
        self.assertEqual(self.client.get("/api/events").get_json(), {"items": [], "total": 0})


if __name__ == "__main__":
    unittest.main()
