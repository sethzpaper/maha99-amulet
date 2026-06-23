from __future__ import annotations

import aiohttp
import discord

from app_config import Settings
from attendance_db import AttendanceEntry
from database_factory import create_attendance_db
from supabase_storage import SupabaseStorageService


class AttendanceService:
    def __init__(self, bot: discord.Client, settings: Settings):
        self.bot = bot
        self.settings = settings
        self.db = create_attendance_db(settings)
        self.storage = (
            SupabaseStorageService(settings)
            if settings.database_backend == "supabase"
            else None
        )

    @staticmethod
    def bot_display_name(user: discord.abc.User) -> str:
        return getattr(user, "display_name", None) or user.name

    async def ensure_channel(self, interaction: discord.Interaction) -> bool:
        channel_id = self.settings.attendance_channel_id
        if channel_id and interaction.channel_id != channel_id:
            await interaction.response.send_message(
                "คำสั่งลงเวลาใช้ได้เฉพาะในห้อง #attendance เท่านั้น",
                ephemeral=True,
            )
            return False
        return True

    async def emit_log(self, action: str, entry: AttendanceEntry) -> None:
        payload = {
            "action": action,
            "user_id": str(entry.user_id),
            "user_name": entry.user_name,
            "work_date": entry.work_date,
            "clock_in": entry.clock_in,
            "clock_out": entry.clock_out,
            "status": entry.status,
            "reason": entry.reason,
        }
        text = (
            f"`{action}` | {entry.user_name} | {entry.work_date} | "
            f"status={entry.status} | in={entry.clock_in or '-'} | out={entry.clock_out or '-'}"
        )

        channel_id = self.settings.attendance_log_channel_id
        if channel_id:
            channel = self.bot.get_channel(channel_id)
            if channel and hasattr(channel, "send"):
                await channel.send(text)

        webhook_url = self.settings.attendance_webhook_url
        session = getattr(self.bot, "http_session", None)
        if webhook_url and session:
            async with session.post(webhook_url, json=payload) as response:
                if response.status >= 400:
                    print(f"Attendance webhook failed: {response.status} {await response.text()}")

    async def safe_emit_log(self, action: str, entry: AttendanceEntry) -> None:
        try:
            await self.emit_log(action, entry)
        except (aiohttp.ClientError, discord.HTTPException) as exc:
            print(f"Attendance log failed for {action}: {exc}")
