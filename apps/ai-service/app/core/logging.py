import logging
from contextvars import ContextVar, Token

request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")

_ORIGINAL_RECORD_FACTORY = logging.getLogRecordFactory()
_FACTORY_INSTALLED = False


def get_current_request_id() -> str:
    """Returns the correlation request ID bound to the current async context."""
    return request_id_ctx.get()


def set_current_request_id(request_id: str) -> Token[str]:
    """Binds a request ID to the current async context and returns the reset token."""
    return request_id_ctx.set(request_id)


def reset_current_request_id(token: Token[str]) -> None:
    """Restores the previous request ID context after a request finishes."""
    request_id_ctx.reset(token)


def _install_request_id_record_factory() -> None:
    global _FACTORY_INSTALLED
    if _FACTORY_INSTALLED:
        return

    def record_factory(*args, **kwargs) -> logging.LogRecord:
        record = _ORIGINAL_RECORD_FACTORY(*args, **kwargs)
        if not hasattr(record, "request_id"):
            record.request_id = get_current_request_id()
        return record

    logging.setLogRecordFactory(record_factory)
    _FACTORY_INSTALLED = True


def setup_logging() -> None:
    from app.core.config import settings

    _install_request_id_record_factory()
    logging.basicConfig(
        level=settings.LOG_LEVEL,
        format="%(asctime)s | %(levelname)s | request_id=%(request_id)s | %(name)s | %(message)s",
        force=True,
    )
