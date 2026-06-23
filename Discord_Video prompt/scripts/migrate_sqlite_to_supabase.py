from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app_config import load_settings
from supabase_db import create_supabase_client


def rows(path: str, table: str) -> list[dict]:
    if not Path(path).exists():
        return []
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    try:
        return [dict(row) for row in connection.execute(f"select * from {table}")]
    except sqlite3.OperationalError:
        return []
    finally:
        connection.close()


def upsert_batches(client, table: str, data: list[dict], conflict: str) -> int:
    for offset in range(0, len(data), 250):
        client.table(table).upsert(
            data[offset : offset + 250],
            on_conflict=conflict,
        ).execute()
    return len(data)


def main() -> None:
    settings = load_settings()
    client = create_supabase_client(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )
    attendance_employees = rows(
        settings.attendance_db_path,
        "attendance_employees",
    )
    for employee in attendance_employees:
        employee.setdefault("full_name", None)

    migrations = [
        (
            "attendance_employees",
            attendance_employees,
            "user_id",
        ),
        (
            "attendance_entries",
            rows(settings.attendance_db_path, "attendance_entries"),
            "id",
        ),
        (
            "video_projects",
            rows(settings.video_db_path, "video_projects"),
            "id",
        ),
        (
            "video_assets",
            rows(settings.video_db_path, "video_assets"),
            "id",
        ),
        (
            "video_costs",
            rows(settings.video_db_path, "video_costs"),
            "id",
        ),
        (
            "video_events",
            rows(settings.video_db_path, "video_events"),
            "id",
        ),
    ]
    for table, data, conflict in migrations:
        count = upsert_batches(client, table, data, conflict)
        print(f"{table}: migrated {count} rows")
    client.rpc("sync_workflow_sequences").execute()
    print("identity sequences synchronized")


if __name__ == "__main__":
    main()
