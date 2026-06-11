from __future__ import annotations

import re
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, selectinload

from ..deps import SessionDep, require_developer, require_user
from ..models import Album, HomeSection, HomeSectionAlbum, User
from ..utils.api import AppError, success

router = APIRouter(prefix="/home-sections", tags=["home_sections"])


class SectionAlbumInfo(BaseModel):
    album_id: int
    title: str
    visibility: str


class HomeSectionSchema(BaseModel):
    id: int
    key: str
    title: str
    preview_rows: int
    order_index: int
    album_ids: list[int]
    albums: list[SectionAlbumInfo]


class SectionCreatePayload(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    key: Optional[str] = Field(default=None, min_length=1, max_length=64)
    preview_rows: int = Field(default=1, ge=1, le=2)


class SectionUpdatePayload(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    key: Optional[str] = Field(default=None, min_length=1, max_length=64)
    preview_rows: Optional[int] = Field(default=None, ge=1, le=2)


class SectionAlbumsPayload(BaseModel):
    album_ids: list[int] = Field(default_factory=list)


class SectionReorderPayload(BaseModel):
    order: list[int] = Field(default_factory=list)


def _slugify(value: str) -> str:
    normalized = re.sub(r"[^\w\s-]", "", value, flags=re.UNICODE).strip().lower()
    normalized = re.sub(r"[-\s]+", "-", normalized)
    return normalized or "section"


def _generate_unique_key(session: Session, base_key: str, *, exclude_id: Optional[int] = None) -> str:
    candidate = base_key
    index = 1
    while True:
        query: Select[HomeSection] = select(HomeSection).where(HomeSection.key == candidate)
        if exclude_id is not None:
            query = query.where(HomeSection.id != exclude_id)
        exists = session.execute(query).scalar_one_or_none()
        if not exists:
            return candidate
        candidate = f"{base_key}-{index}"
        index += 1


def _load_section(session: Session, section_id: int) -> HomeSection:
    section = session.execute(
        select(HomeSection)
        .options(selectinload(HomeSection.albums).selectinload(HomeSectionAlbum.album))
        .where(HomeSection.id == section_id)
    ).scalar_one_or_none()
    if not section:
        raise AppError(status_code=404, code=40400, message="HOME_SECTION_NOT_FOUND")
    return section


def _section_to_schema(section: HomeSection) -> dict:
    albums_payload = [
        SectionAlbumInfo(
            album_id=assignment.album_id,
            title=assignment.album.title,
            visibility=assignment.album.visibility,
        )
        for assignment in section.albums
        if assignment.album is not None
    ]
    schema = HomeSectionSchema(
        id=section.id,
        key=section.key,
        title=section.title,
        preview_rows=section.preview_rows,
        order_index=section.order_index,
        album_ids=[assignment.album_id for assignment in section.albums],
        albums=albums_payload,
    )
    return schema.dict()


@router.get("")
def list_sections(session: SessionDep, current_user: User = Depends(require_user)):
    sections = session.execute(
        select(HomeSection)
        .options(selectinload(HomeSection.albums).selectinload(HomeSectionAlbum.album))
        .order_by(HomeSection.order_index.asc(), HomeSection.id.asc())
    ).scalars().all()
    return success([_section_to_schema(section) for section in sections])


@router.post("")
def create_section(
    body: SectionCreatePayload,
    session: SessionDep,
    current_user: User = Depends(require_developer),
):
    base_key = _slugify(body.key or body.title)
    unique_key = _generate_unique_key(session, base_key)

    next_order = session.execute(select(func.coalesce(func.max(HomeSection.order_index), -1))).scalar_one() + 1

    section = HomeSection(
        key=unique_key,
        title=body.title.strip(),
        preview_rows=body.preview_rows,
        order_index=next_order,
    )
    session.add(section)
    session.commit()
    section = _load_section(session, section.id)
    return success(_section_to_schema(section))


@router.patch("/{section_id}")
def update_section(
    section_id: int,
    body: SectionUpdatePayload,
    session: SessionDep,
    current_user: User = Depends(require_developer),
):
    section = _load_section(session, section_id)

    if body.title is not None:
        section.title = body.title.strip()
    if body.preview_rows is not None:
        section.preview_rows = body.preview_rows
    if body.key is not None:
        normalized = _slugify(body.key)
        section.key = _generate_unique_key(session, normalized, exclude_id=section.id)

    session.commit()
    section = _load_section(session, section.id)
    return success(_section_to_schema(section))


@router.delete("/{section_id}")
def delete_section(section_id: int, session: SessionDep, current_user: User = Depends(require_developer)):
    section = session.get(HomeSection, section_id)
    if not section:
        raise AppError(status_code=404, code=40400, message="HOME_SECTION_NOT_FOUND")
    session.delete(section)
    session.commit()
    return success(message="DELETED")


@router.put("/{section_id}/albums")
def update_section_albums(
    section_id: int,
    body: SectionAlbumsPayload,
    session: SessionDep,
    current_user: User = Depends(require_developer),
):
    section = _load_section(session, section_id)

    desired_ids: list[int] = []
    seen = set()
    for album_id in body.album_ids:
        if album_id in seen:
            continue
        seen.add(album_id)
        desired_ids.append(album_id)

    current_assignments = {assignment.album_id: assignment for assignment in section.albums}

    for assignment in list(section.albums):
        if assignment.album_id not in seen:
            session.delete(assignment)

    for order, album_id in enumerate(desired_ids):
        assignment = current_assignments.get(album_id)
        if assignment is None:
            album = session.get(Album, album_id)
            if not album:
                raise AppError(status_code=404, code=40400, message="ALBUM_NOT_FOUND")
            assignment = HomeSectionAlbum(section=section, album=album, order_index=order)
            session.add(assignment)
        else:
            assignment.order_index = order

    session.commit()
    section = _load_section(session, section.id)
    return success(_section_to_schema(section))


@router.put("/reorder")
def reorder_sections(
    body: SectionReorderPayload,
    session: SessionDep,
    current_user: User = Depends(require_developer),
):
    if not body.order:
        return success(message="NO_CHANGES")

    sections = session.execute(select(HomeSection)).scalars().all()
    existing_ids = {section.id for section in sections}

    seen = set()
    for section_id in body.order:
        if section_id not in existing_ids:
            raise AppError(status_code=400, code=40010, message="INVALID_SECTION_ID")
        seen.add(section_id)

    for index, section_id in enumerate(body.order):
        section = next((item for item in sections if item.id == section_id), None)
        if section is not None:
            section.order_index = index

    remaining_sections = [section for section in sections if section.id not in seen]
    start_index = len(body.order)
    for offset, section in enumerate(remaining_sections):
        section.order_index = start_index + offset

    session.commit()
    return success(message="REORDERED")