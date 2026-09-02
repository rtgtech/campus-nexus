from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET"] = "test-secret-that-is-at-least-32-characters"

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import schema_app as backend_schema  # noqa: E402


class SQLiteRuntimeTest(unittest.TestCase):
    def test_default_database_is_backend_local_file(self) -> None:
        self.assertEqual(backend_schema.DEFAULT_DATABASE_PATH, BACKEND_DIR / "campus_nexus.db")
        self.assertTrue(backend_schema.DEFAULT_DATABASE_URL.startswith("sqlite:///"))

    def test_non_sqlite_url_is_rejected(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "must use SQLite"):
            backend_schema.validate_database_url("postgresql://localhost/campus_nexus")

    def test_file_database_persists_and_enforces_pragmas(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database_path = Path(temporary_directory) / "runtime.db"
            database_url = f"sqlite:///{database_path.as_posix()}"
            database_engine = backend_schema.create_database_engine(database_url)
            backend_schema.Base.metadata.create_all(database_engine)
            session_factory = sessionmaker(bind=database_engine, expire_on_commit=False)

            with database_engine.connect() as connection:
                self.assertEqual(connection.scalar(text("PRAGMA foreign_keys")), 1)
                self.assertEqual(connection.scalar(text("PRAGMA busy_timeout")), 30000)
                self.assertEqual(connection.scalar(text("PRAGMA journal_mode")), "wal")

            with session_factory() as session:
                user = backend_schema.User(
                    fullName="Persistent User",
                    username="persistent-user",
                    email="persistent@example.edu",
                    passwordHash="unused",
                )
                session.add(user)
                session.commit()
                user_id = user.userId

            with database_engine.begin() as connection:
                with self.assertRaises(IntegrityError):
                    connection.execute(
                        text(
                            'INSERT INTO user_interests ("userId", interest, "createdAt") '
                            "VALUES (999999, 'orphan', CURRENT_TIMESTAMP)"
                        )
                    )
            database_engine.dispose()

            reopened_engine = backend_schema.create_database_engine(database_url)
            reopened_session_factory = sessionmaker(bind=reopened_engine)
            with reopened_session_factory() as session:
                persisted_user = session.get(backend_schema.User, user_id)
                self.assertIsNotNone(persisted_user)
                self.assertEqual(persisted_user.username, "persistent-user")
            reopened_engine.dispose()


if __name__ == "__main__":
    unittest.main()
