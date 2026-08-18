from __future__ import annotations

import os
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from flask import g
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET"] = "test-secret-that-is-at-least-32-characters"
os.environ["ALLOWED_EMAIL_DOMAINS"] = "example.edu,@campus.example"

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app as backend_app  # noqa: E402
import schema_app as backend_schema  # noqa: E402


class FrontendApiRequirementsTest(unittest.TestCase):
    def setUp(self) -> None:
        backend_app.Base.metadata.drop_all(backend_app.engine)
        backend_app.Base.metadata.create_all(backend_app.engine)
        backend_app._database_initialized = True
        self.client = backend_app.app.test_client()

    def add_user(self, username: str, *, batch_year: int | None = None) -> tuple[int, str]:
        with backend_app.SessionLocal() as session:
            user = backend_app.User(
                fullName=username.replace("-", " ").title(),
                username=username,
                email=f"{username}@example.edu",
                passwordHash="unused",
                dateOfBirth=datetime(2000, 1, 1).date(),
                department="CS",
                semester=2,
                batchYear=batch_year,
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            return user.userId, backend_app.create_auth_token(user)

    @staticmethod
    def auth(token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {token}"}

    def admin_auth(self) -> dict[str, str]:
        return self.auth(backend_app.create_auth_token(backend_app.AdminIdentity()))

    def test_health_reports_database_readiness(self) -> None:
        healthy = self.client.get("/health")
        self.assertEqual(healthy.status_code, 200)
        self.assertEqual(healthy.get_json()["database"], "ready")

        with self.assertLogs(backend_schema.app.logger, level="ERROR"):
            with patch.object(
                backend_schema,
                "ensure_database_initialized",
                side_effect=RuntimeError("schema mismatch"),
            ):
                unhealthy = self.client.get("/health")
        self.assertEqual(unhealthy.status_code, 503)
        self.assertEqual(unhealthy.get_json()["database"], "unavailable")

        with self.assertLogs(backend_schema.app.logger, level="ERROR"):
            with patch.object(
                backend_schema,
                "ensure_database_initialized",
                side_effect=backend_schema.DatabaseSchemaError("schema mismatch"),
            ):
                blocked_api = self.client.get("/api/signal-bar")
        self.assertEqual(blocked_api.status_code, 503)
        self.assertEqual(blocked_api.get_json()["error"], "database schema is not ready")

    def test_signal_bar_contract_authorization_validation_and_order(self) -> None:
        _, student_token = self.add_user("student")
        self.assertEqual(self.client.get("/api/signal-bar").get_json(), {"items": [], "total": 0})
        self.assertEqual(self.client.post("/api/signal-bar", json={"title": "One", "link": "/one"}).status_code, 401)
        self.assertEqual(
            self.client.post("/api/signal-bar", json={"title": "One", "link": "/one"}, headers=self.auth(student_token)).status_code,
            403,
        )
        for link in ("", "//example.com", "javascript:alert(1)", "data:text/plain,bad"):
            response = self.client.post(
                "/api/signal-bar",
                json={"title": "Invalid", "link": link},
                headers=self.admin_auth(),
            )
            self.assertEqual(response.status_code, 400, link)
        self.assertEqual(
            self.client.post(
                "/api/signal-bar",
                json={"title": "x" * 161, "link": "/too-long"},
                headers=self.admin_auth(),
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.post(
                "/api/signal-bar",
                json={"title": "Long link", "link": f"https://example.com/{'x' * 2040}"},
                headers=self.admin_auth(),
            ).status_code,
            400,
        )

        first = self.client.post(
            "/api/signal-bar",
            json={"title": " First ", "link": " /first "},
            headers=self.admin_auth(),
        )
        second = self.client.post(
            "/api/signal-bar",
            json={"title": "Second", "link": "https://example.com/second"},
            headers=self.admin_auth(),
        )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(first.get_json()["position"], 1)
        self.assertEqual(second.get_json()["position"], 2)
        self.assertEqual(first.get_json()["title"], "First")
        items = self.client.get("/api/signal-bar").get_json()["items"]
        self.assertEqual([item["title"] for item in items], ["First", "Second"])

        item_id = first.get_json()["id"]
        updated = self.client.patch(
            f"/api/signal-bar/{item_id}",
            json={"title": "Updated"},
            headers=self.admin_auth(),
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.get_json()["link"], "/first")
        self.assertEqual(self.client.patch("/api/signal-bar/999", json={"title": "Missing"}, headers=self.admin_auth()).status_code, 404)

    def test_profile_and_user_mutations_require_owner_or_admin(self) -> None:
        owner_id, owner_token = self.add_user("owner", batch_year=2027)
        _, other_token = self.add_user("other")
        endpoint = "/api/profiles/owner"

        self.assertEqual(self.client.patch(endpoint, json={"bio": "No"}).status_code, 401)
        self.assertEqual(self.client.patch(endpoint, json={"bio": "No"}, headers=self.auth(other_token)).status_code, 403)
        saved = self.client.patch(
            endpoint,
            json={"bio": "Builder", "interests": ["Robotics", "Design"], "batchYear": 2028},
            headers=self.auth(owner_token),
        )
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.get_json()["batchYear"], 2028)
        self.assertEqual(saved.get_json()["interests"], ["Design", "Robotics"])
        self.assertIn("lastActiveAt", saved.get_json())
        self.assertTrue(saved.get_json()["isOnline"])

        self.assertEqual(self.client.patch(f"/api/users/{owner_id}", json={"name": "Changed"}).status_code, 401)
        self.assertEqual(
            self.client.patch(f"/api/users/{owner_id}", json={"name": "Changed"}, headers=self.auth(other_token)).status_code,
            403,
        )
        self.assertEqual(self.client.get("/api/profile/missing").status_code, 404)
        self.add_user("untouched")
        nullable = self.client.get("/api/profiles/untouched").get_json()
        self.assertIsNone(nullable["batchYear"])
        self.assertIsNone(nullable["lastActiveAt"])
        self.assertEqual(
            self.client.post("/api/profiles", json={"user": "owner", "bio": "No"}).status_code,
            401,
        )
        admin_created = self.client.post(
            "/api/profiles",
            json={"user": "owner", "bio": "Admin edit"},
            headers=self.admin_auth(),
        )
        self.assertEqual(admin_created.status_code, 201)

    def test_preferences_privacy_badges_clubs_and_overview(self) -> None:
        owner_id, owner_token = self.add_user("owner")
        other_id, other_token = self.add_user("other")
        with backend_app.SessionLocal() as session:
            club = backend_app.Club(name="Robotics", slug="robotics", status="Open")
            session.add(club)
            session.flush()
            session.add(backend_app.ClubMember(clubId=club.clubId, userId=owner_id, role="secretary"))
            session.add(backend_app.ClubFollower(clubId=club.clubId, userId=owner_id))
            session.add(backend_app.Badge(badgeId="builder", name="Builder", icon="construction"))
            session.add(backend_app.UserBadge(userId=owner_id, badgeId="builder"))
            session.commit()

        self.assertEqual(self.client.get(f"/api/users/{owner_id}/preferences").status_code, 401)
        self.assertEqual(self.client.get(f"/api/users/{owner_id}/preferences", headers=self.auth(other_token)).status_code, 403)
        preferences = self.client.patch(
            f"/api/users/{owner_id}/preferences",
            json={
                "notificationSources": {"student": True},
                "privacy": {"eventHistoryVisibility": "private"},
            },
            headers=self.auth(owner_token),
        )
        self.assertEqual(preferences.status_code, 200)
        self.assertTrue(preferences.get_json()["notificationSources"]["student"])
        self.assertEqual(preferences.get_json()["privacy"]["eventHistoryVisibility"], "private")

        clubs_public = self.client.get(f"/api/users/{owner_id}/clubs").get_json()
        self.assertEqual(clubs_public["memberOf"][0]["membership"]["title"], "Secretary")
        self.assertFalse(clubs_public["followingVisible"])
        clubs_owner = self.client.get(f"/api/users/{owner_id}/clubs", headers=self.auth(owner_token)).get_json()
        self.assertEqual(clubs_owner["following"][0]["slug"], "robotics")
        badges = self.client.get(f"/api/users/{owner_id}/badges").get_json()["items"]
        self.assertTrue(badges[0]["earned"])

        with patch.object(backend_schema, "friendship_rows", return_value=[]):
            public_overview = self.client.get(f"/api/users/{owner_id}/profile-overview").get_json()
            owner_overview = self.client.get(
                f"/api/users/{owner_id}/profile-overview",
                headers=self.auth(owner_token),
            ).get_json()
        self.assertNotIn("preferences", public_overview)
        self.assertIn("preferences", owner_overview)
        self.assertEqual(owner_overview["user"]["userId"], str(owner_id))

        private = self.client.patch(
            f"/api/users/{owner_id}/preferences",
            json={"privacy": {"profileVisibility": "private"}},
            headers=self.auth(owner_token),
        )
        self.assertEqual(private.status_code, 200)
        self.assertEqual(self.client.get(f"/api/profiles/{owner_id}", headers=self.auth(other_token)).status_code, 403)

    def test_badge_awards_are_idempotent(self) -> None:
        user_id, _ = self.add_user("owner")
        with backend_app.SessionLocal() as session:
            session.add(backend_app.Badge(badgeId="streak", name="Streak", icon="local_fire_department"))
            session.commit()
        with backend_app.app.test_request_context("/"):
            session = backend_app.SessionLocal()
            g.db = session
            try:
                first, first_created = backend_app.award_badge(user_id, "streak")
                second, second_created = backend_app.award_badge(user_id, "streak")
                session.commit()
                self.assertIsNotNone(first)
                self.assertEqual(first.userId, second.userId)
                self.assertTrue(first_created)
                self.assertFalse(second_created)
                self.assertEqual(session.query(backend_app.UserBadge).count(), 1)
            finally:
                session.close()

    def test_profile_overview_mutuals_are_relative_to_the_viewer(self) -> None:
        target_id, _ = self.add_user("target")
        viewer_id, viewer_token = self.add_user("viewer")
        mutual_id, _ = self.add_user("mutual")
        with backend_app.SessionLocal() as session:
            target = session.get(backend_app.User, target_id)
            viewer = session.get(backend_app.User, viewer_id)
            mutual = session.get(backend_app.User, mutual_id)

        def rows(user_id):
            relationship = {"friendshipId": f"friend-{user_id}", "createdAt": "2026-08-18T00:00:00+00:00"}
            if user_id == target_id:
                return [(mutual, relationship)]
            if user_id == viewer_id:
                return [(mutual, relationship)]
            return []

        with patch.object(backend_schema, "friendship_rows", side_effect=rows):
            overview = self.client.get(
                f"/api/users/{target_id}/profile-overview",
                headers=self.auth(viewer_token),
            ).get_json()
        self.assertEqual(overview["stats"]["friends"], 1)
        self.assertEqual(overview["stats"]["mutualFriends"], 1)
        self.assertEqual(overview["mutualFriendsPreview"][0]["userId"], str(mutual_id))

    def test_author_and_seller_filters_and_marketplace_trust(self) -> None:
        seller_id, seller_token = self.add_user("seller")
        buyer_id, _ = self.add_user("buyer")
        other_id, _ = self.add_user("other")
        with backend_app.SessionLocal() as session:
            session.add_all(
                [
                    backend_app.Post(authorId=seller_id, content="Older"),
                    backend_app.Post(authorId=other_id, content="Other"),
                    backend_app.Post(authorId=seller_id, content="Deleted", isDeleted=True),
                ]
            )
            item = backend_app.MarketplaceItem(sellerId=seller_id, title="Laptop", status="available")
            sold = backend_app.MarketplaceItem(sellerId=seller_id, title="Book", status="sold")
            removed = backend_app.MarketplaceItem(sellerId=seller_id, title="Hidden", status="removed")
            session.add_all([item, sold, removed])
            session.flush()
            trade = backend_app.MarketplaceTrade(
                itemId=sold.itemId,
                sellerId=seller_id,
                buyerId=buyer_id,
                status="completed",
                completedAt=datetime.now(timezone.utc),
            )
            session.add(trade)
            session.flush()
            session.add(
                backend_app.MarketplaceReview(
                    tradeId=trade.tradeId,
                    reviewerId=buyer_id,
                    revieweeId=seller_id,
                    rating=5,
                )
            )
            session.add(
                backend_app.MarketplaceReview(
                    tradeId=trade.tradeId,
                    reviewerId=other_id,
                    revieweeId=seller_id,
                    rating=1,
                )
            )
            session.commit()

        posts = self.client.get(f"/api/posts?authorId={seller_id}&limit=20").get_json()
        self.assertEqual([post["caption"] for post in posts], ["Older"])
        marketplace = self.client.get(f"/api/marketplace?sellerId={seller_id}&status=active&limit=20").get_json()
        self.assertEqual([item["title"] for item in marketplace["items"]], ["Laptop"])
        self.assertEqual(marketplace["items"][0]["sellerId"], str(seller_id))
        self.assertEqual(marketplace["sellerSummary"]["sellerRating"], 5.0)
        self.assertEqual(marketplace["sellerSummary"]["sellerRatingCount"], 1)
        self.assertEqual(marketplace["sellerSummary"]["successfulTrades"], 1)

        private = self.client.patch(
            f"/api/users/{seller_id}/preferences",
            json={"privacy": {"marketplaceActivityVisibility": "private"}},
            headers=self.auth(seller_token),
        )
        self.assertEqual(private.status_code, 200)
        self.assertEqual(self.client.get(f"/api/marketplace?sellerId={seller_id}").status_code, 403)

    def test_direct_conversations_are_authenticated_participant_aware_and_idempotent(self) -> None:
        first_id, first_token = self.add_user("first")
        second_id, second_token = self.add_user("second")
        _, outsider_token = self.add_user("outsider")
        endpoint = "/api/messages/conversations"
        payload = {"participantUserId": str(second_id), "threadType": "direct"}
        self.assertEqual(self.client.post(endpoint, json=payload).status_code, 401)
        created = self.client.post(endpoint, json=payload, headers=self.auth(first_token))
        repeated = self.client.post(endpoint, json=payload, headers=self.auth(first_token))
        reverse = self.client.post(
            endpoint,
            json={"participantUserId": str(first_id), "threadType": "direct"},
            headers=self.auth(second_token),
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(repeated.status_code, 200)
        self.assertEqual(created.get_json()["threadId"], repeated.get_json()["threadId"])
        self.assertEqual(created.get_json()["threadId"], reverse.get_json()["threadId"])
        thread_id = created.get_json()["threadId"]

        self.assertEqual(self.client.get(f"/api/messages/conversations/{thread_id}", headers=self.auth(outsider_token)).status_code, 404)
        message = self.client.post(
            "/api/messages/items",
            json={"threadId": thread_id, "content": "Hello"},
            headers=self.auth(second_token),
        )
        self.assertEqual(message.status_code, 201)
        outsider_message = self.client.post(
            "/api/messages/items",
            json={"threadId": thread_id, "content": "Leak"},
            headers=self.auth(outsider_token),
        )
        self.assertEqual(outsider_message.status_code, 400)
        with backend_app.SessionLocal() as session:
            self.assertEqual(session.query(backend_app.ChatThread).count(), 1)
            self.assertEqual(session.query(backend_app.ChatParticipant).count(), 2)
            self.assertEqual(session.query(backend_app.ChatMessage).count(), 1)

        deleted = self.client.delete(
            f"/api/messages/conversations/{thread_id}",
            headers=self.auth(first_token),
        )
        self.assertEqual(deleted.status_code, 204)
        with backend_app.SessionLocal() as session:
            self.assertEqual(session.query(backend_app.ChatThread).count(), 0)
            self.assertEqual(session.query(backend_app.ChatParticipant).count(), 0)
            self.assertEqual(session.query(backend_app.ChatMessage).count(), 0)

    def test_post_user_and_game_mutations_require_the_correct_actor(self) -> None:
        owner_id, owner_token = self.add_user("post-owner")
        _, other_token = self.add_user("post-other")

        self.assertEqual(
            self.client.post("/api/posts", json={"authorId": owner_id, "caption": "Blocked"}).status_code,
            401,
        )
        self.assertEqual(
            self.client.post(
                "/api/posts",
                json={"authorId": owner_id, "caption": "Impersonation"},
                headers=self.auth(other_token),
            ).status_code,
            403,
        )
        created = self.client.post(
            "/api/posts",
            json={"caption": "Owner post"},
            headers=self.auth(owner_token),
        )
        self.assertEqual(created.status_code, 201)
        post_id = created.get_json()["postId"]
        self.assertEqual(self.client.patch(f"/api/posts/{post_id}", json={"caption": "Blocked"}).status_code, 401)
        self.assertEqual(
            self.client.patch(
                f"/api/posts/{post_id}",
                json={"caption": "Blocked"},
                headers=self.auth(other_token),
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.patch(
                f"/api/posts/{post_id}",
                json={"caption": "Updated"},
                headers=self.auth(owner_token),
            ).status_code,
            200,
        )

        self.assertEqual(self.client.post("/api/games/items", json={"title": "Blocked"}).status_code, 401)
        self.assertEqual(
            self.client.post(
                "/api/games/items",
                json={"title": "Blocked"},
                headers=self.auth(owner_token),
            ).status_code,
            403,
        )
        game = self.client.post(
            "/api/games/items",
            json={"title": "Admin game"},
            headers=self.admin_auth(),
        )
        self.assertEqual(game.status_code, 201)
        game_id = game.get_json()["id"]
        self.assertEqual(
            self.client.patch(
                f"/api/games/items/{game_id}",
                json={"title": "Updated"},
                headers=self.admin_auth(),
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.delete(f"/api/games/items/{game_id}", headers=self.admin_auth()).status_code,
            204,
        )

    def test_user_delete_is_soft_and_preserves_related_rows(self) -> None:
        user_id, token = self.add_user("soft-delete")
        with backend_app.SessionLocal() as session:
            post = backend_app.Post(authorId=user_id, postType="normal", content="Keep me")
            session.add(post)
            session.commit()
            post_id = post.postId

        self.assertEqual(
            self.client.delete(f"/api/users/{user_id}", headers=self.auth(token)).status_code,
            204,
        )
        self.assertEqual(self.client.get(f"/api/users/{user_id}").status_code, 404)
        with backend_app.SessionLocal() as session:
            user = session.get(backend_app.User, user_id)
            self.assertIsNotNone(user)
            self.assertFalse(user.isActive)
            self.assertIsNotNone(session.get(backend_app.Post, post_id))

    def test_club_role_contract_accepts_supported_roles_and_rejects_invalid_or_duplicate_roles(self) -> None:
        role_labels = [
            "President",
            "Vice President",
            "Chairman",
            "Vice Chairman",
            "Secretary",
            "Treasurer",
            "Member",
            "Member",
        ]
        users = [self.add_user(f"member-{index}")[0] for index in range(len(role_labels))]
        with backend_app.SessionLocal() as session:
            club = backend_app.Club(name="Robotics", slug="robotics", status="Open")
            session.add(club)
            session.commit()

        member_payloads = []
        for user_id, role in zip(users, role_labels):
            response = self.client.post(
                "/api/clubs/robotics/members",
                json={"userId": user_id, "title": role},
                headers=self.admin_auth(),
            )
            self.assertEqual(response.status_code, 201, role)
            member_payloads.append(response.get_json())

        invalid = self.client.patch(
            f"/api/clubs/robotics/members/{member_payloads[-1]['id']}",
            json={"title": "Supreme Leader"},
            headers=self.admin_auth(),
        )
        self.assertEqual(invalid.status_code, 400)
        duplicate = self.client.patch(
            f"/api/clubs/robotics/members/{member_payloads[-1]['id']}",
            json={"title": "President"},
            headers=self.admin_auth(),
        )
        self.assertEqual(duplicate.status_code, 409)

    def test_postgresql_ddl_quotes_mixed_case_constraint_columns(self) -> None:
        preference_ddl = str(
            CreateTable(backend_schema.UserPreference.__table__).compile(dialect=postgresql.dialect())
        )
        trade_ddl = str(
            CreateTable(backend_schema.MarketplaceTrade.__table__).compile(dialect=postgresql.dialect())
        )
        review_ddl = str(
            CreateTable(backend_schema.MarketplaceReview.__table__).compile(dialect=postgresql.dialect())
        )

        for column_name in (
            "profileVisibility",
            "eventHistoryVisibility",
            "marketplaceActivityVisibility",
        ):
            self.assertIn(f'CHECK ("{column_name}" IN ', preference_ddl)
        self.assertIn('CHECK ("sellerId" <> "buyerId")', trade_ddl)
        self.assertIn('CHECK ("reviewerId" <> "revieweeId")', review_ddl)
        self.assertIn("TIMESTAMP WITH TIME ZONE", preference_ddl)
        self.assertIn('FOREIGN KEY("userId") REFERENCES users ("userId") ON DELETE CASCADE', preference_ddl)

        for table in backend_schema.Base.metadata.sorted_tables:
            for column in table.columns:
                if isinstance(column.type, backend_schema.DateTime):
                    self.assertTrue(column.type.timezone, f"{table.name}.{column.name} must be timezone-aware")


if __name__ == "__main__":
    unittest.main()
