from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import socket
import sqlite3
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from neo4j.exceptions import DriverError, Neo4jError
from sqlalchemy.engine import make_url

try:
    from . import graph_store
    from .schema_app import BACKEND_DIR, Base, DATABASE_URL, engine as application_engine
except ImportError:
    import graph_store
    from schema_app import BACKEND_DIR, Base, DATABASE_URL, engine as application_engine


ROOT_DIR = BACKEND_DIR.parent
BACKUPS_DIR = ROOT_DIR / "backups"
SQLITE_FILENAME = "campus_nexus.db"
GRAPH_FILENAME = "neo4j_graph.json"
MANIFEST_FILENAME = "manifest.json"
SNAPSHOT_PREFIX = "campus_nexus_snapshot_"
SNAPSHOT_FORMAT_VERSION = 2


class SyncError(RuntimeError):
    pass


def configured_sqlite_path() -> Path:
    database = make_url(DATABASE_URL).database
    if not database or database == ":memory:":
        raise SyncError("database backup and sync require a file-backed SQLite DATABASE_URL")
    return Path(database).resolve()


def ensure_backend_stopped() -> None:
    port = int(os.getenv("PORT", "5000"))
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as connection:
        connection.settimeout(0.25)
        if connection.connect_ex(("127.0.0.1", port)) == 0:
            raise SyncError(f"backend port {port} is active; stop npm run dev:backend first")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest().upper()


def sqlite_inventory(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise SyncError(f"SQLite database does not exist: {path}")
    connection = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
    try:
        integrity_check = connection.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity_check != "ok":
            raise SyncError(f"SQLite integrity_check failed: {integrity_check}")
        foreign_key_issues = connection.execute("PRAGMA foreign_key_check").fetchall()
        if foreign_key_issues:
            tables = sorted({str(issue[0]) for issue in foreign_key_issues})
            raise SyncError(
                f"SQLite has {len(foreign_key_issues)} foreign-key violation(s) in: {', '.join(tables)}"
            )
        actual_tables = {
            str(row[0])
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
            )
        }
        expected_tables = set(Base.metadata.tables)
        if actual_tables != expected_tables:
            missing = sorted(expected_tables - actual_tables)
            extra = sorted(actual_tables - expected_tables)
            detail = []
            if missing:
                detail.append(f"missing tables: {', '.join(missing)}")
            if extra:
                detail.append(f"unexpected tables: {', '.join(extra)}")
            raise SyncError(f"SQLite schema mismatch ({'; '.join(detail)})")
        table_counts = {
            table_name: int(connection.execute(f'SELECT COUNT(*) FROM "{table_name}"').fetchone()[0])
            for table_name in sorted(expected_tables)
        }
        user_ids = {
            int(row[0])
            for row in connection.execute(
                'SELECT "userId" FROM users WHERE "isActive" = 1 AND "accountRole" <> \'admin\''
            )
        }
        club_ids = {
            int(row[0])
            for row in connection.execute('SELECT "clubId" FROM clubs WHERE "isActive" = 1')
        }
        return {
            "integrityCheck": integrity_check,
            "foreignKeyIssues": 0,
            "tableCounts": table_counts,
            "activeUserIds": user_ids,
            "activeClubIds": club_ids,
        }
    finally:
        connection.close()


def backup_sqlite(source_path: Path, destination_path: Path) -> dict[str, Any]:
    source = sqlite3.connect(f"file:{source_path.as_posix()}?mode=ro", uri=True)
    destination = sqlite3.connect(destination_path)
    try:
        source.backup(destination)
        destination.execute("PRAGMA journal_mode=DELETE")
        destination.commit()
    finally:
        destination.close()
        source.close()
    return sqlite_inventory(destination_path)


def export_graph() -> dict[str, Any]:
    driver = graph_store._get_driver()

    def read_graph(transaction):
        users = transaction.run(
            "MATCH (user:User) "
            "RETURN user.userId AS userId, user.pagerank AS pagerank, user.pagerankPercentile AS pagerankPercentile "
            "ORDER BY user.userId"
        ).data()
        clubs = transaction.run(
            "MATCH (club:Club) "
            "RETURN club.clubId AS clubId, club.pagerank AS pagerank, club.pagerankPercentile AS pagerankPercentile "
            "ORDER BY club.clubId"
        ).data()
        metadata = transaction.run(
            "MATCH (graph:GraphMetadata) "
            "RETURN graph.name AS name, graph.schemaVersion AS schemaVersion, "
            "toString(graph.bootstrappedAt) AS bootstrappedAt, "
            "toString(graph.updatedAt) AS updatedAt "
            "ORDER BY graph.name"
        ).data()
        friendships = transaction.run(
            "MATCH (source:User)-[edge:FRIENDS_WITH]->(target:User) "
            "RETURN source.userId AS sourceUserId, target.userId AS targetUserId, "
            "edge.friendshipId AS friendshipId, edge.weight AS weight, "
            "toString(edge.createdAt) AS createdAt "
            "ORDER BY source.userId, target.userId"
        ).data()
        relationships = transaction.run(
            "MATCH (user:User)-[edge:RELATED_TO]->(club:Club) "
            "RETURN user.userId AS userId, club.clubId AS clubId, edge.weight AS weight, "
            "edge.isMember AS isMember, edge.isFollower AS isFollower "
            "ORDER BY user.userId, club.clubId"
        ).data()
        unknown_nodes = transaction.run(
            "MATCH (node) "
            "WHERE any(label IN labels(node) WHERE NOT label IN $allowed) "
            "RETURN count(node) AS count",
            allowed=["User", "Club", "GraphMetadata"],
        ).single()["count"]
        unknown_relationships = transaction.run(
            "MATCH ()-[edge]->() "
            "WHERE NOT type(edge) IN $allowed "
            "RETURN count(edge) AS count",
            allowed=["FRIENDS_WITH", "RELATED_TO"],
        ).single()["count"]
        return {
            "formatVersion": 1,
            "database": graph_store._database(),
            "users": users,
            "clubs": clubs,
            "metadata": metadata,
            "friendships": friendships,
            "relationships": relationships,
            "unknownNodeCount": int(unknown_nodes),
            "unknownRelationshipCount": int(unknown_relationships),
        }

    with driver.session(database=graph_store._database()) as session:
        return session.execute_read(read_graph)


def _integer_set(rows: Any, field: str, label: str) -> set[int]:
    if not isinstance(rows, list):
        raise SyncError(f"Neo4j snapshot {label} must be a list")
    values: list[int] = []
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get(field), int):
            raise SyncError(f"Neo4j snapshot {label} contains an invalid {field}")
        values.append(row[field])
    if len(values) != len(set(values)):
        raise SyncError(f"Neo4j snapshot {label} contains duplicate {field} values")
    return set(values)


def validate_graph(graph: dict[str, Any], sqlite_data: dict[str, Any]) -> None:
    if graph.get("formatVersion") != 1:
        raise SyncError("unsupported Neo4j graph snapshot format")
    if graph.get("unknownNodeCount") != 0 or graph.get("unknownRelationshipCount") != 0:
        raise SyncError("Neo4j contains unsupported nodes or relationships that would be lost")

    graph_user_ids = _integer_set(graph.get("users"), "userId", "users")
    graph_club_ids = _integer_set(graph.get("clubs"), "clubId", "clubs")
    if graph_user_ids != sqlite_data["activeUserIds"]:
        raise SyncError("Neo4j User IDs do not exactly match active, non-admin SQLite users")
    if graph_club_ids != sqlite_data["activeClubIds"]:
        raise SyncError("Neo4j Club IDs do not exactly match active SQLite clubs")

    metadata = graph.get("metadata")
    if not isinstance(metadata, list) or [row.get("name") for row in metadata] != ["feed"]:
        raise SyncError("Neo4j must contain exactly one GraphMetadata node named feed")

    friendship_pairs: set[tuple[int, int]] = set()
    friendships = graph.get("friendships")
    if not isinstance(friendships, list):
        raise SyncError("Neo4j snapshot friendships must be a list")
    for friendship in friendships:
        source_id = friendship.get("sourceUserId")
        target_id = friendship.get("targetUserId")
        if not isinstance(source_id, int) or not isinstance(target_id, int):
            raise SyncError("Neo4j friendship endpoints must be integer user IDs")
        if source_id not in graph_user_ids or target_id not in graph_user_ids:
            raise SyncError("Neo4j friendship references a user missing from SQLite")
        if source_id >= target_id:
            raise SyncError("Neo4j friendships must use distinct, canonical source/target IDs")
        pair = (source_id, target_id)
        if pair in friendship_pairs:
            raise SyncError("Neo4j snapshot contains duplicate friendships")
        friendship_pairs.add(pair)

    related_pairs: set[tuple[int, int]] = set()
    relationships = graph.get("relationships")
    if not isinstance(relationships, list):
        raise SyncError("Neo4j snapshot relationships must be a list")
    for relationship in relationships:
        user_id = relationship.get("userId")
        club_id = relationship.get("clubId")
        if not isinstance(user_id, int) or not isinstance(club_id, int):
            raise SyncError("Neo4j RELATED_TO endpoints must be integer IDs")
        if user_id not in graph_user_ids or club_id not in graph_club_ids:
            raise SyncError("Neo4j RELATED_TO edge references an entity missing from SQLite")
        pair = (user_id, club_id)
        if pair in related_pairs:
            raise SyncError("Neo4j snapshot contains duplicate RELATED_TO edges")
        related_pairs.add(pair)
    expected_related_pairs = {
        (user_id, club_id)
        for user_id in graph_user_ids
        for club_id in graph_club_ids
    }
    if related_pairs != expected_related_pairs:
        raise SyncError("Neo4j RELATED_TO edges are stale or incomplete; run the graph update first")


def graph_counts(graph: dict[str, Any]) -> dict[str, int]:
    return {
        "users": len(graph["users"]),
        "clubs": len(graph["clubs"]),
        "metadata": len(graph["metadata"]),
        "friendships": len(graph["friendships"]),
        "relationships": len(graph["relationships"]),
    }


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def create_snapshot() -> Path:
    ensure_backend_stopped()
    sqlite_path = configured_sqlite_path()
    current_sqlite = sqlite_inventory(sqlite_path)
    graph = export_graph()
    validate_graph(graph, current_sqlite)

    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    temporary_directory = Path(tempfile.mkdtemp(prefix=".campus_nexus_snapshot_", dir=BACKUPS_DIR))
    timestamp = datetime.now().astimezone().strftime("%Y%m%d_%H%M%S_%f")
    snapshot_path = BACKUPS_DIR / f"{SNAPSHOT_PREFIX}{timestamp}"
    try:
        sqlite_backup = temporary_directory / SQLITE_FILENAME
        sqlite_data = backup_sqlite(sqlite_path, sqlite_backup)
        if sqlite_data["tableCounts"] != current_sqlite["tableCounts"]:
            raise SyncError("SQLite changed while the backup was being created")

        graph_path = temporary_directory / GRAPH_FILENAME
        write_json(graph_path, graph)
        manifest = {
            "formatVersion": SNAPSHOT_FORMAT_VERSION,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "files": {
                SQLITE_FILENAME: {
                    "sha256": sha256(sqlite_backup),
                    "sizeBytes": sqlite_backup.stat().st_size,
                },
                GRAPH_FILENAME: {
                    "sha256": sha256(graph_path),
                    "sizeBytes": graph_path.stat().st_size,
                },
            },
            "sqlite": {
                "tableCounts": sqlite_data["tableCounts"],
                "foreignKeyIssues": 0,
                "integrityCheck": "ok",
            },
            "neo4j": {
                "database": graph.get("database", "neo4j"),
                "counts": graph_counts(graph),
            },
        }
        write_json(temporary_directory / MANIFEST_FILENAME, manifest)
        temporary_directory.replace(snapshot_path)
        return snapshot_path
    except Exception:
        shutil.rmtree(temporary_directory, ignore_errors=True)
        raise
    finally:
        graph_store.close_driver()


def compatible_snapshot(path: Path) -> bool:
    return all((path / name).is_file() for name in (SQLITE_FILENAME, GRAPH_FILENAME, MANIFEST_FILENAME))


def latest_snapshot() -> Path:
    if not BACKUPS_DIR.is_dir():
        raise SyncError("backups directory does not exist; run npm run dev:backup on the source machine")
    snapshots = sorted(
        (
            path
            for path in BACKUPS_DIR.iterdir()
            if path.is_dir() and path.name.startswith(SNAPSHOT_PREFIX) and compatible_snapshot(path)
        ),
        key=lambda path: path.name,
        reverse=True,
    )
    if not snapshots:
        raise SyncError("no compatible snapshot found; run npm run dev:backup on the source machine")
    return snapshots[0]


def load_snapshot(snapshot: Path) -> tuple[Path, dict[str, Any], dict[str, Any]]:
    snapshot = snapshot.resolve()
    if not compatible_snapshot(snapshot):
        raise SyncError(f"snapshot is incomplete or uses the old native-dump format: {snapshot}")
    manifest = json.loads((snapshot / MANIFEST_FILENAME).read_text(encoding="utf-8"))
    if manifest.get("formatVersion") != SNAPSHOT_FORMAT_VERSION:
        raise SyncError("unsupported snapshot manifest version")
    for filename in (SQLITE_FILENAME, GRAPH_FILENAME):
        file_path = snapshot / filename
        expected = manifest.get("files", {}).get(filename, {})
        if file_path.stat().st_size != expected.get("sizeBytes") or sha256(file_path) != expected.get("sha256"):
            raise SyncError(f"snapshot checksum or size mismatch: {filename}")
    sqlite_data = sqlite_inventory(snapshot / SQLITE_FILENAME)
    graph = json.loads((snapshot / GRAPH_FILENAME).read_text(encoding="utf-8"))
    validate_graph(graph, sqlite_data)
    return snapshot / SQLITE_FILENAME, graph, manifest


def restore_graph(graph: dict[str, Any]) -> None:
    driver = graph_store._get_driver()

    def write_graph(transaction):
        transaction.run("MATCH (node) DETACH DELETE node").consume()
        transaction.run(
            "UNWIND $rows AS row "
            "CREATE (user:User {userId: row.userId}) "
            "SET user.pagerank = row.pagerank, user.pagerankPercentile = coalesce(row.pagerankPercentile, 0.0)",
            rows=graph["users"],
        ).consume()
        transaction.run(
            "UNWIND $rows AS row "
            "CREATE (club:Club {clubId: row.clubId}) "
            "SET club.pagerank = row.pagerank, club.pagerankPercentile = coalesce(row.pagerankPercentile, 0.0)",
            rows=graph["clubs"],
        ).consume()
        transaction.run(
            "UNWIND $rows AS row "
            "CREATE (metadata:GraphMetadata {name: row.name}) "
            "SET metadata.schemaVersion = row.schemaVersion, "
            "metadata.bootstrappedAt = CASE WHEN row.bootstrappedAt IS NULL THEN null ELSE datetime(row.bootstrappedAt) END, "
            "metadata.updatedAt = CASE WHEN row.updatedAt IS NULL THEN null ELSE datetime(row.updatedAt) END",
            rows=graph["metadata"],
        ).consume()
        transaction.run(
            "UNWIND $rows AS row "
            "MATCH (source:User {userId: row.sourceUserId}), (target:User {userId: row.targetUserId}) "
            "CREATE (source)-[edge:FRIENDS_WITH]->(target) "
            "SET edge.friendshipId = row.friendshipId, edge.weight = row.weight, "
            "edge.createdAt = CASE WHEN row.createdAt IS NULL THEN null ELSE datetime(row.createdAt) END",
            rows=graph["friendships"],
        ).consume()
        transaction.run(
            "UNWIND $rows AS row "
            "MATCH (user:User {userId: row.userId}), (club:Club {clubId: row.clubId}) "
            "CREATE (user)-[edge:RELATED_TO]->(club) "
            "SET edge.weight = row.weight, edge.isMember = row.isMember, edge.isFollower = row.isFollower",
            rows=graph["relationships"],
        ).consume()
        counts = transaction.run(
            "OPTIONAL MATCH (user:User) WITH count(user) AS users "
            "OPTIONAL MATCH (club:Club) WITH users, count(club) AS clubs "
            "OPTIONAL MATCH ()-[friendship:FRIENDS_WITH]->() WITH users, clubs, count(friendship) AS friendships "
            "OPTIONAL MATCH ()-[related:RELATED_TO]->() "
            "RETURN users, clubs, friendships, count(related) AS relationships"
        ).single()
        expected = graph_counts(graph)
        actual = {key: int(counts[key]) for key in ("users", "clubs", "friendships", "relationships")}
        if actual != {key: expected[key] for key in actual}:
            raise SyncError("Neo4j row counts changed during transactional restore")

    with driver.session(database=graph_store._database()) as session:
        session.execute_write(write_graph)


def clear_sqlite_sidecars(database_path: Path) -> None:
    if database_path.exists():
        connection = sqlite3.connect(database_path)
        try:
            connection.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        finally:
            connection.close()
    for suffix in ("-wal", "-shm", "-journal"):
        sidecar = Path(f"{database_path}{suffix}")
        if sidecar.exists():
            sidecar.unlink()


def replace_sqlite_database(source_path: Path, target_path: Path) -> tuple[Path | None, Path]:
    target_path.parent.mkdir(parents=True, exist_ok=True)
    rollback_path: Path | None = None
    staged_path = target_path.with_name(f".{target_path.name}.syncing")
    try:
        if target_path.exists():
            rollback_handle, rollback_name = tempfile.mkstemp(
                prefix=".campus_nexus_rollback_",
                suffix=".db",
                dir=target_path.parent,
            )
            os.close(rollback_handle)
            rollback_path = Path(rollback_name)
            rollback_path.unlink()
            backup_sqlite(target_path, rollback_path)
        shutil.copy2(source_path, staged_path)
        sqlite_inventory(staged_path)
        application_engine.dispose()
        clear_sqlite_sidecars(target_path)
        staged_path.replace(target_path)
        return rollback_path, staged_path
    except Exception:
        if rollback_path is not None and rollback_path.exists():
            rollback_path.unlink()
        if staged_path.exists():
            staged_path.unlink()
        raise


def restore_sqlite_rollback(target_path: Path, rollback_path: Path | None) -> None:
    application_engine.dispose()
    clear_sqlite_sidecars(target_path)
    if rollback_path is None:
        if target_path.exists():
            target_path.unlink()
        return
    rollback_path.replace(target_path)


def sync_snapshot(snapshot: Path | None = None) -> Path:
    ensure_backend_stopped()
    snapshot_path = snapshot.resolve() if snapshot is not None else latest_snapshot()
    sqlite_source, graph, _manifest = load_snapshot(snapshot_path)
    target_path = configured_sqlite_path()

    graph_store.ensure_constraints()
    rollback_path: Path | None = None
    staged_path: Path | None = None
    sqlite_replaced = False
    try:
        rollback_path, staged_path = replace_sqlite_database(sqlite_source, target_path)
        sqlite_replaced = True
        restore_graph(graph)
        return snapshot_path
    except Exception:
        if sqlite_replaced:
            restore_sqlite_rollback(target_path, rollback_path)
        raise
    finally:
        graph_store.close_driver()
        if rollback_path is not None and rollback_path.exists():
            rollback_path.unlink()
        if staged_path is not None and staged_path.exists():
            staged_path.unlink()


def main() -> None:
    parser = argparse.ArgumentParser(description="Back up or synchronize Campus Nexus development data")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("backup", help="write a validated SQLite and Neo4j snapshot to backups")
    sync_parser = subparsers.add_parser("sync", help="overwrite local databases from a validated snapshot")
    sync_parser.add_argument("--snapshot", type=Path, help="snapshot directory; defaults to the latest compatible one")
    args = parser.parse_args()

    try:
        if args.command == "backup":
            snapshot = create_snapshot()
            print(f"Created validated database snapshot: {snapshot}")
        else:
            snapshot = sync_snapshot(args.snapshot)
            print(f"Synchronized SQLite and Neo4j from: {snapshot}")
    except (
        DriverError,
        Neo4jError,
        OSError,
        ValueError,
        json.JSONDecodeError,
        graph_store.GraphUnavailable,
        SyncError,
    ) as error:
        parser.exit(1, f"Database {args.command} failed: {error}\n")


if __name__ == "__main__":
    main()
