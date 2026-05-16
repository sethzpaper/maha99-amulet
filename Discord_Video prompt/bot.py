from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Optional
from zoneinfo import ZoneInfo

import aiohttp
import discord
from discord import app_commands
from discord.ext import commands
from dotenv import load_dotenv

from attendance_db import AttendanceDB, AttendanceEntry
from reporting import build_monthly_pdf, entry_duration, format_duration
from video_pipeline_db import ASSET_TYPES, STAGES, VideoPipelineDB, VideoProject


load_dotenv(Path(__file__).parent / ".env")

BOT_TOKEN = os.getenv("DISCORD_TOKEN")
DATABASE_PATH = os.getenv("ATTENDANCE_DB_PATH", "data/attendance.sqlite3")
TIMEZONE = ZoneInfo(os.getenv("TIMEZONE", "Asia/Bangkok"))
ATTENDANCE_CHANNEL_ID = int(os.getenv("ATTENDANCE_CHANNEL_ID", "0") or "0")
LOG_CHANNEL_ID = int(os.getenv("ATTENDANCE_LOG_CHANNEL_ID", "0") or "0")
WEBHOOK_URL = os.getenv("ATTENDANCE_WEBHOOK_URL")
GUILD_ID = int(os.getenv("DISCORD_GUILD_ID", "0") or "0")
VIDEO_DB_PATH = os.getenv("VIDEO_PIPELINE_DB_PATH", "data/video_pipeline.sqlite3")
VIDEO_MASTER_CHANNEL_ID = int(os.getenv("VIDEO_MASTER_CHANNEL_ID", "0") or "0")
VIDEO_APPROVED_CHANNEL_ID = int(os.getenv("VIDEO_APPROVED_CHANNEL_ID", "0") or "0")
VIDEO_PIPELINE_WEBHOOK_URL = os.getenv("VIDEO_PIPELINE_WEBHOOK_URL")
VIDEO_STAGE_CHANNEL_IDS = {
    "idea": int(os.getenv("VIDEO_STAGE_IDEA_CHANNEL_ID", "0") or "0"),
    "image_gen": int(os.getenv("VIDEO_STAGE_IMAGE_GEN_CHANNEL_ID", "0") or "0"),
    "storyboard": int(os.getenv("VIDEO_STAGE_STORYBOARD_CHANNEL_ID", "0") or "0"),
    "render": int(os.getenv("VIDEO_STAGE_RENDER_CHANNEL_ID", "0") or "0"),
    "review": int(os.getenv("VIDEO_STAGE_REVIEW_CHANNEL_ID", "0") or "0"),
    "edits": int(os.getenv("VIDEO_STAGE_EDITS_CHANNEL_ID", "0") or "0"),
    "approved": int(os.getenv("VIDEO_STAGE_APPROVED_CHANNEL_ID", "0") or "0"),
}

db = AttendanceDB(DATABASE_PATH)
video_db = VideoPipelineDB(VIDEO_DB_PATH)

intents = discord.Intents.default()
bot = commands.Bot(command_prefix="!", intents=intents)


def now_local() -> datetime:
    return datetime.now(TIMEZONE)


def display_name(user: discord.abc.User) -> str:
    return getattr(user, "display_name", None) or user.name


async def ensure_attendance_channel(interaction: discord.Interaction) -> bool:
    if ATTENDANCE_CHANNEL_ID and interaction.channel_id != ATTENDANCE_CHANNEL_ID:
        await interaction.response.send_message(
            "คำสั่งลงเวลาใช้ได้เฉพาะในห้อง #attendance เท่านั้น",
            ephemeral=True,
        )
        return False
    return True


async def emit_log(interaction: discord.Interaction, action: str, entry: AttendanceEntry) -> None:
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

    if LOG_CHANNEL_ID:
        channel = bot.get_channel(LOG_CHANNEL_ID)
        if channel and hasattr(channel, "send"):
            await channel.send(text)

    if WEBHOOK_URL:
        async with aiohttp.ClientSession() as session:
            async with session.post(WEBHOOK_URL, json=payload) as response:
                if response.status >= 400:
                    print(f"Webhook failed: {response.status} {await response.text()}")


async def safe_emit_log(interaction: discord.Interaction, action: str, entry: AttendanceEntry) -> None:
    try:
        await emit_log(interaction, action, entry)
    except Exception as exc:
        print(f"Attendance log failed for {action}: {exc}")


def project_summary(project: VideoProject) -> str:
    thread_line = f"<#{project.thread_id}>" if project.thread_id else "-"
    notion_line = project.notion_url or "-"
    drive_line = project.drive_url or "-"
    final_line = project.final_asset_url or "-"
    return (
        f"Project: `{project.project_key}`\n"
        f"Title: {project.title}\n"
        f"Stage: `{project.stage}`\n"
        f"Owner: {project.owner_name}\n"
        f"Thread: {thread_line}\n"
        f"Notion: {notion_line}\n"
        f"Drive: {drive_line}\n"
        f"Final: {final_line}"
    )


def video_teamspace_template() -> str:
    return (
        "AI Video Teamspace\n\n"
        "Quick Actions\n"
        "`/new-video-project` - create one project thread\n"
        "`/set-stage` - move project status\n"
        "`/attach-asset` - save prompt, reference, image, storyboard, video, final\n"
        "`/link-notion` - attach Notion page\n"
        "`/link-drive` - attach Drive/S3/R2 folder\n"
        "`/cost` or `/credits` - log usage\n"
        "`/approve` - lock final version\n"
        "`/video-status` - inspect project metadata\n\n"
        "Main Boards\n"
        "#00-ai-video-home\n"
        "#01-video-ideas\n"
        "#02-image-gen\n"
        "#03-storyboard\n"
        "#04-video-render\n"
        "#05-video-review\n"
        "#06-video-edits\n"
        "#07-approved-videos\n\n"
        "Libraries\n"
        "#08-asset-library\n"
        "#09-prompt-library\n"
        "#10-cost-tracker\n"
        "#11-notion-sync-log\n\n"
        "Stages\n"
        "`idea` -> `image_gen` -> `storyboard` -> `render` -> `review` -> `edits` -> `approved`"
    )


def project_thread_template(project: VideoProject, brief: str) -> str:
    return (
        f"New AI video project\n\n"
        f"{project_summary(project)}\n\n"
        f"Brief\n{brief}\n\n"
        f"Project Fields\n"
        f"- Owner: {project.owner_name}\n"
        f"- Stage: `{project.stage}`\n"
        f"- Notion Page: {project.notion_url or '-'}\n"
        f"- Drive Folder: {project.drive_url or '-'}\n"
        f"- Final Asset: {project.final_asset_url or '-'}\n\n"
        f"Workflow\n"
        f"`idea` -> `image_gen` -> `storyboard` -> `render` -> `review` -> `edits` -> `approved`\n\n"
        f"Useful Commands\n"
        f"`/set-stage`, `/attach-asset`, `/link-notion`, `/link-drive`, `/cost`, `/approve`, `/video-status`"
    )


def channel_setup_env_hint(channels: dict[str, discord.TextChannel]) -> str:
    mapping = {
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
    for channel_name, env_name in mapping.items():
        channel = channels.get(channel_name)
        if channel:
            lines.append(f"{env_name}={channel.id}")
    return "\n".join(lines)


async def resolve_video_project(
    interaction: discord.Interaction,
    project_id: Optional[str],
) -> Optional[VideoProject]:
    try:
        if project_id:
            return video_db.get_project(project_id)
        if interaction.channel and isinstance(interaction.channel, discord.Thread):
            return video_db.get_project_by_thread(interaction.channel.id)
    except KeyError:
        pass

    message = "ไม่พบโปรเจ็กต์ ระบุ project_id หรือใช้คำสั่งนี้ใน thread ของโปรเจ็กต์"
    if interaction.response.is_done():
        await interaction.followup.send(message, ephemeral=True)
    else:
        await interaction.response.send_message(message, ephemeral=True)
    return None


async def send_video_webhook(action: str, project: VideoProject, extra: Optional[dict] = None) -> None:
    if not VIDEO_PIPELINE_WEBHOOK_URL:
        return
    payload = {
        "action": action,
        "project_key": project.project_key,
        "title": project.title,
        "stage": project.stage,
        "owner_id": str(project.owner_id),
        "owner_name": project.owner_name,
        "thread_id": str(project.thread_id) if project.thread_id else None,
        "final_asset_url": project.final_asset_url,
    }
    if extra:
        payload.update(extra)
    async with aiohttp.ClientSession() as session:
        async with session.post(VIDEO_PIPELINE_WEBHOOK_URL, json=payload) as response:
            if response.status >= 400:
                print(f"Video webhook failed: {response.status} {await response.text()}")


async def safe_send_video_webhook(
    action: str,
    project: VideoProject,
    extra: Optional[dict] = None,
) -> None:
    try:
        await send_video_webhook(action, project, extra)
    except Exception as exc:
        print(f"Video webhook failed for {action}: {exc}")


async def post_to_stage_channel(project: VideoProject, message: str) -> None:
    channel_id = VIDEO_STAGE_CHANNEL_IDS.get(project.stage) or 0
    if not channel_id:
        return
    channel = bot.get_channel(channel_id)
    if channel and hasattr(channel, "send"):
        await channel.send(message)


async def post_to_thread(project: VideoProject, message: str) -> None:
    if not project.thread_id:
        return
    channel = bot.get_channel(project.thread_id)
    if channel and hasattr(channel, "send"):
        await channel.send(message)


@bot.event
async def on_ready() -> None:
    if GUILD_ID:
        guild = discord.Object(id=GUILD_ID)
        bot.tree.copy_global_to(guild=guild)
        await bot.tree.sync(guild=guild)
    else:
        await bot.tree.sync()
    print(f"Logged in as {bot.user}")


@bot.tree.command(name="clockin", description="ลงเวลาเข้างาน")
async def clockin(interaction: discord.Interaction) -> None:
    if not await ensure_attendance_channel(interaction):
        return

    ts = now_local()
    entry = db.clock_in(interaction.user.id, display_name(interaction.user), ts.date(), ts)
    await interaction.response.send_message(
        f"ลงเวลาเข้างานแล้วเมื่อ {ts.strftime('%H:%M')} น.",
        ephemeral=True,
    )
    await safe_emit_log(interaction, "clockin", entry)


@bot.tree.command(name="clockout", description="ลงเวลาออกงาน")
async def clockout(interaction: discord.Interaction) -> None:
    if not await ensure_attendance_channel(interaction):
        return

    ts = now_local()
    try:
        entry = db.clock_out(interaction.user.id, display_name(interaction.user), ts.date(), ts)
    except ValueError:
        await interaction.response.send_message(
            "ยังไม่พบเวลาเข้างานของวันนี้ กรุณาใช้ /clockin ก่อน",
            ephemeral=True,
        )
        return

    await interaction.response.send_message(
        f"ลงเวลาออกงานแล้ว คุณทำงานไป {format_duration(entry_duration(entry))}",
        ephemeral=True,
    )
    await safe_emit_log(interaction, "clockout", entry)


@bot.tree.command(name="status", description="เช็คสถานะการลงเวลาวันนี้")
async def status(interaction: discord.Interaction) -> None:
    if not await ensure_attendance_channel(interaction):
        return

    ts = now_local()
    entry = db.get_today_entry(interaction.user.id, ts.date())
    if not entry:
        await interaction.response.send_message("วันนี้ยังไม่มีข้อมูลลงเวลา", ephemeral=True)
        return

    if entry.status == "completed":
        await interaction.response.send_message(
            f"วันนี้คุณทำงานครบแล้ว รวม {format_duration(entry_duration(entry))}",
            ephemeral=True,
        )
    elif entry.clock_in:
        clock_in = datetime.fromisoformat(entry.clock_in).strftime("%H:%M")
        await interaction.response.send_message(
            f"วันนี้คุณ clock-in แล้วเมื่อ {clock_in} น.",
            ephemeral=True,
        )
    else:
        await interaction.response.send_message(
            f"วันนี้สถานะของคุณคือ {entry.status}: {entry.reason or '-'}",
            ephemeral=True,
        )


@bot.tree.command(name="summary", description="สร้างรายงานสรุปรายเดือนเป็น PDF")
@app_commands.describe(year="ปี ค.ศ. เช่น 2026", month="เดือน 1-12")
async def summary(
    interaction: discord.Interaction,
    year: Optional[int] = None,
    month: Optional[int] = None,
) -> None:
    if not await ensure_attendance_channel(interaction):
        return

    await interaction.response.defer(ephemeral=True, thinking=True)
    ts = now_local()
    year = year or ts.year
    month = month or ts.month

    if month < 1 or month > 12:
        await interaction.followup.send("เดือนต้องอยู่ระหว่าง 1-12", ephemeral=True)
        return

    entries = db.month_entries(interaction.user.id, year, month)
    report_path = Path("reports") / f"attendance_{interaction.user.id}_{year:04d}_{month:02d}.pdf"
    try:
        build_monthly_pdf(report_path, display_name(interaction.user), year, month, entries)
    except RuntimeError as exc:
        await interaction.followup.send(str(exc), ephemeral=True)
        return

    await interaction.followup.send(
        "สร้างรายงานสรุปรายเดือนเรียบร้อย",
        file=discord.File(report_path),
        ephemeral=True,
    )


@bot.tree.command(name="absent", description="ลางาน พร้อมระบุเหตุผล")
@app_commands.describe(reason="เหตุผลการลา")
async def absent(interaction: discord.Interaction, reason: str) -> None:
    if not await ensure_attendance_channel(interaction):
        return

    ts = now_local()
    entry = db.mark_status(interaction.user.id, display_name(interaction.user), ts.date(), "absent", reason, ts)
    await interaction.response.send_message(f"บันทึกลางานแล้ว: {reason}", ephemeral=True)
    await safe_emit_log(interaction, "absent", entry)


@bot.tree.command(name="wfh", description="แจ้งทำงานจากบ้าน")
async def wfh(interaction: discord.Interaction) -> None:
    if not await ensure_attendance_channel(interaction):
        return

    ts = now_local()
    entry = db.mark_status(interaction.user.id, display_name(interaction.user), ts.date(), "wfh", None, ts)
    await interaction.response.send_message("บันทึกสถานะทำงานจากบ้านแล้ว", ephemeral=True)
    await safe_emit_log(interaction, "wfh", entry)


@bot.tree.command(name="late", description="แจ้งสาเหตุมาสาย")
@app_commands.describe(reason="สาเหตุมาสาย")
async def late(interaction: discord.Interaction, reason: str) -> None:
    if not await ensure_attendance_channel(interaction):
        return

    ts = now_local()
    entry = db.mark_status(interaction.user.id, display_name(interaction.user), ts.date(), "late", reason, ts)
    await interaction.response.send_message(f"บันทึกมาสายแล้ว: {reason}", ephemeral=True)
    await safe_emit_log(interaction, "late", entry)


@bot.tree.command(name="holidaycoming", description="เตือนวันหยุดที่ใกล้มาถึง")
async def holidaycoming(interaction: discord.Interaction) -> None:
    await interaction.response.send_message(
        "ยังไม่ได้เชื่อมต่อปฏิทินวันหยุด ตั้งค่า source วันหยุดแล้วค่อยเปิดใช้คำสั่งนี้ได้เลย",
        ephemeral=True,
    )


@bot.tree.command(name="new-video-project", description="Create a new AI video project thread")
@app_commands.describe(title="Project title", brief="Idea, prompt, goal, or client note")
async def new_video_project(
    interaction: discord.Interaction,
    title: str,
    brief: str,
) -> None:
    await interaction.response.defer(ephemeral=True, thinking=True)
    ts = now_local()
    owner_name = display_name(interaction.user)
    project = video_db.create_project(title, brief, interaction.user.id, owner_name, ts)

    parent = bot.get_channel(VIDEO_MASTER_CHANNEL_ID) if VIDEO_MASTER_CHANNEL_ID else interaction.channel
    thread = None
    if parent and hasattr(parent, "create_thread"):
        thread_name = f"{project.project_key} {title}"[:100]
        try:
            thread = await parent.create_thread(name=thread_name, auto_archive_duration=10080)
            project = video_db.set_thread(project.project_key, thread.id, ts)
        except Exception as exc:
            print(f"Could not create project thread: {exc}")

    template = project_thread_template(project, brief)
    if thread:
        await thread.send(template)
    else:
        await post_to_stage_channel(project, template)

    await safe_send_video_webhook("created", project, {"brief": brief})
    await interaction.followup.send(
        f"สร้างโปรเจ็กต์แล้ว\n\n{project_summary(project)}",
        ephemeral=True,
    )


@bot.tree.command(name="set-stage", description="Move an AI video project to another stage")
@app_commands.describe(project_id="Project key; omit inside project thread", note="Optional update note")
@app_commands.choices(
    stage=[app_commands.Choice(name=stage, value=stage) for stage in STAGES]
)
async def set_stage(
    interaction: discord.Interaction,
    stage: app_commands.Choice[str],
    project_id: Optional[str] = None,
    note: Optional[str] = None,
) -> None:
    project = await resolve_video_project(interaction, project_id)
    if not project:
        return

    ts = now_local()
    project = video_db.set_stage(
        project.project_key,
        stage.value,
        interaction.user.id,
        display_name(interaction.user),
        ts,
        note,
    )
    message = f"Stage updated to `{project.stage}` for `{project.project_key}`"
    if note:
        message = f"{message}\nNote: {note}"
    await interaction.response.send_message(message, ephemeral=True)
    await post_to_thread(project, message)
    await post_to_stage_channel(project, f"{message}\n{project_summary(project)}")
    await safe_send_video_webhook("stage_changed", project, {"note": note})


@bot.tree.command(name="attach-asset", description="Attach prompt, image, storyboard, video, or final link")
@app_commands.describe(
    url="Drive/S3/R2/Dropbox/Notion/Discord file URL",
    project_id="Project key; omit inside project thread",
    prompt="Prompt or generation settings",
    note="Optional context",
)
@app_commands.choices(
    asset_type=[app_commands.Choice(name=asset_type, value=asset_type) for asset_type in ASSET_TYPES]
)
async def attach_asset(
    interaction: discord.Interaction,
    asset_type: app_commands.Choice[str],
    url: str,
    project_id: Optional[str] = None,
    prompt: Optional[str] = None,
    note: Optional[str] = None,
) -> None:
    project = await resolve_video_project(interaction, project_id)
    if not project:
        return

    asset = video_db.attach_asset(
        project.project_key,
        asset_type.value,
        url,
        prompt,
        note,
        interaction.user.id,
        display_name(interaction.user),
        now_local(),
    )
    project = video_db.get_project(project.project_key)
    message = f"Asset attached to `{project.project_key}`: `{asset.asset_type}`\n{asset.url}"
    if note:
        message = f"{message}\nNote: {note}"
    await interaction.response.send_message(message, ephemeral=True)
    await post_to_thread(project, message)
    await safe_send_video_webhook(
        "asset_added",
        project,
        {"asset_type": asset.asset_type, "url": asset.url, "prompt": prompt, "note": note},
    )


async def add_project_cost(
    interaction: discord.Interaction,
    amount: float,
    unit: str,
    project_id: Optional[str],
    tool: Optional[str],
    note: Optional[str],
) -> None:
    project = await resolve_video_project(interaction, project_id)
    if not project:
        return

    cost = video_db.add_cost(
        project.project_key,
        amount,
        unit,
        tool,
        note,
        interaction.user.id,
        display_name(interaction.user),
        now_local(),
    )
    total = video_db.cost_total(project.project_key, unit)
    message = (
        f"Cost logged for `{project.project_key}`: {cost.amount:g} {cost.unit}\n"
        f"Total `{cost.unit}`: {total:g}"
    )
    if tool:
        message = f"{message}\nTool: {tool}"
    if note:
        message = f"{message}\nNote: {note}"
    await interaction.response.send_message(message, ephemeral=True)
    await post_to_thread(project, message)
    await safe_send_video_webhook(
        "cost_added",
        project,
        {"amount": amount, "unit": unit, "tool": tool, "note": note, "unit_total": total},
    )


@bot.tree.command(name="cost", description="Log credits, tokens, or money used by a project")
@app_commands.describe(
    amount="Amount used",
    unit="credits, tokens, usd, thb, etc.",
    project_id="Project key; omit inside project thread",
    tool="Tool name such as Midjourney, Runway, Kling, Veo, ComfyUI",
    note="Optional context",
)
async def cost(
    interaction: discord.Interaction,
    amount: float,
    unit: str = "credits",
    project_id: Optional[str] = None,
    tool: Optional[str] = None,
    note: Optional[str] = None,
) -> None:
    await add_project_cost(interaction, amount, unit, project_id, tool, note)


@bot.tree.command(name="credits", description="Alias for /cost")
@app_commands.describe(
    amount="Credit amount used",
    project_id="Project key; omit inside project thread",
    tool="Tool name",
    note="Optional context",
)
async def credits(
    interaction: discord.Interaction,
    amount: float,
    project_id: Optional[str] = None,
    tool: Optional[str] = None,
    note: Optional[str] = None,
) -> None:
    await add_project_cost(interaction, amount, "credits", project_id, tool, note)


@bot.tree.command(name="approve", description="Approve and lock the final version")
@app_commands.describe(
    final_url="Final video URL if not already attached as final asset",
    project_id="Project key; omit inside project thread",
    note="Approval note",
)
async def approve(
    interaction: discord.Interaction,
    final_url: Optional[str] = None,
    project_id: Optional[str] = None,
    note: Optional[str] = None,
) -> None:
    project = await resolve_video_project(interaction, project_id)
    if not project:
        return

    project = video_db.approve(
        project.project_key,
        final_url,
        interaction.user.id,
        display_name(interaction.user),
        now_local(),
        note,
    )
    message = f"Approved final version\n\n{project_summary(project)}"
    if note:
        message = f"{message}\nNote: {note}"
    await interaction.response.send_message(message, ephemeral=True)
    await post_to_thread(project, message)

    approved_channel_id = VIDEO_APPROVED_CHANNEL_ID or VIDEO_STAGE_CHANNEL_IDS.get("approved") or 0
    approved_channel = bot.get_channel(approved_channel_id) if approved_channel_id else None
    if approved_channel and hasattr(approved_channel, "send"):
        await approved_channel.send(message)

    if interaction.channel and isinstance(interaction.channel, discord.Thread):
        try:
            await interaction.channel.edit(locked=True, archived=True)
        except Exception as exc:
            print(f"Could not lock approved thread: {exc}")

    await safe_send_video_webhook("approved", project, {"note": note})


@bot.tree.command(name="video-status", description="Show project metadata, assets, and cost totals")
@app_commands.describe(project_id="Project key; omit inside project thread")
async def video_status(
    interaction: discord.Interaction,
    project_id: Optional[str] = None,
) -> None:
    project = await resolve_video_project(interaction, project_id)
    if not project:
        return

    assets = video_db.project_assets(project.project_key)
    costs = video_db.project_costs(project.project_key)
    totals: dict[str, float] = {}
    for item in costs:
        totals[item.unit] = totals.get(item.unit, 0) + item.amount
    asset_lines = [f"- `{asset.asset_type}` {asset.url}" for asset in assets[-8:]]
    cost_lines = [f"- {amount:g} {unit}" for unit, amount in totals.items()]
    message = (
        f"{project_summary(project)}\n\n"
        f"Assets:\n{chr(10).join(asset_lines) if asset_lines else '-'}\n\n"
        f"Cost totals:\n{chr(10).join(cost_lines) if cost_lines else '-'}"
    )
    await interaction.response.send_message(message, ephemeral=True)


@bot.tree.command(name="setup-video-channels", description="Create Notion-style AI video pipeline channels")
@app_commands.describe(category_name="Discord category name to create or reuse")
@app_commands.checks.has_permissions(manage_channels=True)
async def setup_video_channels(
    interaction: discord.Interaction,
    category_name: str = "AI VIDEO TEAMSPACE",
) -> None:
    if not interaction.guild:
        await interaction.response.send_message("ใช้คำสั่งนี้ใน server เท่านั้น", ephemeral=True)
        return

    await interaction.response.defer(ephemeral=True, thinking=True)
    guild = interaction.guild
    category = discord.utils.get(guild.categories, name=category_name)
    if not category:
        category = await guild.create_category(category_name)

    channel_names = [
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
    created_or_found: dict[str, discord.TextChannel] = {}
    for name in channel_names:
        existing = discord.utils.get(category.text_channels, name=name)
        if existing:
            created_or_found[name] = existing
            continue
        created_or_found[name] = await category.create_text_channel(name)

    home = created_or_found["00-ai-video-home"]
    await home.send(video_teamspace_template())

    env_hint = channel_setup_env_hint(created_or_found)
    await interaction.followup.send(
        "สร้าง/ตรวจ channel layout เรียบร้อยแล้ว\n\n"
        f"Home: {home.mention}\n\n"
        "นำค่าเหล่านี้ไปใส่ใน `.env` เพื่อให้ bot mirror stage ได้ถาวร:\n"
        f"```env\n{env_hint}\n```",
        ephemeral=True,
    )


@setup_video_channels.error
async def setup_video_channels_error(
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


async def link_project_url(
    interaction: discord.Interaction,
    link_type: str,
    url: str,
    project_id: Optional[str],
) -> None:
    project = await resolve_video_project(interaction, project_id)
    if not project:
        return

    project = video_db.set_project_link(
        project.project_key,
        link_type,
        url,
        interaction.user.id,
        display_name(interaction.user),
        now_local(),
    )
    message = f"{link_type.title()} link saved for `{project.project_key}`\n{url}"
    await interaction.response.send_message(message, ephemeral=True)
    await post_to_thread(project, message)
    await safe_send_video_webhook(
        f"{link_type}_linked",
        project,
        {f"{link_type}_url": url},
    )


@bot.tree.command(name="link-notion", description="Attach a Notion page to a video project")
@app_commands.describe(url="Notion page URL", project_id="Project key; omit inside project thread")
async def link_notion(
    interaction: discord.Interaction,
    url: str,
    project_id: Optional[str] = None,
) -> None:
    await link_project_url(interaction, "notion", url, project_id)


@bot.tree.command(name="link-drive", description="Attach a Drive/S3/R2/Dropbox folder to a video project")
@app_commands.describe(url="Storage folder URL", project_id="Project key; omit inside project thread")
async def link_drive(
    interaction: discord.Interaction,
    url: str,
    project_id: Optional[str] = None,
) -> None:
    await link_project_url(interaction, "drive", url, project_id)


@bot.tree.command(name="project-template", description="Post the Notion-style AI video home template")
async def project_template(interaction: discord.Interaction) -> None:
    if not interaction.channel or not hasattr(interaction.channel, "send"):
        await interaction.response.send_message("ส่ง template ใน channel นี้ไม่ได้", ephemeral=True)
        return
    await interaction.channel.send(video_teamspace_template())
    await interaction.response.send_message("ส่ง project template แล้ว", ephemeral=True)


if __name__ == "__main__":
    if not BOT_TOKEN:
        raise SystemExit("Missing DISCORD_TOKEN in .env")
    bot.run(BOT_TOKEN)
