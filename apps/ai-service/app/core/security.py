import secrets

from fastapi import Header, HTTPException, status

from app.core.config import settings


async def verify_service_key(
    x_service_key: str | None = Header(default=None, alias="X-Service-Key"),
) -> bool:
    """
    Verifies the shared service-to-service secret passed via X-Service-Key.
    Fails closed if AI_SERVICE_API_KEY is missing or empty.
    """
    expected_key = settings.AI_SERVICE_API_KEY.strip()
    if not expected_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service-to-service authentication is not configured",
        )

    if x_service_key is None or not x_service_key.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing service credentials",
        )

    if not secrets.compare_digest(x_service_key.strip(), expected_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid service credentials",
        )

    return True
