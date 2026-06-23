from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv


load_dotenv(Path(__file__).parent / ".env")


def _env_int(name: str) -> int:
    return int(os.getenv(name, "0") or "0")


@dataclass(frozen=True)
class Settings:
    database_backend: str
    supabase_url: str | None
    supabase_service_role_key: str | None
    supabase_reports_bucket: str
    supabase_assets_bucket: str
    discord_client_id: str | None
    discord_client_secret: str | None
    activity_host: str
    activity_port: int
    activity_dev_bypass: bool
    ai_job_webhook_url: str | None
    job_worker_poll_seconds: int
    discord_token: str | None
    guild_id: int
    timezone: ZoneInfo
    attendance_db_path: str
    attendance_channel_id: int
    attendance_log_channel_id: int
    attendance_webhook_url: str | None
    attendance_default_daily_rate: float
    admin_web_host: str
    admin_web_port: int
    admin_web_token: str | None
    video_db_path: str
    video_master_channel_id: int
    video_approved_channel_id: int
    video_pipeline_webhook_url: str | None
    video_stage_channel_ids: dict[str, int]


def load_settings() -> Settings:
    return Settings(
        database_backend=os.getenv("DATABASE_BACKEND", "sqlite").strip().lower(),
        supabase_url=os.getenv("SUPABASE_URL"),
        supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
        supabase_reports_bucket=os.getenv(
            "SUPABASE_REPORTS_BUCKET",
            "attendance-reports",
        ),
        supabase_assets_bucket=os.getenv(
            "SUPABASE_ASSETS_BUCKET",
            "video-assets",
        ),
        discord_client_id=os.getenv("DISCORD_CLIENT_ID"),
        discord_client_secret=os.getenv("DISCORD_CLIENT_SECRET"),
        activity_host=os.getenv("ACTIVITY_HOST", "127.0.0.1"),
        activity_port=_env_int("ACTIVITY_PORT") or 8092,
        activity_dev_bypass=os.getenv(
            "ACTIVITY_DEV_BYPASS",
            "false",
        ).strip().lower() in ("1", "true", "yes"),
        ai_job_webhook_url=os.getenv("AI_JOB_WEBHOOK_URL"),
        job_worker_poll_seconds=_env_int("JOB_WORKER_POLL_SECONDS") or 5,
        discord_token=os.getenv("DISCORD_TOKEN"),
        guild_id=_env_int("DISCORD_GUILD_ID"),
        timezone=ZoneInfo(os.getenv("TIMEZONE", "Asia/Bangkok")),
        attendance_db_path=os.getenv("ATTENDANCE_DB_PATH", "runtime/attendance.sqlite3"),
        attendance_channel_id=_env_int("ATTENDANCE_CHANNEL_ID"),
        attendance_log_channel_id=_env_int("ATTENDANCE_LOG_CHANNEL_ID"),
        attendance_webhook_url=os.getenv("ATTENDANCE_WEBHOOK_URL"),
        attendance_default_daily_rate=float(
            os.getenv("ATTENDANCE_DEFAULT_DAILY_RATE", "400")
        ),
        admin_web_host=os.getenv("ADMIN_WEB_HOST", "127.0.0.1"),
        admin_web_port=_env_int("ADMIN_WEB_PORT") or 8080,
        admin_web_token=os.getenv("ADMIN_WEB_TOKEN"),
        video_db_path=os.getenv("VIDEO_PIPELINE_DB_PATH", "runtime/video_pipeline.sqlite3"),
        video_master_channel_id=_env_int("VIDEO_MASTER_CHANNEL_ID"),
        video_approved_channel_id=_env_int("VIDEO_APPROVED_CHANNEL_ID"),
        video_pipeline_webhook_url=os.getenv("VIDEO_PIPELINE_WEBHOOK_URL"),
        video_stage_channel_ids={
            "idea": _env_int("VIDEO_STAGE_IDEA_CHANNEL_ID"),
            "image_gen": _env_int("VIDEO_STAGE_IMAGE_GEN_CHANNEL_ID"),
            "storyboard": _env_int("VIDEO_STAGE_STORYBOARD_CHANNEL_ID"),
            "render": _env_int("VIDEO_STAGE_RENDER_CHANNEL_ID"),
            "review": _env_int("VIDEO_STAGE_REVIEW_CHANNEL_ID"),
            "edits": _env_int("VIDEO_STAGE_EDITS_CHANNEL_ID"),
            "approved": _env_int("VIDEO_STAGE_APPROVED_CHANNEL_ID"),
        },
    )
