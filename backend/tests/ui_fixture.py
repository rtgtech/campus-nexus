"""Isolated, synthetic browser-test API. Never opens the developer's database."""
import os
import sys
from datetime import date, timedelta
from pathlib import Path

os.environ.update(DATABASE_URL="sqlite:///:memory:", JWT_SECRET="browser-fixture-secret-at-least-32-characters",
                  NEO4J_URI="", CORS_ORIGIN="http://127.0.0.1:3100", FEED_RANKER="v2", FEED_V2_PERCENT="100")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import schema_app as s
from fake_graph import FakeGraph
from flask import jsonify

graph = FakeGraph()
graph_patch = graph.patch_backend(s)
graph_patch.start()
s.Base.metadata.create_all(s.engine)
s._database_initialized = True
now = s.utcnow()

with s.SessionLocal() as db:
    users = [s.User(fullName=name, username=username, email=username + "@example.edu", passwordHash="fixture-only",
                    dateOfBirth=date(2001, 1, 1), semester=4, department="CS")
             for name, username in [("Alex Morgan", "alex"), ("Maya Chen", "maya"), ("Sam Taylor", "sam")]]
    db.add_all(users)
    db.flush()
    club = s.Club(name="Design Society", slug="design-society", description="A place to sketch, experiment, and make things together.", status="Open")
    db.add(club)
    db.flush()
    db.add(s.ClubFollower(clubId=club.clubId, userId=users[0].userId))
    db.add(s.ClubMember(clubId=club.clubId, userId=users[1].userId, role="president"))
    titles = ["Small ideas, shared with good people.\nOur sketch night is back this Thursday. Bring a notebook and something you want to make.",
              "Found a quiet corner of campus for the next study session. Anyone working on their final project?",
              "A little reminder to take a break between deadlines. The campus garden looks especially good this week."]
    for index in range(32):
        author = users[1 + index % 2]
        db.add(s.Post(authorId=author.userId, content=titles[index % len(titles)] + " #campus",
                      clubId=club.clubId if index % 3 == 0 else None,
                      postType="club_post" if index % 3 == 0 else "normal", createdAt=now - timedelta(hours=index)))
    db.add(s.Post(authorId=users[0].userId, content="Looking forward to a new semester of good conversations.", createdAt=now - timedelta(hours=2)))
    db.add(s.CampusEvent(title="Make something together", link="https://example.com/workshop", eventType="Workshop", eventDate=date(2026, 9, 18), place="Design studio"))
    db.add(s.CampusEvent(title="A conversation with our alumni", link="https://example.com/alumni", eventType="Alumni Talk", eventDate=date(2026, 9, 22), place="Main auditorium"))
    db.add(s.SignalBarItem(title="The library is open late this week.", link="/clubs", position=1))
    db.add(s.MarketplaceItem(sellerId=users[1].userId, title="Design books, ready for a new desk", description="A few favorite books from last semester.", category="Books", price=250))
    db.commit()
    token = s.create_auth_token(users[0])
    session_user = users[0].to_dict()
graph.create_friendship(users[0].userId, users[1].userId)


@s.app.route("/__fixture__/session")
def fixture_session():
    return jsonify(token=token, user=session_user)


if __name__ == "__main__":
    s.app.run(host="127.0.0.1", port=5055, threaded=False, use_reloader=False)
