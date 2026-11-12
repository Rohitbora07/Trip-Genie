import uuid

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.logging import reset_current_request_id, set_current_request_id

REQUEST_ID_HEADER = "X-Request-ID"
_MAX_REQUEST_ID_LENGTH = 128


def _normalize_request_id(raw_value: str | None) -> str:
    if not raw_value:
        return str(uuid.uuid4())
    cleaned = raw_value.strip()
    if not cleaned or len(cleaned) > _MAX_REQUEST_ID_LENGTH or any(ch in cleaned for ch in ("\r", "\n")):
        return str(uuid.uuid4())
    return cleaned


class RequestIDMiddleware:
    """
    ASGI middleware that reads or generates X-Request-ID for every request,
    binds it to logs and request.state, and appends X-Request-ID to every response.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        incoming_id: str | None = None
        for header_name, header_value in scope.get("headers", []):
            if header_name.lower() == b"x-request-id":
                incoming_id = header_value.decode("latin-1")
                break

        request_id = _normalize_request_id(incoming_id)
        scope.setdefault("state", {})["request_id"] = request_id
        token = set_current_request_id(request_id)

        async def send_with_request_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = [
                    (name, value)
                    for name, value in message.get("headers", [])
                    if name.lower() != b"x-request-id"
                ]
                headers.append((b"x-request-id", request_id.encode("latin-1")))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        finally:
            reset_current_request_id(token)
