import logging
import re
from email.parser import BytesParser
from email.policy import default
from urllib.parse import parse_qsl, urlparse

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, PlainTextResponse, RedirectResponse

from app.core.config import get_settings
from app.schemas.lead import LeadPayload
from app.services.archive import archive_lead
from app.services.telegram import clean, render_message, send_message


router = APIRouter()
logger = logging.getLogger(__name__)
email_pattern = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$')


def wants_document(request: Request) -> bool:
    destination = request.headers.get('sec-fetch-dest', '')
    return destination == 'document' if destination else 'text/html' in request.headers.get('accept', '')


def response_for_success(request: Request, delivery: str = 'telegram', status_code: int = 200):
    if wants_document(request):
        referer = request.headers.get('referer', '')
        target = urlparse(referer).path if referer else '/'
        return RedirectResponse(f'{target or "/"}#sent', status_code=303, headers={'Cache-Control': 'no-store'})
    return JSONResponse({'ok': True, 'delivery': delivery}, status_code=status_code, headers={'Cache-Control': 'no-store'})


async def parse_payload(request: Request, raw: bytes) -> dict:
    content_type = request.headers.get('content-type', '')
    if 'application/x-www-form-urlencoded' in content_type:
        return dict(parse_qsl(raw.decode('utf-8'), keep_blank_values=True))
    if 'multipart/form-data' in content_type:
        message = BytesParser(policy=default).parsebytes(
            f'Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n'.encode() + raw
        )
        return {
            part.get_param('name', header='content-disposition'): part.get_content()
            for part in message.iter_parts()
            if part.get_param('name', header='content-disposition') and not part.get_filename()
        }
    return LeadPayload.model_validate_json(raw).fields()


@router.api_route('/api/lead', methods=['GET', 'PUT', 'PATCH', 'DELETE'])
async def reject_method():
    return PlainTextResponse('Method Not Allowed', status_code=405, headers={'Allow': 'POST', 'Cache-Control': 'no-store'})


@router.post('/api/lead')
async def create_lead(request: Request):
    settings = get_settings()
    origin = request.headers.get('origin')
    if origin:
        origin_host = (urlparse(origin).hostname or '').lower()
        request_host = (request.url.hostname or '').lower()
        if origin_host != request_host or request_host not in settings.allowed_hosts:
            return JSONResponse({'ok': False}, status_code=403)
    raw = await request.body()
    if len(raw) > 12000:
        return JSONResponse({'ok': False}, status_code=413)
    try:
        data = await parse_payload(request, raw)
    except (ValueError, UnicodeDecodeError):
        return JSONResponse({'ok': False}, status_code=400)
    if clean(data.get('website')):
        return response_for_success(request, delivery='filtered')
    email = clean(data.get('email'))
    if not email_pattern.match(email):
        return JSONResponse({'ok': False}, status_code=400)
    page = clean(data.get('page')) or request.headers.get('referer', '')[:2000]
    country = request.headers.get('cf-ipcountry') or request.headers.get('x-country-code', '')
    rendered = render_message(data, page, country)
    archived = False
    try:
        archive_lead(settings.lead_archive_path, data, rendered, request.client.host if request.client else '', request.headers.get('user-agent', ''))
        archived = True
    except OSError:
        logger.exception('lead: archive write failed')
    if settings.telegram_bot_token and settings.telegram_chat_id:
        try:
            await send_message(settings.telegram_bot_token, settings.telegram_chat_id, rendered)
            return response_for_success(request)
        except httpx.HTTPError as error:
            logger.error('lead: telegram delivery failed: %s', type(error).__name__)
    else:
        logger.warning('lead: Telegram delivery is not configured')
    if archived:
        return response_for_success(request, delivery='archived', status_code=202)
    return JSONResponse({'ok': False}, status_code=503, headers={'Cache-Control': 'no-store'})
