from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "Trip-Genie AI Service"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    API_V1_PREFIX: str = "/api/v1"

    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = ""
    GROQ_TEMPERATURE: float = Field(default=0.2, ge=0.0, le=2.0)
    GROQ_MAX_TOKENS: int = Field(default=4096, gt=0)
    GROQ_TIMEOUT: int = Field(default=60, gt=0)

    EXPRESS_API_BASE_URL: str = "http://localhost:4000/api/v1"
    AI_SERVICE_API_KEY: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )


@lru_cache
def get_settings():
    return Settings()


settings = get_settings()