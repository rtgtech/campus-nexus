from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from sqlalchemy.orm import sessionmaker
from sqlalchemy import Column, DateTime, MetaData, Table, create_engine, select

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET"] = "test-secret-that-is-at-least-32-characters"

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import import_postgres_dump as importer  # noqa: E402
import schema_app as backend_schema  # noqa: E402


class PostgreSQLImportTest(unittest.TestCase):
    def test_import_preserves_timestamp_instants_after_sqlite_roundtrip(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        self.addCleanup(engine.dispose)
        metadata = MetaData()
        table = Table("timestamps", metadata, Column("posted_at", DateTime(timezone=True)))
        metadata.create_all(engine)
        values = ["2026-09-14 12:30:00+05:30", "2026-09-14 03:00:00-04:00", "2026-09-14 07:00:00+00", "2026-09-14 07:00:00"]
        with engine.begin() as connection:
            connection.execute(table.insert(), [{"posted_at": importer.convert_value(value, table.c.posted_at)} for value in values])
            restored = connection.scalars(select(table.c.posted_at)).all()
        self.assertEqual([backend_schema.utc_isoformat(value) for value in restored], ["2026-09-14T07:00:00+00:00"] * len(values))

    def test_copy_parser_decodes_nulls_and_escapes(self) -> None:
        source = [
            'COPY public.sample (id, "displayName", note) FROM stdin;\n',
            '1\tCampus\\tNexus\tline one\\nline two\n',
            '2\t\\N\tbackslash: \\\\\n',
            '\\.\n',
        ]

        tables = importer.parse_copy_stream(source)

        self.assertEqual(tables["sample"][0], ["id", "displayName", "note"])
        self.assertEqual(tables["sample"][1][0], ["1", "Campus\tNexus", "line one\nline two"])
        self.assertEqual(tables["sample"][1][1], ["2", None, "backslash: \\"])

    def test_import_dump_builds_and_replaces_validated_database(self) -> None:
        source_tables = {
            "users": (
                ["userId", "fullName", "username", "email", "passwordHash"],
                [["1", "Imported User", "imported", "imported@example.edu", "hash"]],
            ),
        }
        with tempfile.TemporaryDirectory() as temporary_directory:
            temporary_path = Path(temporary_directory)
            dump_path = temporary_path / "source.dump"
            dump_path.touch()
            database_path = temporary_path / "result.db"
            with patch.object(importer, "restore_copy_data", return_value=source_tables):
                imported, skipped, ignored, previous_database = importer.import_dump(
                    dump_path,
                    database_path,
                    "pg_restore",
                )

            self.assertTrue(database_path.is_file())
            self.assertEqual(imported["users"], 1)
            self.assertEqual(skipped, {})
            self.assertEqual(ignored, {})
            self.assertIsNone(previous_database)

    def test_import_uses_model_defaults_and_validates_counts(self) -> None:
        source_tables = {
            "users": (
                ["userId", "fullName", "username", "email", "passwordHash"],
                [["1", "Imported User", "imported", "imported@example.edu", "hash"]],
            ),
            "user_interests": (
                ["userId", "interest", "createdAt"],
                [["1", "databases", "2026-08-18 12:00:00"]],
            ),
            "auth_sessions": (["sessionId"], [["legacy-session"]]),
        }
        with tempfile.TemporaryDirectory() as temporary_directory:
            database_path = Path(temporary_directory) / "import.db"
            database_engine = backend_schema.create_database_engine(f"sqlite:///{database_path.as_posix()}")
            backend_schema.Base.metadata.create_all(database_engine)
            with database_engine.connect() as connection:
                connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
                connection.commit()
                with connection.begin():
                    imported, skipped, ignored = importer.import_tables(connection, source_tables)
                connection.exec_driver_sql("PRAGMA foreign_keys=ON")
                importer.validate_import(connection, imported)

            session_factory = sessionmaker(bind=database_engine)
            with session_factory() as session:
                user = session.get(backend_schema.User, 1)
                self.assertIsNotNone(user)
                self.assertEqual(user.username, "imported")
                self.assertEqual(user.accountRole, "student")
                self.assertIsNone(user.lastActiveAt)
            database_engine.dispose()

        self.assertEqual(imported["users"], 1)
        self.assertEqual(imported["user_interests"], 1)
        self.assertEqual(skipped, {"auth_sessions": 1})
        self.assertEqual(ignored, {})


if __name__ == "__main__":
    unittest.main()
