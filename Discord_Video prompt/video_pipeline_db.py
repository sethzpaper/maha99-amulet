from __future__ import annotations

import re
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional


STAGES = ("idea", "image_gen", "storyboard", "render", "review", "edits", "approved")
ASSET_TYPES = ("prompt", "reference", "image", "storyboard", "video", "final", "drive", "other")


@dataclass(frozen=True)
class VideoProject:
    id: int
    project_key: str
    title: str
    brief: str
    stage: str
    owner_id: int
    owner_name: str
    thread_id: Optional[int]
    notion_url: Optional[str]
    drive_url: Optional[str]
    final_asset_url: Optional[str]
    approved_by_id: Optional[int]
    approved_at: Optional[str]
    created_at: str
    updated_at: str


@dataclass(frozen=True)
class VideoAsset:
    id: int
    project_id: int
    asset_type: str
    url: str
    prompt: Optional[str]
    note: Optional[str]
    added_by_id: int
    added_by_name: str
    created_at: str


@dataclass(frozen=True)
class VideoCost:
    id: int
    project_id: int
    amount: float
    unit: str
    tool: Optional[str]
    note: Optional[str]
    added_by_id: int
    added_by_name: str
    created_at: str


class VideoPipelineDB:
    def __init__(self, path: str | Path = "video_pipeline.sqlite3"):
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
                CREATE TABLE IF NOT EXISTS video_projects (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_key TEXT NOT NULL UNIQUE,
                    title TEXT NOT NULL,
                    brief TEXT NOT NULL,
                    stage TEXT NOT NULL,
                    owner_id INTEGER NOT NULL,
                    owner_name TEXT NOT NULL,
                    thread_id INTEGER UNIQUE,
                    notion_url TEXT,
                    drive_url TEXT,
                    final_asset_url TEXT,
                    approved_by_id INTEGER,
                    approved_at TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            self._ensure_column(conn, "video_projects", "notion_url", "TEXT")
            self._ensure_column(conn, "video_projects", "drive_url", "TEXT")
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS video_assets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id INTEGER NOT NULL,
                    asset_type TEXT NOT NULL,
                    url TEXT NOT NULL,
                    prompt TEXT,
                    note TEXT,
                    added_by_id INTEGER NOT NULL,
                    added_by_name TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(project_id) REFERENCES video_projects(id)
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS video_costs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id INTEGER NOT NULL,
                    amount REAL NOT NULL,
                    unit TEXT NOT NULL,
                    tool TEXT,
                    note TEXT,
                    added_by_id INTEGER NOT NULL,
                    added_by_name TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(project_id) REFERENCES video_projects(id)
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS video_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id INTEGER NOT NULL,
                    event_type TEXT NOT NULL,
                    message TEXT NOT NULL,
                    actor_id INTEGER NOT NULL,
                    actor_name TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(project_id) REFERENCES video_projects(id)
                )
                """
            )

    def create_project(
        self,
        title: str,
        brief: str,
        owner_id: int,
        owner_name: str,
        timestamp: datetime,
        thread_id: Optional[int] = None,
    ) -> VideoProject:
        now = timestamp.isoformat()
        base_key = self._new_project_key(title, timestamp)
        key = base_key
        with self._connect() as conn:
            for attempt in range(2, 100):
                exists = conn.execute(
                    "SELECT 1 FROM video_projects WHERE project_key = ?",
                    (key,),
                ).fetchone()
                if not exists:
                    break
                key = f"{base_key}-{attempt}"
            cursor = conn.execute(
                """
                INSERT INTO video_projects (
                    project_key, title, brief, stage, owner_id, owner_name,
                    thread_id, created_at, updated_at
                )
                VALUES (?, ?, ?, 'idea', ?, ?, ?, ?, ?)
                """,
                (key, title, brief, owner_id, owner_name, thread_id, now, now),
            )
            project_id = cursor.lastrowid
            conn.execute(
                """
                INSERT INTO video_events (
                    project_id, event_type, message, actor_id, actor_name, created_at
                )
                VALUES (?, 'created', ?, ?, ?, ?)
                """,
                (project_id, f"Project created: {title}", owner_id, owner_name, now),
            )
        return self.get_project(key)

    def set_thread(self, project_key: str, thread_id: int, timestamp: datetime) -> VideoProject:
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE video_projects
                SET thread_id = ?, updated_at = ?
                WHERE project_key = ?
                """,
                (thread_id, timestamp.isoformat(), project_key),
            )
        return self.get_project(project_key)

    def set_project_link(
        self,
        project_key: str,
        link_type: str,
        url: str,
        actor_id: int,
        actor_name: str,
        timestamp: datetime,
    ) -> VideoProject:
        if link_type not in ("notion", "drive"):
            raise ValueError(f"Unknown link type: {link_type}")
        project = self.get_project(project_key)
        now = timestamp.isoformat()
        column = "notion_url" if link_type == "notion" else "drive_url"
        with self._connect() as conn:
            conn.execute(
                f"""
                UPDATE video_projects
                SET {column} = ?, updated_at = ?
                WHERE project_key = ?
                """,
                (url, now, project_key),
            )
            conn.execute(
                """
                INSERT INTO video_events (
                    project_id, event_type, message, actor_id, actor_name, created_at
                )
                VALUES (?, 'link_updated', ?, ?, ?, ?)
                """,
                (project.id, f"{link_type.title()} link updated: {url}", actor_id, actor_name, now),
            )
        return self.get_project(project_key)

    def set_stage(
        self,
        project_key: str,
        stage: str,
        actor_id: int,
        actor_name: str,
        timestamp: datetime,
        note: Optional[str] = None,
    ) -> VideoProject:
        if stage not in STAGES:
            raise ValueError(f"Unknown stage: {stage}")
        project = self.get_project(project_key)
        now = timestamp.isoformat()
        message = f"Stage changed: {project.stage} -> {stage}"
        if note:
            message = f"{message}. {note}"
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE video_projects
                SET stage = ?, updated_at = ?
                WHERE project_key = ?
                """,
                (stage, now, project_key),
            )
            conn.execute(
                """
                INSERT INTO video_events (
                    project_id, event_type, message, actor_id, actor_name, created_at
                )
                VALUES (?, 'stage_changed', ?, ?, ?, ?)
                """,
                (project.id, message, actor_id, actor_name, now),
            )
        return self.get_project(project_key)

    def attach_asset(
        self,
        project_key: str,
        asset_type: str,
        url: str,
        prompt: Optional[str],
        note: Optional[str],
        actor_id: int,
        actor_name: str,
        timestamp: datetime,
    ) -> VideoAsset:
        if asset_type not in ASSET_TYPES:
            raise ValueError(f"Unknown asset type: {asset_type}")
        project = self.get_project(project_key)
        now = timestamp.isoformat()
        with self._connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO video_assets (
                    project_id, asset_type, url, prompt, note,
                    added_by_id, added_by_name, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (project.id, asset_type, url, prompt, note, actor_id, actor_name, now),
            )
            asset_id = cursor.lastrowid
            conn.execute(
                """
                INSERT INTO video_events (
                    project_id, event_type, message, actor_id, actor_name, created_at
                )
                VALUES (?, 'asset_added', ?, ?, ?, ?)
                """,
                (project.id, f"Asset added: {asset_type} {url}", actor_id, actor_name, now),
            )
            if asset_type == "final":
                conn.execute(
                    """
                    UPDATE video_projects
                    SET final_asset_url = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (url, now, project.id),
                )
        return self.get_asset(asset_id)

    def add_cost(
        self,
        project_key: str,
        amount: float,
        unit: str,
        tool: Optional[str],
        note: Optional[str],
        actor_id: int,
        actor_name: str,
        timestamp: datetime,
    ) -> VideoCost:
        project = self.get_project(project_key)
        now = timestamp.isoformat()
        with self._connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO video_costs (
                    project_id, amount, unit, tool, note,
                    added_by_id, added_by_name, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (project.id, amount, unit, tool, note, actor_id, actor_name, now),
            )
            cost_id = cursor.lastrowid
            conn.execute(
                """
                INSERT INTO video_events (
                    project_id, event_type, message, actor_id, actor_name, created_at
                )
                VALUES (?, 'cost_added', ?, ?, ?, ?)
                """,
                (project.id, f"Cost added: {amount:g} {unit}", actor_id, actor_name, now),
            )
        return self.get_cost(cost_id)

    def approve(
        self,
        project_key: str,
        final_url: Optional[str],
        actor_id: int,
        actor_name: str,
        timestamp: datetime,
        note: Optional[str] = None,
    ) -> VideoProject:
        project = self.get_project(project_key)
        now = timestamp.isoformat()
        final_asset_url = final_url or project.final_asset_url
        message = "Project approved"
        if final_asset_url:
            message = f"{message}: {final_asset_url}"
        if note:
            message = f"{message}. {note}"
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE video_projects
                SET stage = 'approved',
                    final_asset_url = ?,
                    approved_by_id = ?,
                    approved_at = ?,
                    updated_at = ?
                WHERE project_key = ?
                """,
                (final_asset_url, actor_id, now, now, project_key),
            )
            conn.execute(
                """
                INSERT INTO video_events (
                    project_id, event_type, message, actor_id, actor_name, created_at
                )
                VALUES (?, 'approved', ?, ?, ?, ?)
                """,
                (project.id, message, actor_id, actor_name, now),
            )
        return self.get_project(project_key)

    def get_project(self, project_key: str) -> VideoProject:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM video_projects WHERE project_key = ?",
                (project_key,),
            ).fetchone()
        if not row:
            raise KeyError(project_key)
        return self._project_from_row(row)

    def get_project_by_thread(self, thread_id: int) -> Optional[VideoProject]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM video_projects WHERE thread_id = ?",
                (thread_id,),
            ).fetchone()
        return self._project_from_row(row) if row else None

    def get_asset(self, asset_id: int) -> VideoAsset:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM video_assets WHERE id = ?", (asset_id,)).fetchone()
        if not row:
            raise KeyError(asset_id)
        return self._asset_from_row(row)

    def get_cost(self, cost_id: int) -> VideoCost:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM video_costs WHERE id = ?", (cost_id,)).fetchone()
        if not row:
            raise KeyError(cost_id)
        return self._cost_from_row(row)

    def project_assets(self, project_key: str) -> list[VideoAsset]:
        project = self.get_project(project_key)
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM video_assets
                WHERE project_id = ?
                ORDER BY created_at ASC
                """,
                (project.id,),
            ).fetchall()
        return [self._asset_from_row(row) for row in rows]

    def project_costs(self, project_key: str) -> list[VideoCost]:
        project = self.get_project(project_key)
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM video_costs
                WHERE project_id = ?
                ORDER BY created_at ASC
                """,
                (project.id,),
            ).fetchall()
        return [self._cost_from_row(row) for row in rows]

    def cost_total(self, project_key: str, unit: Optional[str] = None) -> float:
        project = self.get_project(project_key)
        query = "SELECT SUM(amount) AS total FROM video_costs WHERE project_id = ?"
        params: tuple[object, ...] = (project.id,)
        if unit:
            query += " AND unit = ?"
            params = (project.id, unit)
        with self._connect() as conn:
            row = conn.execute(query, params).fetchone()
        return float(row["total"] or 0)

    @staticmethod
    def _ensure_column(
        conn: sqlite3.Connection,
        table_name: str,
        column_name: str,
        column_type: str,
    ) -> None:
        columns = {
            row["name"]
            for row in conn.execute(f"PRAGMA table_info({table_name})").fetchall()
        }
        if column_name not in columns:
            conn.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")

    @staticmethod
    def _new_project_key(title: str, timestamp: datetime) -> str:
        slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
        slug = slug[:24] or "video"
        return f"vid-{timestamp.strftime('%Y%m%d-%H%M%S')}-{slug}"

    @staticmethod
    def _project_from_row(row: sqlite3.Row) -> VideoProject:
        return VideoProject(
            id=row["id"],
            project_key=row["project_key"],
            title=row["title"],
            brief=row["brief"],
            stage=row["stage"],
            owner_id=row["owner_id"],
            owner_name=row["owner_name"],
            thread_id=row["thread_id"],
            notion_url=row["notion_url"],
            drive_url=row["drive_url"],
            final_asset_url=row["final_asset_url"],
            approved_by_id=row["approved_by_id"],
            approved_at=row["approved_at"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    @staticmethod
    def _asset_from_row(row: sqlite3.Row) -> VideoAsset:
        return VideoAsset(
            id=row["id"],
            project_id=row["project_id"],
            asset_type=row["asset_type"],
            url=row["url"],
            prompt=row["prompt"],
            note=row["note"],
            added_by_id=row["added_by_id"],
            added_by_name=row["added_by_name"],
            created_at=row["created_at"],
        )

    @staticmethod
    def _cost_from_row(row: sqlite3.Row) -> VideoCost:
        return VideoCost(
            id=row["id"],
            project_id=row["project_id"],
            amount=row["amount"],
            unit=row["unit"],
            tool=row["tool"],
            note=row["note"],
            added_by_id=row["added_by_id"],
            added_by_name=row["added_by_name"],
            created_at=row["created_at"],
        )
