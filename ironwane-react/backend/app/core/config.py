import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    telegram_bot_token: str
    telegram_chat_id: str
    allowed_hosts: tuple[str, ...]
    lead_archive_path: str


def get_settings() -> Settings:
    hosts = tuple(value.strip().lower() for value in os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if value.strip())
    return Settings(
        telegram_bot_token=os.getenv('TELEGRAM_BOT_TOKEN', ''),
        telegram_chat_id=os.getenv('TELEGRAM_CHAT_ID', ''),
        allowed_hosts=hosts,
        lead_archive_path=os.getenv('LEAD_ARCHIVE_PATH', '/var/lib/ironvane/leads.jsonl')
    )
