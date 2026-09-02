from __future__ import annotations

import re
import sqlite3
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = ROOT / "campus_nexus_schema.sql"
MODEL_PATH = ROOT / "backend" / "schema_app.py"


class SchemaBaselineTest(unittest.TestCase):
    def test_baseline_contains_every_current_model_table(self) -> None:
        model_source = MODEL_PATH.read_text(encoding="utf-8")
        schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
        model_tables = set(re.findall(r'__tablename__\s*=\s*"([^"]+)"', model_source))
        created_tables = set(
            re.findall(r"^CREATE TABLE ([a-z_]+)\s*\(", schema_sql, flags=re.MULTILINE)
        )

        self.assertEqual(created_tables, model_tables)
        self.assertNotIn("auth_sessions", created_tables)

    def test_baseline_is_structure_only_sqlite(self) -> None:
        schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")

        self.assertIn("PRAGMA foreign_keys=ON;", schema_sql)
        self.assertNotIn("INSERT INTO ", schema_sql)
        self.assertNotIn("public.", schema_sql)
        self.assertNotIn("CREATE SEQUENCE", schema_sql)
        self.assertNotIn("PASSWORD", schema_sql)

    def test_baseline_executes_in_sqlite(self) -> None:
        schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
        connection = sqlite3.connect(":memory:")
        try:
            connection.executescript(schema_sql)
            created_tables = {
                row[0]
                for row in connection.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
                )
            }
        finally:
            connection.close()

        model_source = MODEL_PATH.read_text(encoding="utf-8")
        model_tables = set(re.findall(r'__tablename__\s*=\s*"([^"]+)"', model_source))
        self.assertEqual(created_tables, model_tables)

    def test_historical_migration_directory_is_absent(self) -> None:
        self.assertFalse((ROOT / "backend" / "migrations").exists())


if __name__ == "__main__":
    unittest.main()
