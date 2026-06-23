from __future__ import annotations

import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app_config import load_settings
from database_factory import create_attendance_db, create_video_pipeline_db
from job_queue import JobQueue, QueueMessage
from reporting import build_monthly_pdf
from supabase_storage import SupabaseStorageService


class JobWorker:
    def __init__(self):
        self.settings = load_settings()
        self.queue = JobQueue(self.settings)
        self.attendance = create_attendance_db(self.settings)
        self.video = create_video_pipeline_db(self.settings)
        self.storage = SupabaseStorageService(self.settings)

    def run_forever(self) -> None:
        print("Job worker started for ai_jobs and report_jobs")
        while True:
            processed = self.process_one("report_jobs")
            processed = self.process_one("ai_jobs") or processed
            if not processed:
                time.sleep(self.settings.job_worker_poll_seconds)

    def process_one(self, queue_name: str) -> bool:
        message = self.queue.claim(queue_name)
        if not message:
            return False
        job_type = (
            message.payload.get("job_type", "ai")
            if queue_name == "ai_jobs"
            else "monthly_report"
        )
        self.queue.start_run(message, job_type)
        try:
            result = (
                self._run_report(message)
                if queue_name == "report_jobs"
                else self._run_ai(message)
            )
            self.queue.complete(message, result)
            print(f"Completed {queue_name}:{message.message_id}")
        except Exception as exc:
            self.queue.fail(message, str(exc))
            print(f"Failed {queue_name}:{message.message_id}: {exc}")
        return True

    def _run_report(self, message: QueueMessage) -> dict[str, Any]:
        user_id = int(message.payload["user_id"])
        year = int(message.payload["year"])
        month = int(message.payload["month"])
        employee = self.attendance.get_employee(user_id)
        if not employee:
            raise KeyError(f"Unknown employee: {user_id}")
        entries = self.attendance.month_entries(user_id, year, month)
        report_path = (
            Path("reports")
            / f"attendance_{user_id}_{year:04d}_{month:02d}.pdf"
        )
        build_monthly_pdf(
            report_path,
            employee.full_name or employee.user_name,
            year,
            month,
            entries,
            employee.daily_rate,
        )
        object_path = self.storage.upload_report(
            report_path,
            user_id,
            year,
            month,
        )
        return {
            "bucket": self.settings.supabase_reports_bucket,
            "object_path": object_path,
            "entries": len(entries),
        }

    def _run_ai(self, message: QueueMessage) -> dict[str, Any]:
        project_key = message.payload["project_key"]
        project = self.video.get_project(project_key)
        webhook_url = self.settings.ai_job_webhook_url
        if not webhook_url:
            raise RuntimeError("AI_JOB_WEBHOOK_URL is not configured")
        body = {
            "message_id": message.message_id,
            "project": {
                "project_key": project.project_key,
                "title": project.title,
                "brief": project.brief,
                "stage": project.stage,
            },
            "job_type": message.payload["job_type"],
            "payload": message.payload.get("payload", {}),
            "requested_at": datetime.now(self.settings.timezone).isoformat(),
        }
        response = httpx.post(webhook_url, json=body, timeout=120)
        response.raise_for_status()
        try:
            output = response.json()
        except ValueError:
            output = {"text": response.text}
        return {"provider_response": output}


if __name__ == "__main__":
    JobWorker().run_forever()
