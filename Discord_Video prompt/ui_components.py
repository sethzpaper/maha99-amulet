from __future__ import annotations

import discord
from discord import ui

from video_pipeline_db import VideoAsset, VideoCost, VideoProject


STAGE_LABELS = {
    "idea": "IDEA",
    "image_gen": "IMAGE GEN",
    "storyboard": "STORYBOARD",
    "render": "RENDER",
    "review": "REVIEW",
    "edits": "EDITS",
    "approved": "APPROVED",
}

STAGE_COLORS = {
    "idea": 0x95A5A6,
    "image_gen": 0x3498DB,
    "storyboard": 0x9B59B6,
    "render": 0xF39C12,
    "review": 0xE67E22,
    "edits": 0xE74C3C,
    "approved": 0x2ECC71,
}


def _clip(text: str, limit: int = 3800) -> str:
    return text if len(text) <= limit else text[: limit - 3] + "..."


def _is_web_url(value: str | None) -> bool:
    return bool(value and value.startswith(("https://", "http://")))


def project_summary_text(project: VideoProject) -> str:
    thread = f"<#{project.thread_id}>" if project.thread_id else "-"
    return (
        f"Project: `{project.project_key}`\n"
        f"Title: {project.title}\n"
        f"Stage: `{project.stage}`\n"
        f"Owner: {project.owner_name}\n"
        f"Thread: {thread}\n"
        f"Notion: {project.notion_url or '-'}\n"
        f"Drive: {project.drive_url or '-'}\n"
        f"Final: {project.final_asset_url or '-'}"
    )


def _link_buttons(project: VideoProject) -> ui.ActionRow | None:
    buttons = []
    if _is_web_url(project.notion_url):
        buttons.append(ui.Button(label="Notion", url=project.notion_url))
    if _is_web_url(project.drive_url):
        buttons.append(ui.Button(label="Storage", url=project.drive_url))
    if _is_web_url(project.final_asset_url):
        buttons.append(ui.Button(label="Final video", url=project.final_asset_url))
    return ui.ActionRow(*buttons) if buttons else None


def build_project_dashboard(project: VideoProject, brief: str | None = None) -> ui.LayoutView:
    view = ui.LayoutView(timeout=None)
    container = ui.Container(accent_color=STAGE_COLORS.get(project.stage, 0x5865F2))
    container.add_item(
        ui.TextDisplay(
            f"# {project.title}\n"
            f"`{project.project_key}`  •  **{STAGE_LABELS.get(project.stage, project.stage.upper())}**"
        )
    )
    container.add_item(ui.Separator())
    container.add_item(
        ui.TextDisplay(
            _clip(
                f"**Owner**\n{project.owner_name}\n\n"
                f"**Brief**\n{brief or project.brief or '-'}"
            )
        )
    )
    container.add_item(ui.Separator())
    container.add_item(
        ui.TextDisplay(
            "**Workflow**\n"
            "`idea` → `image_gen` → `storyboard` → `render` → `review` → `edits` → `approved`"
        )
    )
    links = _link_buttons(project)
    if links:
        container.add_item(links)
    container.add_item(
        ui.TextDisplay(
            "**Commands**\n"
            "`/set-stage`  `/attach-asset`  `/link-notion`  `/link-drive`  "
            "`/cost`  `/approve`  `/video-status`"
        )
    )
    view.add_item(container)
    return view


def build_video_status(
    project: VideoProject,
    assets: list[VideoAsset],
    costs: list[VideoCost],
) -> ui.LayoutView:
    totals: dict[str, float] = {}
    for item in costs:
        totals[item.unit] = totals.get(item.unit, 0) + item.amount

    asset_lines = [
        f"- **{asset.asset_type}**: {_clip(asset.url, 350)}"
        for asset in assets[-8:]
    ]
    cost_lines = [f"- **{amount:g} {unit}**" for unit, amount in totals.items()]

    view = ui.LayoutView(timeout=None)
    container = ui.Container(accent_color=STAGE_COLORS.get(project.stage, 0x5865F2))
    container.add_item(
        ui.TextDisplay(
            f"# {project.title}\n"
            f"`{project.project_key}`  •  **{STAGE_LABELS.get(project.stage, project.stage.upper())}**"
        )
    )
    container.add_item(ui.Separator())
    container.add_item(
        ui.TextDisplay(
            f"**Owner:** {project.owner_name}\n"
            f"**Created:** {project.created_at[:10]}\n"
            f"**Approved:** {project.approved_at or '-'}"
        )
    )
    container.add_item(ui.Separator())
    container.add_item(
        ui.TextDisplay(
            _clip(
                "**Recent assets**\n"
                + ("\n".join(asset_lines) if asset_lines else "- No assets")
            )
        )
    )
    container.add_item(ui.Separator())
    container.add_item(
        ui.TextDisplay(
            "**Cost totals**\n" + ("\n".join(cost_lines) if cost_lines else "- No costs")
        )
    )
    links = _link_buttons(project)
    if links:
        container.add_item(links)
    view.add_item(container)
    return view


def build_teamspace_dashboard() -> ui.LayoutView:
    view = ui.LayoutView(timeout=None)
    container = ui.Container(accent_color=0x5865F2)
    container.add_item(ui.TextDisplay("# AI Video Teamspace\nMahaniyom Workflow"))
    container.add_item(ui.Separator())
    container.add_item(
        ui.TextDisplay(
            "**Quick actions**\n"
            "`/new-video-project` create project\n"
            "`/set-stage` move status\n"
            "`/attach-asset` save files and prompts\n"
            "`/cost` log credits\n"
            "`/approve` lock final version\n"
            "`/video-status` open project dashboard"
        )
    )
    container.add_item(ui.Separator())
    container.add_item(
        ui.TextDisplay(
            "**Workflow**\n"
            "`idea` → `image_gen` → `storyboard` → `render` → `review` → `edits` → `approved`"
        )
    )
    container.add_item(
        ui.TextDisplay(
            "**Channels**\n"
            "#ai-video-pipeline  #video-ideas  #image-gen  #storyboard\n"
            "#video-render  #video-edits  #approved-videos"
        )
    )
    view.add_item(container)
    return view
