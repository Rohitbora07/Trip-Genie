from __future__ import annotations

import asyncio
import logging
import threading
from typing import Any, TypeVar, cast

import groq
import httpx
from app.core.config import settings
from langchain_core.exceptions import OutputParserException
from langchain_core.runnables import Runnable
from langchain_groq import ChatGroq
from pydantic import BaseModel, SecretStr, ValidationError

logger = logging.getLogger("app.integrations.groq_client")

T = TypeVar("T", bound=BaseModel)
SchemaType = type[T] | dict[str, Any]
ModelCacheKey = tuple[str, float, int, float, int]

class GroqClientError(Exception):
    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        original_error: Exception | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.original_error = original_error


class GroqConfigurationError(GroqClientError):
    """Raised when Groq credentials, model name, or parameters are invalid/missing."""


class GroqAuthenticationError(GroqClientError):
    """Raised on HTTP 401/403 authentication or permission failures."""


class GroqBadRequestError(GroqClientError):
    """Raised on HTTP 400/422 malformed requests or invalid model parameters."""


class GroqRateLimitError(GroqClientError):
    """Raised on HTTP 429 rate-limit or token quota throttling."""


class GroqTimeoutError(GroqClientError):
    """Raised when a Groq API call exceeds the configured timeout."""


class GroqAPIError(GroqClientError):
    """Raised on upstream 5xx server failures, network drops, or unexpected errors."""


class GroqStructuredOutputError(GroqClientError):
    """Raised when structured output schema is invalid or parsing fails."""


def normalize_groq_error(exc: Exception) -> GroqClientError:
    """
    Translates raw Groq SDK, HTTPX, LangChain, and Pydantic exceptions
    into Trip-Genie's consistent GroqClientError hierarchy.
    """
    if isinstance(exc, GroqClientError):
        return exc

    status_code: int | None = getattr(exc, "status_code", None)

    if isinstance(exc, (groq.AuthenticationError, groq.PermissionDeniedError)):
        return GroqAuthenticationError(
            f"Groq authentication failed: {exc}",
            status_code=status_code or 401,
            original_error=exc,
        )

    if isinstance(exc, (groq.BadRequestError, groq.UnprocessableEntityError)):
        return GroqBadRequestError(
            f"Invalid request sent to Groq: {exc}",
            status_code=status_code or 400,
            original_error=exc,
        )

    if isinstance(exc, (ValidationError, OutputParserException)):
        return GroqStructuredOutputError(
            f"Structured output validation failed: {exc}",
            original_error=exc,
        )

    if isinstance(exc, groq.RateLimitError):
        return GroqRateLimitError(
            f"Groq rate limit exceeded: {exc}",
            status_code=status_code or 429,
            original_error=exc,
        )

    if isinstance(
        exc,
        (groq.APITimeoutError, TimeoutError, asyncio.TimeoutError, httpx.TimeoutException),
    ):
        return GroqTimeoutError(
            f"Groq request timed out: {exc}",
            original_error=exc,
        )

    if isinstance(exc, (groq.InternalServerError, groq.APIConnectionError, httpx.NetworkError)):
        return GroqAPIError(
            f"Groq server or connection failure: {exc}",
            status_code=status_code,
            original_error=exc,
        )

    if isinstance(exc, groq.APIStatusError):
        if status_code in (401, 403):
            return GroqAuthenticationError(
                f"Groq authentication failed ({status_code}): {exc}",
                status_code=status_code,
                original_error=exc,
            )
        if status_code in (400, 422):
            return GroqBadRequestError(
                f"Invalid Groq request ({status_code}): {exc}",
                status_code=status_code,
                original_error=exc,
            )
        if status_code == 429:
            return GroqRateLimitError(
                f"Groq rate limit exceeded ({status_code}): {exc}",
                status_code=status_code,
                original_error=exc,
            )
        return GroqAPIError(
            f"Groq API error ({status_code}): {exc}",
            status_code=status_code,
            original_error=exc,
        )

    return GroqAPIError(
        f"Unexpected Groq client failure: {exc}",
        status_code=status_code,
        original_error=exc,
    )


# ============================================================================
# Centralized Groq Client Manager (Reusable & Thread-Safe)
# ============================================================================


class GroqClientManager:
    """
    Centralizes Groq model initialization, configuration validation,
    instance caching/reuse, structured output support, and error normalization.
    """

    def __init__(
        self,
        *,
        api_key: str | None = None,
        default_model: str | None = None,
        default_temperature: float | None = None,
        default_max_tokens: int | None = None,
        default_timeout: float | None = None,
        default_max_retries: int = 2,
    ) -> None:
        self._api_key_override = api_key
        self._default_model_override = default_model
        self._default_temperature_override = default_temperature
        self._default_max_tokens_override = default_max_tokens
        self._default_timeout_override = default_timeout
        self._default_max_retries = default_max_retries

        self._lock = threading.Lock()
        self._model_cache: dict[ModelCacheKey, ChatGroq] = {}
        self._structured_cache: dict[
            tuple[ModelCacheKey, type[BaseModel], bool], Runnable[Any, Any]
        ] = {}

    def _resolve_config(
        self,
        *,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        timeout: float | None = None,
        max_retries: int | None = None,
    ) -> tuple[str, ModelCacheKey]:
        """Resolves defaults from settings and validates all configuration bounds."""
        resolved_api_key = (
            self._api_key_override if self._api_key_override is not None else settings.GROQ_API_KEY
        ).strip()
        if not resolved_api_key:
            raise GroqConfigurationError(
                "GROQ_API_KEY is missing or empty. Set it in your environment."
            )

        resolved_model = (
            model if model is not None else (self._default_model_override or settings.GROQ_MODEL)
        ).strip()
        if not resolved_model:
            raise GroqConfigurationError(
                "GROQ_MODEL is missing or empty. Set it in your environment."
            )

        resolved_temperature = float(
            temperature
            if temperature is not None
            else (
                self._default_temperature_override
                if self._default_temperature_override is not None
                else settings.GROQ_TEMPERATURE
            )
        )
        if not 0.0 <= resolved_temperature <= 2.0:
            raise GroqConfigurationError(
                f"GROQ_TEMPERATURE must be between 0.0 and 2.0 (got {resolved_temperature})."
            )

        resolved_max_tokens = int(
            max_tokens
            if max_tokens is not None
            else (
                self._default_max_tokens_override
                if self._default_max_tokens_override is not None
                else settings.GROQ_MAX_TOKENS
            )
        )
        if resolved_max_tokens <= 0:
            raise GroqConfigurationError(
                f"GROQ_MAX_TOKENS must be a positive integer (got {resolved_max_tokens})."
            )

        resolved_timeout = float(
            timeout
            if timeout is not None
            else (
                self._default_timeout_override
                if self._default_timeout_override is not None
                else settings.GROQ_TIMEOUT
            )
        )
        if resolved_timeout <= 0:
            raise GroqConfigurationError(
                f"GROQ_TIMEOUT must be greater than 0 seconds (got {resolved_timeout})."
            )

        resolved_retries = int(
            max_retries if max_retries is not None else self._default_max_retries
        )
        if resolved_retries < 0:
            raise GroqConfigurationError(
                f"max_retries cannot be negative (got {resolved_retries})."
            )

        cache_key: ModelCacheKey = (
            resolved_model,
            resolved_temperature,
            resolved_max_tokens,
            resolved_timeout,
            resolved_retries,
        )
        return resolved_api_key, cache_key

    def get_model(
        self,
        *,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        timeout: float | None = None,
        max_retries: int | None = None,
    ) -> ChatGroq:
        """
        Returns a reusable, cached ChatGroq instance configured with the
        requested parameters (falling back to centralized settings).
        """
        api_key, cache_key = self._resolve_config(
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout,
            max_retries=max_retries,
        )

        with self._lock:
            cached = self._model_cache.get(cache_key)
            if cached is not None:
                return cached

            resolved_model, resolved_temp, resolved_tokens, resolved_timeout, resolved_retries = (
                cache_key
            )

            logger.info(
                "Initializing reusable ChatGroq instance: model=%s, temp=%.2f, max_tokens=%d, timeout=%.1fs",
                resolved_model,
                resolved_temp,
                resolved_tokens,
                resolved_timeout,
            )

            try:
                instance = ChatGroq(
                    model=resolved_model,
                    api_key=SecretStr(api_key),
                    temperature=resolved_temp,
                    max_tokens=resolved_tokens,
                    timeout=resolved_timeout,
                    max_retries=resolved_retries,
                )
            except Exception as exc:
                raise normalize_groq_error(exc) from exc

            self._model_cache[cache_key] = instance
            return instance

    def get_structured_model(
        self,
        schema: SchemaType[T],
        *,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        timeout: float | None = None,
        max_retries: int | None = None,
        include_raw: bool = False,
    ) -> Runnable[Any, Any]:
        """
        Returns a reusable runnable bound to a Pydantic schema or JSON schema dict
        for guaranteed structured output.
        """
        pydantic_schema: type[BaseModel] | None = (
            schema if isinstance(schema, type) and issubclass(schema, BaseModel) else None
        )
        if pydantic_schema is None and not isinstance(schema, dict):
            raise GroqStructuredOutputError(
                "Structured output schema must be a Pydantic BaseModel subclass or a JSON schema dict."
            )

        _, cache_key = self._resolve_config(
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout,
            max_retries=max_retries,
        )

        if pydantic_schema is not None:
            struct_key = (cache_key, pydantic_schema, include_raw)
            with self._lock:
                cached_struct = self._structured_cache.get(struct_key)
                if cached_struct is not None:
                    return cached_struct

        base_model = self.get_model(
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout,
            max_retries=max_retries,
        )

        try:
            structured_runnable = cast(
                Runnable[Any, Any],
                base_model.with_structured_output(
                    schema,
                    include_raw=include_raw,
                ),
            )
        except Exception as exc:
            raise GroqStructuredOutputError(
                f"Failed to bind structured output schema: {exc}",
                original_error=exc,
            ) from exc

        if pydantic_schema is not None:
            with self._lock:
                self._structured_cache[(cache_key, pydantic_schema, include_raw)] = (
                    structured_runnable
                )

        return structured_runnable

    def invoke(
        self,
        input_data: Any,
        *,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        timeout: float | None = None,
    ) -> Any:
        """Synchronously invokes a cached ChatGroq model with consistent error handling."""
        chat_model = self.get_model(
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout,
        )
        try:
            return chat_model.invoke(input_data)
        except Exception as exc:
            raise normalize_groq_error(exc) from exc

    async def ainvoke(
        self,
        input_data: Any,
        *,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        timeout: float | None = None,
    ) -> Any:
        """Asynchronously invokes a cached ChatGroq model with enforced timeout and error normalization."""
        chat_model = self.get_model(
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout,
        )
        active_timeout = float(timeout if timeout is not None else settings.GROQ_TIMEOUT)
        try:
            async with asyncio.timeout(active_timeout):
                return await chat_model.ainvoke(input_data)
        except Exception as exc:
            raise normalize_groq_error(exc) from exc

    async def ainvoke_structured(
        self,
        input_data: Any,
        schema: SchemaType[T],
        *,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        timeout: float | None = None,
        include_raw: bool = False,
    ) -> Any:
        """Asynchronously invokes a structured-output model with consistent error handling."""
        structured_model = self.get_structured_model(
            schema,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout,
            include_raw=include_raw,
        )
        active_timeout = float(timeout if timeout is not None else settings.GROQ_TIMEOUT)
        try:
            async with asyncio.timeout(active_timeout):
                return await structured_model.ainvoke(input_data)
        except Exception as exc:
            raise normalize_groq_error(exc) from exc

    @property
    def cached_model_count(self) -> int:
        """Returns the number of cached reusable ChatGroq instances."""
        with self._lock:
            return len(self._model_cache)

    def clear_cache(self) -> None:
        """Clears all cached model and structured-output instances."""
        with self._lock:
            self._model_cache.clear()
            self._structured_cache.clear()


# ============================================================================
# Default Singleton & Convenience Helpers
# ============================================================================

groq_client = GroqClientManager()


def get_groq_model(
    *,
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
    timeout: float | None = None,
    max_retries: int | None = None,
) -> ChatGroq:
    """
    Returns a centralized, reusable ChatGroq instance.
    Preserves backward compatibility with callers importing `get_groq_model()`.
    """
    return groq_client.get_model(
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout=timeout,
        max_retries=max_retries,
    )


def get_structured_groq_model(
    schema: SchemaType[T],
    *,
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
    timeout: float | None = None,
    max_retries: int | None = None,
    include_raw: bool = False,
) -> Runnable[Any, Any]:
    """
    Returns a centralized, reusable ChatGroq instance bound to a structured output schema.
    """
    return groq_client.get_structured_model(
        schema,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout=timeout,
        max_retries=max_retries,
        include_raw=include_raw,
    )
