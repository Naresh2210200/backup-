"""
Local Storage helper for the FastAPI service.
Replaces R2 with local disk access, pointing to Django's local_storage folder.
"""
import logging
from pathlib import Path
from config import settings

logger = logging.getLogger(__name__)

# Point to the same folder Django uses: ../camate-backend/local_storage
# Resolving absolute path to be safe
STORAGE_ROOT = Path(__file__).resolve().parent.parent / 'camate-backend' / 'local_storage'

def _abs(storage_key: str) -> Path:
    p = STORAGE_ROOT / storage_key
    # Just ensure parent dir exists if we are writing
    return p
def read_file(storage_key: str) -> str:
    """Read a file from local disk as UTF-8 string."""
    path = _abs(storage_key)
    if not path.exists():
        logger.error(f"File not found: {path} (key={storage_key})")
        raise ValueError(f"Cannot read file from storage: {storage_key}")
    return path.read_text(encoding='utf-8')

def read_bytes(storage_key: str) -> bytes:
    """Read a file from local disk as bytes."""
    path = _abs(storage_key)
    if not path.exists():
        logger.error(f"File not found: {path} (key={storage_key})")
        raise ValueError(f"Cannot read file from storage: {storage_key}")
    return path.read_bytes()

def save_file(storage_key: str, content: bytes, content_type: str = 'application/octet-stream') -> str:
    """Save bytes to local disk."""
    path = _abs(storage_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    logger.info(f"Saved local file: {path}")
    return storage_key

def get_presigned_download_url(storage_key: str, expires_in: int = 300) -> str:
    """
    Return a URL that points to Django's media serve endpoint.
    FastAPI doesn't serve the files directly to the user; it returns a URL.
    """
    # Assuming Django is running on localhost:8000
    return f"http://127.0.0.1:8000/media/{storage_key}"
