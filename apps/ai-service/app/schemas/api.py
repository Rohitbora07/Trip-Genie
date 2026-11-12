from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.itinerary import ItineraryOutput
from app.schemas.trip import TripConstraints, TripInput
from app.services.llm_service import LLMUsage

OptimizationGoal = Literal["budget", "pace", "routing", "balanced"]
DisruptionType = Literal[
    "flight_delay",
    "flight_cancellation",
    "weather",
    "venue_closure",
    "transport_delay",
    "other",
]


# ---------------------------------------------------------------------------
# Health & Readiness Contracts
# ---------------------------------------------------------------------------


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str
    version: str
    environment: str
    request_id: str | None = None
    timestamp: datetime


class ConfigCheckStatus(BaseModel):
    configured: bool
    detail: str


class ReadinessChecks(BaseModel):
    groq_api_key: ConfigCheckStatus
    groq_model: ConfigCheckStatus
    service_api_key: ConfigCheckStatus
    express_api_base_url: ConfigCheckStatus


class ReadinessResponse(BaseModel):
    status: Literal["ready", "degraded"]
    service: str
    version: str
    environment: str
    request_id: str | None = None
    timestamp: datetime
    checks: ReadinessChecks


# ---------------------------------------------------------------------------
# Standardized Error Contracts
# ---------------------------------------------------------------------------


class APIErrorDetail(BaseModel):
    code: str
    message: str
    retryable: bool = False
    details: list[dict[str, Any]] | dict[str, Any] | None = None


class ErrorEnvelope(BaseModel):
    success: Literal[False] = False
    request_id: str
    error: APIErrorDetail


# ---------------------------------------------------------------------------
# Itinerary Generation, Optimization & Recovery Contracts
# ---------------------------------------------------------------------------


class GenerationOptions(BaseModel):
    model: str | None = Field(default=None)
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    max_tokens: int | None = Field(default=None, gt=0)


class ResponseMetadata(BaseModel):
    model: str
    latency_ms: float = Field(..., ge=0.0)
    usage: LLMUsage | None = None


class GenerateItineraryRequest(BaseModel):
    request_id: str | None = Field(default=None)
    trip_id: str | None = Field(default=None)
    generation_job_id: str | None = Field(default=None)
    trip: TripInput
    options: GenerationOptions | None = Field(default=None)


class GenerateItineraryData(BaseModel):
    trip_id: str | None = None
    generation_job_id: str | None = None
    itinerary: ItineraryOutput
    metadata: ResponseMetadata


class GenerateItineraryResponse(BaseModel):
    success: Literal[True] = True
    request_id: str
    data: GenerateItineraryData


class OptimizeItineraryRequest(BaseModel):
    request_id: str | None = Field(default=None)
    trip_id: str | None = Field(default=None)
    generation_job_id: str | None = Field(default=None)
    trip: TripInput
    current_itinerary: ItineraryOutput
    optimization_goal: OptimizationGoal = Field(default="balanced")
    target_budget: float | None = Field(default=None, ge=0.0)
    constraints: TripConstraints | None = Field(default=None)
    instructions: str | None = Field(default=None, max_length=2000)


class OptimizeItineraryData(BaseModel):
    trip_id: str | None = None
    generation_job_id: str | None = None
    itinerary: ItineraryOutput
    changes_summary: list[str]
    budget_delta: float = 0.0
    metadata: ResponseMetadata


class OptimizeItineraryResponse(BaseModel):
    success: Literal[True] = True
    request_id: str
    data: OptimizeItineraryData


class DisruptionDetails(BaseModel):
    type: DisruptionType
    description: str = Field(..., min_length=1, max_length=1500)
    affected_day_number: int = Field(..., ge=1)
    affected_activity_index: int | None = Field(default=None, ge=0)
    delay_minutes: int | None = Field(default=None, ge=0)
    occurred_at: datetime | None = Field(default=None)


class RecoveryOption(BaseModel):
    option_id: str
    title: str
    summary: str
    trade_offs: list[str] = Field(default_factory=list)
    estimated_cost_delta: float = 0.0


class RecoveryItineraryRequest(BaseModel):
    request_id: str | None = Field(default=None)
    trip_id: str | None = Field(default=None)
    generation_job_id: str | None = Field(default=None)
    trip: TripInput
    current_itinerary: ItineraryOutput
    disruption: DisruptionDetails
    preserve_confirmed_activities: bool = Field(default=True)
    instructions: str | None = Field(default=None, max_length=2000)


class RecoveryItineraryData(BaseModel):
    trip_id: str | None = None
    generation_job_id: str | None = None
    itinerary: ItineraryOutput
    selected_strategy: str
    impacted_days: list[int]
    recovery_options: list[RecoveryOption]
    metadata: ResponseMetadata


class RecoveryItineraryResponse(BaseModel):
    success: Literal[True] = True
    request_id: str
    data: RecoveryItineraryData
