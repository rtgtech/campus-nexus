from __future__ import annotations

import json
import os
import re
import sys
import unittest
from datetime import date, datetime, timezone
from pathlib import Path
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET"] = "test-secret-that-is-at-least-32-characters"
os.environ["ALLOWED_EMAIL_DOMAINS"] = "example.edu,@campus.example"

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app as backend_app  # noqa: E402
import schema_app as backend_schema  # noqa: E402


class FrontendResponseContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.contract = json.loads(
            (REPOSITORY_ROOT / "lib" / "api-response-fields.json").read_text(encoding="utf-8")
        )

    def setUp(self) -> None:
        backend_app.Base.metadata.drop_all(backend_app.engine)
        backend_app.Base.metadata.create_all(backend_app.engine)
        backend_app._database_initialized = True
        self.client = backend_app.app.test_client()

        with backend_app.SessionLocal() as session:
            first = backend_app.User(
                fullName="First Student",
                username="first-student",
                email="first-student@example.edu",
                passwordHash="unused",
                dateOfBirth=date(2000, 1, 1),
                department="CS",
                semester=2,
                batchYear=2027,
                lastActiveAt=datetime.now(timezone.utc),
            )
            second = backend_app.User(
                fullName="Second Student",
                username="second-student",
                email="second-student@example.edu",
                passwordHash="unused",
                dateOfBirth=date(2001, 2, 2),
                department="ECE",
                semester=3,
            )
            session.add_all([first, second])
            session.flush()

            club = backend_app.Club(name="Contract Club", slug="contract-club", description="Contract")
            session.add(club)
            session.flush()
            member = backend_app.ClubMember(clubId=club.clubId, userId=first.userId, role="member")
            post = backend_app.Post(authorId=first.userId, clubId=club.clubId, content="Contract post #api")
            game = backend_app.Game(name="Contract Game", description="Contract")
            listing = backend_app.MarketplaceItem(
                sellerId=first.userId,
                title="Contract Listing",
                description="Contract",
                category="Books",
                price=25,
            )
            session.add_all([member, post, game, listing])
            session.flush()

            thread = backend_app.ChatThread(
                threadType="direct",
                directKey=backend_app.direct_conversation_key(first.userId, second.userId),
            )
            session.add(thread)
            session.flush()
            session.add_all(
                [
                    backend_app.ChatParticipant(threadId=thread.threadId, userId=first.userId),
                    backend_app.ChatParticipant(threadId=thread.threadId, userId=second.userId),
                    backend_app.ChatMessage(threadId=thread.threadId, senderId=first.userId, content="Contract message"),
                    backend_app.UserPoint(userId=first.userId, gameId=game.gameId, points=100, reason="test"),
                    backend_app.SignalBarItem(title="Contract signal", link="/contract", position=1),
                    backend_app.CampusEvent(
                        title="Contract event",
                        link="/events/contract",
                        eventType="Workshop",
                        eventDate=date(2026, 8, 30),
                        place="Lab 1",
                    ),
                    backend_app.Badge(badgeId="contract", name="Contract Badge", icon="verified"),
                    backend_app.Notification(
                        userId=first.userId,
                        actorId=second.userId,
                        type="post_like",
                        targetType="post",
                        targetId=str(post.postId),
                        message="Second Student liked your post.",
                    ),
                ]
            )
            session.flush()
            session.add(backend_app.UserBadge(userId=first.userId, badgeId="contract"))
            session.commit()

            self.first_id = first.userId
            self.second_id = second.userId
            self.club_id = club.clubId
            self.member_id = member.clubMemberId
            self.post_id = post.postId
            self.game_id = game.gameId
            self.listing_id = listing.itemId
            self.thread_id = thread.threadId
            self.first_token = backend_app.create_auth_token(first)

    def auth(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.first_token}"}

    def assert_entity(self, entity_name: str, payload: dict) -> None:
        contract = self.contract[entity_name]
        required = set(contract["required"])
        known = required | set(contract["optional"])
        actual = set(payload)
        self.assertFalse(required - actual, f"{entity_name} missing {sorted(required - actual)}")
        self.assertFalse(actual - known, f"{entity_name} has unknown fields {sorted(actual - known)}")

    def assert_root(self, payload: dict, required: set[str], optional: set[str] | None = None) -> None:
        optional = optional or set()
        self.assertEqual(set(payload), required | (set(payload) & optional))
        self.assertFalse(required - set(payload))

    @staticmethod
    def frontend_type_fields(type_name: str, relative_path: str = "lib/app-data.ts") -> set[str]:
        source = (REPOSITORY_ROOT / relative_path).read_text(encoding="utf-8")
        match = re.search(rf"export type {re.escape(type_name)} = \{{\r?\n", source)
        if match is None:
            raise AssertionError(f"frontend type {type_name} is missing")
        fields: set[str] = set()
        depth = 1
        for line in source[match.end():].splitlines():
            if depth == 1:
                field = re.match(r"\s{2}([A-Za-z][A-Za-z0-9]*)\??:", line)
                if field is not None:
                    fields.add(field.group(1))
            depth += line.count("{") - line.count("}")
            if depth == 0:
                break
        return fields

    def test_every_manifest_field_is_declared_by_the_frontend_types(self) -> None:
        for entity_name, contract in self.contract.items():
            with self.subTest(entity=entity_name):
                api_fields = set(contract["required"]) | set(contract["optional"])
                frontend_fields = self.frontend_type_fields(entity_name)
                self.assertFalse(
                    api_fields - frontend_fields,
                    f"{entity_name} is not receiving fields {sorted(api_fields - frontend_fields)}",
                )

        campus_user_fields = set(self.contract["CampusUser"]["required"]) | set(
            self.contract["CampusUser"]["optional"]
        )
        auth_user_fields = self.frontend_type_fields("CampusAuthUser", "lib/auth-client.ts")
        self.assertFalse(
            campus_user_fields - auth_user_fields,
            f"CampusAuthUser is not receiving fields {sorted(campus_user_fields - auth_user_fields)}",
        )

        root_contracts = {
            "FeedData": {"feedCards", "trending", "suggestedPeople"},
            "SignalBarData": {"items", "total"},
            "CampusEventsData": {"items", "total"},
            "ClubsData": {"spotlightClubs", "clubCards", "stats"},
            "ClubDetailData": {"club", "members", "posts", "followers", "postsCount"},
            "GamesData": {"gameCards", "topRated", "recentActivity"},
            "LeaderboardData": {"entries", "totalPlayers", "generatedAt"},
            "MarketplaceData": {"items", "sellerSummary"},
            "MessagesData": {"conversations", "messages"},
            "NotificationsData": {"items", "total", "unreadCount"},
            "SearchData": {"query", "users", "clubs", "posts", "products"},
            "ProfileOverviewData": {
                "user",
                "profile",
                "stats",
                "friendsPreview",
                "mutualFriendsPreview",
                "badges",
                "clubs",
                "marketplace",
                "preferences",
            },
        }
        for type_name, api_fields in root_contracts.items():
            with self.subTest(root=type_name):
                frontend_fields = self.frontend_type_fields(type_name)
                self.assertFalse(
                    api_fields - frontend_fields,
                    f"{type_name} is not receiving fields {sorted(api_fields - frontend_fields)}",
                )

    def test_every_frontend_entity_contract_matches_live_api_payloads(self) -> None:
        user = self.client.get(f"/api/users/{self.first_id}").get_json()
        self.assert_entity("CampusUser", user)

        post = self.client.get(f"/api/posts/{self.post_id}").get_json()
        self.assert_entity("FeedCard", post)

        signal = self.client.get("/api/signal-bar").get_json()["items"][0]
        self.assert_entity("SignalBarItem", signal)
        event = self.client.get("/api/events").get_json()["items"][0]
        self.assert_entity("CampusEvent", event)

        club = self.client.get(f"/api/clubs/items/{self.club_id}").get_json()
        self.assert_entity("ClubCard", club)
        detail = self.client.get("/api/clubs/contract-club").get_json()
        self.assert_entity("ClubCard", detail["club"])
        self.assert_entity("ClubMember", detail["members"][0])
        self.assert_entity("CampusUser", detail["members"][0]["user"])

        game = self.client.get(f"/api/games/items/{self.game_id}").get_json()
        self.assert_entity("GameCard", game)
        leaderboard = self.client.get("/api/games/leaderboards").get_json()["entries"][0]
        self.assert_entity("LeaderboardEntry", leaderboard)

        listing = self.client.get(f"/api/marketplace/items/{self.listing_id}").get_json()
        self.assert_entity("MarketplaceItem", listing)
        market = self.client.get(f"/api/marketplace?sellerId={self.first_id}").get_json()
        self.assert_entity("MarketplaceSellerSummary", market["sellerSummary"])

        messages = self.client.get("/api/messages", headers=self.auth()).get_json()
        self.assert_entity("Conversation", messages["conversations"][0])
        self.assert_entity("CampusUser", messages["conversations"][0]["participants"][0])
        self.assert_entity("Message", messages["messages"][0])

        profile = self.client.get(f"/api/profiles/{self.first_id}").get_json()
        self.assert_entity("ProfileData", profile)
        badges = self.client.get(f"/api/users/{self.first_id}/badges").get_json()["items"]
        self.assert_entity("ProfileBadge", badges[0])

        notification = self.client.get("/api/notifications", headers=self.auth()).get_json()["items"][0]
        self.assert_entity("NotificationItem", notification)

        search = self.client.get("/api/search?q=Contract&types=club,post,product").get_json()
        self.assert_entity("SearchItem", search["clubs"][0])
        self.assert_entity("SearchItem", search["posts"][0])
        self.assert_entity("SearchItem", search["products"][0])
        user_search = self.client.get("/api/search?q=First&types=user").get_json()
        self.assert_entity("SearchItem", user_search["users"][0])

        follow = self.client.get("/api/clubs/contract-club/follow", headers=self.auth()).get_json()
        self.assert_entity("ClubFollowStatus", follow)
        self.assert_entity(
            "FriendshipRecord",
            {
                "id": "1:2",
                "friendshipId": "1:2",
                "userAId": "1",
                "userBId": "2",
                "weight": 1.0,
                "createdAt": "2026-08-23T00:00:00+00:00",
            },
        )

        with backend_app.SessionLocal() as session:
            friend = session.get(backend_app.User, self.second_id)
            friend_payload = backend_app.friendship_user_payload(
                friend,
                {"friendshipId": "graph-1", "createdAt": "2026-08-23T00:00:00+00:00"},
            )
        self.assert_entity("ProfileFriend", friend_payload)
        self.assert_entity("FriendshipUser", friend_payload)

    def test_aggregate_endpoint_roots_have_no_missed_or_unknown_fields(self) -> None:
        with patch.object(
            backend_schema,
            "feed_signals",
            side_effect=backend_schema.GraphUnavailable("offline"),
        ):
            feed = self.client.get("/api/feed").get_json()
        self.assert_root(feed, {"feedCards", "trending", "suggestedPeople"})
        self.assertEqual(len(feed["feedCards"]), 1)
        self.assert_entity("FeedCard", feed["feedCards"][0])
        self.assertIsInstance(feed["feedCards"][0]["feedScore"], float)
        self.assertEqual(
            set(feed["feedCards"][0]["rankingSignals"]),
            {"pagerank", "engagement", "recency", "social"},
        )
        self.assert_root(self.client.get("/api/signal-bar").get_json(), {"items", "total"})
        self.assert_root(self.client.get("/api/events").get_json(), {"items", "total"})
        self.assert_root(self.client.get("/api/clubs").get_json(), {"spotlightClubs", "clubCards", "stats"})
        self.assert_root(
            self.client.get("/api/clubs/contract-club").get_json(),
            {"club", "members", "posts", "followers", "postsCount"},
        )
        self.assert_root(self.client.get("/api/games").get_json(), {"gameCards", "topRated", "recentActivity"})
        self.assert_root(
            self.client.get("/api/games/leaderboards").get_json(),
            {"entries", "totalPlayers", "generatedAt"},
        )
        self.assert_root(
            self.client.get(f"/api/marketplace?sellerId={self.first_id}").get_json(),
            {"items", "sellerSummary"},
        )
        self.assert_root(
            self.client.get("/api/messages", headers=self.auth()).get_json(),
            {"conversations", "messages"},
        )
        self.assert_root(
            self.client.get("/api/saved-posts", headers=self.auth()).get_json(),
            {"items", "total"},
        )
        self.assert_root(
            self.client.get("/api/notifications", headers=self.auth()).get_json(),
            {"items", "total", "unreadCount"},
        )
        self.assert_root(
            self.client.get("/api/search?q=Contract").get_json(),
            {"query", "users", "clubs", "posts", "products"},
        )

        liked = self.client.post(f"/api/posts/{self.post_id}/like", headers=self.auth()).get_json()
        self.assert_root(liked, {"post", "postId", "likes", "liked", "likedByCurrentUser"})
        self.assert_entity("FeedCard", liked["post"])
        saved = self.client.post(f"/api/posts/{self.post_id}/save", headers=self.auth()).get_json()
        self.assert_root(
            saved,
            {"post", "postId", "bookmarks", "saved", "savedByCurrentUser", "bookmarkedByCurrentUser"},
        )
        self.assert_entity("FeedCard", saved["post"])
        xp = self.client.post("/api/games/xp", json={"xp": 50}, headers=self.auth()).get_json()
        self.assert_root(xp, {"userId", "awardedXp", "totalXp"})

        with patch.object(backend_schema, "friendship_rows", return_value=[]):
            overview = self.client.get(
                f"/api/users/{self.first_id}/profile-overview",
                headers=self.auth(),
            ).get_json()
        self.assert_root(
            overview,
            {
                "user",
                "profile",
                "stats",
                "friendsPreview",
                "mutualFriendsPreview",
                "badges",
                "clubs",
                "marketplace",
                "preferences",
            },
        )
        self.assert_root(overview["stats"], {"friends", "mutualFriends", "rank", "totalXp"})
        self.assert_root(overview["clubs"], {"memberOf", "following", "followingVisible"})
        self.assert_root(
            overview["marketplace"],
            {"activeListings", "sellerId", "sellerRating", "sellerRatingCount", "successfulTrades"},
        )


if __name__ == "__main__":
    unittest.main()
