from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import tempfile
from collections.abc import Iterable
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, TextIO

from sqlalchemy import Boolean, Date, DateTime, Float, Integer, Numeric, func, select
from sqlalchemy.engine import Connection

try:
    from .schema_app import BACKEND_DIR, Base, create_database_engine, engine as application_engine
except ImportError:
    from schema_app import BACKEND_DIR, Base, create_database_engine, engine as application_engine


ROOT_DIR = BACKEND_DIR.parent
DEFAULT_SQLITE_PATH = BACKEND_DIR / "campus_nexus.db"
COPY_HEADER_RE = re.compile(r"^COPY public\.([a-z_][a-z0-9_]*) \((.+)\) FROM stdin;$")
COLUMN_RE = re.compile(r'"((?:[^"]|"")+)"|([A-Za-z_][A-Za-z0-9_]*)')
COPY_ESCAPES = {
    "b": "\b",
    "f": "\f",
    "n": "\n",
    "r": "\r",
    "t": "\t",
    "v": "\v",
    "\\": "\\",
}


class ImportFailure(RuntimeError):
    pass


def copy_columns(value: str) -> list[str]:
    return [
        quoted.replace('""', '"') if quoted else unquoted
        for quoted, unquoted in COLUMN_RE.findall(value)
    ]


def decode_copy_value(value: str) -> str | None:
    if value == r"\N":
        return None
    result: list[str] = []
    index = 0
    while index < len(value):
        character = value[index]
        if character != "\\":
            result.append(character)
            index += 1
            continue
        index += 1
        if index >= len(value):
            result.append("\\")
            break
        escaped = value[index]
        if escaped in COPY_ESCAPES:
            result.append(COPY_ESCAPES[escaped])
            index += 1
            continue
        if escaped in "01234567":
            end = index + 1
            while end < min(index + 3, len(value)) and value[end] in "01234567":
                end += 1
            result.append(chr(int(value[index:end], 8)))
            index = end
            continue
        if escaped == "x":
            end = index + 1
            while end < min(index + 3, len(value)) and value[end] in "0123456789abcdefABCDEF":
                end += 1
            if end > index + 1:
                result.append(chr(int(value[index + 1:end], 16)))
                index = end
                continue
        result.append(escaped)
        index += 1
    return "".join(result)


def parse_copy_stream(stream: Iterable[str]) -> dict[str, tuple[list[str], list[list[str | None]]]]:
    tables: dict[str, tuple[list[str], list[list[str | None]]]] = {}
    current_table: str | None = None
    current_columns: list[str] = []
    current_rows: list[list[str | None]] = []

    for raw_line in stream:
        line = raw_line.rstrip("\r\n")
        if current_table is None:
            match = COPY_HEADER_RE.match(line)
            if match is None:
                continue
            current_table = match.group(1)
            current_columns = copy_columns(match.group(2))
            current_rows = []
            continue
        if line == r"\.":
            tables[current_table] = (current_columns, current_rows)
            current_table = None
            current_columns = []
            current_rows = []
            continue
        values = [decode_copy_value(value) for value in line.split("\t")]
        if len(values) != len(current_columns):
            raise ImportFailure(
                f"COPY row for {current_table} has {len(values)} values; expected {len(current_columns)}"
            )
        current_rows.append(values)

    if current_table is not None:
        raise ImportFailure(f"COPY data for {current_table} ended before its terminator")
    return tables


def restore_copy_data(dump_path: Path, pg_restore: str) -> dict[str, tuple[list[str], list[list[str | None]]]]:
    process = subprocess.Popen(
        [
            pg_restore,
            "--data-only",
            "--no-owner",
            "--no-privileges",
            "--file=-",
            str(dump_path),
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
    )
    if process.stdout is None or process.stderr is None:
        process.kill()
        raise ImportFailure("could not read pg_restore output")
    try:
        tables = parse_copy_stream(process.stdout)
        stderr = process.stderr.read().strip()
        return_code = process.wait()
    except Exception:
        process.kill()
        process.wait()
        raise
    if return_code != 0:
        detail = stderr or f"exit code {return_code}"
        raise ImportFailure(f"pg_restore failed: {detail}")
    return tables


def convert_value(value: str | None, column) -> Any:
    if value is None:
        return None
    column_type = column.type
    if isinstance(column_type, Boolean):
        return value.lower() in {"t", "true", "1"}
    if isinstance(column_type, DateTime):
        return datetime.fromisoformat(value.replace(" ", "T", 1))
    if isinstance(column_type, Date):
        return date.fromisoformat(value)
    if isinstance(column_type, Integer):
        return int(value)
    if isinstance(column_type, Float):
        return float(value)
    if isinstance(column_type, Numeric):
        return Decimal(value)
    return value


def chunks(rows: list[dict[str, Any]], size: int = 500) -> Iterable[list[dict[str, Any]]]:
    for start in range(0, len(rows), size):
        yield rows[start:start + size]


def import_tables(
    connection: Connection,
    source_tables: dict[str, tuple[list[str], list[list[str | None]]]],
) -> tuple[dict[str, int], dict[str, int], dict[str, list[str]]]:
    imported: dict[str, int] = {}
    skipped = {
        table_name: len(rows)
        for table_name, (_, rows) in source_tables.items()
        if table_name not in Base.metadata.tables
    }
    ignored_columns: dict[str, list[str]] = {}

    for table in Base.metadata.sorted_tables:
        source = source_tables.get(table.name)
        if source is None:
            imported[table.name] = 0
            continue
        source_columns, source_rows = source
        known_columns = [column_name for column_name in source_columns if column_name in table.c]
        ignored = [column_name for column_name in source_columns if column_name not in table.c]
        if ignored:
            ignored_columns[table.name] = ignored
        column_indexes = [source_columns.index(column_name) for column_name in known_columns]
        converted_rows = [
            {
                column_name: convert_value(source_row[index], table.c[column_name])
                for column_name, index in zip(known_columns, column_indexes)
            }
            for source_row in source_rows
        ]
        for batch in chunks(converted_rows):
            if batch:
                connection.execute(table.insert(), batch)
        imported[table.name] = len(converted_rows)

    return imported, skipped, ignored_columns


def validate_import(connection: Connection, imported: dict[str, int]) -> None:
    foreign_key_issues = connection.exec_driver_sql("PRAGMA foreign_key_check").all()
    if foreign_key_issues:
        tables = sorted({str(issue[0]) for issue in foreign_key_issues})
        raise ImportFailure(
            f"foreign-key validation found {len(foreign_key_issues)} issue(s) in: {', '.join(tables)}"
        )
    for table_name, expected_count in imported.items():
        table = Base.metadata.tables[table_name]
        actual_count = connection.scalar(select(func.count()).select_from(table))
        if actual_count != expected_count:
            raise ImportFailure(
                f"row-count validation failed for {table_name}: expected {expected_count}, found {actual_count}"
            )


def backup_path_for(target_path: Path) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    backup_directory = ROOT_DIR / "backups"
    backup_directory.mkdir(parents=True, exist_ok=True)
    return backup_directory / f"campus_nexus_sqlite_before_import_{timestamp}.db"


def replace_database(imported_path: Path, target_path: Path) -> Path | None:
    application_engine.dispose()
    sidecars = [Path(f"{target_path}{suffix}") for suffix in ("-wal", "-shm")]
    active_sidecars = [path for path in sidecars if path.exists()]
    if active_sidecars:
        raise ImportFailure("SQLite WAL files are active; stop the backend before importing")
    previous_database: Path | None = None
    if target_path.exists():
        previous_database = backup_path_for(target_path)
        shutil.copy2(target_path, previous_database)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    imported_path.replace(target_path)
    return previous_database


def import_dump(
    dump_path: Path,
    target_path: Path,
    pg_restore: str,
) -> tuple[dict[str, int], dict[str, int], dict[str, list[str]], Path | None]:
    if not dump_path.is_file():
        raise ImportFailure(f"PostgreSQL dump does not exist: {dump_path}")
    source_tables = restore_copy_data(dump_path, pg_restore)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_file: TextIO | None = tempfile.NamedTemporaryFile(
        prefix="campus_nexus_import_",
        suffix=".db",
        dir=target_path.parent,
        delete=False,
    )
    imported_path = Path(temporary_file.name)
    temporary_file.close()
    imported_path.unlink()
    database_engine = create_database_engine(f"sqlite:///{imported_path.as_posix()}")
    try:
        Base.metadata.create_all(database_engine)
        with database_engine.connect() as connection:
            connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
            connection.commit()
            with connection.begin():
                imported, skipped, ignored_columns = import_tables(connection, source_tables)
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")
            validate_import(connection, imported)
        database_engine.dispose()
        previous_database = replace_database(imported_path, target_path)
        return imported, skipped, ignored_columns, previous_database
    finally:
        database_engine.dispose()
        if imported_path.exists():
            imported_path.unlink()
        for suffix in ("-wal", "-shm"):
            sidecar = Path(f"{imported_path}{suffix}")
            if sidecar.exists():
                sidecar.unlink()


def main() -> None:
    parser = argparse.ArgumentParser(description="Import a PostgreSQL custom dump into Campus Nexus SQLite")
    parser.add_argument("dump", type=Path, help="path to a pg_dump custom-format archive")
    parser.add_argument("--database", type=Path, default=DEFAULT_SQLITE_PATH, help="destination SQLite file")
    parser.add_argument("--pg-restore", default=shutil.which("pg_restore"), help="path to pg_restore")
    args = parser.parse_args()
    if not args.pg_restore:
        parser.error("pg_restore was not found; install PostgreSQL client tools or pass --pg-restore")

    try:
        imported, skipped, ignored_columns, previous_database = import_dump(
            args.dump.resolve(),
            args.database.resolve(),
            args.pg_restore,
        )
    except ImportFailure as error:
        parser.exit(1, f"Import failed: {error}\n")

    total_rows = sum(imported.values())
    print(f"Imported {total_rows} rows into {args.database.resolve()}")
    for table_name, row_count in sorted(imported.items()):
        print(f"  {table_name}: {row_count}")
    for table_name, row_count in sorted(skipped.items()):
        print(f"  skipped legacy table {table_name}: {row_count}")
    for table_name, column_names in sorted(ignored_columns.items()):
        print(f"  ignored legacy columns in {table_name}: {', '.join(column_names)}")
    if previous_database is not None:
        print(f"Previous SQLite database backed up to {previous_database}")


if __name__ == "__main__":
    main()
