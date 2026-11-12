# AI Service HTTP API Reference (`apps/ai-service`)

Base URL (local development): `http://localhost:8000`

All endpoints accept and return JSON. Every response includes an `X-Request-ID` header so you can trace requests in logs.

---

## Headers

| Header | Required On | What it is |
| :--- | :--- | :--- |
| `X-Service-Key` | All `/api/v1/itineraries/*` routes | Shared password matching `AI_SERVICE_API_KEY` in `apps/ai-service/.env`. |
| `X-Request-ID` | Optional on all routes | Tracking ID from Express. If omitted, the AI service generates a UUID automatically. |

---

## Endpoints

### 1. `GET /health` (Liveness)
Checks whether FastAPI is running.
- **Auth required**: No
- **Success (`200 OK`)**:
```json
{
  "status": "ok",
  "service": "Trip-Genie AI Service",
  "version": "1.0.0",
  "environment": "development",
  "request_id": "...",
  "timestamp": "2026-11-12T02:11:00Z"
}
```

### 2. `GET /api/v1/health` (Readiness + Config Check)
Checks whether required `.env` values (`GROQ_API_KEY`, `GROQ_MODEL`, `AI_SERVICE_API_KEY`, `EXPRESS_API_BASE_URL`) are present. Never prints secret values.
- **Auth required**: No
- **Ready (`200 OK`)** when `GROQ_API_KEY`, `GROQ_MODEL`, and `AI_SERVICE_API_KEY` are set.
- **Not Ready (`503 Service Unavailable`)** with `"status": "degraded"` if any required key is missing.

### 3. `POST /api/v1/itineraries/generate`
Generates a complete day-by-day itinerary using Groq structured output.
- **Auth required**: Yes (`X-Service-Key`)
- **Request body**: See [generate-itinerary-request.example.json](../../packages/contracts/examples/generate-itinerary-request.example.json)
- **Response (`200 OK`)**: See [generate-itinerary-response.example.json](../../packages/contracts/examples/generate-itinerary-response.example.json)

### 4. `POST /api/v1/itineraries/optimize` *(Stub)*
Reserved route for optimizing budget, pace, or routing on an existing itinerary.
- **Auth required**: Yes (`X-Service-Key`)
- **Request body**: See [optimize-itinerary-request.example.json](../../packages/contracts/examples/optimize-itinerary-request.example.json)
- **Current response**: `501 Not Implemented` (`error.code = "NOT_IMPLEMENTED"`)

### 5. `POST /api/v1/itineraries/recovery` *(Stub)*
Reserved route for updating an existing itinerary after delays, cancellations, weather, or venue closures.
- **Auth required**: Yes (`X-Service-Key`)
- **Request body**: See [recovery-itinerary-request.example.json](../../packages/contracts/examples/recovery-itinerary-request.example.json)
- **Current response**: `501 Not Implemented` (`error.code = "NOT_IMPLEMENTED"`)

---

## Error Codes & Retry Guide

Every error returns this structure:

```json
{
  "success": false,
  "request_id": "req-123",
  "error": {
    "code": "LLM_TIMEOUT",
    "message": "LLM request timed out",
    "retryable": true,
    "details": null
  }
}
```

| HTTP Status | Error Code | Meaning | Safe to Retry? |
| :--- | :--- | :--- | :--- |
| `400` | `LLM_BAD_REQUEST` | Groq rejected the request parameters/prompt (`LLMBadRequestError`). | No |
| `401` | `UNAUTHORIZED` | Missing or wrong `X-Service-Key` header. | No |
| `422` | `REQUEST_VALIDATION_ERROR` | Request JSON failed Pydantic rules (e.g., `end_date` before `start_date`). | No |
| `429` | `LLM_RATE_LIMIT` | Groq rate limit reached (`LLMRateLimitError`). | **Yes** |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected bug inside Python (traceback logged with `request_id`). | No |
| `501` | `NOT_IMPLEMENTED` | Stub endpoint (`/optimize` or `/recovery`) not built yet. | No |
| `502` | `LLM_AUTHENTICATION_ERROR` | Groq rejected the AI service's `GROQ_API_KEY` (kept separate from `401` so you know it's Groq, not `X-Service-Key`). | No |
| `502` | `LLM_VALIDATION_ERROR` | AI response didn't match the `ItineraryOutput` schema (`LLMValidationError`). | **Yes** |
| `502` | `LLM_MODEL_ERROR` | Groq server/network error (`LLMModelError`). | **Yes** |
| `503` | `SERVICE_UNAVAILABLE` | `AI_SERVICE_API_KEY` is blank/not configured on the AI service. | No |
| `504` | `LLM_TIMEOUT` | Groq took too long to respond (`LLMTimeoutError`). | **Yes** |

---

## How to Run and Test Locally

From `apps/ai-service/`:

```powershell
# Run the AI server
.\.venv\Scripts\uvicorn.exe app.main:app --reload --port 8000

# Run unit tests
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```
