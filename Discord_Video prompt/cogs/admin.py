from __future__ import annotations

import discord
from discord import app_commands
from discord.ext import commands

from ui_components import build_teamspace_dashboard


NOTION_CHANNELS = [
    "00-ai-video-home",
    "01-video-ideas",
    "02-image-gen",
    "03-storyboard",
    "04-video-render",
    "05-video-review",
    "06-video-edits",
    "07-approved-videos",
    "08-asset-library",
    "09-prompt-library",
    "10-cost-tracker",
    "11-notion-sync-log",
]

MAHANIYOM_CHANNELS = [
    "ai-video-pipeline",
    "video-ideas",
    "image-gen",
    "storyboard",
    "video-render",
    "video-edits",
    "approved-videos",
]


def _env_hint(channels: dict[str, discord.TextChannel]) -> str:
    mapping = {
        "ai-video-pipeline": "VIDEO_MASTER_CHANNEL_ID",
        "video-ideas": "VIDEO_STAGE_IDEA_CHANNEL_ID",
        "image-gen": "VIDEO_STAGE_IMAGE_GEN_CHANNEL_ID",
        "storyboard": "VIDEO_STAGE_STORYBOARD_CHANNEL_ID",
        "video-render": "VIDEO_STAGE_RENDER_CHANNEL_ID",
        "video-edits": "VIDEO_STAGE_EDITS_CHANNEL_ID",
        "approved-videos": "VIDEO_APPROVED_CHANNEL_ID",
        "00-ai-video-home": "VIDEO_MASTER_CHANNEL_ID",
        "01-video-ideas": "VIDEO_STAGE_IDEA_CHANNEL_ID",
        "02-image-gen": "VIDEO_STAGE_IMAGE_GEN_CHANNEL_ID",
        "03-storyboard": "VIDEO_STAGE_STORYBOARD_CHANNEL_ID",
        "04-video-render": "VIDEO_STAGE_RENDER_CHANNEL_ID",
        "05-video-review": "VIDEO_STAGE_REVIEW_CHANNEL_ID",
        "06-video-edits": "VIDEO_STAGE_EDITS_CHANNEL_ID",
        "07-approved-videos": "VIDEO_APPROVED_CHANNEL_ID",
    }
    lines = []
    for name, env_name in mapping.items():
        channel = channels.get(name)
        if channel:
            lines.append(f"{env_name}={channel.id}")
            if name in ("approved-videos", "07-approved-videos"):
                lines.append(f"VIDEO_STAGE_APPROVED_CHANNEL_ID={channel.id}")
    return "\n".join(dict.fromkeys(lines))


class AdminCog(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(name="setup-video-channels", description="Create Notion-style AI video pipeline channels")
    @app_commands.describe(category_name="Discord category name to create or reuse")
    @app_commands.checks.has_permissions(manage_channels=True)
    async def setup_video_channels(
        self,
        interaction: discord.Interaction,
        category_name: str = "AI VIDEO TEAMSPACE",
    ) -> None:
        if not interaction.guild:
            await interaction.response.send_message("ใช้คำสั่งนี้ใน server เท่านั้น", ephemeral=True)
            return
        await interaction.response.defer(ephemeral=True, thinking=True)
        category = discord.utils.get(interaction.guild.categories, name=category_name)
        if not category:
            category = await interaction.guild.create_category(category_name)
        channels: dict[str, discord.TextChannel] = {}
        for name in NOTION_CHANNELS:
            channel = discord.utils.get(category.text_channels, name=name)
            channels[name] = channel or await category.create_text_channel(name)
        home = channels["00-ai-video-home"]
        await home.send(view=build_teamspace_dashboard())
        await interaction.followup.send(
            f"สร้าง/ตรวจ channel layout เรียบร้อยแล้ว\nHome: {home.mention}\n\n"
            f"```env\n{_env_hint(channels)}\n```",
            ephemeral=True,
        )

    @setup_video_channels.error
    async def setup_video_channels_error(
        self,
        interaction: discord.Interaction,
        error: app_commands.AppCommandError,
    ) -> None:
        if isinstance(error, app_commands.MissingPermissions):
            await interaction.response.send_message(
                "ต้องมีสิทธิ์ Manage Channels เพื่อใช้คำสั่งนี้",
                ephemeral=True,
            )
            return
        raise error

    @app_commands.command(name="check-video-setup", description="Check Mahaniyom Workflow channel layout")
    @app_commands.describe(category_name="Existing Discord category name")
    async def check_video_setup(
        self,
        interaction: discord.Interaction,
        category_name: str = "Mahaniyom Workflow",
    ) -> None:
        if not interaction.guild:
            await interaction.response.send_message("ใช้คำสั่งนี้ใน server เท่านั้น", ephemeral=True)
            return
        category = discord.utils.get(interaction.guild.categories, name=category_name)
        if not category:
            await interaction.response.send_message(
                f"ไม่พบ category `{category_name}`",
                ephemeral=True,
            )
            return
        found = {
            name: channel
            for name in MAHANIYOM_CHANNELS
            if (channel := discord.utils.get(category.text_channels, name=name))
        }
        missing = [name for name in MAHANIYOM_CHANNELS if name not in found]
        await interaction.response.send_message(
            f"ตรวจ `{category_name}`: {'พร้อมใช้งาน' if not missing else 'ยังขาดบางห้อง'}\n\n"
            f"พบ: {', '.join('#' + name for name in found) or '-'}\n"
            f"ขาด: {', '.join('#' + name for name in missing) or '-'}\n\n"
            f"```env\n{_env_hint(found)}\n```",
            ephemeral=True,
        )

    @app_commands.command(name="project-template", description="Post the Components V2 teamspace dashboard")
    async def project_template(self, interaction: discord.Interaction) -> None:
        if not interaction.channel or not hasattr(interaction.channel, "send"):
            await interaction.response.send_message("ส่ง template ใน channel นี้ไม่ได้", ephemeral=True)
            return
        await interaction.channel.send(view=build_teamspace_dashboard())
        await interaction.response.send_message("ส่ง project dashboard แล้ว", ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(AdminCog(bot))
