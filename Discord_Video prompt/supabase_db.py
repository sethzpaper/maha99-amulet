from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any, Iterable, Optional

from supabase import Client, create_client

from attendance_db import AttendanceEmployee, AttendanceEntry
from video_pipeline_db import (
    ASSET_TYPES,
    STAGES,
    VideoAsset,
    VideoCost,
    VideoProject,
)


def create_supabase_client(url: str | None, service_role_key: str | None) -> Client:
    if not url or not service_role_key:
        raise RuntimeError(
            "DATABASE_BACKEND=supabase requires SUPABASE_URL and "
            "SUPABASE_SERVICE_ROLE_KEY"
        )
    return create_client(url, service_role_key)


def _first(data: list[dict[str, Any]], key: object) -> dict[str, Any]:
    if not data:
        raise KeyError(key)
    return data[0]


class SupabaseAttendanceDB:
    def __init__(
        self,
        url: str | None,
        service_role_key: str | None,
        default_daily_rate: float = 400.0,
        client: Client | None = None,
    ):
        self.client = client or create_supabase_client(url, service_role_key)
        self.default_daily_rate = float(default_daily_rate)

    def clock_in(
        self,
        user_id: int,
        user_name: str,
        work_date: date,
        timestamp: datetime,
    ) -> AttendanceEntry:
        existing = self.get_today_entry(user_id, work_date)
        self.upsert_employee(user_id, user_name, timestamp)
        if existing and existing.clock_in:
            return existing

        now = timestamp.isoformat()
        status = existing.status if existing and existing.status in ("late", "wfh") else "working"
        payload = {
            "user_id": user_id,
            "user_name": user_name,
            "work_date": work_date.isoformat(),
            "clock_in": existing.clock_in if existing else now,
            "clock_out": existing.clock_out if existing else None,
            "status": status,
            "reason": existing.reason if existing else None,
            "updated_at": now,
        }
        if not existing:
            payload["created_at"] = now
        self.client.table("attendance_entries").upsert(
            payload,
            on_conflict="user_id,work_date",
        ).execute()
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
        self.upsert_employee(user_id, user_name, timestamp)
        self.client.table("attendance_entries").update(
            {
                "user_name": user_name,
                "clock_out": timestamp.isoformat(),
                "status": "completed",
                "updated_at": timestamp.isoformat(),
            }
        ).eq("user_id", user_id).eq("work_date", work_date.isoformat()).execute()
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
        self.upsert_employee(user_id, user_name, timestamp)
        existing = self.get_today_entry(user_id, work_date)
        payload = {
            "user_id": user_id,
            "user_name": user_name,
            "work_date": work_date.isoformat(),
            "clock_in": existing.clock_in if existing else None,
            "clock_out": existing.clock_out if existing else None,
            "status": status,
            "reason": reason,
            "updated_at": timestamp.isoformat(),
        }
        if not existing:
            payload["created_at"] = timestamp.isoformat()
        self.client.table("attendance_entries").upsert(
            payload,
            on_conflict="user_id,work_date",
        ).execute()
        return self.get_today_entry(user_id, work_date)

    def get_today_entry(
        self,
        user_id: int,
        work_date: date,
    ) -> Optional[AttendanceEntry]:
        response = (
            self.client.table("attendance_entries")
            .select("*")
            .eq("user_id", user_id)
            .eq("work_date", work_date.isoformat())
            .limit(1)
            .execute()
        )
        return self._entry(response.data[0]) if response.data else None

    def month_entries(
        self,
        user_id: int,
        year: int,
        month: int,
    ) -> list[AttendanceEntry]:
        end_month = month + 1
        end_year = year
        if end_month == 13:
            end_month = 1
            end_year += 1
        response = (
            self.client.table("attendance_entries")
            .select("*")
            .eq("user_id", user_id)
            .gte("work_date", f"{year:04d}-{month:02d}-01")
            .lt("work_date", f"{end_year:04d}-{end_month:02d}-01")
            .order("work_date")
            .execute()
        )
        return [self._entry(row) for row in response.data]

    def upsert_employee(
        self,
        user_id: int,
        user_name: str,
        timestamp: datetime,
    ) -> AttendanceEmployee:
        existing = self.get_employee(user_id)
        payload = {
            "user_id": user_id,
            "user_name": user_name,
            "daily_rate": existing.daily_rate if existing else self.default_daily_rate,
            "updated_at": timestamp.isoformat(),
        }
        if existing:
            payload["full_name"] = existing.full_name
            payload["created_at"] = existing.created_at
        else:
            payload["created_at"] = timestamp.isoformat()
        self.client.table("attendance_employees").upsert(
            payload,
            on_conflict="user_id",
        ).execute()
        return self.get_employee(user_id)

    def get_employee(self, user_id: int) -> Optional[AttendanceEmployee]:
        response = (
            self.client.table("attendance_employees")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return self._employee(response.data[0]) if response.data else None

    def list_employees(self) -> list[AttendanceEmployee]:
        response = (
            self.client.table("attendance_employees")
            .select("*")
            .order("full_name")
            .order("user_name")
            .execute()
        )
        return [self._employee(row) for row in response.data]

    def set_daily_rate(
        self,
        user_id: int,
        daily_rate: float,
        timestamp: datetime,
    ) -> AttendanceEmployee:
        if daily_rate < 0:
            raise ValueError("daily_rate_must_be_non_negative")
        response = (
            self.client.table("attendance_employees")
            .update(
                {
                    "daily_rate": float(daily_rate),
                    "updated_at": timestamp.isoformat(),
                }
            )
            .eq("user_id", user_id)
            .execute()
        )
        _first(response.data, user_id)
        return self.get_employee(user_id)

    def set_full_name(
        self,
        user_id: int,
        full_name: str,
        timestamp: datetime,
    ) -> AttendanceEmployee:
        response = (
            self.client.table("attendance_employees")
            .update(
                {
                    "full_name": full_name.strip() or None,
                    "updated_at": timestamp.isoformat(),
                }
            )
            .eq("user_id", user_id)
            .execute()
        )
        _first(response.data, user_id)
        return self.get_employee(user_id)

    def daily_rate_for(self, user_id: int) -> float:
        employee = self.get_employee(user_id)
        return employee.daily_rate if employee else self.default_daily_rate

    @staticmethod
    def worked_seconds(entries: Iterable[AttendanceEntry]) -> int:
        total = 0
        for entry in entries:
            if entry.clock_in and entry.clock_out:
                start = datetime.fromisoformat(entry.clock_in)
                end = datetime.fromisoformat(entry.clock_out)
                total += max(0, int((end - start).total_seconds()))
        return total

    @staticmethod
    def _entry(row: dict[str, Any]) -> AttendanceEntry:
        return AttendanceEntry(
            id=row["id"],
            user_id=row["user_id"],
            user_name=row["user_name"],
            work_date=row["work_date"],
            clock_in=row.get("clock_in"),
            clock_out=row.get("clock_out"),
            status=row["status"],
            reason=row.get("reason"),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    @staticmethod
    def _employee(row: dict[str, Any]) -> AttendanceEmployee:
        return AttendanceEmployee(
            user_id=row["user_id"],
            user_name=row["user_name"],
            full_name=row.get("full_name"),
            daily_rate=float(row["daily_rate"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )


class SupabaseVideoPipelineDB:
    def __init__(
        self,
        url: str | None,
        service_role_key: str | None,
        client: Client | None = None,
    ):
        self.client = client or create_supabase_client(url, service_role_key)

    def create_project(
        self,
        title: str,
        brief: str,
        owner_id: int,
        owner_name: str,
        timestamp: datetime,
        thread_id: Optional[int] = None,
    ) -> VideoProject:
        base_key = self._new_project_key(title, timestamp)
        key = base_key
        for attempt in range(2, 100):
            response = (
                self.client.table("video_projects")
                .select("id")
                .eq("project_key", key)
                .limit(1)
                .execute()
            )
            if not response.data:
                break
            key = f"{base_key}-{attempt}"
        now = timestamp.isoformat()
        response = self.client.table("video_projects").insert(
            {
                "project_key": key,
                "title": title,
                "brief": brief,
                "stage": "idea",
                "owner_id": owner_id,
                "owner_name": owner_name,
                "thread_id": thread_id,
                "created_at": now,
                "updated_at": now,
            }
        ).execute()
        project = self._project(_first(response.data, key))
        self._event(project.id, "created", f"Project created: {title}", owner_id, owner_name, now)
        return project

    def set_thread(self, project_key: str, thread_id: int, timestamp: datetime) -> VideoProject:
        self._update_project(project_key, {"thread_id": thread_id}, timestamp)
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
        column = "notion_url" if link_type == "notion" else "drive_url"
        self._update_project(project_key, {column: url}, timestamp)
        self._event(
            project.id,
            "link_updated",
            f"{link_type.title()} link updated: {url}",
            actor_id,
            actor_name,
            timestamp.isoformat(),
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
        message = f"Stage changed: {project.stage} -> {stage}"
        if note:
            message = f"{message}. {note}"
        self._update_project(project_key, {"stage": stage}, timestamp)
        self._event(project.id, "stage_changed", message, actor_id, actor_name, timestamp.isoformat())
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
        response = self.client.table("video_assets").insert(
            {
                "project_id": project.id,
                "asset_type": asset_type,
                "url": url,
                "prompt": prompt,
                "note": note,
                "added_by_id": actor_id,
                "added_by_name": actor_name,
                "created_at": now,
            }
        ).execute()
        asset = self._asset(_first(response.data, project_key))
        self._event(
            project.id,
            "asset_added",
            f"Asset added: {asset_type} {url}",
            actor_id,
            actor_name,
            now,
        )
        if asset_type == "final":
            self._update_project(project_key, {"final_asset_url": url}, timestamp)
        return asset

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
        response = self.client.table("video_costs").insert(
            {
                "project_id": project.id,
                "amount": amount,
                "unit": unit,
                "tool": tool,
                "note": note,
                "added_by_id": actor_id,
                "added_by_name": actor_name,
                "created_at": now,
            }
        ).execute()
        cost = self._cost(_first(response.data, project_key))
        self._event(
            project.id,
            "cost_added",
            f"Cost added: {amount:g} {unit}",
            actor_id,
            actor_name,
            now,
        )
        return cost

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
        final_asset_url = final_url or project.final_asset_url
        message = "Project approved"
        if final_asset_url:
            message = f"{message}: {final_asset_url}"
        if note:
            message = f"{message}. {note}"
        self._update_project(
            project_key,
            {
                "stage": "approved",
                "final_asset_url": final_asset_url,
                "approved_by_id": actor_id,
                "approved_at": timestamp.isoformat(),
            },
            timestamp,
        )
        self._event(
            project.id,
            "approved",
            message,
            actor_id,
            actor_name,
            timestamp.isoformat(),
        )
        return self.get_project(project_key)

    def get_project(self, project_key: str) -> VideoProject:
        response = (
            self.client.table("video_projects")
            .select("*")
            .eq("project_key", project_key)
            .limit(1)
            .execute()
        )
        return self._project(_first(response.data, project_key))

    def get_project_by_thread(self, thread_id: int) -> Optional[VideoProject]:
        response = (
            self.client.table("video_projects")
            .select("*")
            .eq("thread_id", thread_id)
            .limit(1)
            .execute()
        )
        return self._project(response.data[0]) if response.data else None

    def list_projects(self) -> list[VideoProject]:
        response = (
            self.client.table("video_projects")
            .select("*")
            .order("updated_at", desc=True)
            .execute()
        )
        return [self._project(row) for row in response.data]

    def get_asset(self, asset_id: int) -> VideoAsset:
        response = self.client.table("video_assets").select("*").eq("id", asset_id).limit(1).execute()
        return self._asset(_first(response.data, asset_id))

    def get_cost(self, cost_id: int) -> VideoCost:
        response = self.client.table("video_costs").select("*").eq("id", cost_id).limit(1).execute()
        return self._cost(_first(response.data, cost_id))

    def project_assets(self, project_key: str) -> list[VideoAsset]:
        project = self.get_project(project_key)
        response = (
            self.client.table("video_assets")
            .select("*")
            .eq("project_id", project.id)
            .order("created_at")
            .execute()
        )
        return [self._asset(row) for row in response.data]

    def project_costs(self, project_key: str) -> list[VideoCost]:
        project = self.get_project(project_key)
        response = (
            self.client.table("video_costs")
            .select("*")
            .eq("project_id", project.id)
            .order("created_at")
            .execute()
        )
        return [self._cost(row) for row in response.data]

    def cost_total(self, project_key: str, unit: Optional[str] = None) -> float:
        costs = self.project_costs(project_key)
        return sum(cost.amount for cost in costs if unit is None or cost.unit == unit)

    def _update_project(
        self,
        project_key: str,
        values: dict[str, Any],
        timestamp: datetime,
    ) -> None:
        values["updated_at"] = timestamp.isoformat()
        response = (
            self.client.table("video_projects")
            .update(values)
            .eq("project_key", project_key)
            .execute()
        )
        _first(response.data, project_key)

    def _event(
        self,
        project_id: int,
        event_type: str,
        message: str,
        actor_id: int,
        actor_name: str,
        created_at: str,
    ) -> None:
        self.client.table("video_events").insert(
            {
                "project_id": project_id,
                "event_type": event_type,
                "message": message,
                "actor_id": actor_id,
                "actor_name": actor_name,
                "created_at": created_at,
            }
        ).execute()

    @staticmethod
    def _new_project_key(title: str, timestamp: datetime) -> str:
        slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
        return f"vid-{timestamp.strftime('%Y%m%d-%H%M%S')}-{slug[:24] or 'video'}"

    @staticmethod
    def _project(row: dict[str, Any]) -> VideoProject:
        return VideoProject(
            id=row["id"],
            project_key=row["project_key"],
            title=row["title"],
            brief=row["brief"],
            stage=row["stage"],
            owner_id=row["owner_id"],
            owner_name=row["owner_name"],
            thread_id=row.get("thread_id"),
            notion_url=row.get("notion_url"),
            drive_url=row.get("drive_url"),
            final_asset_url=row.get("final_asset_url"),
            approved_by_id=row.get("approved_by_id"),
            approved_at=row.get("approved_at"),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    @staticmethod
    def _asset(row: dict[str, Any]) -> VideoAsset:
        return VideoAsset(
            id=row["id"],
            project_id=row["project_id"],
            asset_type=row["asset_type"],
            url=row["url"],
            prompt=row.get("prompt"),
            note=row.get("note"),
            added_by_id=row["added_by_id"],
            added_by_name=row["added_by_name"],
            created_at=row["created_at"],
        )

    @staticmethod
    def _cost(row: dict[str, Any]) -> VideoCost:
        return VideoCost(
            id=row["id"],
            project_id=row["project_id"],
            amount=float(row["amount"]),
            unit=row["unit"],
            tool=row.get("tool"),
            note=row.get("note"),
            added_by_id=row["added_by_id"],
            added_by_name=row["added_by_name"],
            created_at=row["created_at"],
        )
