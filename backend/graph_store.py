from __future__ import annotations

import atexit
import os
from datetime import datetime, timezone
from typing import Any, Iterable, Mapping, Optional

from neo4j import GraphDatabase
from neo4j.exceptions import DriverError, Neo4jError


class GraphUnavailable(RuntimeError):
    pass


class GraphStateError(RuntimeError):
    pass


_driver = None


def _database() -> str:
    return os.getenv("NEO4J_DATABASE", "neo4j")


def _get_driver():
    global _driver
    if _driver is not None:
        return _driver

    uri = os.getenv("NEO4J_URI")
    username = os.getenv("NEO4J_USERNAME")
    password = os.getenv("NEO4J_PASSWORD")
    if not uri or not username or not password:
        raise GraphUnavailable("Neo4j connection is not configured")

    _driver = GraphDatabase.driver(uri, auth=(username, password), max_transaction_retry_time=2.0)
    return _driver


def close_driver() -> None:
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None


atexit.register(close_driver)


def _execute(query: str, **parameters):
    try:
        return _get_driver().execute_query(query, parameters_=parameters, database_=_database())
    except GraphUnavailable:
        raise
    except (DriverError, Neo4jError, OSError) as error:
        raise GraphUnavailable("Neo4j is unavailable") from error


def ensure_constraints() -> None:
    for query in (
        "CREATE CONSTRAINT campus_user_id IF NOT EXISTS FOR (user:User) REQUIRE user.userId IS UNIQUE",
        "CREATE CONSTRAINT campus_club_id IF NOT EXISTS FOR (club:Club) REQUIRE club.clubId IS UNIQUE",
        "CREATE CONSTRAINT campus_graph_name IF NOT EXISTS FOR (graph:GraphMetadata) REQUIRE graph.name IS UNIQUE",
    ):
        _execute(query)


def _pair(user_a_id: Any, user_b_id: Any) -> tuple[int, int]:
    user_a = int(user_a_id)
    user_b = int(user_b_id)
    if user_a == user_b:
        raise ValueError("friendship endpoints must be different")
    return tuple(sorted((user_a, user_b)))


def _friendship_payload(record: Mapping[str, Any]) -> dict[str, Any]:
    friendship_id = str(record["friendshipId"])
    user_a_id = str(record["userAId"])
    user_b_id = str(record["userBId"])
    created_at = str(record["createdAt"])
    return {
        "id": friendship_id,
        "friendshipId": friendship_id,
        "userAId": user_a_id,
        "userBId": user_b_id,
        "weight": float(record.get("weight", 1.0)),
        "createdAt": created_at,
    }


def get_friendship(user_a_id: Any, user_b_id: Any) -> Optional[dict[str, Any]]:
    user_a, user_b = _pair(user_a_id, user_b_id)
    result = _execute(
        """
        MATCH (a:User {userId: $user_a})-[friendship:FRIENDS_WITH]->(b:User {userId: $user_b})
        RETURN friendship.friendshipId AS friendshipId,
               a.userId AS userAId,
               b.userId AS userBId,
               friendship.weight AS weight,
               toString(friendship.createdAt) AS createdAt
        """,
        user_a=user_a,
        user_b=user_b,
    )
    return _friendship_payload(result.records[0]) if result.records else None


def create_friendship(user_a_id: Any, user_b_id: Any) -> tuple[dict[str, Any], bool]:
    user_a, user_b = _pair(user_a_id, user_b_id)
    created_at = datetime.now(timezone.utc).isoformat()
    result = _execute(
        """
        MERGE (a:User {userId: $user_a})
        MERGE (b:User {userId: $user_b})
        MERGE (a)-[friendship:FRIENDS_WITH]->(b)
        ON CREATE SET friendship.friendshipId = $friendship_id,
                      friendship.createdAt = datetime($created_at)
        SET friendship.weight = 1.0
        RETURN friendship.friendshipId AS friendshipId,
               a.userId AS userAId,
               b.userId AS userBId,
               friendship.weight AS weight,
               toString(friendship.createdAt) AS createdAt
        """,
        user_a=user_a,
        user_b=user_b,
        friendship_id=f"{user_a}:{user_b}",
        created_at=created_at,
    )
    return _friendship_payload(result.records[0]), bool(result.summary.counters.relationships_created)


def delete_friendship(user_a_id: Any, user_b_id: Any) -> bool:
    user_a, user_b = _pair(user_a_id, user_b_id)
    result = _execute(
        """
        MATCH (:User {userId: $user_a})-[friendship:FRIENDS_WITH]->(:User {userId: $user_b})
        DELETE friendship
        """,
        user_a=user_a,
        user_b=user_b,
    )
    return bool(result.summary.counters.relationships_deleted)


def friend_rows(user_id: Any) -> list[dict[str, Any]]:
    result = _execute(
        """
        MATCH (user:User {userId: $user_id})-[friendship:FRIENDS_WITH]-(friend:User)
        WITH friend, friendship,
             CASE WHEN user.userId < friend.userId THEN user.userId ELSE friend.userId END AS userAId,
             CASE WHEN user.userId < friend.userId THEN friend.userId ELSE user.userId END AS userBId
        RETURN friend.userId AS friendUserId,
               friendship.friendshipId AS friendshipId,
               userAId,
               userBId,
               friendship.weight AS weight,
               toString(friendship.createdAt) AS createdAt
        ORDER BY friendship.createdAt DESC, friend.userId
        """,
        user_id=int(user_id),
    )
    return [
        {"friendUserId": int(record["friendUserId"]), "friendship": _friendship_payload(record)}
        for record in result.records
    ]


def feed_signals(
    *,
    user_ids: Iterable[Any],
    club_ids: Iterable[Any],
    viewerUserId: Optional[Any],
) -> tuple[dict[str, float], dict[str, float]]:
    viewer_id = int(viewerUserId) if viewerUserId is not None else None
    pagerank: dict[str, float] = {}
    social: dict[str, float] = {}

    users = sorted({int(value) for value in user_ids})
    if users:
        result = _execute(
            """
            UNWIND $target_ids AS target_id
            OPTIONAL MATCH (target:User {userId: target_id})
            OPTIONAL MATCH (viewer:User {userId: $viewer_id})-[edge:FRIENDS_WITH]-(target)
            RETURN target_id,
                   coalesce(target.pagerank, 0.0) AS pagerank,
                   CASE WHEN $viewer_id = target_id THEN 1.0 ELSE coalesce(edge.weight, 0.0) END AS social
            """,
            target_ids=users,
            viewer_id=viewer_id,
        )
        for record in result.records:
            key = f"user:{record['target_id']}"
            pagerank[key] = float(record["pagerank"])
            social[key] = float(record["social"])

    clubs = sorted({int(value) for value in club_ids})
    if clubs:
        result = _execute(
            """
            UNWIND $target_ids AS target_id
            OPTIONAL MATCH (target:Club {clubId: target_id})
            OPTIONAL MATCH (:User {userId: $viewer_id})-[edge:RELATED_TO]->(target)
            RETURN target_id,
                   coalesce(target.pagerank, 0.0) AS pagerank,
                   coalesce(edge.weight, 0.0) AS social
            """,
            target_ids=clubs,
            viewer_id=viewer_id,
        )
        for record in result.records:
            key = f"club:{record['target_id']}"
            pagerank[key] = float(record["pagerank"])
            social[key] = float(record["social"])

    return pagerank, social


def stored_friendships() -> list[dict[str, Any]]:
    result = _execute(
        """
        MATCH (a:User)-[friendship:FRIENDS_WITH]->(b:User)
        RETURN a.userId AS userAId,
               b.userId AS userBId,
               friendship.friendshipId AS friendshipId,
               friendship.weight AS weight,
               toString(friendship.createdAt) AS createdAt
        """
    )
    return [_friendship_payload(record) for record in result.records]


def replace_graph(
    *,
    user_ids: Iterable[Any],
    club_ids: Iterable[Any],
    relationships: Iterable[Mapping[str, Any]],
    pagerank: Mapping[str, float],
    bootstrap_friendships: Iterable[Mapping[str, Any]] = (),
    bootstrap: bool = False,
) -> None:
    users = sorted({int(value) for value in user_ids})
    clubs = sorted({int(value) for value in club_ids})
    related = [dict(row) for row in relationships]
    friends = [dict(row) for row in bootstrap_friendships]
    ranks = [{"key": key, "score": float(score)} for key, score in pagerank.items()]

    def write(tx):
        count = tx.run(
            "MATCH (node) WHERE node:User OR node:Club OR node:GraphMetadata RETURN count(node) AS count"
        ).single()["count"]
        initialized = tx.run(
            "MATCH (:GraphMetadata {name: 'feed'}) RETURN count(*) AS count"
        ).single()["count"]
        if bootstrap and count:
            raise GraphStateError("Neo4j graph is not empty; refusing bootstrap")
        if not bootstrap and not initialized:
            raise GraphStateError("Neo4j graph is not initialized; run with --bootstrap first")

        tx.run("UNWIND $ids AS id MERGE (:User {userId: id})", ids=users).consume()
        tx.run("UNWIND $ids AS id MERGE (:Club {clubId: id})", ids=clubs).consume()
        tx.run("MATCH (user:User) WHERE NOT user.userId IN $ids DETACH DELETE user", ids=users).consume()
        tx.run("MATCH (club:Club) WHERE NOT club.clubId IN $ids DETACH DELETE club", ids=clubs).consume()
        tx.run("MATCH ()-[edge:RELATED_TO]->() DELETE edge").consume()
        tx.run(
            """
            UNWIND $rows AS row
            MATCH (user:User {userId: row.userId}), (club:Club {clubId: row.clubId})
            CREATE (user)-[:RELATED_TO {
                weight: row.weight,
                isMember: row.isMember,
                isFollower: row.isFollower
            }]->(club)
            """,
            rows=related,
        ).consume()

        if bootstrap:
            tx.run(
                """
                UNWIND $rows AS row
                MATCH (a:User {userId: row.userAId}), (b:User {userId: row.userBId})
                MERGE (a)-[friendship:FRIENDS_WITH]->(b)
                SET friendship.friendshipId = row.friendshipId,
                    friendship.weight = 1.0,
                    friendship.createdAt = datetime(row.createdAt)
                """,
                rows=friends,
            ).consume()
        else:
            tx.run("MATCH ()-[friendship:FRIENDS_WITH]->() SET friendship.weight = 1.0").consume()

        tx.run(
            """
            UNWIND $rows AS row
            MATCH (node) WHERE (node:User AND row.key = 'user:' + toString(node.userId))
                              OR (node:Club AND row.key = 'club:' + toString(node.clubId))
            SET node.pagerank = row.score
            """,
            rows=ranks,
        ).consume()
        tx.run(
            """
            MERGE (graph:GraphMetadata {name: 'feed'})
            ON CREATE SET graph.bootstrappedAt = datetime()
            SET graph.updatedAt = datetime(), graph.schemaVersion = 2
            """
        ).consume()

    try:
        with _get_driver().session(database=_database()) as session:
            session.execute_write(write)
    except GraphStateError:
        raise
    except GraphUnavailable:
        raise
    except (DriverError, Neo4jError, OSError) as error:
        raise GraphUnavailable("Neo4j is unavailable") from error
