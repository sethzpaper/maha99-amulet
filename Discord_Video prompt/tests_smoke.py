from __future__ import annotations

import asyncio
import sys
from dataclasses import replace
from datetime import datetime, timezone, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from attendance_db import AttendanceDB
from app_config import load_settings
from bot_app import EXTENSIONS, MahaniyomBot
from reporting import (
    build_monthly_pdf,
    calculate_monthly_wage,
    entry_duration,
    format_duration,
    format_duration_pdf,
)
from ui_components import build_project_dashboard, build_video_status
from video_pipeline_db import VideoPipelineDB


TZ = timezone(timedelta(hours=7))


def test_attendance_flow(tmp: Path) -> None:
    db = AttendanceDB(tmp / "attendance.sqlite3")
    start = datetime(2026, 5, 14, 9, 0, tzinfo=TZ)
    end = datetime(2026, 5, 14, 18, 30, tzinfo=TZ)

    clocked_in = db.clock_in(1, "Tester", start.date(), start)
    assert clocked_in.status == "working"
    assert clocked_in.clock_in is not None
    assert clocked_in.clock_out is None

    clocked_out = db.clock_out(1, "Tester", end.date(), end)
    assert clocked_out.status == "completed"
    assert entry_duration(clocked_out) == 34200
    assert AttendanceDB.worked_seconds([clocked_out]) == 34200
    assert format_duration(34200) == "9 ชั่วโมง 30 นาที"
    assert format_duration_pdf(34200) == "9h 30m"
    employee = db.get_employee(1)
    assert employee.user_name == "Tester"
    assert employee.full_name is None
    assert employee.daily_rate == 400
    employee = db.set_full_name(1, "สมชาย ใจดี", end)
    assert employee.full_name == "สมชาย ใจดี"
    employee = db.set_daily_rate(1, 450, end)
    assert employee.daily_rate == 450

    absent = db.mark_status(2, "Leave User", start.date(), "absent", "sick", start)
    assert absent.status == "absent"
    assert absent.reason == "sick"
    entries = db.month_entries(1, 2026, 5)
    assert len(entries) == 1
    assert calculate_monthly_wage(entries, employee.daily_rate) == 450

    report_path = build_monthly_pdf(
        tmp / "attendance_report.pdf",
        "Tester",
        2026,
        5,
        entries,
        employee.daily_rate,
    )
    assert report_path.exists()
    assert report_path.stat().st_size > 0


def test_video_pipeline_flow(tmp: Path) -> None:
    db = VideoPipelineDB(tmp / "video.sqlite3")
    now = datetime(2026, 5, 14, 12, 0, tzinfo=TZ)

    project = db.create_project(
        "Temple Product Launch",
        "30s cinematic launch video",
        owner_id=10,
        owner_name="Producer",
        timestamp=now,
    )
    assert project.project_key.startswith("vid-20260514-120000-temple-product-launch")
    assert project.stage == "idea"

    project = db.set_thread(project.project_key, 12345, now)
    assert db.get_project_by_thread(12345).project_key == project.project_key

    project = db.set_project_link(
        project.project_key,
        "notion",
        "https://www.notion.so/example",
        10,
        "Producer",
        now,
    )
    assert project.notion_url == "https://www.notion.so/example"

    project = db.set_project_link(
        project.project_key,
        "drive",
        "https://drive.example/folder",
        10,
        "Producer",
        now,
    )
    assert project.drive_url == "https://drive.example/folder"

    project = db.set_stage(project.project_key, "image_gen", 10, "Producer", now, "Prompt ready")
    assert project.stage == "image_gen"

    asset = db.attach_asset(
        project.project_key,
        "final",
        "https://drive.example/final.mp4",
        prompt="golden temple product hero",
        note="v1",
        actor_id=10,
        actor_name="Producer",
        timestamp=now,
    )
    assert asset.asset_type == "final"
    assert db.get_project(project.project_key).final_asset_url == "https://drive.example/final.mp4"

    cost = db.add_cost(project.project_key, 240, "credits", "Runway", "render", 10, "Producer", now)
    assert cost.amount == 240
    assert db.cost_total(project.project_key, "credits") == 240

    project = db.set_stage(project.project_key, "pending_review", 10, "Producer", now, "Render ready")
    assert project.stage == "pending_review"

    approved = db.approve(project.project_key, None, 99, "Approver", now, "final ok")
    assert approved.stage == "approved"
    assert approved.final_asset_url == "https://drive.example/final.mp4"
    assert approved.approved_by_id == 99

    dashboard = build_project_dashboard(approved)
    status_view = build_video_status(
        approved,
        db.project_assets(approved.project_key),
        db.project_costs(approved.project_key),
    )
    assert dashboard.to_components()[0]["type"] == 17
    assert status_view.to_components()[0]["type"] == 17


def test_admin_web(tmp: Path) -> None:
    from fastapi.testclient import TestClient

    import admin_web

    admin_web.settings = replace(
        load_settings(),
        attendance_db_path=str(tmp / "admin-attendance.sqlite3"),
        admin_web_token="test-token",
    )
    admin_web.db = AttendanceDB(
        admin_web.settings.attendance_db_path,
        admin_web.settings.attendance_default_daily_rate,
    )
    now = datetime(2026, 5, 14, 9, 0, tzinfo=TZ)
    admin_web.db.upsert_employee(55, "Discord Employee", now)

    client = TestClient(admin_web.app)
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/").status_code == 401
    page = client.get("/?token=test-token")
    assert page.status_code == 200
    assert "Discord Employee" in page.text

    response = client.post(
        "/employees/55/profile?token=test-token",
        content="full_name=%E0%B8%AA%E0%B8%A1%E0%B8%8A%E0%B8%B2%E0%B8%A2+%E0%B9%83%E0%B8%88%E0%B8%94%E0%B8%B5",
        headers={"content-type": "application/x-www-form-urlencoded"},
        follow_redirects=False,
    )
    assert response.status_code == 303
    assert admin_web.db.get_employee(55).full_name == "สมชาย ใจดี"

    response = client.post(
        "/employees/55/rate?token=test-token",
        content="daily_rate=475",
        headers={"content-type": "application/x-www-form-urlencoded"},
        follow_redirects=False,
    )
    assert response.status_code == 303
    assert admin_web.db.daily_rate_for(55) == 475


def test_activity_web(tmp: Path) -> None:
    from fastapi.testclient import TestClient

    import activity_server

    activity_server.settings = replace(
        load_settings(),
        database_backend="sqlite",
        video_db_path=str(tmp / "activity-video.sqlite3"),
        activity_dev_bypass=True,
    )
    activity_server.video_db = VideoPipelineDB(
        activity_server.settings.video_db_path
    )
    activity_server.job_queue = None
    now = datetime(2026, 5, 14, 12, 0, tzinfo=TZ)
    project = activity_server.video_db.create_project(
        "Activity project",
        "Kanban smoke test",
        10,
        "Producer",
        now,
    )

    client = TestClient(activity_server.app)
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/api/config").json()["development"] is True
    projects = client.get("/api/projects").json()["projects"]
    assert projects[0]["project_key"] == project.project_key
    assert projects[0]["credits"] == 0
    response = client.post(
        "/api/projects",
        json={"title": "Created in Activity", "brief": "New card"},
    )
    assert response.status_code == 200
    assert response.json()["stage"] == "idea"
    response = client.patch(
        f"/api/projects/{project.project_key}/stage",
        json={"stage": "pending_review"},
    )
    assert response.status_code == 200
    assert response.json()["stage"] == "pending_review"
    response = client.post(
        f"/api/projects/{project.project_key}/jobs",
        json={"job_type": "image_generation", "payload": {}},
    )
    assert response.status_code == 503


async def test_bot_structure() -> None:
    bot = MahaniyomBot(load_settings())
    for extension in EXTENSIONS:
        await bot.load_extension(extension)
    command_names = {command.name for command in bot.tree.get_commands()}
    assert command_names == {
        "absent",
        "approve",
        "attach-asset",
        "check-video-setup",
        "clockin",
        "clockout",
        "cost",
        "credits",
        "holidaycoming",
        "late",
        "link-drive",
        "link-notion",
        "new-video-project",
        "project-template",
        "set-stage",
        "setup-video-channels",
        "status",
        "summary",
        "video-status",
        "wfh",
    }
    await bot.close()


def main() -> None:
    with TemporaryDirectory() as temp_dir:
        tmp = Path(temp_dir)
        test_attendance_flow(tmp)
        test_video_pipeline_flow(tmp)
        test_admin_web(tmp)
        test_activity_web(tmp)
    asyncio.run(test_bot_structure())
    print("smoke tests passed")


if __name__ == "__main__":
    main()
