from typing import Any, TypedDict

from app.schemas.api import GenerationOptions
from app.schemas.itinerary import ItineraryOutput, PlaceInfo
from app.schemas.trip import TripInput


class ItineraryGenerationState(TypedDict, total=False):
    """Central state container for the LangGraph itinerary generation workflow."""

    # 1. Initial user request
    trip: TripInput
    options: GenerationOptions | None
    llm: Any

    # 2. Pre-computed requirements analysis
    requirements: dict[str, Any]

    # 3. Grounded external tools context (OSM & Open-Meteo)
    resolved_location: dict[str, Any]
    travel_guide_summary: str
    weather_summary: dict[str, Any]
    candidate_places: list[PlaceInfo]

    # 4. Draft & intermediate generation artifacts
    draft_itinerary: ItineraryOutput | None
    repair_prompt: str | None

    # 5. Constraint validation & repair tracking
    violations: list[str]
    warnings: list[str]
    repair_attempts: int

    # 6. Finalized reconciled output & telemetry
    final_output: ItineraryOutput | None
    metadata: dict[str, Any]
