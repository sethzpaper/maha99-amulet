from __future__ import annotations

import aiohttp
import discord
from discord.ext import commands

from app_config import Settings
from services import AttendanceService, VideoPipelineService


EXTENSIONS = (
    "cogs.attendance",
    "cogs.video_pipeline",
    "cogs.admin",
)


class MahaniyomBot(commands.Bot):
    def __init__(self, settings: Settings):
        super().__init__(command_prefix="!", intents=discord.Intents.default())
        self.settings = settings
        self.http_session: aiohttp.ClientSession | None = None
        self.attendance_service = AttendanceService(self, settings)
        self.video_service = VideoPipelineService(self, settings)

    async def setup_hook(self) -> None:
        self.http_session = aiohttp.ClientSession()
        for extension in EXTENSIONS:
            await self.load_extension(extension)

        if self.settings.guild_id:
            guild = discord.Object(id=self.settings.guild_id)
            self.tree.copy_global_to(guild=guild)
            await self.tree.sync(guild=guild)
        else:
            await self.tree.sync()

    async def close(self) -> None:
        if self.http_session and not self.http_session.closed:
            await self.http_session.close()
        await super().close()

    async def on_ready(self) -> None:
        print(f"Logged in as {self.user}")
