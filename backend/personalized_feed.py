"""Bounded feed retrieval, learning and viewer-owned pagination.

Registered with the application module to keep models in the existing schema
registry and permit the application's graph adapters to be replaced in tests.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import secrets
import time
from datetime import datetime, timedelta, timezone

from flask import jsonify, request
from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.dialects.sqlite import insert

try:
    from .feed_ranker import rank_personalized_posts, rank_feed_posts
except ImportError:
    from feed_ranker import rank_personalized_posts, rank_feed_posts

EVENT_WEIGHTS = {"impression": 0, "open": 1, "dwell": 2, "like": 3, "comment": 4, "save": 5}


class FeedService:
    def __init__(self, schema):
        self.s = schema

    def viewer(self):
        user = self.s.current_auth_user()
        return user if isinstance(user, self.s.User) and user.isActive else None

    def enabled(self, user):
        if user is None:
            return False
        setting = self.s.db().get(self.s.FeedSetting, user.userId)
        return setting is None or setting.enabled

    def context(self, user):
        s = self.s
        friend_ids, club_ids, excluded = set(), set(), set()
        graph_available = True
        if user:
            try:
                friend_ids = {int(row["friendUserId"]) for row in s.graph_friend_rows(user.userId)}
            except s.GraphUnavailable:
                graph_available = False
            club_ids = set(s.db().scalars(select(s.ClubFollower.clubId).where(s.ClubFollower.userId == user.userId)))
            club_ids.update(s.db().scalars(select(s.ClubMember.clubId).where(
                s.ClubMember.userId == user.userId, s.ClubMember.status == "active")))
            excluded = set(s.db().scalars(select(s.FeedExclusion.target).where(s.FeedExclusion.userId == user.userId)))
        return friend_ids, club_ids, excluded, graph_available

    def eligible_query(self, user, context):
        s = self.s
        friends, _, excluded, _ = context
        own_id = user.userId if user else -1
        # Apply the same profile privacy vocabulary already used by profile APIs.
        profile_visible = or_(s.User.userId == own_id,
            s.UserPreference.profileVisibility.is_(None), s.UserPreference.profileVisibility == "campus",
            and_(s.UserPreference.profileVisibility == "friends", s.User.userId.in_(friends)))
        post_visible = or_(s.Post.authorId == own_id, s.Post.visibility == "public",
            and_(s.Post.visibility == "campus", user is not None),
            and_(s.Post.visibility == "friends", s.Post.authorId.in_(friends)))
        query = (select(s.Post).join(s.User, s.User.userId == s.Post.authorId)
                 .outerjoin(s.UserPreference, s.UserPreference.userId == s.User.userId)
                 .outerjoin(s.Club, s.Club.clubId == s.Post.clubId)
                 .where(s.Post.isDeleted.is_(False), s.User.isActive.is_(True), profile_visible, post_visible,
                        or_(s.Post.clubId.is_(None), s.Club.isActive.is_(True))))
        for kind, column in (("post", s.Post.postId), ("author", s.Post.authorId), ("club", s.Post.clubId)):
            ids = [int(target.split(":", 1)[1]) for target in excluded if target.startswith(kind + ":")]
            if ids:
                query = query.where(or_(column.is_(None), column.not_in(ids)))
        return query

    def affinities(self, user, now):
        s = self.s
        weights = {}
        if not self.enabled(user):
            return weights
        rows = s.db().scalars(select(s.FeedAffinity).where(
            s.FeedAffinity.userId == user.userId, s.FeedAffinity.day >= (now - timedelta(days=90)).date().isoformat()))
        for row in rows:
            age = max(0, (now.date() - datetime.fromisoformat(row.day).date()).days)
            weights[row.target] = weights.get(row.target, 0) + row.weight * 0.5 ** (age / 14)
        return {key: 1 - math.exp(-max(0, value) / 10) for key, value in weights.items() if value > 0}

    def targets(self, post):
        targets = [f"author:{post.authorId}"]
        if post.clubId is not None:
            targets.append(f"club:{post.clubId}")
        targets.extend(f"topic:{tag.lower()}"[:100] for tag in self.s.extract_hashtags(post.content or "")[:10])
        return list(dict.fromkeys(targets))

    def candidates(self, user, context, affinity, now, latest):
        s = self.s
        base = self.eligible_query(user, context)
        recent = base.where(s.Post.createdAt >= now - timedelta(days=30))
        order = (s.Post.createdAt.desc(), s.Post.postId.asc())
        if latest:
            return s.db().scalars(base.order_by(*order).limit(600)).all()
        friends, clubs, _, _ = context
        network = or_(s.Post.authorId.in_(friends), s.Post.clubId.in_(clubs))
        preferred = sorted(affinity, key=affinity.get, reverse=True)[:40]
        authors = [int(key.split(":")[1]) for key in preferred if key.startswith("author:")]
        preferred_clubs = [int(key.split(":")[1]) for key in preferred if key.startswith("club:")]
        topics = [key[6:] for key in preferred if key.startswith("topic:")]
        interest = or_(s.Post.authorId.in_(authors), s.Post.clubId.in_(preferred_clubs),
                       *[func.lower(s.Post.content).contains(tag, autoescape=True) for tag in topics])
        rows = {}
        for query in (recent.where(network), recent.where(interest), recent):
            rows.update({post.postId: post for post in s.db().scalars(query.order_by(*order).limit(200))})
        if len(rows) < 20:
            rows.update({post.postId: post for post in s.db().scalars(base.order_by(*order).limit(600))})
        return list(rows.values())[:600]

    def rank(self, user, posts, context, affinity, now, latest):
        s = self.s
        ids = [post.postId for post in posts]
        counts = {post_id: 0 for post_id in ids}
        for model, multiplier in ((s.PostLike, 1), (s.Comment, 2), (s.PostBookmark, 3)):
            query = (select(model.postId, func.count(func.distinct(model.userId)))
                     .join(s.Post, s.Post.postId == model.postId)
                     .where(model.postId.in_(ids), model.userId != s.Post.authorId))
            if model is s.Comment:
                query = query.where(s.Comment.isDeleted.is_(False))
            for post_id, count in s.db().execute(query.group_by(model.postId)):
                counts[post_id] += count * multiplier
        pagerank, graph_available = {}, context[3]
        if graph_available and posts and not latest:
            try:
                pagerank, _ = s.feed_signals(user_ids={post.authorId for post in posts},
                    club_ids={post.clubId for post in posts if post.clubId is not None},
                    viewerUserId=user.userId if user else None)
            except s.GraphUnavailable:
                graph_available = False
        # Population percentiles are refreshed with the persistent graph, not
        # normalized against whichever candidates happened to be retrieved.
        percentiles = {}
        if graph_available and posts and not latest:
            try:
                percentiles = s.feed_pagerank_percentiles(user_ids={post.authorId for post in posts},
                    club_ids={post.clubId for post in posts if post.clubId is not None})
            except s.GraphUnavailable:
                pass
        seen = set()
        if self.enabled(user):
            seen = set(s.db().scalars(select(s.FeedEvent.postId).where(
                s.FeedEvent.userId == user.userId, s.FeedEvent.kind == "impression",
                s.FeedEvent.createdAt >= now - timedelta(hours=24))))
        rows = []
        for post in posts:
            source = f"club:{post.clubId}" if post.clubId is not None else f"author:{post.authorId}"
            graph_target = f"club:{post.clubId}" if post.clubId is not None else f"user:{post.authorId}"
            values = [affinity.get(target, 0) for target in self.targets(post)]
            relationship = post.clubId in context[1] if post.clubId is not None else post.authorId in context[0]
            rows.append(dict(postId=str(post.postId), createdAt=s.utc_isoformat(post.createdAt),
                authorId=str(post.authorId), clubId=post.clubId, type=post.type_code,
                source=source, relationship=float(relationship),
                affinity=sum(values) / len(values) if values else 0,
                engagement=counts[post.postId], pagerank=percentiles.get(graph_target, 0), seen=post.postId in seen))
        ranked = rank_personalized_posts(rows, now_ts=now.timestamp(), has_history=bool(affinity),
                                        graph_available=graph_available, latest=latest)
        strategy = os.getenv("FEED_RANKER", "v2").lower()
        try:
            rollout = max(0, min(100, int(os.getenv("FEED_V2_PERCENT", "100"))))
        except ValueError:
            rollout = 0
        bucket = int(hashlib.sha256(str(user.userId if user else "guest").encode()).hexdigest()[:8], 16) % 100
        use_legacy = not latest and (strategy in {"legacy", "shadow"} or bucket >= rollout)
        if use_legacy:
            social = {("club:" + str(p["clubId"]) if p["clubId"] is not None else "user:" + p["authorId"]): p["relationship"] for p in rows}
            legacy = rank_feed_posts(posts=[{**p, "engagementScore": p["engagement"]} for p in rows],
                viewerUserId=str(user.userId) if user else None, pagerank_scores=pagerank,
                social_scores=social, now_ts=now.timestamp())
            if strategy == "shadow":
                overlap = len({p["postId"] for p in ranked[:20]} & {p["postId"] for p in legacy[:20]})
                s.app.logger.info("feed_shadow top20_overlap=%s", overlap)
            ranked = [{**p, "explanationCode": "campus-discovery"} for p in legacy]
        return ranked, "latest" if latest else "legacy" if use_legacy else "v2"

    def serialize_page(self, posts, user, records):
        s = self.s
        ids = [post.postId for post in posts]
        authors = {row.userId: row for row in s.db().scalars(select(s.User).where(s.User.userId.in_({p.authorId for p in posts})))}
        clubs = {row.clubId: row for row in s.db().scalars(select(s.Club).where(s.Club.clubId.in_({p.clubId for p in posts if p.clubId is not None})))}
        media = {}
        for row in s.db().scalars(select(s.PostMedia).where(s.PostMedia.postId.in_(ids)).order_by(s.PostMedia.sortOrder, s.PostMedia.mediaId)):
            media.setdefault(row.postId, []).append(row.mediaUrl)
        liked, saved = set(), set()
        if user:
            liked = set(s.db().scalars(select(s.PostLike.postId).where(s.PostLike.postId.in_(ids), s.PostLike.userId == user.userId)))
            saved = set(s.db().scalars(select(s.PostBookmark.postId).where(s.PostBookmark.postId.in_(ids), s.PostBookmark.userId == user.userId)))
        result = []
        for post in posts:
            record = records[str(post.postId)]
            club = clubs.get(post.clubId)
            card = post.to_dict(
                authors[post.authorId].fullName,
                club.slug if club else None,
                media.get(post.postId) or ([post.mediaUrl] if post.mediaUrl else []),
                club.name if club else None,
            )
            card.update(likedByCurrentUser=post.postId in liked, viewerHasLiked=post.postId in liked,
                        savedByCurrentUser=post.postId in saved, bookmarkedByCurrentUser=post.postId in saved,
                        viewerHasSaved=post.postId in saved)
            card.update({key: record[key] for key in ("feedScore", "rankingSignals", "explanationCode")})
            result.append(card)
        return result

    def feed_response(self):
        s = self.s
        started = time.perf_counter()
        now = s.utcnow()
        user = self.viewer()
        user_id = user.userId if user else None
        mode = request.args.get("mode", "for-you")
        if mode not in {"for-you", "latest"}:
            return jsonify(error="mode must be for-you or latest"), 400
        try:
            limit = int(request.args.get("limit", "20"))
            if not 1 <= limit <= 50:
                raise ValueError
        except ValueError:
            return jsonify(error="limit must be between 1 and 50"), 400
        context = self.context(user)
        cursor = request.args.get("cursor")
        offset = 0
        if cursor:
            try:
                snapshot_id, offset_text = cursor.split(":")
                offset = int(offset_text)
                if offset < 0:
                    raise ValueError
            except ValueError:
                return jsonify(error="Invalid feed cursor"), 400
            snapshot = s.db().get(s.FeedSnapshot, snapshot_id)
            if snapshot is None or s.as_utc(snapshot.expiresAt) <= now:
                return jsonify(error="This feed has expired. Refresh to see new posts.", code="feed_expired"), 410
            if snapshot.userId != user_id or snapshot.mode != mode:
                return jsonify(error="Invalid feed cursor"), 403
            ordered = json.loads(snapshot.records)
            if offset > len(ordered):
                return jsonify(error="Invalid feed cursor"), 400
        else:
            affinity = self.affinities(user, now)
            posts = self.candidates(user, context, affinity, now, mode == "latest")
            ordered, version = self.rank(user, posts, context, affinity, now, mode == "latest")
            # Store only IDs and ranking explanations, never stale post content.
            ordered = [{key: row[key] for key in ("postId", "feedScore", "rankingSignals", "explanationCode")} for row in ordered]
            snapshot = s.FeedSnapshot(id=secrets.token_urlsafe(24), userId=user_id, mode=mode, version=version,
                records=json.dumps(ordered), createdAt=now, expiresAt=now + timedelta(minutes=15))
            s.db().add(snapshot)
            s.db().commit()
        selected = []
        while offset < len(ordered) and len(selected) < limit:
            batch = ordered[offset:offset + limit - len(selected)]
            offset += len(batch)
            ids = [int(row["postId"]) for row in batch]
            visible = {post.postId: post for post in s.db().scalars(self.eligible_query(user, context).where(s.Post.postId.in_(ids)))}
            selected.extend(visible[post_id] for post_id in ids if post_id in visible)
        cards = self.serialize_page(selected, user, {row["postId"]: row for row in ordered})
        s.app.logger.info("feed_request version=%s candidates=%s returned=%s duration_ms=%.1f", snapshot.version,
                          len(ordered), len(cards), (time.perf_counter() - started) * 1000)
        response = jsonify(feedCards=cards, trending=[], suggestedPeople=[], nextCursor=f"{snapshot.id}:{offset}" if offset < len(ordered) else None,
            snapshotId=snapshot.id, mode=mode, rankingVersion=snapshot.version, personalizationEnabled=self.enabled(user))
        response.headers["Cache-Control"] = "private, no-store"
        return response

    def record_behavior(self, user, post, kind, duration=0, version=None, position=None):
        s = self.s
        if not self.enabled(user) or user.userId == post.authorId:
            return False
        now = s.utcnow()
        day = now.date().isoformat()
        if version is None:
            snapshot = s.db().scalar(select(s.FeedSnapshot).where(
                s.FeedSnapshot.userId == user.userId, s.FeedSnapshot.expiresAt > now)
                .order_by(s.FeedSnapshot.createdAt.desc()).limit(1))
            version = snapshot.version if snapshot else "unattributed"
        result = s.db().execute(insert(s.FeedEvent).values(userId=user.userId, postId=post.postId, kind=kind,
            day=day, createdAt=now, duration=min(30, max(0, duration)), version=version, position=position).on_conflict_do_nothing())
        if not result.rowcount:
            if kind == "impression":
                s.db().query(s.FeedEvent).filter_by(userId=user.userId, postId=post.postId, kind=kind, day=day).update({"createdAt": now})
            return False
        weight = EVENT_WEIGHTS[kind]
        if weight:
            for target in self.targets(post):
                statement = insert(s.FeedAffinity).values(userId=user.userId, target=target, day=day, weight=weight)
                s.db().execute(statement.on_conflict_do_update(index_elements=["userId", "target", "day"],
                    set_={"weight": s.FeedAffinity.weight + weight}))
        return True

    def cleanup(self):
        s = self.s
        now = s.utcnow()
        for model, condition in (
            (s.FeedEvent, s.FeedEvent.createdAt < now - timedelta(days=30)),
            (s.FeedAffinity, s.FeedAffinity.day < (now - timedelta(days=90)).date().isoformat()),
            (s.FeedSnapshot, s.FeedSnapshot.expiresAt < now),
        ):
            s.db().execute(delete(model).where(condition))
        s.db().commit()


def register_feed(s):
    service = FeedService(s)

    @s.app.route("/api/feed/preferences", methods=["GET", "PATCH"])
    def feed_preferences():
        user = service.viewer()
        if not user:
            return jsonify(error="unauthorized"), 401
        if request.method == "PATCH":
            enabled = s.read_json().get("enabled")
            if not isinstance(enabled, bool):
                return jsonify(error="enabled must be a boolean"), 400
            statement = insert(s.FeedSetting).values(userId=user.userId, enabled=enabled)
            s.db().execute(statement.on_conflict_do_update(index_elements=["userId"], set_={"enabled": enabled}))
            s.db().execute(delete(s.FeedSnapshot).where(s.FeedSnapshot.userId == user.userId))
            s.db().commit()
        exclusions = list(s.db().scalars(select(s.FeedExclusion.target).where(s.FeedExclusion.userId == user.userId).order_by(s.FeedExclusion.target)))
        labels = {}
        for kind, model, id_column, label in (
            ("author", s.User, s.User.userId, lambda row: row.fullName),
            ("club", s.Club, s.Club.clubId, lambda row: row.name),
            ("post", s.Post, s.Post.postId, lambda row: (row.content or "Campus post")[:80]),
        ):
            ids = [int(target.split(":")[1]) for target in exclusions if target.startswith(kind + ":")]
            query = select(model).where(id_column.in_(ids))
            if kind == "post":
                friends, clubs, _, available = service.context(user)
                query = service.eligible_query(user, (friends, clubs, set(), available)).where(id_column.in_(ids))
            for row in s.db().scalars(query):
                labels[f"{kind}:{getattr(row, id_column.key)}"] = label(row)
        return jsonify(enabled=service.enabled(user), exclusions=exclusions, exclusionLabels=labels)

    @s.app.route("/api/feed/history", methods=["DELETE"])
    def feed_history():
        user = service.viewer()
        if not user:
            return jsonify(error="unauthorized"), 401
        for model in (s.FeedEvent, s.FeedAffinity, s.FeedSnapshot):
            s.db().execute(delete(model).where(model.userId == user.userId))
        statement = insert(s.FeedSetting).values(userId=user.userId, enabled=service.enabled(user), historyResetAt=s.utcnow())
        s.db().execute(statement.on_conflict_do_update(index_elements=["userId"], set_={"historyResetAt": s.utcnow()}))
        s.db().commit()
        return ("", 204)

    @s.app.route("/api/feed/exclusions", methods=["PUT", "DELETE"])
    def feed_exclusions():
        user = service.viewer()
        if not user:
            return jsonify(error="unauthorized"), 401
        target = s.read_json().get("target", "")
        if not isinstance(target, str) or not s.re.fullmatch(r"(post|author|club):[1-9][0-9]*", target):
            return jsonify(error="target must identify a post, author, or club"), 400
        kind, target_id = target.split(":")
        if len(target_id) > 19 or int(target_id) > 2**63 - 1:
            return jsonify(error="Invalid target identifier"), 400
        model = {"post": s.Post, "author": s.User, "club": s.Club}[kind]
        if request.method == "PUT" and s.db().get(model, int(target_id)) is None:
            return jsonify(error="not found"), 404
        if request.method == "PUT":
            s.db().execute(insert(s.FeedExclusion).values(userId=user.userId, target=target).on_conflict_do_nothing())
        else:
            s.db().execute(delete(s.FeedExclusion).where(s.FeedExclusion.userId == user.userId, s.FeedExclusion.target == target))
        s.db().commit()
        s.app.logger.info("feed_feedback kind=%s excluded=%s", kind, request.method == "PUT")
        return jsonify(target=target, excluded=request.method == "PUT")

    @s.app.route("/api/feed/events", methods=["POST"])
    def feed_events():
        user = service.viewer()
        if not user:
            return jsonify(error="unauthorized"), 401
        data = s.read_json()
        events = data.get("events")
        if not isinstance(events, list) or not 1 <= len(events) <= 50:
            return jsonify(error="events must contain between 1 and 50 entries"), 400
        if not service.enabled(user):
            return jsonify(accepted=0)
        snapshot_id = data.get("snapshotId")
        if not isinstance(snapshot_id, str):
            return jsonify(error="snapshotId is required"), 400
        snapshot = s.db().get(s.FeedSnapshot, snapshot_id)
        if snapshot is None or snapshot.userId != user.userId or s.as_utc(snapshot.expiresAt) <= s.utcnow():
            return jsonify(error="Feed session expired"), 410
        served = {int(row["postId"]): index for index, row in enumerate(json.loads(snapshot.records))}
        parsed = []
        for event in events:
            if not isinstance(event, dict) or event.get("kind") not in {"impression", "open", "dwell"}:
                return jsonify(error="Invalid event kind"), 400
            post_id = s.optional_int(event.get("postId"))
            duration = event.get("duration", 0)
            if post_id not in served or isinstance(duration, bool) or not isinstance(duration, (int, float)) or not math.isfinite(duration) or not 0 <= duration <= 30:
                return jsonify(error="Invalid event post or duration"), 400
            if event["kind"] == "dwell" and duration < 10:
                return jsonify(error="dwell requires at least ten active seconds"), 400
            parsed.append((post_id, event["kind"], int(duration)))
        visible = {post.postId: post for post in s.db().scalars(service.eligible_query(user, service.context(user)).where(s.Post.postId.in_([p[0] for p in parsed])))}
        accepted = sum(service.record_behavior(user, visible[post_id], kind, duration, snapshot.version, served[post_id])
                       for post_id, kind, duration in parsed if post_id in visible)
        s.db().commit()
        return jsonify(accepted=accepted)

    @s.app.route("/api/liked-posts")
    def liked_posts():
        user = service.viewer()
        if not user:
            return jsonify(error="unauthorized"), 401
        posts = s.db().scalars(service.eligible_query(user, service.context(user))
            .join(s.PostLike, and_(s.PostLike.postId == s.Post.postId, s.PostLike.userId == user.userId))
            .order_by(s.PostLike.createdAt.desc(), s.Post.postId.desc())).all()
        return jsonify([s.serialize_post(post, str(user.userId)) for post in posts])

    @s.app.cli.command("cleanup-feed")
    def cleanup_feed():
        s.ensure_database_initialized()
        with s.app.test_request_context():
            from flask import g
            g.db = s.SessionLocal()
            try:
                service.cleanup()
            finally:
                g.db.close()
        print("Expired feed events, affinity aggregates, and snapshots removed.")

    return service
