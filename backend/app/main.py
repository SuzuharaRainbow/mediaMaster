from __future__ import annotations

from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .albums.routes import router as albums_router
from .auth.routes import router as auth_router
from .config import settings
from .db import init_db
from .media.routes import router as media_router
from .home_sections.routes import router as home_sections_router
from .tags.routes import router as tags_router
from .social.routes import router as social_router
from .utils.api import AppError, success

app = FastAPI(title="Suzuhara Media API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request.state.request_id = str(uuid4())
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    return response


@app.exception_handler(AppError)
async def handle_app_error(request: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": exc.code,
            "message": exc.message,
            "request_id": request.state.request_id,
        },
    )


@app.exception_handler(RequestValidationError)
async def handle_validation_error(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "code": 42200,
            "message": "VALIDATION_ERROR",
            "details": exc.errors(),
            "request_id": request.state.request_id,
        },
    )


@app.exception_handler(StarletteHTTPException)
async def handle_http_exception(request: Request, exc: StarletteHTTPException):
    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": exc.status_code,
            "message": detail,
            "request_id": request.state.request_id,
        },
    )


@app.get("/health", tags=["system"])
async def healthcheck():
    return success({"status": "ok"})


app.include_router(auth_router)
app.include_router(albums_router)
app.include_router(media_router)
app.include_router(tags_router)
app.include_router(social_router)
app.include_router(home_sections_router)


@app.on_event("startup")
def on_startup() -> None:
    init_db()