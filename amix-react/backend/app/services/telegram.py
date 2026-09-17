import html
from typing import Any

import httpx


ORDER = (
    ('name', 'Имя'),
    ('email', 'Email'),
    ('telegram', 'Telegram'),
    ('company', 'Компания'),
    ('country', 'Страна'),
    ('topic', 'Тема'),
    ('message', 'Сообщение')
)
SKIP = {'website', 'consent', 'kind', 'page'}


def clean(value: Any) -> str:
    if value is None or isinstance(value, (list, dict)):
        return ''
    return str(value).strip()[:2000]


def render_message(fields: dict[str, Any], page: str, country: str) -> str:
    heading = 'Подписка' if clean(fields.get('kind')) == 'subscribe' else 'Новая заявка AMIX'
    seen = set(SKIP)
    lines = []
    for key, label in ORDER:
        seen.add(key)
        value = clean(fields.get(key))
        if value:
            lines.append(f'<b>{html.escape(label)}:</b> {html.escape(value)}')
    for key, raw_value in fields.items():
        if key in seen:
            continue
        value = clean(raw_value)
        if value:
            lines.append(f'<b>{html.escape(str(key))}:</b> {html.escape(value)}')
    metadata = []
    if page:
        metadata.append(f'<b>Страница:</b> {html.escape(page)}')
    if country:
        metadata.append(f'<b>Гео:</b> {html.escape(country)}')
    groups = [f'<b>{html.escape(heading)}</b>', '\n'.join(lines)]
    if metadata:
        groups.append('\n'.join(metadata))
    return '\n\n'.join(groups).strip()


async def send_message(token: str, chat_id: str, text: str) -> None:
    async with httpx.AsyncClient(timeout=httpx.Timeout(15, connect=5)) as client:
        response = await client.post(
            f'https://api.telegram.org/bot{token}/sendMessage',
            json={
                'chat_id': chat_id,
                'text': text,
                'parse_mode': 'HTML',
                'disable_web_page_preview': True
            }
        )
    response.raise_for_status()
