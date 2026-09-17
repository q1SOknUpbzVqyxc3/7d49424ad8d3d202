import fcntl
import ipaddress
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def mask_ip(value: str) -> str:
    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        return '0.0.0.0' if value else ''
    prefix = 24 if address.version == 4 else 64
    return str(ipaddress.ip_network(f'{address}/{prefix}', strict=False).network_address)


def archive_lead(path_value: str, fields: dict[str, Any], rendered: str, ip: str, user_agent: str) -> None:
    path = Path(path_value)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o750)
    record = {
        'at': datetime.now(timezone.utc).isoformat(),
        'ip': mask_ip(ip),
        'user_agent': user_agent[:2000],
        'fields': fields,
        'rendered': rendered
    }
    descriptor = os.open(path, os.O_APPEND | os.O_CREAT | os.O_WRONLY, 0o640)
    try:
        fcntl.flock(descriptor, fcntl.LOCK_EX)
        os.write(descriptor, (json.dumps(record, ensure_ascii=False, separators=(',', ':')) + '\n').encode())
    finally:
        fcntl.flock(descriptor, fcntl.LOCK_UN)
        os.close(descriptor)
