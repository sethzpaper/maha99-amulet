from __future__ import annotations

import os
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


def is_payable_day(entry: AttendanceEntry) -> bool:
    return bool(
        entry.clock_in
        and entry.clock_out
        and entry.status == "completed"
    )


def calculate_monthly_wage(
    entries: list[AttendanceEntry],
    daily_rate: float,
) -> float:
    return sum(1 for entry in entries if is_payable_day(entry)) * float(daily_rate)


def build_monthly_pdf(
    output_path: str | Path,
    user_name: str,
    year: int,
    month: int,
    entries: list[AttendanceEntry],
    daily_rate: float = 400.0,
) -> Path:
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    except ImportError as exc:
        raise RuntimeError(
            "missing_reportlab: install dependencies with `pip install -r requirements.txt`"
        ) from exc

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    work_entries = [entry for entry in entries if entry.clock_in]
    payable_entries = [entry for entry in entries if is_payable_day(entry)]
    absent_entries = [entry for entry in entries if entry.status == "absent"]
    incomplete_entries = [
        entry for entry in entries if entry.clock_in and not entry.clock_out
    ]
    total_seconds = AttendanceDB.worked_seconds(entries)
    average_seconds = total_seconds // len(payable_entries) if payable_entries else 0
    total_wage = calculate_monthly_wage(entries, daily_rate)

    font_name, bold_font_name = _register_report_fonts(pdfmetrics, TTFont)
    styles = getSampleStyleSheet()
    for style_name in ("Normal", "Title", "Heading2"):
        styles[style_name].fontName = (
            bold_font_name if style_name in ("Title", "Heading2") else font_name
        )
    doc = SimpleDocTemplate(
        str(output),
        pagesize=A4,
        topMargin=28,
        bottomMargin=28,
        leftMargin=24,
        rightMargin=24,
    )
    story = [
        Paragraph("WORKTIME", styles["Title"]),
        Paragraph(f"Employee: {user_name}", styles["Heading2"]),
        Paragraph(f"Period: {year:04d}-{month:02d}", styles["Normal"]),
        Spacer(1, 14),
        Paragraph(f"Recorded days: {len(work_entries)}", styles["Normal"]),
        Paragraph(f"Paid days: {len(payable_entries)}", styles["Normal"]),
        Paragraph(f"Absent days: {len(absent_entries)}", styles["Normal"]),
        Paragraph(f"Incomplete days: {len(incomplete_entries)}", styles["Normal"]),
        Paragraph(f"Total hours: {format_duration_pdf(total_seconds)}", styles["Normal"]),
        Paragraph(f"Average per work day: {format_duration_pdf(average_seconds)}", styles["Normal"]),
        Paragraph(f"Daily rate: {daily_rate:,.2f} THB", styles["Normal"]),
        Paragraph(f"Total wage: {total_wage:,.2f} THB", styles["Heading2"]),
        Spacer(1, 18),
    ]

    table_data = [
        ["Day", "Date", "Clock in", "Clock out", "Worked", "Daily rate", "Wage", "Status / Note"]
    ]
    for entry in entries:
        clock_in = _time_only(entry.clock_in)
        clock_out = _time_only(entry.clock_out)
        payable = is_payable_day(entry)
        status_note = entry.status
        if entry.reason:
            status_note = f"{status_note}: {entry.reason}"
        if entry.clock_in and not entry.clock_out:
            status_note = "incomplete"
        table_data.append(
            [
                str(int(entry.work_date[-2:])),
                entry.work_date,
                clock_in,
                clock_out,
                format_duration_pdf(entry_duration(entry)) if entry_duration(entry) else "-",
                f"{daily_rate:,.2f}" if payable else "-",
                f"{daily_rate:,.2f}" if payable else "0.00",
                status_note,
            ]
        )

    if len(table_data) == 1:
        table_data.append(["-", "-", "-", "-", "-", "-", "0.00", "No records"])

    table = Table(
        table_data,
        repeatRows=1,
        colWidths=[28, 64, 48, 48, 48, 58, 58, 92],
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
                ("FONTNAME", (0, 0), (-1, 0), bold_font_name),
                ("FONTNAME", (0, 1), (-1, -1), font_name),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("FONTSIZE", (0, 0), (-1, -1), 7.5),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
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


def _register_report_fonts(pdfmetrics, tt_font) -> tuple[str, str]:
    regular_candidates = [
        os.getenv("REPORT_FONT_PATH"),
        r"C:\Windows\Fonts\tahoma.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansThai-Regular.ttf",
    ]
    bold_candidates = [
        os.getenv("REPORT_BOLD_FONT_PATH"),
        r"C:\Windows\Fonts\tahomabd.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansThai-Bold.ttf",
    ]
    regular = next(
        (Path(path) for path in regular_candidates if path and Path(path).exists()),
        None,
    )
    bold = next(
        (Path(path) for path in bold_candidates if path and Path(path).exists()),
        regular,
    )
    if not regular:
        return "Helvetica", "Helvetica-Bold"
    if "WorktimeThai" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(tt_font("WorktimeThai", str(regular)))
    if "WorktimeThaiBold" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(tt_font("WorktimeThaiBold", str(bold)))
    return "WorktimeThai", "WorktimeThaiBold"
