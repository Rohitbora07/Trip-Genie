from fastapi import APIRouter

from app.api.routes.health import root_health_router, v1_health_router
from app.api.routes.itineraries import router as itineraries_router

api_v1_router = APIRouter()
api_v1_router.include_router(v1_health_router)
api_v1_router.include_router(itineraries_router)

__all__ = ["api_v1_router", "root_health_router"]
