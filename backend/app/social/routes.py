from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.orm import Session

from ..deps import SessionDep, require_user
from ..models import SocialMedia, SocialPost, SocialReply, User
from ..utils.api import AppError, success

router = APIRouter(prefix="/social", tags=["social"])


class SocialMediaDto(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    media_type: str
    url: str
    preview_url: Optional[str]
    alt_text: Optional[str]
    order_index: int


class SocialReplyDto(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    author_name: str
    author_handle: str
    author_avatar_url: Optional[str]
    content: str
    created_at: str
    like_count: int
    permalink: Optional[str]


class SocialPostSummaryDto(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    platform: str
    external_id: str
    author_name: str
    author_handle: str
    author_avatar_url: Optional[str]
    content: str
    created_at: str
    like_count: int
    repost_count: int
    reply_count: int
    is_pinned: bool
    permalink: Optional[str]
    media: list[SocialMediaDto]


class SocialPostDetailDto(SocialPostSummaryDto):
    replies: list[SocialReplyDto]


def _parse_cursor(cursor: str) -> tuple[datetime, int]:
    created_str, id_str = cursor.split("|", 1)
    return datetime.fromisoformat(created_str), int(id_str)


def _make_cursor(post: SocialPost) -> str:
    return f"{post.created_at.isoformat()}|{post.id}"


@router.get("/posts")
def list_posts(
    session: SessionDep,
    current_user: User = Depends(require_user),
    platform: Optional[str] = Query(default=None, pattern="^(x|instagram)$"),
    limit: int = Query(default=10, ge=1, le=50),
    cursor: Optional[str] = Query(default=None),
) -> dict:
    base_query = select(SocialPost)
    if platform:
        base_query = base_query.where(SocialPost.platform == platform)

    if cursor:
        cursor_created, cursor_id = _parse_cursor(cursor)
        base_query = base_query.where(
            or_(
                SocialPost.created_at < cursor_created,
                and_(
                    SocialPost.created_at == cursor_created,
                    SocialPost.id < cursor_id,
                ),
            )
        )
        base_query = base_query.where(SocialPost.is_pinned.is_(False))

    order_columns = [desc(SocialPost.created_at), desc(SocialPost.id)]
    if not cursor:
        order_columns.insert(0, desc(SocialPost.is_pinned))

    query = base_query.order_by(*order_columns)

    rows = session.execute(query.limit(limit + 1)).scalars().all()

    has_more = len(rows) > limit
    visible = rows[:limit]

    next_cursor = _make_cursor(visible[-1]) if has_more and visible else None

    def to_summary(post: SocialPost) -> SocialPostSummaryDto:
        media = [
            SocialMediaDto.model_validate(media_item)
            for media_item in sorted(post.media_items, key=lambda m: m.order_index)
        ]
        return SocialPostSummaryDto(
            id=post.id,
            platform=post.platform,
            external_id=post.external_id,
            author_name=post.author_name,
            author_handle=post.author_handle,
            author_avatar_url=post.author_avatar_url,
            content=post.content,
            created_at=post.created_at.isoformat(),
            like_count=post.like_count,
            repost_count=post.repost_count,
            reply_count=post.reply_count,
            is_pinned=post.is_pinned,
            permalink=post.permalink,
            media=media,
        )

    data = {
        "items": [to_summary(item) for item in visible],
        "next_cursor": next_cursor,
        "has_more": has_more,
    }
    return success(data)


@router.get("/posts/{post_id}")
def get_post(post_id: int, session: SessionDep, current_user: User = Depends(require_user)) -> dict:
    post = session.get(SocialPost, post_id)
    if not post:
        raise AppError(status_code=404, code=40400, message="POST_NOT_FOUND")

    media = [
        SocialMediaDto.model_validate(media_item)
        for media_item in sorted(post.media_items, key=lambda m: m.order_index)
    ]

    def to_reply(reply: SocialReply) -> SocialReplyDto:
        return SocialReplyDto(
            id=reply.id,
            author_name=reply.author_name,
            author_handle=reply.author_handle,
            author_avatar_url=reply.author_avatar_url,
            content=reply.content,
            created_at=reply.created_at.isoformat() if reply.created_at else "",
            like_count=reply.like_count,
            permalink=reply.permalink,
        )

    replies = [
        to_reply(reply)
        for reply in sorted(post.replies, key=lambda r: r.created_at or r.id)
    ]

    detail = SocialPostDetailDto(
        id=post.id,
        platform=post.platform,
        external_id=post.external_id,
        author_name=post.author_name,
        author_handle=post.author_handle,
        author_avatar_url=post.author_avatar_url,
        content=post.content,
        created_at=post.created_at.isoformat(),
        like_count=post.like_count,
        repost_count=post.repost_count,
        reply_count=post.reply_count,
        is_pinned=post.is_pinned,
        permalink=post.permalink,
        media=media,
        replies=replies,
    )
    return success(detail)