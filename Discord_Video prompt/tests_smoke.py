from __future__ import annotations

from datetime import datetime, timezone, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory

from attendance_db import AttendanceDB
from reporting import build_monthly_pdf, entry_duration, format_duration, format_duration_pdf
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

    absent = db.mark_status(2, "Leave User", start.date(), "absent", "sick", start)
    assert absent.status == "absent"
    assert absent.reason == "sick"
    entries = db.month_entries(1, 2026, 5)
    assert len(entries) == 1

    report_path = build_monthly_pdf(tmp / "attendance_report.pdf", "Tester", 2026, 5, entries)
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

    approved = db.approve(project.project_key, None, 99, "Approver", now, "final ok")
    assert approved.stage == "approved"
    assert approved.final_asset_url == "https://drive.example/final.mp4"
    assert approved.approved_by_id == 99


def main() -> None:
    with TemporaryDirectory() as temp_dir:
        tmp = Path(temp_dir)
        test_attendance_flow(tmp)
        test_video_pipeline_flow(tmp)
    print("smoke tests passed")


if __name__ == "__main__":
    main()
