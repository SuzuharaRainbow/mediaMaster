from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PORT: int = 8000
    DB_URL: str
    JWT_SECRET: str
    JWT_EXPIRE_HOURS: int = 24
    CORS_ORIGINS: str = "http://localhost:5173"
    MEDIA_ROOT: str = "./media-data"
    MAX_UPLOAD_MB: int = 200

    model_config = SettingsConfigDict(env_file=".env.dev", extra="ignore")

    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

settings = get_settings()