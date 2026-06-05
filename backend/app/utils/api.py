from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class AppError(Exception):
    status_code: int
    code: int
    message: str


def success(data: Any | None = None, message: str = "") -> dict[str, Any]:
    return {"code": 0, "data": data, "message": message}