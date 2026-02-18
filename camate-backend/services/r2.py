"""
Local File Storage — replaces Cloudflare R2 for development/testing.
Files are saved to: camate-backend/local_storage/
The API surface is identical to r2.py so no other code needs to change.
"""
import os
import time
import logging
from pathlib import Path
from decouple import config

logger = logging.getLogger(__name__)

# Root folder for all local uploads/outputs
STORAGE_ROOT = Path(__file__).resolve().parent.parent / 'local_storage'
STORAGE_ROOT.mkdir(parents=True, exist_ok=True)

# Base URL Django will serve files from (uses Django's built-in file serving in dev)
BASE_SERVE_URL = config('LOCAL_STORAGE_URL', default='http://127.0.0.1:8000/media')


def _abs(storage_key: str) -> Path:
    """Convert a storage_key to an absolute local path."""
    p = STORAGE_ROOT / storage_key
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def get_upload_presigned_url(ca_code, customer_id, financial_year, month, file_name):
    """
    Returns a fake 'presigned URL' that points to Django's local upload endpoint.
    The frontend will POST the file to this URL instead of R2.
    """
    timestamp = int(time.time())
    storage_key = f"uploads/{ca_code}/{customer_id}/{financial_year}/{month}/{timestamp}_{file_name}"
    # In local mode the frontend uploads via Django directly (see uploads/views.py LocalUploadView)
    upload_url = f"http://127.0.0.1:8000/api/uploads/local-upload/?key={storage_key}"
    return {
        "presigned_url": upload_url,
        "storage_key": storage_key,
        "local_mode": True   # frontend uses this flag to POST instead of PUT
    }


def get_download_presigned_url(storage_key: str) -> str:
    """Returns a local serve URL for the file."""
    return f"{BASE_SERVE_URL}/{storage_key}"


def get_file_content(storage_key: str) -> str:
    """Reads file content from local disk."""
    path = _abs(storage_key)
    if not path.exists():
        raise ValueError(f"File not found in local storage: {storage_key}")
    return path.read_text(encoding='utf-8')


def save_output_file(ca_code, customer_id, financial_year, month, file_name, file_bytes: bytes) -> str:
    """Saves generated output (Excel) to local disk. Returns storage_key."""
    storage_key = f"outputs/{ca_code}/{customer_id}/{financial_year}/{month}/{file_name}"
    path = _abs(storage_key)
    path.write_bytes(file_bytes)
    logger.info(f"Saved output file locally: {path}")
    return storage_key


def delete_file(storage_key: str) -> bool:
    """Deletes a file from local storage."""
    path = _abs(storage_key)
    try:
        if path.exists():
            path.unlink()
        return True
    except Exception as e:
        logger.error(f"Failed to delete local file {storage_key}: {e}")
        return False


def list_expired_uploads():
    """Lists storage_keys of upload files older than 90 days."""
    import time as _time
    threshold = _time.time() - (90 * 24 * 3600)
    expired = []
    uploads_dir = STORAGE_ROOT / 'uploads'
    if uploads_dir.exists():
        for f in uploads_dir.rglob('*'):
            if f.is_file() and f.stat().st_mtime < threshold:
                expired.append(str(f.relative_to(STORAGE_ROOT)).replace('\\', '/'))
    return expired
