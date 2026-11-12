from fastapi import FastAPI

from app.api.exception_handlers import register_exception_handlers
from app.api.routes import api_v1_router, root_health_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.core.middleware import RequestIDMiddleware

setup_logging()

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
)

app.add_middleware(RequestIDMiddleware)
register_exception_handlers(app)

app.include_router(root_health_router)
app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)
