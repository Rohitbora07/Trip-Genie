import unittest
from typing import Any

from fastapi.testclient import TestClient

from app.api.dependencies import get_llm_service
from app.core import security
from app.main import app
from app.schemas.itinerary import (
    ActivityTiming,
    ItineraryActivity,
    ItineraryDay,
    ItineraryOutput,
    PlaceInfo,
)
from app.services.llm_service import (
    LLMAuthenticationError,
    LLMBadRequestError,
    LLMModelError,
    LLMRateLimitError,
    LLMResponse,
    LLMTimeoutError,
    LLMUsage,
    LLMValidationError,
)


def _sample_itinerary(include_day_date: bool = False) -> ItineraryOutput:
    return ItineraryOutput(
        title="2 Days in Kyoto",
        summary="Temples, gardens, and authentic food.",
        currency="USD",
        days=[
            ItineraryDay(
                day_number=1,
                date="2026-06-01" if include_day_date else None,
                title="Higashiyama Exploration",
                summary="Classic temples and tea houses.",
                activities=[
                    ItineraryActivity(
                        title="Fushimi Inari Morning Walk",
                        description="Walk up the iconic torii gates.",
                        timing=ActivityTiming(
                            start_time="08:00",
                            end_time="10:00",
                            duration_minutes=120,
                        ),
                        place=PlaceInfo(
                            name="Fushimi Inari Taisha",
                            address="Kyoto",
                            category="ATTRACTION",
                        ),
                        estimated_cost=0.0,
                        currency="USD",
                    )
                ],
                daily_cost_total=0.0,
            )
        ],
        total_estimated_cost=0.0,
        highlights=["Fushimi Inari Taisha"],
    )


class StubLLMService:
    def __init__(self, outcome: Any) -> None:
        self.outcome = outcome
        self.last_call_kwargs: dict[str, Any] | None = None

    async def generate_structured(self, **kwargs):
        self.last_call_kwargs = kwargs
        if isinstance(self.outcome, Exception):
            raise self.outcome
        return self.outcome


class TestItineraryAPI(unittest.TestCase):
    def setUp(self) -> None:
        self.original_security_key = security.settings.AI_SERVICE_API_KEY
        security.settings.AI_SERVICE_API_KEY = "test-service-secret"
        self.headers = {
            "X-Service-Key": "test-service-secret",
            "X-Request-ID": "req-itinerary-01",
        }
        self.base_trip_payload = {
            "destination": "Kyoto, Japan",
            "origin": "San Francisco, USA",
            "start_date": "2026-06-01",
            "end_date": "2026-06-02",
            "traveler_count": 2,
            "budget": 1500,
            "currency": "USD",
            "preferences": {
                "pace": "moderate",
                "interests": ["temples", "food"],
            },
            "constraints": {
                "dietary": ["vegetarian"],
                "accessibility": [],
            },
        }

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
        security.settings.AI_SERVICE_API_KEY = self.original_security_key

    def test_generate_itinerary_success_and_date_backfill(self) -> None:
        stub = StubLLMService(
            LLMResponse[ItineraryOutput](
                content=_sample_itinerary(include_day_date=False),
                model="llama-3.3-70b-versatile",
                latency_ms=345.6,
                usage=LLMUsage(input_tokens=100, output_tokens=200, total_tokens=300),
            )
        )
        app.dependency_overrides[get_llm_service] = lambda: stub
        client = TestClient(app)

        res = client.post(
            "/api/v1/itineraries/generate",
            headers=self.headers,
            json={
                "trip_id": "2c92b8e2-9756-48d8-b4a4-d21f07780f11",
                "generation_job_id": "f4f208d7-8481-4b28-b9f1-82b90c6f3310",
                "trip": self.base_trip_payload,
                "options": {"temperature": 0.1},
            },
        )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["request_id"], "req-itinerary-01")
        self.assertEqual(body["data"]["itinerary"]["days"][0]["date"], "2026-06-01")
        self.assertEqual(body["data"]["metadata"]["model"], "llama-3.3-70b-versatile")
        self.assertEqual(body["data"]["metadata"]["usage"]["total_tokens"], 300)
        self.assertIsNotNone(stub.last_call_kwargs)
        self.assertEqual(stub.last_call_kwargs["temperature"], 0.1)

    def test_invalid_trip_dates_return_422_without_serialization_crash(self) -> None:
        client = TestClient(app)
        bad_trip = dict(self.base_trip_payload)
        bad_trip["start_date"] = "2026-06-10"
        bad_trip["end_date"] = "2026-06-01"

        res = client.post(
            "/api/v1/itineraries/generate",
            headers=self.headers,
            json={"trip": bad_trip},
        )
        self.assertEqual(res.status_code, 422)
        body = res.json()
        self.assertFalse(body["success"])
        self.assertEqual(body["error"]["code"], "REQUEST_VALIDATION_ERROR")
        self.assertFalse(body["error"]["retryable"])
        self.assertIsInstance(body["error"]["details"], list)

    def test_llm_error_subclasses_map_to_standard_http_responses(self) -> None:
        cases = [
            (LLMBadRequestError("bad prompt"), 400, "LLM_BAD_REQUEST", False),
            (LLMRateLimitError("too many requests"), 429, "LLM_RATE_LIMIT", True),
            (LLMTimeoutError("timed out"), 504, "LLM_TIMEOUT", True),
            (LLMValidationError("invalid json"), 502, "LLM_VALIDATION_ERROR", True),
            (LLMAuthenticationError("bad groq key"), 502, "LLM_AUTHENTICATION_ERROR", False),
            (LLMModelError("upstream 500"), 502, "LLM_MODEL_ERROR", True),
        ]

        for exc, expected_status, expected_code, expected_retryable in cases:
            with self.subTest(error=type(exc).__name__):
                app.dependency_overrides[get_llm_service] = lambda err=exc: StubLLMService(err)
                client = TestClient(app)
                res = client.post(
                    "/api/v1/itineraries/generate",
                    headers=self.headers,
                    json={"trip": self.base_trip_payload},
                )
                self.assertEqual(res.status_code, expected_status)
                body = res.json()
                self.assertFalse(body["success"])
                self.assertEqual(body["request_id"], "req-itinerary-01")
                self.assertEqual(body["error"]["code"], expected_code)
                self.assertEqual(body["error"]["retryable"], expected_retryable)
                self.assertEqual(res.headers["x-request-id"], "req-itinerary-01")

    def test_unhandled_exception_maps_to_500_without_leaking_details(self) -> None:
        app.dependency_overrides[get_llm_service] = lambda: StubLLMService(
            RuntimeError("sensitive internal traceback detail")
        )
        client = TestClient(app, raise_server_exceptions=False)
        res = client.post(
            "/api/v1/itineraries/generate",
            headers=self.headers,
            json={"trip": self.base_trip_payload},
        )
        self.assertEqual(res.status_code, 500)
        body = res.json()
        self.assertEqual(body["request_id"], "req-itinerary-01")
        self.assertEqual(res.headers["x-request-id"], "req-itinerary-01")
        self.assertEqual(body["error"]["code"], "INTERNAL_SERVER_ERROR")
        self.assertNotIn("sensitive internal traceback detail", res.text)

    def test_optimize_and_recovery_stubs_return_501(self) -> None:
        client = TestClient(app)
        sample_itinerary = _sample_itinerary(include_day_date=True).model_dump(mode="json")

        opt_res = client.post(
            "/api/v1/itineraries/optimize",
            headers=self.headers,
            json={
                "trip": self.base_trip_payload,
                "current_itinerary": sample_itinerary,
                "optimization_goal": "budget",
                "target_budget": 1000,
            },
        )
        self.assertEqual(opt_res.status_code, 501)
        self.assertEqual(opt_res.json()["error"]["code"], "NOT_IMPLEMENTED")

        rec_res = client.post(
            "/api/v1/itineraries/recovery",
            headers=self.headers,
            json={
                "trip": self.base_trip_payload,
                "current_itinerary": sample_itinerary,
                "disruption": {
                    "type": "weather",
                    "description": "Heavy storm on day 1",
                    "affected_day_number": 1,
                },
            },
        )
        self.assertEqual(rec_res.status_code, 501)
        self.assertEqual(rec_res.json()["error"]["code"], "NOT_IMPLEMENTED")


if __name__ == "__main__":
    unittest.main()
