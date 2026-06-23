from __future__ import annotations

from app_config import Settings
from attendance_db import AttendanceDB
from supabase_db import SupabaseAttendanceDB, SupabaseVideoPipelineDB
from video_pipeline_db import VideoPipelineDB


def create_attendance_db(settings: Settings):
    if settings.database_backend == "supabase":
        return SupabaseAttendanceDB(
            settings.supabase_url,
            settings.supabase_service_role_key,
            settings.attendance_default_daily_rate,
        )
    if settings.database_backend != "sqlite":
        raise ValueError(f"Unknown DATABASE_BACKEND: {settings.database_backend}")
    return AttendanceDB(
        settings.attendance_db_path,
        settings.attendance_default_daily_rate,
    )


def create_video_pipeline_db(settings: Settings):
    if settings.database_backend == "supabase":
        return SupabaseVideoPipelineDB(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    if settings.database_backend != "sqlite":
        raise ValueError(f"Unknown DATABASE_BACKEND: {settings.database_backend}")
    return VideoPipelineDB(settings.video_db_path)
