"""Writing uploaded files, with a clear error when the uploads volume is not writable.

The backend runs as a non-root user (UID 10001).  An uploads volume created
by an older image that ran as root is owned by root, so every write fails
with ``PermissionError``.  This module turns that into a readable message and
checks the volume once at startup.
"""

from __future__ import annotations

import logging
import os
import uuid
from pathlib import Path

from fastapi import HTTPException

logger = logging.getLogger(__name__)

UPLOADS_ROOT = Path("/app/uploads")
SUBDIRS = ("recipes", "imported", "logos")

NOT_WRITABLE_DETAIL = (
    "Das Bild konnte nicht gespeichert werden, weil der Upload-Ordner auf dem Server "
    "nicht beschreibbar ist. Bitte einen Administrator, die Rechte des Upload-Volumes "
    "zu prüfen (siehe ADMIN.md, Abschnitt Häufige Probleme)."
)


def _hint(path: Path) -> str:
    return (
        f"Upload directory {path} is not writable by uid {os.getuid()}. "
        f"Fix on the host: chown -R {os.getuid()} <uploads volume>"
    )


def write_upload(directory: Path, filename: str, data: bytes) -> Path:
    """Write *data* to ``directory/filename``; raise HTTP 500 with a clear message on permission errors."""
    dest = directory / filename
    try:
        directory.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
    except PermissionError:
        logger.error(_hint(directory))
        raise HTTPException(status_code=500, detail=NOT_WRITABLE_DETAIL)
    return dest


def check_uploads_writable(root: Path = UPLOADS_ROOT) -> bool:
    """Log an error for each upload directory the backend cannot write to."""
    if not root.exists():
        return True  # local development without the volume
    ok = True
    for sub in ("", *SUBDIRS):
        path = root / sub
        probe = path / f".write_test_{uuid.uuid4().hex}"
        try:
            path.mkdir(parents=True, exist_ok=True)
            probe.write_bytes(b"")
            probe.unlink()
        except OSError:
            logger.error(_hint(path))
            ok = False
    return ok
