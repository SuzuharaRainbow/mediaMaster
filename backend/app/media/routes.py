from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import Media
from ..utils.api import ok

router = APIRouter(prefix="/media", tags=["media"])

@router.get("")
def list_media(page: int = 1, size: int = 24, db: Session = Depends(get_db)):
    query = db.query(Media).order_by(Media.id.desc())
    total = query.count()
    items = query.offset((page - 1) * size).limit(size).all()
    return ok({"items": items, "total": total, "page": page, "size": size})

@router.get("/{media_id}")
def get_media(media_id: int, db: Session = Depends(get_db)):
    media = db.get(Media, media_id)
    if not media:
        raise HTTPException(status_code=404, detail="media not found")
    return ok(media)
