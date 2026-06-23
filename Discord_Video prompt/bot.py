from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app_config import load_settings
from bot_app import MahaniyomBot


settings = load_settings()
bot = MahaniyomBot(settings)


if __name__ == "__main__":
    if not settings.discord_token:
        raise SystemExit("Missing DISCORD_TOKEN in .env")
    bot.run(settings.discord_token)
