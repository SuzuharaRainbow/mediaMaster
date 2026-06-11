from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from ..deps import SessionDep, require_manager, require_user
from ..models import Tag, User
from ..utils.api import AppError, success

router = APIRouter(prefix="/tags", tags=["tags"])


class TagCreate(BaseModel):
    name: str


@router.get("")
def list_tags(session: SessionDep, current_user: User = Depends(require_user)):
    tags = session.execute(select(Tag).order_by(Tag.name.asc())).scalars().all()
    return success([{ "id": tag.id, "name": tag.name } for tag in tags])


@router.post("")
def create_tag(body: TagCreate, session: SessionDep, current_user: User = Depends(require_manager)):
    name = body.name.strip()
    if not name:
        raise AppError(status_code=400, code=40004, message="INVALID_TAG_NAME")
    tag = Tag(name=name)
    session.add(tag)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise AppError(status_code=409, code=40901, message="TAG_EXISTS") from exc
    session.refresh(tag)
    return success({"id": tag.id, "name": tag.name})