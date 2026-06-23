from __future__ import annotations

from typing import Optional

import discord
from discord import app_commands
from discord.ext import commands

from ui_components import build_project_dashboard, build_video_status, project_summary_text
from video_pipeline_db import ASSET_TYPES, STAGES


class VideoPipelineCog(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.service = bot.video_service

    @app_commands.command(name="new-video-project", description="Create a new AI video project thread")
    @app_commands.describe(title="Project title", brief="Idea, prompt, goal, or client note")
    async def new_video_project(
        self,
        interaction: discord.Interaction,
        title: str,
        brief: str,
    ) -> None:
        await interaction.response.defer(ephemeral=True, thinking=True)
        ts = self.service.now()
        project = self.service.db.create_project(
            title,
            brief,
            interaction.user.id,
            self.service.display_name(interaction.user),
            ts,
        )
        parent_id = self.bot.settings.video_master_channel_id
        parent = self.bot.get_channel(parent_id) if parent_id else interaction.channel
        thread = None
        if parent and hasattr(parent, "create_thread"):
            try:
                thread = await parent.create_thread(
                    name=f"{project.project_key} {title}"[:100],
                    auto_archive_duration=10080,
                )
                project = self.service.db.set_thread(project.project_key, thread.id, ts)
            except discord.HTTPException as exc:
                print(f"Could not create project thread: {exc}")

        dashboard = build_project_dashboard(project, brief)
        if thread:
            await thread.send(view=dashboard)
        else:
            await self.service.post_to_stage(project, view=dashboard)
        await self.service.safe_send_webhook("created", project, {"brief": brief})
        await interaction.followup.send(
            f"สร้างโปรเจ็กต์แล้ว\n\n{project_summary_text(project)}",
            ephemeral=True,
        )

    @app_commands.command(name="set-stage", description="Move an AI video project to another stage")
    @app_commands.describe(project_id="Project key; omit inside project thread", note="Optional update note")
    @app_commands.choices(stage=[app_commands.Choice(name=x, value=x) for x in STAGES])
    async def set_stage(
        self,
        interaction: discord.Interaction,
        stage: app_commands.Choice[str],
        project_id: Optional[str] = None,
        note: Optional[str] = None,
    ) -> None:
        project = await self.service.resolve_project(interaction, project_id)
        if not project:
            return
        project = self.service.db.set_stage(
            project.project_key,
            stage.value,
            interaction.user.id,
            self.service.display_name(interaction.user),
            self.service.now(),
            note,
        )
        message = f"Stage updated to `{project.stage}` for `{project.project_key}`"
        if note:
            message += f"\nNote: {note}"
        await interaction.response.send_message(message, ephemeral=True)
        await self.service.post_to_thread(project, content=message)
        await self.service.post_to_stage(
            project,
            view=build_project_dashboard(project),
        )
        await self.service.safe_send_webhook("stage_changed", project, {"note": note})

    @app_commands.command(name="attach-asset", description="Attach prompt, image, storyboard, video, or final link")
    @app_commands.describe(
        url="Drive/S3/R2/Dropbox/Notion/Discord file URL",
        project_id="Project key; omit inside project thread",
        prompt="Prompt or generation settings",
        note="Optional context",
    )
    @app_commands.choices(
        asset_type=[app_commands.Choice(name=x, value=x) for x in ASSET_TYPES]
    )
    async def attach_asset(
        self,
        interaction: discord.Interaction,
        asset_type: app_commands.Choice[str],
        url: str,
        project_id: Optional[str] = None,
        prompt: Optional[str] = None,
        note: Optional[str] = None,
    ) -> None:
        project = await self.service.resolve_project(interaction, project_id)
        if not project:
            return
        asset = self.service.db.attach_asset(
            project.project_key,
            asset_type.value,
            url,
            prompt,
            note,
            interaction.user.id,
            self.service.display_name(interaction.user),
            self.service.now(),
        )
        project = self.service.db.get_project(project.project_key)
        message = f"Asset attached: `{asset.asset_type}`\n{asset.url}"
        if note:
            message += f"\nNote: {note}"
        await interaction.response.send_message(message, ephemeral=True)
        await self.service.post_to_thread(project, content=message)
        await self.service.safe_send_webhook(
            "asset_added",
            project,
            {"asset_type": asset.asset_type, "url": asset.url, "prompt": prompt, "note": note},
        )

    async def _add_cost(
        self,
        interaction: discord.Interaction,
        amount: float,
        unit: str,
        project_id: Optional[str],
        tool: Optional[str],
        note: Optional[str],
    ) -> None:
        project = await self.service.resolve_project(interaction, project_id)
        if not project:
            return
        cost = self.service.db.add_cost(
            project.project_key,
            amount,
            unit,
            tool,
            note,
            interaction.user.id,
            self.service.display_name(interaction.user),
            self.service.now(),
        )
        total = self.service.db.cost_total(project.project_key, unit)
        message = f"Cost logged: {cost.amount:g} {cost.unit}\nTotal: {total:g} {unit}"
        if tool:
            message += f"\nTool: {tool}"
        await interaction.response.send_message(message, ephemeral=True)
        await self.service.post_to_thread(project, content=message)
        await self.service.safe_send_webhook(
            "cost_added",
            project,
            {"amount": amount, "unit": unit, "tool": tool, "note": note, "unit_total": total},
        )

    @app_commands.command(name="cost", description="Log credits, tokens, or money used by a project")
    async def cost(
        self,
        interaction: discord.Interaction,
        amount: float,
        unit: str = "credits",
        project_id: Optional[str] = None,
        tool: Optional[str] = None,
        note: Optional[str] = None,
    ) -> None:
        await self._add_cost(interaction, amount, unit, project_id, tool, note)

    @app_commands.command(name="credits", description="Alias for /cost")
    async def credits(
        self,
        interaction: discord.Interaction,
        amount: float,
        project_id: Optional[str] = None,
        tool: Optional[str] = None,
        note: Optional[str] = None,
    ) -> None:
        await self._add_cost(interaction, amount, "credits", project_id, tool, note)

    @app_commands.command(name="approve", description="Approve and lock the final version")
    async def approve(
        self,
        interaction: discord.Interaction,
        final_url: Optional[str] = None,
        project_id: Optional[str] = None,
        note: Optional[str] = None,
    ) -> None:
        project = await self.service.resolve_project(interaction, project_id)
        if not project:
            return
        project = self.service.db.approve(
            project.project_key,
            final_url,
            interaction.user.id,
            self.service.display_name(interaction.user),
            self.service.now(),
            note,
        )
        await interaction.response.send_message(
            f"Approved final version\n\n{project_summary_text(project)}",
            ephemeral=True,
        )
        await self.service.post_to_thread(project, view=build_project_dashboard(project))
        approved_id = (
            self.bot.settings.video_approved_channel_id
            or self.bot.settings.video_stage_channel_ids.get("approved", 0)
        )
        channel = self.bot.get_channel(approved_id) if approved_id else None
        if channel and hasattr(channel, "send"):
            await channel.send(view=build_project_dashboard(project))
        if isinstance(interaction.channel, discord.Thread):
            try:
                await interaction.channel.edit(locked=True, archived=True)
            except discord.HTTPException as exc:
                print(f"Could not lock approved thread: {exc}")
        await self.service.safe_send_webhook("approved", project, {"note": note})

    @app_commands.command(name="video-status", description="Show project metadata, assets, and cost totals")
    @app_commands.describe(project_id="Project key; omit inside project thread")
    async def video_status(
        self,
        interaction: discord.Interaction,
        project_id: Optional[str] = None,
    ) -> None:
        project = await self.service.resolve_project(interaction, project_id)
        if not project:
            return
        assets = self.service.db.project_assets(project.project_key)
        costs = self.service.db.project_costs(project.project_key)
        await interaction.response.send_message(
            view=build_video_status(project, assets, costs),
            ephemeral=True,
        )

    async def _link(
        self,
        interaction: discord.Interaction,
        link_type: str,
        url: str,
        project_id: Optional[str],
    ) -> None:
        project = await self.service.resolve_project(interaction, project_id)
        if not project:
            return
        project = self.service.db.set_project_link(
            project.project_key,
            link_type,
            url,
            interaction.user.id,
            self.service.display_name(interaction.user),
            self.service.now(),
        )
        await interaction.response.send_message(
            f"{link_type.title()} link saved\n{url}",
            ephemeral=True,
        )
        await self.service.post_to_thread(project, view=build_project_dashboard(project))
        await self.service.safe_send_webhook(
            f"{link_type}_linked",
            project,
            {f"{link_type}_url": url},
        )

    @app_commands.command(name="link-notion", description="Attach a Notion page to a video project")
    async def link_notion(
        self,
        interaction: discord.Interaction,
        url: str,
        project_id: Optional[str] = None,
    ) -> None:
        await self._link(interaction, "notion", url, project_id)

    @app_commands.command(name="link-drive", description="Attach a storage folder to a video project")
    async def link_drive(
        self,
        interaction: discord.Interaction,
        url: str,
        project_id: Optional[str] = None,
    ) -> None:
        await self._link(interaction, "drive", url, project_id)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(VideoPipelineCog(bot))
