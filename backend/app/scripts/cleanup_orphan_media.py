from __future__ import annotations

from pathlib import Path

from sqlalchemy import select

from ..config import settings
from ..db import SessionLocal
from ..models import Album, Media


def _remove_file(path: Path) -> None:
    if not path.exists():
        return
    try:
        path.unlink()
    except OSError:
        # 忽略无法删除的文件，避免阻塞后续清理
        pass


def cleanup_unassigned_media() -> int:
    media_root = Path(settings.MEDIA_ROOT)
    removed = 0

    with SessionLocal() as session:
        orphans: list[Media] = (
            session.execute(select(Media).where(Media.album_id.is_(None))).scalars().all()
        )

        if not orphans:
            return 0

        orphan_ids = [media.id for media in orphans]

        if orphan_ids:
            for album in session.execute(
                select(Album).where(Album.cover_media_id.in_(orphan_ids))
            ).scalars():
                album.cover_media_id = None

        for media in orphans:
            storage_path = media_root / media.storage_path
            _remove_file(storage_path)

            if media.preview_path:
                preview_path = media_root / media.preview_path
                _remove_file(preview_path)

            session.delete(media)
            removed += 1

        session.commit()

    return removed


def main() -> None:
    count = cleanup_unassigned_media()
    if count == 0:
        print("没有发现未加入相册的媒体。")
    else:
        print(f"已删除未加入相册的媒体 {count} 条。")


if __name__ == "__main__":
    main()