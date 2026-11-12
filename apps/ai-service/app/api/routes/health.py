from datetime import UTC, datetime

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from app.api.dependencies import RequestIdDep, SettingsDep
from app.schemas.api import (
    ConfigCheckStatus,
    HealthResponse,
    ReadinessChecks,
    ReadinessResponse,
)

root_health_router = APIRouter(tags=["Health"])
v1_health_router = APIRouter(tags=["Health"])


def _check_non_empty(value: str, configured_detail: str, missing_detail: str) -> ConfigCheckStatus:
    is_configured = bool(value.strip())
    return ConfigCheckStatus(
        configured=is_configured,
        detail=configured_detail if is_configured else missing_detail,
    )


def _check_url(value: str) -> ConfigCheckStatus:
    cleaned = value.strip()
    is_valid = cleaned.startswith(("http://", "https://"))
    return ConfigCheckStatus(
        configured=is_valid,
        detail="configured" if is_valid else "invalid or missing URL",
    )


def _build_health_payload(app_settings: SettingsDep, request_id: str) -> HealthResponse:
    return HealthResponse(
        status="ok",
        service=app_settings.APP_NAME,
        version="1.0.0",
        environment=app_settings.ENVIRONMENT,
        request_id=request_id,
        timestamp=datetime.now(UTC),
    )


def _build_readiness_payload(app_settings: SettingsDep, request_id: str) -> tuple[int, ReadinessResponse]:
    checks = ReadinessChecks(
        groq_api_key=_check_non_empty(
            app_settings.GROQ_API_KEY,
            "configured",
            "GROQ_API_KEY is missing",
        ),
        groq_model=_check_non_empty(
            app_settings.GROQ_MODEL,
            app_settings.GROQ_MODEL.strip() or "configured",
            "GROQ_MODEL is missing",
        ),
        service_api_key=_check_non_empty(
            app_settings.AI_SERVICE_API_KEY,
            "configured",
            "AI_SERVICE_API_KEY is missing",
        ),
        express_api_base_url=_check_url(app_settings.EXPRESS_API_BASE_URL),
    )

    is_ready = (
        checks.groq_api_key.configured
        and checks.groq_model.configured
        and checks.service_api_key.configured
    )

    payload = ReadinessResponse(
        status="ready" if is_ready else "degraded",
        service=app_settings.APP_NAME,
        version="1.0.0",
        environment=app_settings.ENVIRONMENT,
        request_id=request_id,
        timestamp=datetime.now(UTC),
        checks=checks,
    )
    http_status = status.HTTP_200_OK if is_ready else status.HTTP_503_SERVICE_UNAVAILABLE
    return http_status, payload


@root_health_router.get(
    "/health",
    response_model=HealthResponse,
    summary="Liveness check",
)
async def liveness_health(
    app_settings: SettingsDep,
    request_id: RequestIdDep,
) -> HealthResponse:
    return _build_health_payload(app_settings, request_id)


@v1_health_router.get(
    "/health",
    response_model=ReadinessResponse,
    summary="Readiness and configuration check",
)
async def readiness_health(
    app_settings: SettingsDep,
    request_id: RequestIdDep,
) -> JSONResponse:
    http_status, payload = _build_readiness_payload(app_settings, request_id)
    return JSONResponse(
        status_code=http_status,
        content=payload.model_dump(mode="json"),
    )
