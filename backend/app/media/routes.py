from pathlib import Path
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session
from ..config import settings
from ..db import get_db
from ..models import Media
from ..utils.api import ok

router = APIRouter(prefix="/media", tags=["media"])

@router.get("")
def list_media(page: int = 1, size: int = 24, db: Session = Depends(get_db)):
    query = db.query(Media).order_by(Media.id.desc())
    return ok({"items": query.offset((page - 1) * size).limit(size).all(), "total": query.count(), "page": page, "size": size})

@router.get("/{media_id}")
def get_media(media_id: int, db: Session = Depends(get_db)):
    media = db.get(Media, media_id)
    if not media:
        raise HTTPException(status_code=404, detail="media not found")
    return ok(media)

@router.post("")
async def upload_media(file: UploadFile = File(...), db: Session = Depends(get_db)):
    media_root = Path(settings.media_root)
    media_root.mkdir(parents=True, exist_ok=True)
    target = media_root / file.filename
    with target.open("wb") as handle:
        while chunk := await file.read(1024 * 1024):
            handle.write(chunk)
    media = Media(title=file.filename, media_type=file.content_type or "application/octet-stream", storage_path=str(target))
    db.add(media); db.commit(); db.refresh(media)
    return ok(media)
