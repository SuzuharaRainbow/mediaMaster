from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Literal, Optional

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..deps import (
    ACCESS_TOKEN_COOKIE,
    SessionDep,
    create_access_token,
    hash_password,
    require_developer,
    require_user,
    verify_password,
)
from ..models import AccessRequest, User
from ..utils.api import AppError, success

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


def _user_payload(user: User) -> dict:
    effective_role = user.view_role or user.role
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "view_role": user.view_role,
        "effective_role": effective_role,
    }


def _access_request_payload(request: AccessRequest) -> dict:
    return {
        "id": request.id,
        "username": request.username,
        "status": request.status,
        "message": request.message,
        "created_at": request.created_at.isoformat() if request.created_at else None,
        "processed_at": request.processed_at.isoformat() if request.processed_at else None,
        "processed_by": (
            {"id": request.processed_by.id, "username": request.processed_by.username}
            if request.processed_by
            else None
        ),
        "decision_note": request.decision_note,
    }


def _generate_guest_email(session: Session, username: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", username.lower()).strip("-") or "guest"
    candidate = f"{base}@guest.local"
    counter = 1
    while session.query(User).filter(User.email == candidate).first():
        counter += 1
        candidate = f"{base}{counter}@guest.local"
    return candidate


@router.post("/login")
def login(body: LoginRequest, session: SessionDep) -> JSONResponse:
    user = session.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise AppError(status_code=401, code=40100, message="INVALID_CREDENTIALS")

    token = create_access_token(user=user)
    response = JSONResponse(success({"user": _user_payload(user)}))
    response.set_cookie(
        ACCESS_TOKEN_COOKIE,
        token,
        httponly=True,
        max_age=settings.JWT_EXPIRE_HOURS * 3600,
        samesite="lax",
    )
    return response


@router.post("/logout")
def logout(_: User = Depends(require_user)) -> JSONResponse:
    response = JSONResponse(success(message="LOGGED_OUT"))
    response.delete_cookie(ACCESS_TOKEN_COOKIE)
    return response


@router.get("/me")
def me(current_user: User = Depends(require_user)) -> dict:
    return success({"user": _user_payload(current_user)})


class AccessRequestBody(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=4, max_length=255)
    message: str | None = Field(default=None, max_length=255)


class AccessDecisionBody(BaseModel):
    note: str | None = Field(default=None, max_length=255)


class RoleUpdateBody(BaseModel):
    role: Literal["viewer", "manager"]


class ViewRoleBody(BaseModel):
    view_role: Optional[Literal["developer", "manager", "viewer"]] = Field(default=None)


@router.post("/access-requests")
def create_access_request(body: AccessRequestBody, session: SessionDep):
    username = body.username.strip()
    if not username:
        raise AppError(status_code=422, code=42200, message="USERNAME_REQUIRED")

    existing_user = session.query(User).filter(User.username == username).first()
    if existing_user:
        raise AppError(status_code=409, code=40910, message="USER_ALREADY_EXISTS")

    pending = (
        session.query(AccessRequest)
        .filter(AccessRequest.username == username, AccessRequest.status == "pending")
        .first()
    )
    message = body.message.strip() if body.message else None
    password_hash = hash_password(body.password)

    if pending:
        pending.password_hash = password_hash
        pending.message = message
        session.commit()
        session.refresh(pending)
        return success({"request": _access_request_payload(pending), "status": "pending"})

    request = AccessRequest(username=username, password_hash=password_hash, message=message, status="pending")
    session.add(request)
    session.commit()
    session.refresh(request)
    return success({"request": _access_request_payload(request), "status": "pending"})


@router.get("/access-requests")
def list_access_requests(
    session: SessionDep,
    current_user: User = Depends(require_developer),
):
    requests = (
        session.query(AccessRequest)
        .order_by(AccessRequest.created_at.desc())
        .all()
    )
    return success({"items": [_access_request_payload(item) for item in requests]})


@router.post("/access-requests/{request_id}/approve")
def approve_access_request(
    request_id: int,
    body: AccessDecisionBody,
    session: SessionDep,
    reviewer: User = Depends(require_developer),
):
    request = session.get(AccessRequest, request_id)
    if not request:
        raise AppError(status_code=404, code=40400, message="ACCESS_REQUEST_NOT_FOUND")
    if request.status != "pending":
        raise AppError(status_code=409, code=40912, message="REQUEST_ALREADY_PROCESSED")

    existing_user = session.query(User).filter(User.username == request.username).first()
    if existing_user:
        raise AppError(status_code=409, code=40910, message="USER_ALREADY_EXISTS")

    email = _generate_guest_email(session, request.username)
    viewer = User(
        username=request.username,
        email=email,
        password_hash=request.password_hash,
        role="viewer",
    )
    session.add(viewer)

    request.status = "approved"
    request.processed_at = datetime.now(timezone.utc)
    request.processed_by = reviewer
    request.decision_note = body.note.strip() if body.note else None

    session.commit()
    session.refresh(request)
    return success({"request": _access_request_payload(request)})


@router.get("/users")
def list_users(session: SessionDep, current_user: User = Depends(require_developer)):
    users = session.execute(select(User).order_by(User.created_at.asc(), User.id.asc())).scalars().all()
    items = [
        {
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }
        for user in users
    ]
    return success({"items": items})


@router.post("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    body: RoleUpdateBody,
    session: SessionDep,
    current_user: User = Depends(require_developer),
):
    user = session.get(User, user_id)
    if not user:
        raise AppError(status_code=404, code=40400, message="USER_NOT_FOUND")

    if user.username == "developer" or user.role == "developer":
        raise AppError(status_code=400, code=40010, message="DEVELOPER_ROLE_LOCKED")

    if user.role == body.role:
        return success({"id": user.id, "username": user.username, "role": user.role})

    user.role = body.role
    session.commit()
    session.refresh(user)
    return success({"id": user.id, "username": user.username, "role": user.role})


@router.post("/view-role")
def update_view_role(
    body: ViewRoleBody,
    session: SessionDep,
    current_user: User = Depends(require_user),
):
    if current_user.role not in ("developer", "manager"):
        raise AppError(status_code=403, code=40301, message="NO_PERMISSION")

    allowed_roles = {
        "developer": {"developer", "manager", "viewer"},
        "manager": {"manager", "viewer"},
    }
    target = body.view_role
    if target is not None and target not in allowed_roles[current_user.role]:
        raise AppError(status_code=400, code=40020, message="INVALID_VIEW_ROLE")

    if target is None or target == current_user.role:
        current_user.view_role = None
    else:
        current_user.view_role = target

    session.commit()
    session.refresh(current_user)
    return success({"user": _user_payload(current_user)})


@router.post("/access-requests/{request_id}/reject")
def reject_access_request(
    request_id: int,
    body: AccessDecisionBody,
    session: SessionDep,
    reviewer: User = Depends(require_developer),
):
    request = session.get(AccessRequest, request_id)
    if not request:
        raise AppError(status_code=404, code=40400, message="ACCESS_REQUEST_NOT_FOUND")
    if request.status != "pending":
        raise AppError(status_code=409, code=40912, message="REQUEST_ALREADY_PROCESSED")

    request.status = "rejected"
    request.processed_at = datetime.now(timezone.utc)
    request.processed_by = reviewer
    request.decision_note = body.note.strip() if body.note else None

    session.commit()
    session.refresh(request)
    return success({"request": _access_request_payload(request)})