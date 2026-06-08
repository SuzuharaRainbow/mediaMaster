from __future__ import annotations

import hashlib
import logging
import mimetypes
import re
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Iterator, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.dialects.mysql import INTEGER as MySQLInteger
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import settings
from ..deps import SessionDep, require_manager, require_user
from ..models import Album, Media, MediaTag, Tag, User
from ..utils.api import AppError, success

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/media", tags=["media"])


def _media_summary(media: Media) -> dict:
    return {
        "id": media.id,
        "type": media.type,
        "album_id": media.album_id,
        "title": media.title,
        "mime_type": media.mime_type,
        "bytes": media.bytes,
        "created_at": media.created_at,
        "taken_at": media.taken_at,
        "preview_path": media.preview_path,
    }


def _media_detail(media: Media) -> dict:
    return {
        **_media_summary(media),
        "filename": media.filename,
        "width": media.width,
        "height": media.height,
        "duration_sec": media.duration_sec,
        "storage_path": media.storage_path,
        "preview_path": media.preview_path,
        "sha256": media.sha256,
        "tags": [tag.name for tag in media.tags],
        "owner_id": media.owner_id,
    }


def _media_public_detail(media: Media) -> dict:
    return {
        "id": media.id,
        "title": media.title,
        "type": media.type,
        "mime_type": media.mime_type,
        "preview_path": media.preview_path,
        "album_id": media.album_id,
        "sha256": media.sha256,
        "created_at": media.created_at,
    }


IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".bmp",
    ".webp",
    ".heic",
    ".heif",
    ".tif",
    ".tiff",
    ".avif",
}

VIDEO_EXTENSIONS = {
    ".mp4",
    ".mov",
    ".m4v",
    ".avi",
    ".mkv",
    ".webm",
    ".flv",
    ".wmv",
    ".mpeg",
    ".mpg",
}


def _classify_type(mime: str, filename: Optional[str]) -> str:
    mime_lower = (mime or "").lower()
    ext = Path(filename).suffix.lower() if filename else ""

    if mime_lower.startswith("video/"):
        return "video"
    if mime_lower.startswith("image/"):
        return "image"

    if ext in VIDEO_EXTENSIONS:
        return "video"
    if ext in IMAGE_EXTENSIONS:
        return "image"

    return "image"


def _sync_media_types(session: Session) -> None:
    medias = session.execute(select(Media)).scalars().all()
    changed = False
    for media in medias:
        desired = _classify_type(media.mime_type, media.filename)
        if media.type != desired:
            media.type = desired
            changed = True
        if desired == "video" and not media.preview_path and media.storage_path:
            preview_rel = _generate_video_preview(Path(media.storage_path))
            if preview_rel:
                media.preview_path = preview_rel
                changed = True
    if changed:
        session.commit()
        session.expire_all()


def _generate_video_preview(rel_path: Path) -> Optional[str]:
    source_path = Path(settings.MEDIA_ROOT) / rel_path
    if not source_path.exists():
        return None

    preview_rel = Path("previews") / rel_path.with_suffix(".jpg")
    preview_abs = Path(settings.MEDIA_ROOT) / preview_rel
    preview_abs.parent.mkdir(parents=True, exist_ok=True)

    command = [
        "ffmpeg",
        "-y",
        "-ss",
        "00:00:00.5",
        "-i",
        str(source_path),
        "-frames:v",
        "1",
        "-vf",
        "scale=640:-1",
        "-update",
        "1",
        str(preview_abs),
    ]

    try:
        subprocess.run(command, capture_output=True, check=True)
    except FileNotFoundError:
        logger.warning("ffmpeg not found when generating preview for %s", source_path)
        return None
    except subprocess.CalledProcessError as exc:
        logger.warning(
            "ffmpeg failed for %s: %s",
            source_path,
            exc.stderr.decode("utf-8", errors="ignore") if exc.stderr else exc,
        )
        return None

    if preview_abs.exists():
        return preview_rel.as_posix()
    return None


def _file_iterator(path: Path, start: int, end: int) -> Iterator[bytes]:
    chunk_size = 1024 * 512  # 512KB
    with path.open("rb") as file:
        file.seek(start)
        bytes_remaining = end - start + 1
        while bytes_remaining > 0:
            read_size = min(chunk_size, bytes_remaining)
            data = file.read(read_size)
            if not data:
                break
            bytes_remaining -= len(data)
            yield data


def _serve_file(*, path: Path, request: Request, media_type: str, filename: str) -> StreamingResponse | FileResponse:
    file_size = path.stat().st_size
    range_header = request.headers.get("range")
    headers = {
        "Accept-Ranges": "bytes",
        "Content-Disposition": f"inline; filename=\"{filename}\"",
    }

    if range_header:
        range_match = re.match(r"bytes=(\d+)-(\d*)", range_header)
        if range_match:
            start = int(range_match.group(1))
            end_str = range_match.group(2)
            end = int(end_str) if end_str else file_size - 1
            end = min(end, file_size - 1)
            if start >= file_size:
                start = file_size - 1
            if end < start:
                end = start
            response = StreamingResponse(
                _file_iterator(path, start, end),
                media_type=media_type,
                status_code=206,
                headers={
                    **headers,
                    "Content-Range": f"bytes {start}-{end}/{file_size}",
                    "Content-Length": str(end - start + 1),
                },
            )
            return response

    return FileResponse(
        str(path),
        media_type=media_type,
        filename=filename,
        headers=headers,
    )


def _ensure_album(session: Session, album_id: Optional[int], user: User) -> None:
    if album_id is None:
        return
    album = session.get(Album, album_id)
    if not album:
        raise AppError(status_code=404, code=40400, message="ALBUM_NOT_FOUND")
    if user.role == "developer":
        return
    if album.owner_id != user.id and album.visibility == "private":
        raise AppError(status_code=403, code=40301, message="NO_PERMISSION")


def _ensure_can_view(media: Media, user: User) -> None:
    if user.role == "developer" or media.owner_id == user.id:
        return
    if media.album is None:
        return
    if media.album.visibility != "private":
        return
    raise AppError(status_code=403, code=40301, message="NO_PERMISSION")


@router.get("")
def list_media(
    session: SessionDep,
    current_user: User = Depends(require_user),
    media_type: Optional[str] = Query(default=None, alias="type", pattern="^(image|video)$"),
    album_id: Optional[int] = Query(default=None),
    q: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    sort: str = Query(default="created_at", pattern="^(created_at|taken_at)$"),
):
    _sync_media_types(session)

    query = select(Media)
    count_query = select(func.count(Media.id))

    filters = []
    if media_type:
        filters.append(Media.type == media_type)
    if album_id:
        filters.append(Media.album_id == album_id)
    if q:
        like_term = f"%{q}%"
        tag_match_subquery = (
            select(MediaTag.media_id)
            .join(Tag, MediaTag.tag_id == Tag.id)
            .where(Tag.name.ilike(like_term))
            .scalar_subquery()
        )
        filters.append(
            or_(
                Media.title.ilike(like_term),
                Media.filename.ilike(like_term),
                Media.id.in_(tag_match_subquery),
            )
        )

    if filters:
        for f in filters:
            query = query.where(f)
            count_query = count_query.where(f)

    if current_user.role != "developer":
        join_on = Media.album_id == Album.id
        visibility_condition = or_(
            Media.owner_id == current_user.id,
            Media.album_id.is_(None),
            Album.visibility != "private",
        )
        query = query.join(Album, join_on, isouter=True).where(visibility_condition)
        count_query = count_query.join(Album, join_on, isouter=True).where(visibility_condition)

    order_column = Media.created_at if sort == "created_at" else Media.taken_at
    name_base = func.substring_index(Media.filename, ".", 1)
    name_numeric = func.cast(name_base, MySQLInteger(unsigned=True))

    if sort == "created_at":
        date_bucket = func.date(Media.created_at)
        query = query.order_by(
            date_bucket.is_(None),
            date_bucket.asc(),
            Media.created_at.asc(),
            name_numeric.asc(),
            name_base.asc(),
            Media.id.asc(),
        )
    else:
        query = query.order_by(
            order_column.is_(None),
            order_column.asc(),
            name_numeric.asc(),
            name_base.asc(),
            Media.id.asc(),
        )

    total = session.execute(count_query).scalar_one()
    items = (
        session.execute(query.offset((page - 1) * size).limit(size)).scalars().all()
    )

    data = {
        "items": [_media_summary(item) for item in items],
        "page": page,
        "size": size,
        "total": total,
    }
    return success(data)


@router.get("/{media_id}")
def get_media(media_id: int, session: SessionDep, current_user: User = Depends(require_user)):
    media = session.get(Media, media_id)
    if not media:
        raise AppError(status_code=404, code=40400, message="MEDIA_NOT_FOUND")
    _ensure_can_view(media, current_user)
    if current_user.role == "viewer":
        return success(_media_public_detail(media))
    return success(_media_detail(media))


@router.get("/{media_id}/file")
def download_media(media_id: int, request: Request, session: SessionDep, current_user: User = Depends(require_user)):
    media = session.get(Media, media_id)
    if not media:
        raise AppError(status_code=404, code=40400, message="MEDIA_NOT_FOUND")
    _ensure_can_view(media, current_user)
    file_path = Path(settings.MEDIA_ROOT) / media.storage_path
    if not file_path.exists():
        raise AppError(status_code=404, code=40400, message="FILE_NOT_FOUND")
    return _serve_file(path=file_path, request=request, media_type=media.mime_type, filename=media.filename)


@router.get("/{media_id}/preview")
def download_media_preview(media_id: int, request: Request, session: SessionDep, current_user: User = Depends(require_user)):
    media = session.get(Media, media_id)
    if not media:
        raise AppError(status_code=404, code=40400, message="MEDIA_NOT_FOUND")
    _ensure_can_view(media, current_user)
    if not media.preview_path:
        raise AppError(status_code=404, code=40400, message="PREVIEW_NOT_FOUND")
    preview_path = Path(settings.MEDIA_ROOT) / media.preview_path
    if not preview_path.exists():
        raise AppError(status_code=404, code=40400, message="PREVIEW_NOT_FOUND")
    return _serve_file(path=preview_path, request=request, media_type="image/jpeg", filename=f"preview-{media.filename}.jpg")


async def _store_file(upload: UploadFile, *, size_limit: Optional[int]) -> tuple[Path, int, str]:
    ext = Path(upload.filename or "").suffix or mimetypes.guess_extension(upload.content_type or "") or ""
    rel_path = Path(datetime.utcnow().strftime("%Y/%m/%d")) / f"{uuid4().hex}{ext}"
    target_path = Path(settings.MEDIA_ROOT) / rel_path
    target_path.parent.mkdir(parents=True, exist_ok=True)

    sha256 = hashlib.sha256()
    size = 0
    chunk_size = 1024 * 1024

    try:
        with target_path.open("wb") as buffer:
            while True:
                chunk = await upload.read(chunk_size)
                if not chunk:
                    break
                size += len(chunk)
                if size_limit is not None and size > size_limit:
                    raise AppError(status_code=400, code=40001, message="FILE_TOO_LARGE")
                sha256.update(chunk)
                buffer.write(chunk)
    except Exception:
        if target_path.exists():
            target_path.unlink(missing_ok=True)
        raise
    finally:
        await upload.close()

    if size == 0:
        if target_path.exists():
            target_path.unlink(missing_ok=True)
        raise AppError(status_code=400, code=40000, message="EMPTY_FILE")

    return rel_path, size, sha256.hexdigest()


@router.post("/upload")
async def upload_media(
    session: SessionDep,
    current_user: User = Depends(require_manager),
    files: List[UploadFile] = File(..., alias="file"),
    album_id: Optional[int] = Form(default=None),
    taken_at: Optional[str] = Form(default=None),
    title: Optional[str] = Form(default=None),
):
    if not files:
        raise AppError(status_code=400, code=40000, message="NO_FILES")

    _ensure_album(session, album_id, current_user)

    created_media = []
    for upload in files:
        limit_bytes = None
        if settings.MAX_UPLOAD_MB and settings.MAX_UPLOAD_MB > 0:
            limit_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024

        rel_path, size, sha256 = await _store_file(upload, size_limit=limit_bytes)

        mime = upload.content_type or mimetypes.guess_type(upload.filename or "")[0] or "application/octet-stream"
        media_type = _classify_type(mime, upload.filename)
        taken_at_dt = None
        if taken_at:
            try:
                taken_at_dt = datetime.fromisoformat(taken_at)
            except ValueError as exc:  # noqa: PERF203 keep simple
                raise AppError(status_code=400, code=40000, message="INVALID_TAKEN_AT") from exc

        title_value = (title.strip() if title else "") or (upload.filename or rel_path.name)
        preview_rel = None
        if media_type == "video":
            preview_rel = _generate_video_preview(rel_path)

        media = Media(
            owner_id=current_user.id,
            album_id=album_id,
            type=media_type,
            filename=upload.filename or rel_path.name,
            title=title_value,
            mime_type=mime,
            bytes=size,
            sha256=sha256,
            taken_at=taken_at_dt,
            storage_path=rel_path.as_posix(),
            preview_path=preview_rel,
        )
        session.add(media)
        created_media.append(media)

    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise AppError(status_code=409, code=40900, message="MEDIA_DUPLICATE") from exc

    for media in created_media:
        session.refresh(media)

    return success([
        {
            "id": media.id,
            "type": media.type,
            "filename": media.filename,
            "album_id": media.album_id,
            "created_at": media.created_at,
        }
        for media in created_media
    ])


class UpdateMediaPayload(BaseModel):
    title: Optional[str] = None
    album_id: Optional[int] = None
    taken_at: Optional[str] = None


@router.patch("/{media_id}")
def update_media(
    media_id: int,
    body: UpdateMediaPayload,
    session: SessionDep,
    current_user: User = Depends(require_manager),
):
    media = session.get(Media, media_id)
    if not media:
        raise AppError(status_code=404, code=40400, message="MEDIA_NOT_FOUND")

    if body.album_id is not None:
        _ensure_album(session, body.album_id, current_user)
        media.album_id = body.album_id

    if body.title is not None:
        media.title = body.title

    if body.taken_at is not None:
        if body.taken_at.strip():
            try:
                media.taken_at = datetime.fromisoformat(body.taken_at)
            except ValueError as exc:  # noqa: PERF203 keep simple
                raise AppError(status_code=400, code=40000, message="INVALID_TAKEN_AT") from exc
        else:
            media.taken_at = None

    session.commit()
    session.refresh(media)
    return success(_media_detail(media))


@router.delete("/{media_id}")
def delete_media(
    media_id: int,
    session: SessionDep,
    current_user: User = Depends(require_manager),
):
    media = session.get(Media, media_id)
    if not media:
        raise AppError(status_code=404, code=40400, message="MEDIA_NOT_FOUND")

    file_path = Path(settings.MEDIA_ROOT) / media.storage_path
    if file_path.exists():
        try:
            file_path.unlink()
        except OSError:
            pass

    session.delete(media)
    session.commit()
    return success(message="DELETED")


class TagUpdatePayload(BaseModel):
    tags: List[str]


@router.post("/{media_id}/tags")
def update_media_tags(
    media_id: int,
    body: TagUpdatePayload,
    session: SessionDep,
    current_user: User = Depends(require_manager),
):
    media = session.get(Media, media_id)
    if not media:
        raise AppError(status_code=404, code=40400, message="MEDIA_NOT_FOUND")

    desired_names = {name.strip() for name in body.tags if name.strip()}

    existing_tags = (
        session.execute(select(Tag).where(Tag.name.in_(desired_names))).scalars().all()
        if desired_names
        else []
    )
    existing_names = {tag.name for tag in existing_tags}

    for name in desired_names - existing_names:
        tag = Tag(name=name)
        session.add(tag)
        existing_tags.append(tag)

    media.tags = existing_tags
    session.commit()
    session.refresh(media)
    return success({"tags": [tag.name for tag in media.tags]})