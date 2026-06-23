from __future__ import annotations

import mimetypes
from pathlib import Path

from app_config import Settings
from supabase_db import create_supabase_client


class SupabaseStorageService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = create_supabase_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )

    def upload_report(
        self,
        local_path: str | Path,
        user_id: int,
        year: int,
        month: int,
    ) -> str:
        object_path = f"{user_id}/{year:04d}/{month:02d}.pdf"
        return self._upload(
            self.settings.supabase_reports_bucket,
            object_path,
            Path(local_path),
        )

    def upload_video_asset(
        self,
        local_path: str | Path,
        project_key: str,
    ) -> str:
        path = Path(local_path)
        object_path = f"{project_key}/{path.name}"
        return self._upload(
            self.settings.supabase_assets_bucket,
            object_path,
            path,
        )

    def signed_url(self, bucket: str, object_path: str, expires_in: int = 3600) -> str:
        response = self.client.storage.from_(bucket).create_signed_url(
            object_path,
            expires_in,
        )
        return response["signedURL"]

    def _upload(self, bucket: str, object_path: str, local_path: Path) -> str:
        content_type = mimetypes.guess_type(local_path.name)[0] or "application/octet-stream"
        self.client.storage.from_(bucket).upload(
            path=object_path,
            file=local_path.read_bytes(),
            file_options={"content-type": content_type, "upsert": "true"},
        )
        return object_path
