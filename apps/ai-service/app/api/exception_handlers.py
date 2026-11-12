import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import (
    get_current_request_id,
    reset_current_request_id,
    set_current_request_id,
)
from app.schemas.api import APIErrorDetail, ErrorEnvelope
from app.services.llm_service import (
    LLMAuthenticationError,
    LLMBadRequestError,
    LLMError,
    LLMModelError,
    LLMRateLimitError,
    LLMTimeoutError,
    LLMValidationError,
)

logger = logging.getLogger("app.api.exception_handlers")

# Maps each LLMError subclass to (http_status_code, machine_error_code, retryable)
_LLM_ERROR_MAP: list[tuple[type[LLMError], int, str, bool]] = [
    (LLMBadRequestError, status.HTTP_400_BAD_REQUEST, "LLM_BAD_REQUEST", False),
    (LLMRateLimitError, status.HTTP_429_TOO_MANY_REQUESTS, "LLM_RATE_LIMIT", True),
    (LLMTimeoutError, status.HTTP_504_GATEWAY_TIMEOUT, "LLM_TIMEOUT", True),
    (LLMValidationError, status.HTTP_502_BAD_GATEWAY, "LLM_VALIDATION_ERROR", True),
    # Upstream Groq auth errors map to 502 (not 401) so callers don't confuse them with X-Service-Key auth.
    (LLMAuthenticationError, status.HTTP_502_BAD_GATEWAY, "LLM_AUTHENTICATION_ERROR", False),
    (LLMModelError, status.HTTP_502_BAD_GATEWAY, "LLM_MODEL_ERROR", True),
    (LLMError, status.HTTP_502_BAD_GATEWAY, "LLM_ERROR", True),
]

_HTTP_CODE_MAP: dict[int, tuple[str, bool]] = {
    status.HTTP_400_BAD_REQUEST: ("BAD_REQUEST", False),
    status.HTTP_401_UNAUTHORIZED: ("UNAUTHORIZED", False),
    status.HTTP_403_FORBIDDEN: ("FORBIDDEN", False),
    status.HTTP_404_NOT_FOUND: ("NOT_FOUND", False),
    status.HTTP_409_CONFLICT: ("CONFLICT", False),
    status.HTTP_422_UNPROCESSABLE_CONTENT: ("REQUEST_VALIDATION_ERROR", False),
    status.HTTP_429_TOO_MANY_REQUESTS: ("RATE_LIMIT_EXCEEDED", True),
    status.HTTP_501_NOT_IMPLEMENTED: ("NOT_IMPLEMENTED", False),
    status.HTTP_502_BAD_GATEWAY: ("BAD_GATEWAY", True),
    status.HTTP_503_SERVICE_UNAVAILABLE: ("SERVICE_UNAVAILABLE", True),
    status.HTTP_504_GATEWAY_TIMEOUT: ("GATEWAY_TIMEOUT", True),
}


def _resolve_request_id(request: Request) -> str:
    state_id = getattr(request.state, "request_id", None)
    if isinstance(state_id, str) and state_id:
        return state_id
    return get_current_request_id()


def _error_response(
    *,
    request: Request,
    status_code: int,
    code: str,
    message: str,
    retryable: bool,
    details: list[dict[str, Any]] | dict[str, Any] | None = None,
) -> JSONResponse:
    request_id = _resolve_request_id(request)
    envelope = ErrorEnvelope(
        request_id=request_id,
        error=APIErrorDetail(
            code=code,
            message=message,
            retryable=retryable,
            details=details,
        ),
    )
    return JSONResponse(
        status_code=status_code,
        content=envelope.model_dump(mode="json"),
        headers={"X-Request-ID": request_id},
    )


def _sanitize_validation_errors(exc: RequestValidationError) -> list[dict[str, Any]]:
    cleaned: list[dict[str, Any]] = []
    for err in exc.errors():
        cleaned.append(
            {
                "loc": list(err.get("loc", ())),
                "msg": str(err.get("msg", "Validation error")),
                "type": str(err.get("type", "value_error")),
            }
        )
    return cleaned


async def llm_error_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, LLMError)
    for exc_type, http_status, error_code, retryable in _LLM_ERROR_MAP:
        if isinstance(exc, exc_type):
            logger.warning(
                "Mapped %s to HTTP %d (%s): %s",
                type(exc).__name__,
                http_status,
                error_code,
                exc,
            )
            return _error_response(
                request=request,
                status_code=http_status,
                code=error_code,
                message=str(exc) or error_code,
                retryable=retryable,
            )

    return _error_response(
        request=request,
        status_code=status.HTTP_502_BAD_GATEWAY,
        code="LLM_ERROR",
        message=str(exc) or "Upstream LLM failure",
        retryable=True,
    )


async def validation_error_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    return _error_response(
        request=request,
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        code="REQUEST_VALIDATION_ERROR",
        message="Request payload validation failed",
        retryable=False,
        details=_sanitize_validation_errors(exc),
    )


async def http_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    code, retryable = _HTTP_CODE_MAP.get(
        exc.status_code,
        ("HTTP_ERROR", exc.status_code >= 500),
    )
    message = exc.detail if isinstance(exc.detail, str) else "Request failed"
    details = exc.detail if isinstance(exc.detail, (dict, list)) else None
    return _error_response(
        request=request,
        status_code=exc.status_code,
        code=code,
        message=message,
        retryable=retryable,
        details=details,
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = _resolve_request_id(request)
    token = set_current_request_id(request_id)
    try:
        logger.exception("Unhandled internal error in AI service: %s", exc)
    finally:
        reset_current_request_id(token)
    return _error_response(
        request=request,
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        code="INTERNAL_SERVER_ERROR",
        message="An unexpected internal error occurred",
        retryable=False,
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Registers standardized exception handlers for LLMError, HTTPException, validation, and 500s."""
    app.add_exception_handler(LLMError, llm_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
