"""
ตัวอย่างการเรียกใช้ MahaniyomNotion จาก Manus pipeline
====================================================

วิธีรัน:
  1) สร้างไฟล์ .env (ดู .env.example) ใส่ NOTION_TOKEN และ NOTION_DATABASE_ID
  2) pip install notion-client python-dotenv
  3) python example_usage.py
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# โหลด .env จากโฟลเดอร์เดียวกับไฟล์นี้
load_dotenv(Path(__file__).parent / ".env")

from notion_client_mahaniyom import MahaniyomNotion


def main():
    # 1. สร้าง client (อ่าน NOTION_TOKEN, NOTION_DATABASE_ID จาก env อัตโนมัติ)
    nc = MahaniyomNotion()

    # 2. เช็ค schema ก่อน — ครั้งแรกควรรันสักครั้ง
    print(">>> ตรวจสอบ schema ของ Mahaniyom Asset DB...")
    result = nc.validate_schema()
    if not result.ok:
        print("\n⚠️  Schema ยังไม่พร้อม — แก้คอลัมน์ใน Notion ตามรายงานข้างบนก่อน")
        return

    # 3. ตัวอย่าง: หลัง ComfyUI generate ภาพเสร็จ
    print("\n>>> สร้าง page สำหรับ asset ใหม่...")
    page = nc.create_asset(
        name="scene_001_sunset",
        image_path="https://cdn.example.com/maha99/scene_001.png",
        video_path=None,  # ยังไม่มีวิดีโอ
        status="Generating",
        comfy_prompt=(
            "masterpiece, best quality, ultra detailed, "
            "thai temple at sunset, cinematic lighting, 8k"
        ),
        grok_prompt="A serene Thai temple bathed in golden sunset light",
    )
    page_id = page["id"]
    page_url = page.get("url")
    print(f"  ✓ created page: {page_url}")

    # 4. หลัง Grok สร้างวิดีโอเสร็จ → อัพเดต status
    print("\n>>> อัพเดต status เป็น Done...")
    nc.update_status(page_id, "Done")
    print("  ✓ updated")

    # 5. ค้นหา page ที่สร้างไว้
    print("\n>>> ค้นหา page ตามชื่อ...")
    found = nc.find_by_name("scene_001_sunset")
    print(f"  ✓ found {len(found)} page(s)")


# ---------------------------------------------------------------------------
# วิธี integrate เข้ากับ Manus pipeline จริง — ใส่ใน workflow ของคุณ
# ---------------------------------------------------------------------------
def manus_integration_hook(asset_data: dict):
    """
    เรียกฟังก์ชันนี้จาก Manus หลังจาก generate เสร็จ
    asset_data ควรมี keys: name, image_path, video_path, status, comfy_prompt, grok_prompt
    """
    nc = MahaniyomNotion()
    page = nc.create_asset(**asset_data)
    return page["id"], page.get("url")


if __name__ == "__main__":
    main()
