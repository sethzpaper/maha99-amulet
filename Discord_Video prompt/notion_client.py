"""
DEPRECATED — โค้ดจริงย้ายไปไฟล์ notion_client_mahaniyom.py แล้ว

ไฟล์นี้เหลือไว้เพื่อให้ระบบไม่พังถ้า script เก่าเรียก `import notion_client`
จาก directory นี้ — มันจะ forward ไปที่ package "notion-client" ตัวจริงที่ติดตั้งจาก pip

แนะนำให้ลบไฟล์นี้ทิ้งเมื่อสะดวก:
    rm notion_client.py        (Linux/macOS)
    del notion_client.py       (Windows)
"""
import os
import sys
import importlib

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))

# ลบ directory นี้ออกจาก sys.path ชั่วคราว แล้วโหลด notion_client ตัวจริง
_saved_path = sys.path[:]
sys.path = [p for p in sys.path if os.path.abspath(p or ".") != _THIS_DIR]

# ลบ cache ของตัวเองออก ไม่งั้น importlib จะคืน shim นี้กลับมา
_self_cached = sys.modules.pop("notion_client", None)
try:
    _real = importlib.import_module("notion_client")
except ImportError as _e:
    # คืนค่าเดิมถ้าโหลดไม่สำเร็จ
    sys.path = _saved_path
    if _self_cached is not None:
        sys.modules["notion_client"] = _self_cached
    raise ImportError(
        "ติดตั้ง notion-client ไม่สำเร็จ: pip install notion-client"
    ) from _e
finally:
    sys.path = _saved_path

# แทนที่ตัวเองใน sys.modules ด้วย package ตัวจริง
sys.modules["notion_client"] = _real

# Re-export ของจำเป็นเพื่อให้ `from notion_client import Client` ทำงานได้
Client = _real.Client
errors = _real.errors
