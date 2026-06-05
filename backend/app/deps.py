from datetime import datetime, timedelta, timezone
from jose import jwt
from .config import settings

def create_access_token(subject: str, role: str = "viewer") -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expire_hours)
    return jwt.encode({"sub": subject, "role": role, "exp": expire}, settings.jwt_secret, algorithm="HS256")
