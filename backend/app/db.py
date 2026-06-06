from __future__ import annotations

import os
from pathlib import Path
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from typing import Generator

from .config import settings

engine = create_engine(settings.DB_URL, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

def get_session() -> Generator[Session, None, None]:
    session: Session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

def _ensure_media_root() -> None:
    media_path = Path(settings.MEDIA_ROOT)
    media_path.mkdir(parents=True, exist_ok=True)

def _ensure_default_developer(session: Session) -> None:
    from passlib.hash import bcrypt
    from .models import User

    exists = session.query(User).filter(User.role == "developer").first()
    if exists:
        return
    password_hash = bcrypt.hash("ChangeMe123!")
    user = User(
        username="developer",
        email="developer@example.com",
        password_hash=password_hash,
        role="developer",
    )
    session.add(user)
    session.commit()


def _seed_social_posts(session: Session) -> None:
    from datetime import datetime, timezone
    from sqlalchemy import select
    from .models import SocialPost, SocialMedia, SocialReply

    existing = session.execute(select(SocialPost).limit(1)).scalar_one_or_none()
    if existing:
        return

    base_created = datetime(2025, 9, 8, 9, 0, tzinfo=timezone.utc)

    post1 = SocialPost(
        platform="x",
        external_id="1832712345678901234",
        author_name="鈴原希実",
        author_handle="NozomiSuzuhara",
        author_avatar_url="https://placekitten.com/200/200",
        content=(
            "#鈴原希実 の夢はカワイイなんばーわんの誕生会2025\n\n"
            "グッズ販売はじまったよ〜っ🥰💕\n今年はくまさん🐻と白ねこさん🐈🎀\nどっちが好きですか？👀\n\n"
            "ぜひチェックしてね( ˘˘ )\nstore.plusmember.jp/shop/products/…\n\n"
            "そして会場にもぜひ来てね〜！🙌\n#鈴原希実のカワイイ誕生会2025"
        ),
        created_at=base_created,
        like_count=40123,
        repost_count=1123,
        reply_count=194,
        is_pinned=True,
        permalink="https://x.com/NozomiSuzuhara/status/1832712345678901234",
    )

    post1.media_items = [
        SocialMedia(
            media_type="image",
            url="https://placekitten.com/600/400",
            preview_url="https://placekitten.com/300/200",
            alt_text="Nozomi Suzuhara in maid outfit with teddy bear",
            order_index=0,
        ),
        SocialMedia(
            media_type="image",
            url="https://placebear.com/600/400",
            preview_url="https://placebear.com/300/200",
            alt_text="Nozomi Suzuhara smiling in red outfit",
            order_index=1,
        ),
        SocialMedia(
            media_type="image",
            url="https://placekitten.com/601/401",
            preview_url="https://placekitten.com/300/201",
            alt_text="Close-up portrait",
            order_index=2,
        ),
        SocialMedia(
            media_type="image",
            url="https://placebear.com/601/401",
            preview_url="https://placebear.com/300/201",
            alt_text="Holding teddy bear",
            order_index=3,
        ),
    ]

    post1.replies = [
        SocialReply(
            author_name="Apollo Bay 公式",
            author_handle="ApolloBay_seiyu",
            author_avatar_url="https://placekitten.com/180/180",
            content="オフィシャルグッズ事前販売開始のお知らせ🔔",
            created_at=base_created.replace(hour=10),
            like_count=120,
            permalink="https://x.com/ApolloBay_seiyu/status/1832719900000000000",
        )
    ]

    post2 = SocialPost(
        platform="x",
        external_id="1832755555555555555",
        author_name="鈴原希実",
        author_handle="NozomiSuzuhara",
        author_avatar_url="https://placekitten.com/200/201",
        content="お知らせ🖤🤍\n\nFC2次先行受付が始まったよ〜ん🥰⚠️\n受付期間は9/28(日)23時59分まで🙌",
        created_at=base_created.replace(day=9, hour=1),
        like_count=10240,
        repost_count=612,
        reply_count=85,
        permalink="https://x.com/NozomiSuzuhara/status/1832755555555555555",
    )

    post2.media_items = [
        SocialMedia(
            media_type="image",
            url="https://placekitten.com/602/402",
            preview_url="https://placekitten.com/301/201",
            alt_text="Nozomi Suzuhara announcement banner",
            order_index=0,
        )
    ]

    session.add_all([post1, post2])
    session.commit()


def _seed_home_sections(session: Session) -> None:
    from sqlalchemy import select, text
    from .models import HomeSection

    # migrate legacy schema if needed
    columns = session.execute(text("SHOW COLUMNS FROM home_sections LIKE 'preview_rows'"))
    has_preview_rows = columns.first() is not None
    if not has_preview_rows:
        session.execute(text("ALTER TABLE home_sections ADD COLUMN preview_rows INT NOT NULL DEFAULT 1"))
        session.commit()

    legacy = session.execute(text("SHOW COLUMNS FROM home_sections LIKE 'preview_limit'"))
    has_legacy = legacy.first() is not None
    if has_legacy:
        session.execute(text(
            "UPDATE home_sections SET preview_rows = LEAST(4, GREATEST(1, CEIL(preview_limit / 4)))"
        ))
        session.commit()
        try:
            session.execute(text("ALTER TABLE home_sections DROP COLUMN preview_limit"))
            session.commit()
        except Exception:  # noqa: BLE001
            session.rollback()

    defaults = [
        {"key": "photos", "title": "照片", "preview_rows": 2},
        {"key": "broadcast", "title": "广播", "preview_rows": 1},
        {"key": "live", "title": "生放送", "preview_rows": 1},
        {"key": "xspace", "title": "Xspace", "preview_rows": 1},
    ]

    for index, item in enumerate(defaults):
        section = session.execute(select(HomeSection).where(HomeSection.key == item["key"])).scalar_one_or_none()
        if section:
            section.title = item["title"]
            section.preview_rows = item["preview_rows"]
            section.order_index = index
        else:
            session.add(
                HomeSection(
                    key=item["key"],
                    title=item["title"],
                    preview_rows=item["preview_rows"],
                    order_index=index,
                )
            )

    session.commit()


def init_db() -> None:
    from . import models  # noqa: F401 ensure models are registered

    Base.metadata.create_all(bind=engine)
    _ensure_media_root()
    with SessionLocal() as session:
        try:
            session.execute(text("ALTER TABLE users MODIFY COLUMN role ENUM('developer','manager','viewer') NOT NULL DEFAULT 'viewer'"))
            session.commit()
        except Exception:
            session.rollback()
        try:
            session.execute(
                text("ALTER TABLE users ADD COLUMN view_role ENUM('developer','manager','viewer') NULL DEFAULT NULL")
            )
            session.commit()
        except Exception:
            session.rollback()
        _ensure_default_developer(session)
        try:
            session.execute(text("ALTER TABLE media ADD COLUMN preview_path VARCHAR(512) NULL"))
            session.commit()
        except Exception:
            session.rollback()
        _seed_social_posts(session)
        _seed_home_sections(session)