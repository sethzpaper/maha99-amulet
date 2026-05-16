from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Iterable, Optional


@dataclass(frozen=True)
class AttendanceEntry:
    id: int
    user_id: int
    user_name: str
    work_date: str
    clock_in: Optional[str]
    clock_out: Optional[str]
    status: str
    reason: Optional[str]
    created_at: str
    updated_at: str


class AttendanceDB:
    def __init__(self, path: str | Path = "attendance.sqlite3"):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    @contextmanager
    def _connect(self):
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_schema(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS attendance_entries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    user_name TEXT NOT NULL,
                    work_date TEXT NOT NULL,
                    clock_in TEXT,
                    clock_out TEXT,
                    status TEXT NOT NULL DEFAULT 'working',
                    reason TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE(user_id, work_date)
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_attendance_month
                ON attendance_entries(user_id, work_date)
                """
            )

    def clock_in(
        self,
        user_id: int,
        user_name: str,
        work_date: date,
        timestamp: datetime,
    ) -> AttendanceEntry:
        existing = self.get_today_entry(user_id, work_date)
        now = timestamp.isoformat()
        if existing and existing.clock_in:
            return existing

        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO attendance_entries (
                    user_id, user_name, work_date, clock_in, status, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, 'working', ?, ?)
                ON CONFLICT(user_id, work_date)
                DO UPDATE SET
                    user_name = excluded.user_name,
                    clock_in = COALESCE(attendance_entries.clock_in, excluded.clock_in),
                    status = CASE
                        WHEN attendance_entries.status IN ('late', 'wfh')
                        THEN attendance_entries.status
                        ELSE 'working'
                    END,
                    updated_at = excluded.updated_at
                """,
                (user_id, user_name, work_date.isoformat(), now, now, now),
            )
        return self.get_today_entry(user_id, work_date)

    def clock_out(
        self,
        user_id: int,
        user_name: str,
        work_date: date,
        timestamp: datetime,
    ) -> AttendanceEntry:
        existing = self.get_today_entry(user_id, work_date)
        if not existing or not existing.clock_in:
            raise ValueError("clock_out_without_clock_in")

        now = timestamp.isoformat()
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE attendance_entries
                SET user_name = ?, clock_out = ?, status = 'completed', updated_at = ?
                WHERE user_id = ? AND work_date = ?
                """,
                (user_name, now, now, user_id, work_date.isoformat()),
            )
        return self.get_today_entry(user_id, work_date)

    def mark_status(
        self,
        user_id: int,
        user_name: str,
        work_date: date,
        status: str,
        reason: Optional[str],
        timestamp: datetime,
    ) -> AttendanceEntry:
        now = timestamp.isoformat()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO attendance_entries (
                    user_id, user_name, work_date, status, reason, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, work_date)
                DO UPDATE SET
                    user_name = excluded.user_name,
                    status = excluded.status,
                    reason = excluded.reason,
                    updated_at = excluded.updated_at
                """,
                (user_id, user_name, work_date.isoformat(), status, reason, now, now),
            )
        return self.get_today_entry(user_id, work_date)

    def get_today_entry(self, user_id: int, work_date: date) -> Optional[AttendanceEntry]:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT * FROM attendance_entries
                WHERE user_id = ? AND work_date = ?
                """,
                (user_id, work_date.isoformat()),
            ).fetchone()
        return self._entry_from_row(row) if row else None

    def month_entries(self, user_id: int, year: int, month: int) -> list[AttendanceEntry]:
        start = f"{year:04d}-{month:02d}-01"
        end_month = month + 1
        end_year = year
        if end_month == 13:
            end_month = 1
            end_year += 1
        end = f"{end_year:04d}-{end_month:02d}-01"

        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM attendance_entries
                WHERE user_id = ? AND work_date >= ? AND work_date < ?
                ORDER BY work_date ASC
                """,
                (user_id, start, end),
            ).fetchall()
        return [self._entry_from_row(row) for row in rows]

    @staticmethod
    def worked_seconds(entries: Iterable[AttendanceEntry]) -> int:
        total = 0
        for entry in entries:
            if not entry.clock_in or not entry.clock_out:
                continue
            start = datetime.fromisoformat(entry.clock_in)
            end = datetime.fromisoformat(entry.clock_out)
            total += max(0, int((end - start).total_seconds()))
        return total

    @staticmethod
    def _entry_from_row(row: sqlite3.Row) -> AttendanceEntry:
        return AttendanceEntry(
            id=row["id"],
            user_id=row["user_id"],
            user_name=row["user_name"],
            work_date=row["work_date"],
            clock_in=row["clock_in"],
            clock_out=row["clock_out"],
            status=row["status"],
            reason=row["reason"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
