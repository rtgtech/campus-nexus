from __future__ import annotations

import os
import sys
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET"] = "test-secret-that-is-at-least-32-characters"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import schema_app as s
from fake_graph import FakeGraph
from feed_ranker import rank_personalized_posts


class PersonalizedFeedTest(unittest.TestCase):
    def setUp(self):
        s.Base.metadata.drop_all(s.engine)
        s.Base.metadata.create_all(s.engine)
        s._database_initialized = True
        self.graph = FakeGraph()
        self.graph_patch = self.graph.patch_backend(s)
        self.graph_patch.start()
        self.env_patch = patch.dict(os.environ, {"FEED_RANKER": "v2", "FEED_V2_PERCENT": "100"})
        self.env_patch.start()
        self.client = s.app.test_client()
        self.now = s.utcnow()
        with s.SessionLocal() as db:
            users = [s.User(fullName=name, username=name, email=name + "@example.edu", passwordHash="unused",
                            dateOfBirth=date(2000, 1, 1), semester=2, department="CS") for name in ("viewer", "friend", "other")]
            db.add_all(users)
            db.flush()
            self.viewer, self.friend, self.other = [u.userId for u in users]
            self.auth = {"Authorization": "Bearer " + s.create_auth_token(users[0])}
            self.other_auth = {"Authorization": "Bearer " + s.create_auth_token(users[2])}
            club = s.Club(name="Studio", slug="studio", status="Open")
            db.add(club)
            db.flush()
            self.club = club.clubId
            db.commit()

    def tearDown(self):
        self.graph_patch.stop()
        self.env_patch.stop()

    def post(self, author=None, hours=0, **kwargs):
        with s.SessionLocal() as db:
            post = s.Post(authorId=author or self.other, content="Campus art #design", createdAt=self.now - timedelta(hours=hours), **kwargs)
            db.add(post)
            db.commit()
            return post.postId

    def feed(self, query="", auth=None):
        response = self.client.get("/api/feed" + query, headers=auth or self.auth)
        self.assertEqual(response.status_code, 200, response.get_json())
        return response.get_json()

    def event(self, snapshot, post, kind="impression", **kwargs):
        return self.client.post("/api/feed/events", headers=self.auth,
            json={"snapshotId": snapshot, "events": [{"postId": str(post), "kind": kind, **kwargs}]})

    def test_fresh_friend_beats_old_popular_post(self):
        fresh = self.post(self.friend)
        old = self.post(hours=24 * 20, likeCount=100000)
        self.graph.create_friendship(self.viewer, self.friend)
        self.graph.pagerank[f"user:{self.other}"] = 1
        cards = self.feed()["feedCards"]
        self.assertEqual(cards[0]["postId"], str(fresh))
        self.assertEqual(next(p for p in cards if p["postId"] == str(old))["rankingSignals"]["engagement"], 0)

    def test_club_follow_is_immediate_without_graph_refresh(self):
        post = self.post(clubId=self.club, postType="club_post")
        self.assertEqual(self.feed()["feedCards"][0]["rankingSignals"]["social"], 0)
        self.client.post("/api/clubs/studio/follow", headers=self.auth)
        card = self.feed()["feedCards"][0]
        self.assertEqual(card["postId"], str(post))
        self.assertEqual(card["rankingSignals"]["social"], 1)
        self.assertNotIn((self.viewer, self.club), self.graph.related)

    def test_pagination_snapshot_survives_new_posts_and_likes(self):
        originals = {str(self.post(hours=i)) for i in range(6)}
        first = self.feed("?limit=2")
        new_id = self.post()
        self.client.post("/api/posts/" + str(new_id) + "/like", headers=self.auth)
        ids = [p["postId"] for p in first["feedCards"]]
        cursor = first["nextCursor"]
        while cursor:
            page = self.feed("?limit=2&cursor=" + cursor)
            ids.extend(p["postId"] for p in page["feedCards"])
            cursor = page["nextCursor"]
        self.assertEqual(set(ids), originals)
        self.assertEqual(len(ids), len(originals))

    def test_cursor_is_owned_and_mode_bound(self):
        self.post()
        self.post()
        cursor = self.feed("?limit=1")["nextCursor"]
        for query, headers in (("?cursor=" + cursor, self.other_auth), ("?mode=latest&cursor=" + cursor, self.auth)):
            self.assertEqual(self.client.get("/api/feed" + query, headers=headers).status_code, 403)

    def test_expired_cursor_returns_refresh_instruction(self):
        self.post()
        self.post()
        feed = self.feed("?limit=1")
        with s.SessionLocal() as db:
            db.get(s.FeedSnapshot, feed["snapshotId"]).expiresAt = self.now - timedelta(seconds=1)
            db.commit()
        response = self.client.get("/api/feed?cursor=" + feed["nextCursor"], headers=self.auth)
        self.assertEqual(response.status_code, 410)
        self.assertEqual(response.get_json()["code"], "feed_expired")

    def test_deletion_and_new_mute_filter_existing_snapshot(self):
        ids = [self.post(hours=i) for i in range(4)]
        first = self.feed("?mode=latest&limit=1")
        with s.SessionLocal() as db:
            db.get(s.Post, ids[1]).isDeleted = True
            db.commit()
        self.client.put("/api/feed/exclusions", headers=self.auth, json={"target": f"post:{ids[2]}"})
        page = self.feed("?mode=latest&cursor=" + first["nextCursor"])
        self.assertEqual([p["postId"] for p in page["feedCards"]], [str(ids[3])])

    def test_event_deduplication_and_learning(self):
        post = self.post()
        snapshot = self.feed()["snapshotId"]
        self.assertEqual(self.event(snapshot, post, "dwell", duration=10).get_json()["accepted"], 1)
        self.assertEqual(self.event(snapshot, post, "dwell", duration=30).get_json()["accepted"], 0)
        with s.SessionLocal() as db:
            rows = db.query(s.FeedAffinity).all()
            self.assertEqual({row.weight for row in rows}, {2})
        self.assertGreater(self.feed()["feedCards"][0]["rankingSignals"]["affinity"], 0)

    def test_event_validation_is_atomic(self):
        post = self.post()
        feed = self.feed()
        for duration in (-1, 9, 31, True, "10"):
            self.assertEqual(self.event(feed["snapshotId"], post, "dwell", duration=duration).status_code, 400)
        response = self.client.post("/api/feed/events", headers=self.auth, json={"snapshotId": feed["snapshotId"],
            "events": [{"postId": post, "kind": "open"}, {"postId": post, "kind": "save"}]})
        self.assertEqual(response.status_code, 400)
        with s.SessionLocal() as db:
            self.assertEqual(db.query(s.FeedEvent).count(), 0)

    def test_events_cannot_spoof_user_or_unserved_post(self):
        self.post()
        snapshot = self.feed()["snapshotId"]
        unserved = self.post()
        self.assertEqual(self.event(snapshot, unserved, "open").status_code, 400)
        self.assertEqual(self.client.post("/api/feed/events", json={"userId": self.viewer, "events": []}).status_code, 401)
        self.assertFalse(self.client.get(f"/api/feed?userId={self.viewer}").get_json()["personalizationEnabled"])

    def test_disabling_stops_learning_and_invalidates_snapshot(self):
        post = self.post()
        snapshot = self.feed()["snapshotId"]
        self.event(snapshot, post, "open")
        response = self.client.patch("/api/feed/preferences", headers=self.auth, json={"enabled": False})
        self.assertFalse(response.get_json()["enabled"])
        self.assertEqual(self.event(snapshot, post, "dwell", duration=10).get_json()["accepted"], 0)
        card = self.feed()["feedCards"][0]
        self.assertEqual(card["rankingSignals"]["affinity"], 0)

    def test_history_reset_preserves_likes_saves_and_mutes(self):
        post = self.post()
        self.client.post(f"/api/posts/{post}/like", headers=self.auth)
        self.client.post(f"/api/posts/{post}/save", headers=self.auth)
        self.client.put("/api/feed/exclusions", headers=self.auth, json={"target": f"post:{post}"})
        self.assertEqual(self.client.delete("/api/feed/history", headers=self.auth).status_code, 204)
        with s.SessionLocal() as db:
            for model in (s.FeedEvent, s.FeedAffinity, s.FeedSnapshot):
                self.assertEqual(db.query(model).count(), 0)
            for model in (s.PostLike, s.PostBookmark, s.FeedExclusion):
                self.assertEqual(db.query(model).count(), 1)

    def test_engagement_uses_unique_non_author_actions(self):
        post_id = self.post()
        for _ in range(3):
            self.client.post(f"/api/posts/{post_id}/comments", headers=self.auth, json={"content": "Nice"})
        self.client.post(f"/api/posts/{post_id}/like", headers=self.auth)
        self.client.post(f"/api/posts/{post_id}/like", headers=self.other_auth)
        self.client.post(f"/api/posts/{post_id}/save", headers=self.auth)
        import math
        self.assertAlmostEqual(self.feed()["feedCards"][0]["rankingSignals"]["engagement"], math.log1p(6) / math.log1p(100), places=5)

    def test_privacy_and_inactive_accounts(self):
        self.post(visibility="private")
        friend_post = self.post(self.friend, visibility="friends")
        self.assertFalse(self.feed()["feedCards"])
        self.graph.create_friendship(self.viewer, self.friend)
        self.assertEqual([p["postId"] for p in self.feed()["feedCards"]], [str(friend_post)])
        with s.SessionLocal() as db:
            db.add(s.UserPreference(userId=self.friend, profileVisibility="private"))
            db.commit()
        self.assertFalse(self.feed()["feedCards"])

    def test_graph_failure_keeps_sql_club_relevance(self):
        self.post(clubId=self.club, postType="club_post")
        self.client.post("/api/clubs/studio/follow", headers=self.auth)
        with patch.object(s, "graph_friend_rows", side_effect=s.GraphUnavailable("offline")), patch.object(s, "feed_signals", side_effect=s.GraphUnavailable("offline")):
            signals = self.feed()["feedCards"][0]["rankingSignals"]
        self.assertEqual(signals["social"], 1)
        self.assertEqual(signals["pagerank"], 0)

    def test_latest_is_chronological_and_ignores_seen_penalty(self):
        newer = self.post(hours=0)
        self.post(self.friend, hours=24)
        self.graph.create_friendship(self.viewer, self.friend)
        feed = self.feed("?mode=latest")
        self.event(feed["snapshotId"], newer)
        again = self.feed("?mode=latest")
        self.assertEqual(again["feedCards"][0]["postId"], str(newer))
        self.assertEqual(feed["feedCards"][0]["feedScore"], again["feedCards"][0]["feedScore"])

    def test_request_validation(self):
        for query in ("?limit=0", "?limit=51", "?limit=bad", "?cursor=bad", "?mode=bad"):
            self.assertEqual(self.client.get("/api/feed" + query, headers=self.auth).status_code, 400)
        self.assertEqual(self.client.put("/api/feed/exclusions", headers=self.auth, json={"target": "author:not-an-id"}).status_code, 400)
        for target in ("post:" + str(2**63), "author:" + "9" * 5000):
            self.assertEqual(self.client.put("/api/feed/exclusions", headers=self.auth, json={"target": target}).status_code, 400)

    def test_exclusion_labels_respect_current_post_visibility(self):
        post = self.post()
        target = f"post:{post}"
        self.client.put("/api/feed/exclusions", headers=self.auth, json={"target": target})
        preferences = self.client.get("/api/feed/preferences", headers=self.auth).get_json()
        self.assertEqual(preferences["exclusionLabels"][target], "Campus art #design")
        with s.SessionLocal() as db:
            db.get(s.Post, post).visibility = "private"
            db.commit()
        preferences = self.client.get("/api/feed/preferences", headers=self.auth).get_json()
        self.assertIn(target, preferences["exclusions"])
        self.assertNotIn(target, preferences["exclusionLabels"])

    def test_rollout_and_shadow_modes(self):
        self.post()
        for mode in ("legacy", "shadow"):
            with patch.dict(os.environ, {"FEED_RANKER": mode}):
                self.assertEqual(self.feed()["rankingVersion"], "legacy")
        with patch.dict(os.environ, {"FEED_V2_PERCENT": "0"}):
            self.assertEqual(self.feed()["rankingVersion"], "legacy")

    def test_cleanup_retention(self):
        post = self.post()
        with s.SessionLocal() as db:
            db.add(s.FeedEvent(userId=self.viewer, postId=post, kind="open", day="2020-01-01", createdAt=self.now - timedelta(days=31)))
            db.add(s.FeedAffinity(userId=self.viewer, target=f"author:{self.other}", day="2020-01-01", weight=5))
            db.commit()
        result = s.app.test_cli_runner().invoke(args=["cleanup-feed"])
        self.assertEqual(result.exit_code, 0, result.output)
        with s.SessionLocal() as db:
            self.assertEqual(db.query(s.FeedEvent).count(), 0)
            self.assertEqual(db.query(s.FeedAffinity).count(), 0)


class ScoringTest(unittest.TestCase):
    def test_invalid_values_remain_finite(self):
        cards = rank_personalized_posts([dict(postId="1", createdAt="invalid", engagement=float("nan"), affinity=float("inf"), relationship=-1)], now_ts=1000)
        self.assertEqual(cards[0]["feedScore"], 0)

    def test_source_diversity_and_exploration(self):
        posts = [dict(postId=str(i), source="author:" + str(i // 3), relationship=float(i < 12),
                      createdAt="2026-09-13T12:00:00Z") for i in range(30)]
        cards = rank_personalized_posts(posts, now_ts=1789300800)
        self.assertFalse(cards[4]["relationship"])
        sources = [card["source"] for card in cards[:10]]
        self.assertTrue(all(left != right for left, right in zip(sources, sources[1:])))
        self.assertLessEqual(max(sources.count(source) for source in sources), 2)

    def test_engagement_saturates_and_seen_halves_score(self):
        base = dict(postId="1", createdAt="2026-09-13T12:00:00Z", engagement=100)
        cards = rank_personalized_posts([base, {**base, "postId": "2", "engagement": 1000000}, {**base, "postId": "3", "seen": True}], now_ts=1789300800)
        scores = {p["postId"]: p["feedScore"] for p in cards}
        self.assertEqual(scores["1"], scores["2"])
        self.assertAlmostEqual(scores["3"], scores["1"] / 2, places=5)


if __name__ == "__main__":
    unittest.main()
