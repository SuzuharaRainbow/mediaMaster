from __future__ import annotations

from datetime import datetime, timedelta
from typing import Annotated

from fastapi import Depends, Request
from jose import JWTError, jwt
from passlib.hash import bcrypt
from sqlalchemy.orm import Session

from .config import settings
from .db import get_session
from .models import User
from .utils.api import AppError

ACCESS_TOKEN_COOKIE = "access_token"
ALGORITHM = "HS256"

SessionDep = Annotated[Session, Depends(get_session)]


def hash_password(password: str) -> str:
    return bcrypt.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.verify(password, hashed)


def create_access_token(*, user: User) -> str:
    expire = datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRE_HOURS)
    payload = {"sub": str(user.id), "role": user.role, "exp": int(expire.timestamp())}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
    except JWTError as exc:  # noqa: PERF203 keep simple
        raise AppError(status_code=401, code=40100, message="INVALID_TOKEN") from exc


def get_token_from_cookie(request: Request) -> str:
    token = request.cookies.get(ACCESS_TOKEN_COOKIE)
    if not token:
        raise AppError(status_code=401, code=40100, message="NOT_AUTHENTICATED")
    return token


def get_current_user(
    session: SessionDep,
    token: str = Depends(get_token_from_cookie),
) -> User:
    payload = _decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise AppError(status_code=401, code=40100, message="INVALID_TOKEN")
    user = session.get(User, int(user_id))
    if not user:
        raise AppError(status_code=401, code=40100, message="USER_NOT_FOUND")
    return user


def require_user(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    return current_user


def require_manager(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    if current_user.role not in ("developer", "manager"):
        raise AppError(status_code=403, code=40301, message="NO_PERMISSION")
    return current_user


def require_developer(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    if current_user.role != "developer":
        raise AppError(status_code=403, code=40301, message="NO_PERMISSION")
    return current_user