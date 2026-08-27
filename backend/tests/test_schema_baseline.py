from __future__ import annotations

import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = ROOT / "campus_nexus_schema.sql"
MODEL_PATH = ROOT / "backend" / "schema_app.py"


class SchemaBaselineTest(unittest.TestCase):
    def test_baseline_contains_every_current_model_table_and_metadata_table(self) -> None:
        model_source = MODEL_PATH.read_text(encoding="utf-8")
        schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
        model_tables = set(re.findall(r'__tablename__\s*=\s*"([^"]+)"', model_source))
        created_tables = set(
            re.findall(r"^CREATE TABLE public\.([a-z_]+)\s*\(", schema_sql, flags=re.MULTILINE)
        )

        self.assertEqual(created_tables, model_tables | {"schema_migrations"})
        self.assertNotIn("auth_sessions", created_tables)

    def test_baseline_is_structure_only_and_starts_at_the_final_version(self) -> None:
        schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")

        self.assertEqual(schema_sql.count("INSERT INTO "), 1)
        self.assertIn("INSERT INTO public.schema_migrations", schema_sql)
        self.assertIn("VALUES ('004_department_options', CURRENT_TIMESTAMP);", schema_sql)
        self.assertNotIn("COPY public.", schema_sql)
        self.assertNotIn("CREATE ROLE", schema_sql)
        self.assertNotIn("PASSWORD", schema_sql)

    def test_historical_migration_directory_is_absent(self) -> None:
        self.assertFalse((ROOT / "backend" / "migrations").exists())


if __name__ == "__main__":
    unittest.main()
