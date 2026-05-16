"""
Mahaniyom Asset - Notion Client
================================
Python module สำหรับให้ Manus ส่ง metadata ของภาพ/วิดีโอที่ generate เสร็จ
ไปยัง Notion database "Mahaniyom Asset"

Requirements:
    pip install notion-client python-dotenv

Environment variables (แนะนำให้เก็บใน .env):
    NOTION_TOKEN        Internal Integration Token (secret_xxx หรือ ntn_xxx)
    NOTION_DATABASE_ID  Database ID ของ "Mahaniyom Asset" (32 ตัวอักษร)

Usage (สั้น):
    from notion_client_mahaniyom import MahaniyomNotion
    nc = MahaniyomNotion()           # อ่าน env vars อัตโนมัติ
    nc.validate_schema()             # เช็คคอลัมน์ครบ/ตรง type หรือไม่
    nc.create_asset(
        name="scene_001",
        image_path="/data/out/scene_001.png",
        video_path="/data/out/scene_001.mp4",
        status="Done",
        comfy_prompt="masterpiece, ...",
        grok_prompt="cinematic shot of ...",
    )
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional, Dict, Any, List

try:
    from notion_client import Client
    from notion_client.errors import APIResponseError
except ImportError as e:
    raise ImportError(
        "ต้องติดตั้ง notion-client ก่อน: pip install notion-client"
    ) from e


# ---------------------------------------------------------------------------
# Schema definition
# ---------------------------------------------------------------------------
EXPECTED_SCHEMA: Dict[str, str] = {
    "Name":          "title",
    "Image Path":    "url",
    "Video Path":    "url",
    "Status":        "select",
    "ComfyUI Prompt": "rich_text",
    "Grok Prompt":   "rich_text",
}

ACCEPTABLE_ALTERNATIVES: Dict[str, List[str]] = {
    "url":       ["url", "rich_text", "files"],
    "rich_text": ["rich_text"],
    "title":     ["title"],
    "select":    ["select", "status"],
}


@dataclass
class SchemaCheckResult:
    ok: bool
    missing: List[str]
    type_mismatches: List[str]
    extras: List[str]
    actual_schema: Dict[str, str]

    def report(self) -> str:
        lines = ["===== Mahaniyom Asset – Schema Check ====="]
        lines.append(f"Status : {'OK ✓' if self.ok else 'NEEDS FIX ✗'}")
        lines.append("")
        lines.append("คอลัมน์ที่พบจริงใน Notion:")
        for k, v in self.actual_schema.items():
            lines.append(f"  • {k:<18} ({v})")
        if self.missing:
            lines.append("")
            lines.append("ขาดคอลัมน์ (ต้องเพิ่ม):")
            for m in self.missing:
                lines.append(f"  - {m}  (expected type: {EXPECTED_SCHEMA[m]})")
        if self.type_mismatches:
            lines.append("")
            lines.append("Type ไม่ตรง (อาจต้องแก้):")
            for m in self.type_mismatches:
                lines.append(f"  - {m}")
        if self.extras:
            lines.append("")
            lines.append("คอลัมน์เกิน (ไม่จำเป็น แต่ใช้งานได้):")
            for e in self.extras:
                lines.append(f"  + {e}")
        return "\n".join(lines)


class MahaniyomNotion:
    """Wrapper รอบ notion-client เฉพาะสำหรับ Mahaniyom Asset DB"""

    def __init__(
        self,
        token: Optional[str] = None,
        database_id: Optional[str] = None,
    ):
        self.token = token or os.getenv("NOTION_TOKEN")
        self.database_id = database_id or os.getenv("NOTION_DATABASE_ID")

        if not self.token:
            raise ValueError(
                "ไม่พบ NOTION_TOKEN — ตั้งใน env หรือส่ง token=... ตอน init"
            )
        if not self.database_id:
            raise ValueError(
                "ไม่พบ NOTION_DATABASE_ID — ตั้งใน env หรือส่ง database_id=... ตอน init"
            )

        self.database_id = self.database_id.replace("-", "")
        self.client = Client(auth=self.token)
        self._cached_schema: Optional[Dict[str, str]] = None

    def fetch_schema(self, refresh: bool = False) -> Dict[str, str]:
        if self._cached_schema is not None and not refresh:
            return self._cached_schema

        try:
            db = self.client.databases.retrieve(database_id=self.database_id)
        except APIResponseError as e:
            if e.code == "object_not_found":
                raise RuntimeError(
                    f"หา database id {self.database_id} ไม่เจอ — "
                    "เช็คว่า (1) ID ถูก และ (2) Share DB ให้ Integration แล้ว"
                ) from e
            raise

        props = db.get("properties", {})
        self._cached_schema = {name: meta["type"] for name, meta in props.items()}
        return self._cached_schema

    def validate_schema(self, verbose: bool = True) -> SchemaCheckResult:
        actual = self.fetch_schema(refresh=True)
        missing = []
        type_mismatches = []

        for col, expected_type in EXPECTED_SCHEMA.items():
            if col not in actual:
                missing.append(col)
                continue
            actual_type = actual[col]
            allowed = ACCEPTABLE_ALTERNATIVES.get(expected_type, [expected_type])
            if actual_type not in allowed:
                type_mismatches.append(
                    f"{col}: expected {expected_type} (or {allowed}), got '{actual_type}'"
                )

        extras = [c for c in actual if c not in EXPECTED_SCHEMA]
        ok = len(missing) == 0 and len(type_mismatches) == 0
        result = SchemaCheckResult(
            ok=ok,
            missing=missing,
            type_mismatches=type_mismatches,
            extras=extras,
            actual_schema=actual,
        )
        if verbose:
            print(result.report())
        return result

    def _build_property(self, col_name: str, value: Any) -> Dict[str, Any]:
        schema = self.fetch_schema()
        ptype = schema.get(col_name)
        if ptype is None:
            raise KeyError(f"ไม่มีคอลัมน์ '{col_name}' ใน database")

        if value is None:
            return {ptype: None}

        if ptype == "title":
            return {"title": [{"type": "text", "text": {"content": str(value)}}]}
        if ptype == "rich_text":
            return {"rich_text": [{"type": "text", "text": {"content": str(value)}}]}
        if ptype == "url":
            v = str(value)
            if v.startswith(("http://", "https://", "ftp://")):
                return {"url": v}
            raise ValueError(
                f"คอลัมน์ '{col_name}' เป็น type url แต่ค่า '{v}' ไม่ใช่ URL. "
                "แนะนำเปลี่ยน type เป็น Text ใน Notion หรือส่งเป็น https URL"
            )
        if ptype == "select":
            return {"select": {"name": str(value)}}
        if ptype == "status":
            return {"status": {"name": str(value)}}
        if ptype == "files":
            return {
                "files": [
                    {"type": "external", "name": str(value),
                     "external": {"url": str(value)}}
                ]
            }
        if ptype == "number":
            return {"number": float(value)}
        if ptype == "checkbox":
            return {"checkbox": bool(value)}
        if ptype == "multi_select":
            vals = value if isinstance(value, (list, tuple)) else [value]
            return {"multi_select": [{"name": str(v)} for v in vals]}
        if ptype == "date":
            return {"date": {"start": str(value)}}

        raise NotImplementedError(f"ยังไม่รองรับ property type: {ptype}")

    def create_asset(
        self,
        name: str,
        image_path: Optional[str] = None,
        video_path: Optional[str] = None,
        status: str = "Done",
        comfy_prompt: Optional[str] = None,
        grok_prompt: Optional[str] = None,
        extra_props: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        self.fetch_schema()

        properties: Dict[str, Any] = {}
        properties["Name"] = self._build_property("Name", name)

        if image_path is not None:
            properties["Image Path"] = self._build_property("Image Path", image_path)
        if video_path is not None:
            properties["Video Path"] = self._build_property("Video Path", video_path)
        if status is not None:
            properties["Status"] = self._build_property("Status", status)
        if comfy_prompt is not None:
            properties["ComfyUI Prompt"] = self._build_property(
                "ComfyUI Prompt", comfy_prompt
            )
        if grok_prompt is not None:
            properties["Grok Prompt"] = self._build_property("Grok Prompt", grok_prompt)

        if extra_props:
            for k, v in extra_props.items():
                properties[k] = self._build_property(k, v)

        page = self.client.pages.create(
            parent={"database_id": self.database_id},
            properties=properties,
        )
        return page

    def update_status(self, page_id: str, status: str) -> Dict[str, Any]:
        return self.client.pages.update(
            page_id=page_id,
            properties={"Status": self._build_property("Status", status)},
        )

    def find_by_name(self, name: str) -> List[Dict[str, Any]]:
        result = self.client.databases.query(
            database_id=self.database_id,
            filter={
                "property": "Name",
                "title": {"equals": name},
            },
        )
        return result.get("results", [])


if __name__ == "__main__":
    import sys
    cmd = sys.argv[1] if len(sys.argv) > 1 else "validate"
    nc = MahaniyomNotion()
    if cmd == "validate":
        nc.validate_schema()
    elif cmd == "demo":
        page = nc.create_asset(
            name="demo_asset_001",
            image_path="https://example.com/demo.png",
            video_path="https://example.com/demo.mp4",
            status="Done",
            comfy_prompt="masterpiece, best quality, demo",
            grok_prompt="cinematic shot, demo",
        )
        print(f"Created page: {page.get('url')}")
    else:
        print("Usage: python notion_client_mahaniyom.py [validate|demo]")
