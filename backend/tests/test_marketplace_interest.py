import unittest
import test_social_interactions as social
import schema_app as s


class MarketplaceInterestTest(unittest.TestCase):
    auth_for = social.SocialInteractionsTest.auth_for

    def setUp(self):
        social.SocialInteractionsTest.setUp(self)
        with s.SessionLocal() as db:
            item = s.MarketplaceItem(sellerId=self.friend, title="Calculus book", status="available")
            db.add(item)
            db.commit()
            self.item_id = item.itemId
        self.endpoint = f"/api/marketplace/items/{self.item_id}/interest"

    def test_interest_persists_once_and_notifies_only_owner(self):
        self.assertEqual(self.client.post(self.endpoint, headers=self.auth).status_code, 201)
        self.assertEqual(self.client.post(self.endpoint, headers=self.auth).status_code, 200)
        self.assertTrue(s.app.test_client().get(self.endpoint, headers=self.auth).get_json()["interested"])
        inbox = self.client.get("/api/marketplace/interests", headers=self.auth_for("friend")).get_json()["items"]
        self.assertEqual(len(inbox), 1)
        self.assertEqual(inbox[0]["userId"], str(self.viewer))
        self.assertTrue(inbox[0]["notificationId"])
        self.assertTrue(inbox[0]["canMessage"])
        self.assertEqual(self.client.get("/api/marketplace/interests", headers=self.auth).get_json()["items"], [])
        notifications = self.client.get("/api/notifications", headers=self.auth_for("friend")).get_json()["items"]
        self.assertEqual(len(notifications), 1)
        self.assertEqual(notifications[0]["type"], "marketplace_interest")
        self.assertEqual(notifications[0]["href"], f"/{self.friend}#marketplace")
        self.assertIn("Calculus book", notifications[0]["body"])
        with s.SessionLocal() as db:
            self.assertEqual(db.query(s.MarketplaceInterest).count(), 1)
        message = self.client.post("/api/messages/conversations", headers=self.auth_for("friend"), json={"participantUserId": self.viewer})
        self.assertEqual(message.status_code, 201)

        dismissed = self.client.delete(
            f"/api/notifications/{inbox[0]['notificationId']}",
            headers=self.auth_for("friend"),
        )
        self.assertEqual(dismissed.status_code, 204)
        self.assertEqual(self.client.get("/api/marketplace/interests", headers=self.auth_for("friend")).get_json()["items"], [])
        self.assertTrue(self.client.get(self.endpoint, headers=self.auth).get_json()["interested"])
        with s.SessionLocal() as db:
            self.assertEqual(db.query(s.MarketplaceInterest).count(), 1)

    def test_interest_requires_auth_available_listing_and_no_block(self):
        self.assertEqual(self.client.post(self.endpoint).status_code, 401)
        self.assertEqual(self.client.get("/api/marketplace/interests").status_code, 401)
        self.assertEqual(self.client.post(self.endpoint, headers=self.auth_for("friend")).status_code, 400)
        with s.SessionLocal() as db:
            db.get(s.MarketplaceItem, self.item_id).status = "sold"
            db.commit()
        self.assertEqual(self.client.post(self.endpoint, headers=self.auth).status_code, 409)
        with s.SessionLocal() as db:
            db.get(s.MarketplaceItem, self.item_id).status = "available"
            db.add(s.UserBlock(blockerId=self.friend, blockedId=self.viewer))
            db.commit()
        self.assertEqual(self.client.post(self.endpoint, headers=self.auth).status_code, 403)
        with s.SessionLocal() as db:
            self.assertEqual(db.query(s.MarketplaceInterest).count(), 0)
            self.assertEqual(db.query(s.Notification).count(), 0)


if __name__ == "__main__":
    unittest.main()
