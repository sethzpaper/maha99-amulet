from __future__ import annotations

import html
import secrets
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import parse_qs, quote

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app_config import load_settings
from database_factory import create_attendance_db


settings = load_settings()
db = create_attendance_db(settings)
app = FastAPI(title="Mahaniyom Worktime Admin")


def _require_token(request: Request) -> str:
    configured = settings.admin_web_token
    if not configured:
        raise HTTPException(
            status_code=503,
            detail="ADMIN_WEB_TOKEN is not configured",
        )
    provided = request.query_params.get("token") or request.headers.get("x-admin-token")
    if not provided or not secrets.compare_digest(provided, configured):
        raise HTTPException(status_code=401, detail="Invalid admin token")
    return provided


def _page(token: str, message: str = "") -> str:
    employees = db.list_employees()
    rows = []
    for employee in employees:
        rows.append(
            f"""
            <tr>
              <td>{employee.user_id}</td>
              <td>{html.escape(employee.user_name)}</td>
              <td>
                <form method="post" action="/employees/{employee.user_id}/profile?token={quote(token)}">
                  <input
                    name="full_name"
                    type="text"
                    value="{html.escape(employee.full_name or '')}"
                    placeholder="สมชาย ใจดี"
                  >
                  <button type="submit">Save</button>
                </form>
              </td>
              <td>{employee.daily_rate:,.2f} THB</td>
              <td>
                <form method="post" action="/employees/{employee.user_id}/rate?token={quote(token)}">
                  <input
                    name="daily_rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value="{employee.daily_rate:.2f}"
                    required
                  >
                  <button type="submit">Save</button>
                </form>
              </td>
            </tr>
            """
        )

    body = "\n".join(rows) or """
        <tr><td colspan="5" class="empty">No employees yet. Use /clockin once to create a profile.</td></tr>
    """
    notice = f'<div class="notice">{html.escape(message)}</div>' if message else ""
    return f"""
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Worktime Admin</title>
      <style>
        :root {{
          color-scheme: light;
          font-family: Inter, "Segoe UI", sans-serif;
          background: #f5f6f8;
          color: #202124;
        }}
        body {{ margin: 0; }}
        header {{
          background: #f4d840;
          border-bottom: 1px solid #d2b900;
          padding: 22px 28px;
        }}
        header h1 {{ margin: 0; font-size: 25px; }}
        header p {{ margin: 5px 0 0; color: #4d470f; }}
        main {{ max-width: 980px; margin: 28px auto; padding: 0 18px; }}
        .toolbar {{
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }}
        .toolbar h2 {{ margin: 0; font-size: 18px; }}
        .badge {{
          background: #e8eaed;
          padding: 5px 9px;
          border-radius: 4px;
          font-size: 13px;
        }}
        .notice {{
          background: #e6f4ea;
          border: 1px solid #9ad0a5;
          padding: 10px 12px;
          margin-bottom: 14px;
        }}
        table {{
          width: 100%;
          border-collapse: collapse;
          background: white;
          border: 1px solid #dadce0;
        }}
        th, td {{
          text-align: left;
          padding: 12px;
          border-bottom: 1px solid #e5e7eb;
        }}
        th {{ background: #f8f9fa; font-size: 13px; }}
        input {{
          width: 120px;
          padding: 7px 8px;
          border: 1px solid #bdc1c6;
          border-radius: 4px;
        }}
        button {{
          margin-left: 7px;
          padding: 8px 12px;
          border: 0;
          border-radius: 4px;
          background: #1f2937;
          color: white;
          cursor: pointer;
        }}
        .empty {{ text-align: center; color: #6b7280; padding: 30px; }}
        @media (max-width: 700px) {{
          table, thead, tbody, th, td, tr {{ display: block; }}
          thead {{ display: none; }}
          tr {{ border-bottom: 1px solid #dadce0; padding: 8px; }}
          td {{ border: 0; padding: 7px; }}
        }}
      </style>
    </head>
    <body>
      <header>
        <h1>Worktime Admin</h1>
        <p>Discord employees and daily wage settings</p>
      </header>
      <main>
        {notice}
        <div class="toolbar">
          <h2>Employees</h2>
          <span class="badge">Default {settings.attendance_default_daily_rate:,.2f} THB/day</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Discord user ID</th>
              <th>Discord name</th>
              <th>Employee name</th>
              <th>Current daily rate</th>
              <th>Edit rate</th>
            </tr>
          </thead>
          <tbody>{body}</tbody>
        </table>
      </main>
    </body>
    </html>
    """


@app.get("/", response_class=HTMLResponse)
async def home(request: Request, updated: str = "") -> HTMLResponse:
    token = _require_token(request)
    message = "Daily rate updated." if updated == "1" else ""
    return HTMLResponse(_page(token, message))


@app.post("/employees/{user_id}/rate")
async def update_rate(user_id: int, request: Request) -> RedirectResponse:
    token = _require_token(request)
    body = (await request.body()).decode("utf-8")
    values = parse_qs(body)
    try:
        daily_rate = float(values["daily_rate"][0])
    except (KeyError, IndexError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid daily rate") from exc

    try:
        db.set_daily_rate(user_id, daily_rate, datetime.now(settings.timezone))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Employee not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Daily rate must be non-negative") from exc

    return RedirectResponse(
        url=f"/?token={quote(token)}&updated=1",
        status_code=303,
    )


@app.post("/employees/{user_id}/profile")
async def update_profile(user_id: int, request: Request) -> RedirectResponse:
    token = _require_token(request)
    values = parse_qs((await request.body()).decode("utf-8"), keep_blank_values=True)
    full_name = values.get("full_name", [""])[0]
    try:
        db.set_full_name(user_id, full_name, datetime.now(settings.timezone))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Employee not found") from exc
    return RedirectResponse(
        url=f"/?token={quote(token)}&updated=1",
        status_code=303,
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    if not settings.admin_web_token:
        raise SystemExit("Missing ADMIN_WEB_TOKEN in .env")
    uvicorn.run(
        app,
        host=settings.admin_web_host,
        port=settings.admin_web_port,
    )
