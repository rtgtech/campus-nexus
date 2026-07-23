from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable, Optional
from unittest.mock import patch


class FakeGraph:
    def __init__(self) -> None:
        self.friendships: dict[tuple[int, int], str] = {}
        self.pagerank: dict[str, float] = {}
        self.related: dict[tuple[int, int], float] = {}

    @staticmethod
    def pair(user_a: Any, user_b: Any) -> tuple[int, int]:
        return tuple(sorted((int(user_a), int(user_b))))

    def payload(self, pair: tuple[int, int]) -> dict[str, Any]:
        friendshipId = f"{pair[0]}:{pair[1]}"
        createdAt = self.friendships[pair]
        return {
            "id": friendshipId,
            "friendshipId": friendshipId,
            "userAId": str(pair[0]),
            "userBId": str(pair[1]),
            "weight": 1.0,
            "createdAt": createdAt,
        }

    def get_friendship(self, user_a: Any, user_b: Any) -> Optional[dict[str, Any]]:
        pair = self.pair(user_a, user_b)
        return self.payload(pair) if pair in self.friendships else None

    def create_friendship(self, user_a: Any, user_b: Any) -> tuple[dict[str, Any], bool]:
        pair = self.pair(user_a, user_b)
        created = pair not in self.friendships
        self.friendships.setdefault(pair, datetime.now(timezone.utc).isoformat())
        return self.payload(pair), created

    def delete_friendship(self, user_a: Any, user_b: Any) -> bool:
        return self.friendships.pop(self.pair(user_a, user_b), None) is not None

    def friend_rows(self, userId: Any) -> list[dict[str, Any]]:
        userId = int(userId)
        rows = []
        for pair in self.friendships:
            if userId not in pair:
                continue
            rows.append({"friendUserId": pair[1] if pair[0] == userId else pair[0], "friendship": self.payload(pair)})
        return rows

    def feed_signals(
        self,
        *,
        user_ids: Iterable[Any],
        club_ids: Iterable[Any],
        viewerUserId: Optional[Any],
    ) -> tuple[dict[str, float], dict[str, float]]:
        viewer = int(viewerUserId) if viewerUserId is not None else None
        pagerank: dict[str, float] = {}
        social: dict[str, float] = {}
        for userId in {int(value) for value in user_ids}:
            key = f"user:{userId}"
            pagerank[key] = self.pagerank.get(key, 0.0)
            social[key] = 1.0 if viewer == userId else float(viewer is not None and self.pair(viewer, userId) in self.friendships)
        for clubId in {int(value) for value in club_ids}:
            key = f"club:{clubId}"
            pagerank[key] = self.pagerank.get(key, 0.0)
            social[key] = self.related.get((viewer, clubId), 0.0) if viewer is not None else 0.0
        return pagerank, social

    def patch_backend(self, backend_app):
        return patch.multiple(
            backend_app,
            graph_create_friendship=self.create_friendship,
            graph_delete_friendship=self.delete_friendship,
            graph_get_friendship=self.get_friendship,
            graph_friend_rows=self.friend_rows,
            feed_signals=self.feed_signals,
        )

