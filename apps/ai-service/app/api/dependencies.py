from typing import Annotated

from fastapi import Depends, Request

from app.core.config import Settings, settings
from app.core.logging import get_current_request_id
from app.core.security import verify_service_key
from app.services.llm_service import LLMService, llm_service


def get_app_settings() -> Settings:
    """Provides application settings for route handlers and health probes."""
    return settings


def get_llm_service() -> LLMService:
    """Provides the shared LLMService instance (overridable in tests)."""
    return llm_service


def get_request_id(request: Request) -> str:
    """Retrieves the correlation request ID assigned by RequestIDMiddleware."""
    state_id = getattr(request.state, "request_id", None)
    if isinstance(state_id, str) and state_id:
        return state_id
    return get_current_request_id()


ServiceAuthDep = Annotated[bool, Depends(verify_service_key)]
SettingsDep = Annotated[Settings, Depends(get_app_settings)]
LLMServiceDep = Annotated[LLMService, Depends(get_llm_service)]
RequestIdDep = Annotated[str, Depends(get_request_id)]

__all__ = [
    "LLMServiceDep",
    "RequestIdDep",
    "ServiceAuthDep",
    "SettingsDep",
    "get_app_settings",
    "get_llm_service",
    "get_request_id",
    "verify_service_key",
]
