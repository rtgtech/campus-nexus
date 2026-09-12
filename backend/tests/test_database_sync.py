from __future__ import annotations

import os
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from sqlalchemy.orm import sessionmaker

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET"] = "test-secret-that-is-at-least-32-characters"

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import database_sync  # noqa: E402
import schema_app as backend_schema  # noqa: E402


class DatabaseSyncTest(unittest.TestCase):
    def create_database(
        self,
        path: Path,
        *,
        username: str = "student",
        include_club: bool = True,
    ) -> None:
        engine = backend_schema.create_database_engine(f"sqlite:///{path.as_posix()}")
        backend_schema.Base.metadata.create_all(engine)
        session_factory = sessionmaker(bind=engine)
        with session_factory() as session:
            session.add(
                backend_schema.User(
                    fullName=f"{username.title()} User",
                    username=username,
                    email=f"{username}@example.edu",
                    passwordHash="unused",
                )
            )
            if include_club:
                session.add(backend_schema.Club(name="Engineering Club", slug="engineering-club"))
            session.commit()
        engine.dispose()

    @staticmethod
    def valid_graph() -> dict[str, object]:
        return {
            "formatVersion": 1,
            "database": "neo4j",
            "users": [{"userId": 1, "pagerank": 0.5}],
            "clubs": [{"clubId": 1, "pagerank": 0.5}],
            "metadata": [
                {
                    "name": "feed",
                    "schemaVersion": 2,
                    "bootstrappedAt": None,
                    "updatedAt": None,
                }
            ],
            "friendships": [],
            "relationships": [
                {
                    "userId": 1,
                    "clubId": 1,
                    "weight": 0.0,
                    "isMember": False,
                    "isFollower": False,
                }
            ],
            "unknownNodeCount": 0,
            "unknownRelationshipCount": 0,
        }

    def test_inventory_and_graph_validation_accept_consistent_stores(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database_path = Path(temporary_directory) / "source.db"
            self.create_database(database_path)

            inventory = database_sync.sqlite_inventory(database_path)
            database_sync.validate_graph(self.valid_graph(), inventory)

        self.assertEqual(inventory["activeUserIds"], {1})
        self.assertEqual(inventory["activeClubIds"], {1})
        self.assertEqual(inventory["foreignKeyIssues"], 0)

    def test_graph_validation_rejects_stale_cross_store_ids(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database_path = Path(temporary_directory) / "source.db"
            self.create_database(database_path)
            inventory = database_sync.sqlite_inventory(database_path)
            graph = self.valid_graph()
            graph["users"] = [{"userId": 99, "pagerank": 0.5}]

            with self.assertRaisesRegex(database_sync.SyncError, "User IDs"):
                database_sync.validate_graph(graph, inventory)

    def test_inventory_rejects_foreign_key_violations(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database_path = Path(temporary_directory) / "invalid.db"
            self.create_database(database_path)
            connection = sqlite3.connect(database_path)
            try:
                connection.execute("PRAGMA foreign_keys=OFF")
                connection.execute(
                    'INSERT INTO user_interests ("userId", interest, "createdAt") '
                    "VALUES (999, 'orphan', CURRENT_TIMESTAMP)"
                )
                connection.commit()
            finally:
                connection.close()

            with self.assertRaisesRegex(database_sync.SyncError, "foreign-key violation"):
                database_sync.sqlite_inventory(database_path)

    def test_sqlite_replacement_keeps_a_local_rollback_copy(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            temporary_path = Path(temporary_directory)
            source_path = temporary_path / "source.db"
            target_path = temporary_path / "target.db"
            self.create_database(source_path, username="source")
            self.create_database(target_path, username="target")

            rollback_path, staged_path = database_sync.replace_sqlite_database(source_path, target_path)

            self.assertIsNotNone(rollback_path)
            self.assertEqual(rollback_path.parent, target_path.parent)
            self.assertFalse(staged_path.exists())
            connection = sqlite3.connect(target_path)
            try:
                self.assertEqual(connection.execute("SELECT username FROM users").fetchone()[0], "source")
            finally:
                connection.close()

            database_sync.restore_sqlite_rollback(target_path, rollback_path)
            connection = sqlite3.connect(target_path)
            try:
                self.assertEqual(connection.execute("SELECT username FROM users").fetchone()[0], "target")
            finally:
                connection.close()

    def test_early_sqlite_replacement_failure_preserves_target(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            temporary_path = Path(temporary_directory)
            source_path = temporary_path / "source.db"
            target_path = temporary_path / "target.db"
            self.create_database(source_path, username="source")
            self.create_database(target_path, username="target")

            with patch.object(database_sync, "backup_sqlite", side_effect=OSError("backup failed")):
                with self.assertRaisesRegex(OSError, "backup failed"):
                    database_sync.replace_sqlite_database(source_path, target_path)

            connection = sqlite3.connect(target_path)
            try:
                self.assertEqual(connection.execute("SELECT username FROM users").fetchone()[0], "target")
            finally:
                connection.close()

    def test_latest_snapshot_ignores_old_native_dump_format(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            backups_path = Path(temporary_directory)
            old_snapshot = backups_path / "campus_nexus_snapshot_20260101_000000"
            old_snapshot.mkdir()
            (old_snapshot / "campus_nexus.db").touch()
            (old_snapshot / "neo4j.dump").touch()
            compatible = backups_path / "campus_nexus_snapshot_20260102_000000"
            compatible.mkdir()
            for filename in (
                database_sync.SQLITE_FILENAME,
                database_sync.GRAPH_FILENAME,
                database_sync.MANIFEST_FILENAME,
            ):
                (compatible / filename).touch()

            with patch.object(database_sync, "BACKUPS_DIR", backups_path):
                selected = database_sync.latest_snapshot()

        self.assertEqual(selected, compatible)


if __name__ == "__main__":
    unittest.main()
