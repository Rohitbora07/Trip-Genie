import { env } from "../../config/env";
import type {
    AiErrorEnvelope,
    AiServiceErrorDetails,
    GenerateItineraryRequest,
    GenerateItineraryResponse,
    RecoveryItineraryRequest,
    RecoveryItineraryResponse
} from "./ai.types";

export class AiServiceError extends Error {
    public readonly code: string;
    public readonly httpStatus?: number;
    public readonly retryable: boolean;
    public readonly requestId?: string;
    public readonly details?: unknown;

    constructor(params: AiServiceErrorDetails) {
        super(params.message);
        this.name = "AiServiceError";
        this.code = params.code;
        this.httpStatus = params.httpStatus;
        this.retryable = params.retryable;
        this.requestId = params.requestId;
        this.details = params.details;
    }

    toErrorDetails(): AiServiceErrorDetails {
        return {
            code: this.code,
            message: this.message,
            retryable: this.retryable,
            ...(this.httpStatus !== undefined && { httpStatus: this.httpStatus }),
            ...(this.requestId !== undefined && { requestId: this.requestId }),
            ...(this.details !== undefined && { details: this.details })
        };
    }
}

export interface AiClientCallOptions {
    signal?: AbortSignal;
    timeoutMs?: number;
    baseUrl?: string;
    apiKey?: string;
}

function isErrorEnvelope(value: unknown): value is AiErrorEnvelope {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const candidate = value as Partial<AiErrorEnvelope>;
    return (
        candidate.success === false &&
        typeof candidate.error === "object" &&
        candidate.error !== null &&
        typeof candidate.error.code === "string" &&
        typeof candidate.error.message === "string"
    );
}

function isGenerateItineraryResponse(value: unknown): value is GenerateItineraryResponse {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const candidate = value as Partial<GenerateItineraryResponse>;
    return (
        candidate.success === true &&
        typeof candidate.data === "object" &&
        candidate.data !== null &&
        typeof candidate.data.itinerary === "object" &&
        candidate.data.itinerary !== null &&
        Array.isArray(candidate.data.itinerary.days)
    );
}

/**
 * Calls the FastAPI AI service `POST /api/v1/itineraries/generate` endpoint
 * with `X-Service-Key` auth and `AbortController` timeout + cancellation support.
 */
export async function generateItineraryFromAi(
    payload: GenerateItineraryRequest,
    options: AiClientCallOptions = {}
): Promise<GenerateItineraryResponse> {
    const baseUrl = (options.baseUrl ?? env.AI_SERVICE_URL).replace(/\/+$/, "");
    const apiKey = options.apiKey ?? env.AI_SERVICE_API_KEY;
    const timeoutMs = options.timeoutMs ?? env.AI_SERVICE_TIMEOUT_MS;
    const url = `${baseUrl}/api/v1/itineraries/generate`;

    const controller = new AbortController();
    let timedOut = false;

    const onExternalAbort = () => {
        controller.abort(options.signal?.reason ?? new Error("Aborted by caller"));
    };

    if (options.signal) {
        if (options.signal.aborted) {
            throw new AiServiceError({
                code: "JOB_CANCELLED",
                message: "Generation job was cancelled before calling the AI service",
                retryable: false,
                requestId: payload.request_id ?? undefined
            });
        }
        options.signal.addEventListener("abort", onExternalAbort, { once: true });
    }

    const timeoutHandle = setTimeout(() => {
        timedOut = true;
        controller.abort(new Error(`AI service request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    try {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "X-Service-Key": apiKey
        };
        if (payload.request_id) {
            headers["X-Request-ID"] = payload.request_id;
        }

        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        const rawBody = await response.text();
        let parsedBody: unknown = null;
        if (rawBody) {
            try {
                parsedBody = JSON.parse(rawBody);
            } catch {
                parsedBody = null;
            }
        }

        if (!response.ok) {
            if (isErrorEnvelope(parsedBody)) {
                throw new AiServiceError({
                    code: parsedBody.error.code,
                    message: parsedBody.error.message,
                    retryable: Boolean(parsedBody.error.retryable),
                    httpStatus: response.status,
                    requestId: parsedBody.request_id ?? payload.request_id ?? undefined,
                    details: parsedBody.error.details ?? undefined
                });
            }

            throw new AiServiceError({
                code: `AI_HTTP_${response.status}`,
                message:
                    rawBody.slice(0, 500) ||
                    `AI service returned HTTP ${response.status} ${response.statusText}`,
                retryable: response.status >= 500 || response.status === 429,
                httpStatus: response.status,
                requestId: payload.request_id ?? undefined
            });
        }

        if (!isGenerateItineraryResponse(parsedBody)) {
            throw new AiServiceError({
                code: "AI_INVALID_RESPONSE",
                message: "AI service returned an unexpected response payload",
                retryable: true,
                httpStatus: response.status,
                requestId: payload.request_id ?? undefined
            });
        }

        return parsedBody;
    } catch (error) {
        if (error instanceof AiServiceError) {
            throw error;
        }

        if (options.signal?.aborted) {
            throw new AiServiceError({
                code: "JOB_CANCELLED",
                message: "Generation job was cancelled while waiting for the AI service",
                retryable: false,
                requestId: payload.request_id ?? undefined
            });
        }

        if (timedOut) {
            throw new AiServiceError({
                code: "AI_SERVICE_TIMEOUT",
                message: `AI service request timed out after ${timeoutMs}ms`,
                retryable: true,
                requestId: payload.request_id ?? undefined
            });
        }

        throw new AiServiceError({
            code: "AI_SERVICE_UNAVAILABLE",
            message:
                error instanceof Error
                    ? `Failed to reach AI service: ${error.message}`
                    : "Failed to reach AI service",
            retryable: true,
            requestId: payload.request_id ?? undefined
        });
    } finally {
        clearTimeout(timeoutHandle);
        options.signal?.removeEventListener("abort", onExternalAbort);
    }
}

/**
 * Calls the FastAPI AI service `POST /api/v1/itineraries/recovery` endpoint
 * with `X-Service-Key` auth and `AbortController` timeout + cancellation support.
 */
export async function recoverItineraryFromAi(
    payload: RecoveryItineraryRequest,
    options: AiClientCallOptions = {}
): Promise<RecoveryItineraryResponse> {
    const baseUrl = (options.baseUrl ?? env.AI_SERVICE_URL).replace(/\/+$/, "");
    const apiKey = options.apiKey ?? env.AI_SERVICE_API_KEY;
    const timeoutMs = options.timeoutMs ?? env.AI_SERVICE_TIMEOUT_MS;
    const url = `${baseUrl}/api/v1/itineraries/recovery`;

    const controller = new AbortController();
    let timedOut = false;

    const onExternalAbort = () => {
        controller.abort(options.signal?.reason ?? new Error("Aborted by caller"));
    };

    if (options.signal) {
        if (options.signal.aborted) {
            throw new AiServiceError({
                code: "JOB_CANCELLED",
                message: "Generation job was cancelled before calling the AI service",
                retryable: false,
                requestId: payload.request_id ?? undefined
            });
        }
        options.signal.addEventListener("abort", onExternalAbort, { once: true });
    }

    const timeoutHandle = setTimeout(() => {
        timedOut = true;
        controller.abort(new Error(`AI service request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    try {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "X-Service-Key": apiKey
        };
        if (payload.request_id) {
            headers["X-Request-ID"] = payload.request_id;
        }

        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        const contentType = response.headers.get("content-type") ?? "";
        const isJson = contentType.includes("application/json");
        const body = isJson ? await response.json() : await response.text();

        if (!response.ok) {
            if (isErrorEnvelope(body)) {
                throw new AiServiceError({
                    code: body.error.code,
                    message: body.error.message,
                    retryable: body.error.retryable,
                    httpStatus: response.status,
                    requestId: body.request_id,
                    details: body.error.details
                });
            }

            throw new AiServiceError({
                code: `HTTP_${response.status}`,
                message: typeof body === "string" ? body : `AI service failed with status ${response.status}`,
                retryable: response.status >= 500,
                httpStatus: response.status,
                requestId: payload.request_id ?? undefined
            });
        }

        return body as RecoveryItineraryResponse;
    } catch (error) {
        if (error instanceof AiServiceError) {
            throw error;
        }

        if (timedOut) {
            throw new AiServiceError({
                code: "AI_SERVICE_TIMEOUT",
                message: `AI service request timed out after ${timeoutMs}ms`,
                retryable: true,
                requestId: payload.request_id ?? undefined
            });
        }

        if (controller.signal.aborted) {
            throw new AiServiceError({
                code: "JOB_CANCELLED",
                message: "AI service request was aborted by caller",
                retryable: false,
                requestId: payload.request_id ?? undefined
            });
        }

        throw new AiServiceError({
            code: "AI_SERVICE_UNAVAILABLE",
            message:
                error instanceof Error
                    ? `Failed to reach AI service: ${error.message}`
                    : "Failed to reach AI service",
            retryable: true,
            requestId: payload.request_id ?? undefined
        });
    } finally {
        clearTimeout(timeoutHandle);
        options.signal?.removeEventListener("abort", onExternalAbort);
    }
}
