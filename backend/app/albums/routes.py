from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.dialects.mysql import INTEGER as MySQLInteger

from ..deps import SessionDep, require_manager, require_user
from ..models import Album, Media, User
from ..utils.api import AppError, success

router = APIRouter(prefix="/albums", tags=["albums"])


class AlbumCreate(BaseModel):
    title: str
    visibility: str = "private"


class AlbumUpdate(BaseModel):
    title: Optional[str] = None
    visibility: Optional[str] = None
    cover_media_id: Optional[int] = None


def _album_dict(
    album: Album,
    *,
    media_count: Optional[int] = None,
    first_media_id: Optional[int] = None,
    first_media_preview: Optional[str] = None,
    first_media_storage: Optional[str] = None,
    first_media_type: Optional[str] = None,
) -> dict:
    return {
        "id": album.id,
        "title": album.title,
        "visibility": album.visibility,
        "created_at": album.created_at,
        "owner_id": album.owner_id,
        "cover_media_id": album.cover_media_id,
        "media_count": media_count,
        "first_media_id": first_media_id,
        "first_media_preview_path": first_media_preview,
        "first_media_storage_path": first_media_storage,
        "first_media_type": first_media_type,
    }


def _validate_visibility(value: str) -> str:
    normalized = value.lower()
    if normalized not in {"private", "unlisted", "public"}:
        raise AppError(status_code=400, code=40002, message="INVALID_VISIBILITY")
    return normalized


@router.get("")
def list_albums(
    session: SessionDep,
    current_user: User = Depends(require_user),
    visibility: Optional[str] = Query(default=None),
):
    album_table = Album.__table__
    name_base = func.substring_index(Media.filename, ".", 1)
    name_numeric = func.cast(name_base, MySQLInteger(unsigned=True))

    media_count_subquery = (
        select(func.count(Media.id))
        .where(Media.album_id == album_table.c.id)
        .correlate(album_table)
        .scalar_subquery()
    )
    first_media_id_subquery = (
        select(Media.id)
        .where(Media.album_id == album_table.c.id)
        .order_by(Media.created_at.asc(), name_numeric.asc(), name_base.asc())
        .limit(1)
        .scalar_subquery()
    )
    first_media_preview_subquery = (
        select(Media.preview_path)
        .where(Media.album_id == album_table.c.id)
        .order_by(Media.created_at.asc(), name_numeric.asc(), name_base.asc())
        .limit(1)
        .scalar_subquery()
    )
    first_media_storage_subquery = (
        select(Media.storage_path)
        .where(Media.album_id == album_table.c.id)
        .order_by(Media.created_at.asc(), name_numeric.asc(), name_base.asc())
        .limit(1)
        .scalar_subquery()
    )
    first_media_type_subquery = (
        select(Media.type)
        .where(Media.album_id == album_table.c.id)
        .order_by(Media.created_at.asc(), name_numeric.asc(), name_base.asc())
        .limit(1)
        .scalar_subquery()
    )

    count_column = func.coalesce(media_count_subquery, 0).label("media_count")
    query = (
        select(
            album_table.c.id,
            album_table.c.title,
            album_table.c.visibility,
            album_table.c.created_at,
            album_table.c.owner_id,
            album_table.c.cover_media_id,
            count_column,
            first_media_id_subquery.label("first_media_id"),
            first_media_preview_subquery.label("first_media_preview_path"),
            first_media_storage_subquery.label("first_media_storage_path"),
            first_media_type_subquery.label("first_media_type"),
        )
        .select_from(album_table)
    )
    if visibility:
        _validate_visibility(visibility)
        query = query.where(album_table.c.visibility == visibility)

    if current_user.role != "developer":
        query = query.where((album_table.c.visibility != "private") | (album_table.c.owner_id == current_user.id))

    query = query.order_by(album_table.c.created_at.desc())
    rows = session.execute(query).all()
    payload = [
        {
            "id": row.id,
            "title": row.title,
            "visibility": row.visibility,
            "created_at": row.created_at,
            "owner_id": row.owner_id,
            "cover_media_id": row.cover_media_id,
            "media_count": row.media_count,
            "first_media_id": row.first_media_id,
            "first_media_preview_path": row.first_media_preview_path,
            "first_media_storage_path": row.first_media_storage_path,
            "first_media_type": row.first_media_type,
        }
        for row in rows
    ]
    return success(payload)


@router.post("")
def create_album(body: AlbumCreate, session: SessionDep, current_user: User = Depends(require_manager)):
    visibility = _validate_visibility(body.visibility)
    album = Album(owner_id=current_user.id, title=body.title, visibility=visibility)
    session.add(album)
    session.commit()
    session.refresh(album)
    media_count = session.execute(select(func.count(Media.id)).where(Media.album_id == album.id)).scalar_one()
    first_id, first_preview, first_storage, first_type = _first_media_info(session, album.id)
    return success(
        _album_dict(
            album,
            media_count=media_count,
            first_media_id=first_id,
            first_media_preview=first_preview,
            first_media_storage=first_storage,
            first_media_type=first_type,
        )
    )


@router.patch("/{album_id}")
def update_album(
    album_id: int,
    body: AlbumUpdate,
    session: SessionDep,
    current_user: User = Depends(require_manager),
):
    album = session.get(Album, album_id)
    if not album:
        raise AppError(status_code=404, code=40400, message="ALBUM_NOT_FOUND")

    if body.title is not None:
        album.title = body.title
    if body.visibility is not None:
        album.visibility = _validate_visibility(body.visibility)
    if body.cover_media_id is not None:
        media = session.get(Media, body.cover_media_id)
        if not media:
            raise AppError(status_code=404, code=40400, message="MEDIA_NOT_FOUND")
        if media.album_id != album.id:
            raise AppError(status_code=400, code=40003, message="MEDIA_NOT_IN_ALBUM")
        album.cover_media_id = body.cover_media_id

    session.commit()
    session.refresh(album)
    media_count = session.execute(select(func.count(Media.id)).where(Media.album_id == album.id)).scalar_one()
    first_id, first_preview, first_storage, first_type = _first_media_info(session, album.id)
    return success(
        _album_dict(
            album,
            media_count=media_count,
            first_media_id=first_id,
            first_media_preview=first_preview,
            first_media_storage=first_storage,
            first_media_type=first_type,
        )
    )


@router.delete("/{album_id}")
def delete_album(album_id: int, session: SessionDep, current_user: User = Depends(require_manager)):
    album = session.get(Album, album_id)
    if not album:
        raise AppError(status_code=404, code=40400, message="ALBUM_NOT_FOUND")
    session.delete(album)
    session.commit()
    return success(message="DELETED")
def _first_media_info(session: SessionDep, album_id: int) -> tuple[Optional[int], Optional[str], Optional[str], Optional[str]]:
    name_base = func.substring_index(Media.filename, ".", 1)
    name_numeric = func.cast(name_base, MySQLInteger(unsigned=True))
    row = session.execute(
        select(Media.id, Media.preview_path, Media.storage_path, Media.type)
        .where(Media.album_id == album_id)
        .order_by(Media.created_at.asc(), name_numeric.asc(), name_base.asc())
        .limit(1)
    ).first()
    if not row:
        return None, None, None, None
    return row.id, row.preview_path, row.storage_path, row.type