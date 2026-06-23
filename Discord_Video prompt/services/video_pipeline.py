from __future__ import annotations

from datetime import datetime
from typing import Optional

import aiohttp
import discord

from app_config import Settings
from database_factory import create_video_pipeline_db
from video_pipeline_db import VideoProject


class VideoPipelineService:
    def __init__(self, bot: discord.Client, settings: Settings):
        self.bot = bot
        self.settings = settings
        self.db = create_video_pipeline_db(settings)

    def now(self) -> datetime:
        return datetime.now(self.settings.timezone)

    @staticmethod
    def display_name(user: discord.abc.User) -> str:
        return getattr(user, "display_name", None) or user.name

    async def resolve_project(
        self,
        interaction: discord.Interaction,
        project_id: Optional[str],
    ) -> Optional[VideoProject]:
        try:
            if project_id:
                return self.db.get_project(project_id)
            if isinstance(interaction.channel, discord.Thread):
                return self.db.get_project_by_thread(interaction.channel.id)
        except KeyError:
            pass

        message = "ไม่พบโปรเจ็กต์ ระบุ project_id หรือใช้คำสั่งนี้ใน thread ของโปรเจ็กต์"
        if interaction.response.is_done():
            await interaction.followup.send(message, ephemeral=True)
        else:
            await interaction.response.send_message(message, ephemeral=True)
        return None

    async def send_webhook(
        self,
        action: str,
        project: VideoProject,
        extra: Optional[dict] = None,
    ) -> None:
        webhook_url = self.settings.video_pipeline_webhook_url
        session = getattr(self.bot, "http_session", None)
        if not webhook_url or not session:
            return
        payload = {
            "action": action,
            "project_key": project.project_key,
            "title": project.title,
            "stage": project.stage,
            "owner_id": str(project.owner_id),
            "owner_name": project.owner_name,
            "thread_id": str(project.thread_id) if project.thread_id else None,
            "notion_url": project.notion_url,
            "drive_url": project.drive_url,
            "final_asset_url": project.final_asset_url,
        }
        if extra:
            payload.update(extra)
        async with session.post(webhook_url, json=payload) as response:
            if response.status >= 400:
                print(f"Video webhook failed: {response.status} {await response.text()}")

    async def safe_send_webhook(
        self,
        action: str,
        project: VideoProject,
        extra: Optional[dict] = None,
    ) -> None:
        try:
            await self.send_webhook(action, project, extra)
        except (aiohttp.ClientError, discord.HTTPException) as exc:
            print(f"Video webhook failed for {action}: {exc}")

    async def post_to_stage(self, project: VideoProject, *, content=None, view=None) -> None:
        channel_id = self.settings.video_stage_channel_ids.get(project.stage, 0)
        channel = self.bot.get_channel(channel_id) if channel_id else None
        if channel and hasattr(channel, "send"):
            await channel.send(content=content, view=view)

    async def post_to_thread(self, project: VideoProject, *, content=None, view=None) -> None:
        channel = self.bot.get_channel(project.thread_id) if project.thread_id else None
        if channel and hasattr(channel, "send"):
            await channel.send(content=content, view=view)
