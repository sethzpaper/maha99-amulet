from __future__ import annotations

import sys
import asyncio
from pathlib import Path
from typing import Any

import httpx
import uvicorn
from fastapi import Depends, FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app_config import Settings, load_settings
from database_factory import create_video_pipeline_db
from job_queue import JobQueue
from video_pipeline_db import STAGES


class TokenRequest(BaseModel):
    code: str


class StageRequest(BaseModel):
    stage: str


class JobRequest(BaseModel):
    job_type: str = Field(min_length=1, max_length=80)
    payload: dict[str, Any] = Field(default_factory=dict)


class ProjectRequest(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    brief: str = Field(min_length=1, max_length=1200)


settings: Settings = load_settings()
video_db = create_video_pipeline_db(settings)
job_queue = JobQueue(settings) if settings.database_backend == "supabase" else None
app = FastAPI(title="Mahaniyom Workflow Activity")


async def current_user(
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    return await validate_discord_token(authorization)


async def validate_discord_token(authorization: str | None) -> dict[str, Any]:
    if settings.activity_dev_bypass:
        return {"id": "0", "username": "Local Developer"}
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Discord access token")
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            "https://discord.com/api/v10/users/@me",
            headers={"Authorization": authorization},
        )
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Discord access token")
    return response.json()


def board_version() -> str:
    return "|".join(
        f"{project.project_key}:{project.stage}:{project.updated_at}"
        for project in video_db.list_projects()
    )


@app.post("/api/auth/token")
async def exchange_token(payload: TokenRequest) -> dict[str, Any]:
    if settings.activity_dev_bypass:
        return {"access_token": "development", "token_type": "Bearer"}
    if not settings.discord_client_id or not settings.discord_client_secret:
        raise HTTPException(status_code=503, detail="Discord OAuth is not configured")
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            "https://discord.com/api/v10/oauth2/token",
            data={
                "client_id": settings.discord_client_id,
                "client_secret": settings.discord_client_secret,
                "grant_type": "authorization_code",
                "code": payload.code,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=401, detail="Discord authorization failed")
    return response.json()


@app.get("/api/config")
async def config() -> dict[str, Any]:
    return {
        "discord_client_id": settings.discord_client_id or "",
        "development": settings.activity_dev_bypass,
        "stages": list(STAGES),
    }


@app.get("/api/projects")
async def projects(user: dict = Depends(current_user)) -> dict[str, Any]:
    del user
    return {
        "projects": [
            project_payload(project)
            for project in video_db.list_projects()
        ]
    }


@app.post("/api/projects")
async def create_project(
    payload: ProjectRequest,
    user: dict = Depends(current_user),
) -> dict[str, Any]:
    project = video_db.create_project(
        payload.title.strip(),
        payload.brief.strip(),
        int(user["id"]),
        user.get("global_name") or user.get("username") or "Discord user",
        __import__("datetime").datetime.now(settings.timezone),
    )
    return {
        "project_key": project.project_key,
        "title": project.title,
        "stage": project.stage,
    }


@app.patch("/api/projects/{project_key}/stage")
async def update_stage(
    project_key: str,
    payload: StageRequest,
    user: dict = Depends(current_user),
) -> dict[str, Any]:
    if payload.stage not in STAGES:
        raise HTTPException(status_code=400, detail="Unknown stage")
    try:
        project = video_db.set_stage(
            project_key,
            payload.stage,
            int(user["id"]),
            user.get("global_name") or user.get("username") or "Discord user",
            __import__("datetime").datetime.now(settings.timezone),
            "Moved from Discord Activity",
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Project not found") from exc
    return {"project_key": project.project_key, "stage": project.stage}


@app.post("/api/projects/{project_key}/jobs")
async def enqueue_job(
    project_key: str,
    payload: JobRequest,
    user: dict = Depends(current_user),
) -> dict[str, Any]:
    del user
    try:
        video_db.get_project(project_key)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Project not found") from exc
    if not job_queue:
        raise HTTPException(
            status_code=503,
            detail="AI queues require DATABASE_BACKEND=supabase",
        )
    message_id = job_queue.enqueue_ai(
        project_key,
        payload.job_type,
        payload.payload,
    )
    return {"message_id": message_id, "status": "queued"}


@app.get("/api/jobs")
async def recent_jobs(user: dict = Depends(current_user)) -> dict[str, Any]:
    del user
    if not job_queue:
        return {"jobs": []}
    response = (
        job_queue.client.table("job_runs")
        .select("*")
        .order("started_at", desc=True)
        .limit(20)
        .execute()
    )
    return {"jobs": response.data}


@app.websocket("/ws/board")
async def board_updates(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        authentication = await websocket.receive_json()
        token = authentication.get("token", "")
        authorization = f"Bearer {token}" if token else None
        await validate_discord_token(authorization)
        previous = board_version()
        await websocket.send_json({"type": "ready"})
        while True:
            await asyncio.sleep(2)
            current = board_version()
            if current != previous:
                previous = current
                await websocket.send_json({"type": "projects_changed"})
    except (WebSocketDisconnect, HTTPException):
        return


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


def project_payload(project) -> dict[str, Any]:
    costs = video_db.project_costs(project.project_key)
    credits = sum(cost.amount for cost in costs if cost.unit.lower() == "credits")
    cash_costs = [
        cost for cost in costs if cost.unit.lower() not in ("credit", "credits", "token", "tokens")
    ]
    cash_total = sum(cost.amount for cost in cash_costs)
    cash_unit = cash_costs[-1].unit if cash_costs else ""
    return {
        "project_key": project.project_key,
        "title": project.title,
        "brief": project.brief,
        "stage": project.stage,
        "owner_name": project.owner_name,
        "updated_at": project.updated_at,
        "final_asset_url": project.final_asset_url,
        "credits": credits,
        "cost_total": cash_total,
        "cost_unit": cash_unit,
    }


DIST_DIR = PROJECT_ROOT / "activity" / "dist"
if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="activity-assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def activity_frontend(path: str) -> FileResponse:
        candidate = DIST_DIR / path
        if path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(DIST_DIR / "index.html")


if __name__ == "__main__":
    uvicorn.run(app, host=settings.activity_host, port=settings.activity_port)
