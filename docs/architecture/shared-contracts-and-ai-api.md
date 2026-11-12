# Shared Contracts & Python AI API — Plain-English Guide

This guide explains how **Express (`apps/api`)** and the **Python AI Service (`apps/ai-service`)** connect to each other, why each folder/file exists, and what happens step by step when an itinerary is generated.

---

## 1. The Big Picture (How Everything Fits Together)

Your backend is split into two apps that talk over HTTP:

```
User / Frontend
      │
      ▼
Express API (apps/api - TypeScript)
  - Checks user login (JWT cookie)
  - Stores trips, days, activities, places in Postgres (Prisma)
  - Translates Express data  <──>  Shared Contracts (packages/contracts)
      │
      │  HTTP + X-Service-Key + X-Request-ID
      ▼
Python AI Service (apps/ai-service - FastAPI)
  1. RequestIDMiddleware stamps a tracking number (X-Request-ID)
  2. verify_service_key checks the secret password (X-Service-Key)
  3. FastAPI validates the incoming JSON using Pydantic schemas
  4. itinerary_service builds the travel prompt and calls Groq via llm_service
  5. If anything fails, exception_handlers convert errors into clean JSON
```

---

## 2. Why `packages/contracts/` Exists

Express and Python naturally write data differently:

| What | Express / Prisma style | Python AI style |
| :--- | :--- | :--- |
| **Field names** | `camelCase` (`startDate`, `travelerCount`, `estimatedCost`) | `snake_case` (`start_date`, `traveler_count`, `estimated_cost`) |
| **Activity times** | Full calendar timestamp (`2026-06-01T09:00:00.000Z`) | Simple 24-hour clock (`"09:00"`) |
| **Overview text** | Called `description` on `Itinerary` & `ItineraryDay` | Called `summary` on `ItineraryOutput` & `ItineraryDay` |
| **Places** | Separate `Place` table linked by `placeId` | Embedded inside each activity (`place`) |

`packages/contracts/` is the **single rulebook** both sides agree on. It also includes TypeScript helper functions (`toGenerateItineraryRequest` and `fromItineraryOutputToExpressPayload`) so Express can convert data to Python and back without bugs.

---

## 3. Feature-by-Feature Walkthrough

### Feature A: Health & Readiness Checks (`GET /health` and `GET /api/v1/health`)
- **`GET /health`**: A quick "are you awake?" check. Returns `200 OK` if FastAPI is running. Does not need a password.
- **`GET /api/v1/health`**: A smarter "are you ready to do AI work?" check. It checks whether `GROQ_API_KEY`, `GROQ_MODEL`, `AI_SERVICE_API_KEY`, and `EXPRESS_API_BASE_URL` are filled in inside `.env` (without ever printing the actual secret values!).
  - If all required config is set → returns **`200`** with `"status": "ready"`.
  - If a required key is missing → returns **`503`** with `"status": "degraded"` and tells you which variable is missing.

### Feature B: Service-to-Service Security (`verify_service_key`)
- Random people on the internet must **not** be able to hit `/api/v1/itineraries/generate` and burn your Groq API credits.
- Every `/api/v1/itineraries/*` route uses `verify_service_key`.
- Express must send the header `X-Service-Key: <your AI_SERVICE_API_KEY>`.
- **Safety rules**:
  - If `AI_SERVICE_API_KEY` is blank/unconfigured on the Python server, it **refuses all requests (`503`)** instead of accidentally accepting an empty header.
  - If the header is missing or wrong, it returns **`401 Unauthorized`**.

### Feature C: Itinerary Generation + Future Stubs
- **`POST /api/v1/itineraries/generate`**:
  1. Validates the incoming `trip` data (`destination`, `start_date`, `end_date`, `budget`, `preferences`, `constraints`).
  2. Uses `itinerary_service.py` to turn that trip info into clear AI instructions.
  3. Calls `llm_service.generate_structured(...)` so Groq returns data matching `ItineraryOutput`.
  4. If Groq leaves a day's `date` blank, automatically fills it in (`start_date + day_number - 1`).
  5. Returns the itinerary along with model name, latency (ms), and token counts.
- **`POST /api/v1/itineraries/optimize`** & **`POST /api/v1/itineraries/recovery`**:
  - These are **placeholders (stubs)** with their exact request/response shapes already defined for budget optimization and disruption recovery (e.g., delayed flights or bad weather).
  - Calling them right now checks auth and validates your JSON, then cleanly returns **`501 Not Implemented`** until the AI workflows for those two features are built.

### Feature D: Request-ID Tracking (`X-Request-ID`)
- Think of `X-Request-ID` like an **order tracking number**.
- Express can pass its own `X-Request-ID` header, or Python creates a random UUID if none was sent.
- Python automatically:
  1. Prints `request_id=...` inside **every log line**.
  2. Returns `X-Request-ID` in the **HTTP response headers**.
  3. Includes `"request_id"` inside **every JSON success and error body**.
- When debugging a bug later, search one `request_id` across both Node and Python logs to trace the full request.

### Feature E: Error Translation (`LLMError` → Clean HTTP Errors)
Inside `llm_service.py`, AI errors are wrapped in custom Python classes (`LLMRateLimitError`, `LLMTimeoutError`, etc.). Without an exception handler, FastAPI would crash with a generic `500`. Now, `exception_handlers.py` catches every error and turns it into one predictable JSON shape:

```json
{
  "success": false,
  "request_id": "req-123",
  "error": {
    "code": "LLM_RATE_LIMIT",
    "message": "Rate limit exceeded",
    "retryable": true,
    "details": null
  }
}
```

Express can read `error.retryable` to decide whether a failed `GenerationJob` should be retried automatically (`true`) or marked failed right away (`false`).

---

## 4. File-by-File Guide (What Every File Does)

### Inside `packages/contracts/`
| File | Plain-English Purpose |
| :--- | :--- |
| `README.md` | Short quick-start reference for the contracts folder. |
| `package.json` & `tsconfig.json` | Makes `packages/contracts` a valid TypeScript module (`@trip-genie/contracts`). |
| `schemas/common.schema.json` | Master JSON definitions for trips, itineraries, activities, places, health checks, and errors. |
| `schemas/itinerary-generate.schema.json` | JSON rules for `/api/v1/itineraries/generate` requests and responses. |
| `schemas/itinerary-optimize.schema.json` | JSON rules for `/api/v1/itineraries/optimize` requests and responses. |
| `schemas/itinerary-recovery.schema.json` | JSON rules for `/api/v1/itineraries/recovery` requests and responses. |
| `schemas/express-bridge.schema.json` | JSON reference showing Express `camelCase` shapes before/after bridging. |
| `events/generation-job.schema.json` | Shapes for `GenerationJob.input`, `result`, and `errorDetails` stored in Postgres. |
| `openapi/ai-service.yaml` | Full OpenAPI spec describing every route, header, and error response. |
| `examples/*.json` | Real sample payloads (requests, responses, bridged output, and errors) for testing. |
| `ts/types.ts` | TypeScript interfaces matching all schemas above. |
| `ts/bridge.ts` | Converter functions (`toGenerateItineraryRequest`, `fromItineraryOutputToExpressPayload`, date/time helpers). |
| `ts/index.ts` | Re-exports everything from `ts/types.ts` and `ts/bridge.ts`. |

### Inside `apps/ai-service/`
| File | Plain-English Purpose |
| :--- | :--- |
| `app/main.py` | App entry point: turns on logging, attaches `RequestIDMiddleware`, registers error handlers, and mounts `/health` + `/api/v1/*` routes. |
| `app/core/middleware.py` | Reads/generates `X-Request-ID`, stores it on `request.state`, puts it in logs, and adds it to response headers. |
| `app/core/logging.py` | Updated log formatter so every log line automatically shows `request_id=...`. |
| `app/core/security.py` | `verify_service_key` — checks `X-Service-Key` safely and blocks access if the server key is missing or empty. |
| `app/api/dependencies.py` | Reusable FastAPI helpers (`ServiceAuthDep`, `SettingsDep`, `LLMServiceDep`, `RequestIdDep`) so routes stay clean and easy to test. |
| `app/api/exception_handlers.py` | Catches `LLMError` subclasses, validation errors, HTTP errors, and crashes, converting all of them into the standard `ErrorEnvelope` JSON. |
| `app/api/routes/__init__.py` | Bundles `v1` routers (`health` + `itineraries`) for `main.py`. |
| `app/api/routes/health.py` | Implements `GET /health` and `GET /api/v1/health`. |
| `app/api/routes/itineraries.py` | Implements `POST /api/v1/itineraries/generate` and the `optimize` / `recovery` stubs. |
| `app/schemas/api.py` | Pydantic models for all HTTP envelopes (requests, responses, health checks, and errors). |
| `app/services/itinerary_service.py` | Builds the travel planning prompt from `TripInput`, calls `llm_service`, and fills any missing day dates. |
| `tests/test_api_health_and_auth.py` | Tests health checks, readiness `503` checks, request IDs, and `X-Service-Key` security. |
| `tests/test_api_itineraries.py` | Tests itinerary generation, invalid date `422` handling, all `LLMError` HTTP mappings, `500` safety, and `501` stubs. |
