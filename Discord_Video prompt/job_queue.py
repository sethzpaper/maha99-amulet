from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from app_config import Settings
from supabase_db import create_supabase_client


@dataclass(frozen=True)
class QueueMessage:
    queue_name: str
    message_id: int
    read_count: int
    payload: dict[str, Any]


class JobQueue:
    def __init__(self, settings: Settings):
        if settings.database_backend != "supabase":
            raise RuntimeError("Queues require DATABASE_BACKEND=supabase")
        self.client = create_supabase_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )

    def enqueue_ai(
        self,
        project_key: str,
        job_type: str,
        payload: dict[str, Any] | None = None,
        delay_seconds: int = 0,
    ) -> int:
        response = self.client.rpc(
            "enqueue_ai_job",
            {
                "project_key": project_key,
                "job_type": job_type,
                "payload": payload or {},
                "delay_seconds": delay_seconds,
            },
        ).execute()
        return int(response.data)

    def enqueue_report(
        self,
        user_id: int,
        year: int,
        month: int,
        delay_seconds: int = 0,
    ) -> int:
        response = self.client.rpc(
            "enqueue_report_job",
            {
                "discord_user_id": user_id,
                "report_year": year,
                "report_month": month,
                "delay_seconds": delay_seconds,
            },
        ).execute()
        return int(response.data)

    def claim(self, queue_name: str, visibility_seconds: int = 300) -> QueueMessage | None:
        response = self.client.rpc(
            "claim_job",
            {
                "target_queue": queue_name,
                "visibility_seconds": visibility_seconds,
            },
        ).execute()
        if not response.data:
            return None
        row = response.data[0]
        return QueueMessage(
            queue_name=queue_name,
            message_id=int(row["msg_id"]),
            read_count=int(row["read_ct"]),
            payload=row["message"],
        )

    def start_run(self, message: QueueMessage, job_type: str) -> None:
        self.client.table("job_runs").upsert(
            {
                "queue_name": message.queue_name,
                "message_id": message.message_id,
                "job_type": job_type,
                "status": "running",
                "payload": message.payload,
                "error": None,
                "finished_at": None,
            },
            on_conflict="queue_name,message_id",
        ).execute()

    def complete(self, message: QueueMessage, result: dict[str, Any]) -> None:
        self.client.table("job_runs").update(
            {
                "status": "completed",
                "result": result,
                "finished_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("queue_name", message.queue_name).eq(
            "message_id",
            message.message_id,
        ).execute()
        self.archive(message)

    def fail(self, message: QueueMessage, error: str) -> None:
        self.client.table("job_runs").update(
            {
                "status": "failed",
                "error": error[:4000],
                "finished_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("queue_name", message.queue_name).eq(
            "message_id",
            message.message_id,
        ).execute()
        if message.read_count >= 3:
            self.archive(message)

    def archive(self, message: QueueMessage) -> None:
        self.client.rpc(
            "archive_job",
            {
                "target_queue": message.queue_name,
                "target_message_id": message.message_id,
            },
        ).execute()
