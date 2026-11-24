import unittest
from types import SimpleNamespace

from app.api.dependencies import get_app_settings, get_llm_service
from app.core import security
from app.main import app
from fastapi.testclient import TestClient


class FakeLLMService:
    async def generate_structured(self, **kwargs):
        raise AssertionError("Should not be called in health/auth tests")


class TestHealthAndAuthAPI(unittest.TestCase):
    def setUp(self) -> None:
        self.original_security_key = security.settings.AI_SERVICE_API_KEY
        self.fake_settings = SimpleNamespace(
            APP_NAME="Trip-Genie AI Service",
            ENVIRONMENT="test",
            LOG_LEVEL="INFO",
            API_V1_PREFIX="/api/v1",
            GROQ_API_KEY="gsk_test_secret_value",
            GROQ_MODEL="llama-3.3-70b-versatile",
            GROQ_TEMPERATURE=0.2,
            GROQ_MAX_TOKENS=4096,
            GROQ_TIMEOUT=60,
            EXPRESS_API_BASE_URL="http://localhost:4000/api/v1",
            AI_SERVICE_API_KEY="test-service-secret",
        )
        security.settings.AI_SERVICE_API_KEY = "test-service-secret"
        app.dependency_overrides[get_app_settings] = lambda: self.fake_settings
        app.dependency_overrides[get_llm_service] = lambda: FakeLLMService()
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
        security.settings.AI_SERVICE_API_KEY = self.original_security_key

    def test_root_health_generates_and_echoes_request_id(self) -> None:
        res_auto = self.client.get("/health")
        self.assertEqual(res_auto.status_code, 200)
        body_auto = res_auto.json()
        self.assertEqual(body_auto["status"], "ok")
        self.assertTrue(body_auto["request_id"])
        self.assertEqual(res_auto.headers["x-request-id"], body_auto["request_id"])

        res_custom = self.client.get("/health", headers={"X-Request-ID": "trace-123"})
        self.assertEqual(res_custom.status_code, 200)
        self.assertEqual(res_custom.headers["x-request-id"], "trace-123")
        self.assertEqual(res_custom.json()["request_id"], "trace-123")

    def test_v1_readiness_ready_without_leaking_secrets(self) -> None:
        res = self.client.get("/api/v1/health", headers={"X-Request-ID": "ready-1"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "ready")
        self.assertTrue(data["checks"]["groq_api_key"]["configured"])
        self.assertTrue(data["checks"]["groq_model"]["configured"])
        self.assertTrue(data["checks"]["service_api_key"]["configured"])
        self.assertNotIn("gsk_test_secret_value", res.text)
        self.assertNotIn("test-service-secret", res.text)

    def test_v1_readiness_degraded_returns_503(self) -> None:
        self.fake_settings.GROQ_API_KEY = ""
        self.fake_settings.AI_SERVICE_API_KEY = "   "
        res = self.client.get("/api/v1/health")
        self.assertEqual(res.status_code, 503)
        data = res.json()
        self.assertEqual(data["status"], "degraded")
        self.assertFalse(data["checks"]["groq_api_key"]["configured"])
        self.assertFalse(data["checks"]["service_api_key"]["configured"])

    def test_missing_service_key_returns_401_error_envelope(self) -> None:
        res = self.client.post(
            "/api/v1/itineraries/generate",
            headers={"X-Request-ID": "auth-missing"},
            json={
                "trip": {
                    "destination": "Tokyo, Japan",
                    "start_date": "2026-07-01",
                    "end_date": "2026-07-02",
                }
            },
        )
        self.assertEqual(res.status_code, 401)
        body = res.json()
        self.assertFalse(body["success"])
        self.assertEqual(body["request_id"], "auth-missing")
        self.assertEqual(body["error"]["code"], "UNAUTHORIZED")
        self.assertEqual(res.headers["x-request-id"], "auth-missing")

    def test_invalid_service_key_returns_401(self) -> None:
        res = self.client.post(
            "/api/v1/itineraries/generate",
            headers={"X-Service-Key": "wrong-key"},
            json={
                "trip": {
                    "destination": "Tokyo, Japan",
                    "start_date": "2026-07-01",
                    "end_date": "2026-07-02",
                }
            },
        )
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.json()["error"]["code"], "UNAUTHORIZED")

    def test_unconfigured_service_key_fails_closed_with_503(self) -> None:
        security.settings.AI_SERVICE_API_KEY = ""
        res = self.client.post(
            "/api/v1/itineraries/generate",
            headers={"X-Service-Key": ""},
            json={
                "trip": {
                    "destination": "Tokyo, Japan",
                    "start_date": "2026-07-01",
                    "end_date": "2026-07-02",
                }
            },
        )
        self.assertEqual(res.status_code, 503)
        self.assertEqual(res.json()["error"]["code"], "SERVICE_UNAVAILABLE")


if __name__ == "__main__":
    unittest.main()
