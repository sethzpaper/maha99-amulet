from __future__ import annotations

from datetime import datetime
from pathlib import Path

from attendance_db import AttendanceDB, AttendanceEntry


def format_duration(seconds: int) -> str:
    hours, remainder = divmod(max(0, seconds), 3600)
    minutes = remainder // 60
    return f"{hours} ชั่วโมง {minutes} นาที"


def format_duration_pdf(seconds: int) -> str:
    hours, remainder = divmod(max(0, seconds), 3600)
    minutes = remainder // 60
    return f"{hours}h {minutes}m"


def entry_duration(entry: AttendanceEntry) -> int:
    if not entry.clock_in or not entry.clock_out:
        return 0
    start = datetime.fromisoformat(entry.clock_in)
    end = datetime.fromisoformat(entry.clock_out)
    return max(0, int((end - start).total_seconds()))


def build_monthly_pdf(
    output_path: str | Path,
    user_name: str,
    year: int,
    month: int,
    entries: list[AttendanceEntry],
) -> Path:
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    except ImportError as exc:
        raise RuntimeError(
            "missing_reportlab: install dependencies with `pip install -r requirements.txt`"
        ) from exc

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    work_entries = [entry for entry in entries if entry.clock_in]
    absent_entries = [entry for entry in entries if entry.status == "absent"]
    total_seconds = AttendanceDB.worked_seconds(entries)
    average_seconds = total_seconds // len(work_entries) if work_entries else 0

    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(str(output), pagesize=A4)
    story = [
        Paragraph(f"Monthly Attendance Summary: {user_name}", styles["Title"]),
        Paragraph(f"Period: {year:04d}-{month:02d}", styles["Normal"]),
        Spacer(1, 14),
        Paragraph(f"Work days: {len(work_entries)}", styles["Normal"]),
        Paragraph(f"Absent days: {len(absent_entries)}", styles["Normal"]),
        Paragraph(f"Total hours: {format_duration_pdf(total_seconds)}", styles["Normal"]),
        Paragraph(f"Average per work day: {format_duration_pdf(average_seconds)}", styles["Normal"]),
        Spacer(1, 18),
    ]

    table_data = [["Date", "Status", "Clock in", "Clock out", "Worked", "Reason"]]
    for entry in entries:
        clock_in = _time_only(entry.clock_in)
        clock_out = _time_only(entry.clock_out)
        table_data.append(
            [
                entry.work_date,
                entry.status,
                clock_in,
                clock_out,
                format_duration_pdf(entry_duration(entry)) if entry_duration(entry) else "-",
                entry.reason or "-",
            ]
        )

    if len(table_data) == 1:
        table_data.append(["-", "No records", "-", "-", "-", "-"])

    table = Table(table_data, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
            ]
        )
    )
    story.append(table)
    doc.build(story)
    return output


def _time_only(value: str | None) -> str:
    if not value:
        return "-"
    return datetime.fromisoformat(value).strftime("%H:%M")
