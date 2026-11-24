import logging
import time
from typing import Any

from app.prompts import (
    ITINERARY_SYSTEM_PROMPT_V1,
    render_itinerary_prompt,
)
from app.schemas.api import GenerationOptions
from app.schemas.itinerary import ItineraryOutput
from app.schemas.trip import TripInput
from app.services.llm_service import LLMResponse, LLMService
from app.workflows.generation import generation_graph

logger = logging.getLogger("app.services.itinerary_service")

# Preserved for backward compatibility
ITINERARY_SYSTEM_PROMPT = ITINERARY_SYSTEM_PROMPT_V1


def build_itinerary_prompts(trip: TripInput) -> tuple[str, str]:
    """Builds the system and user prompts from validated TripInput data."""
    rendered = render_itinerary_prompt(trip)
    return rendered.system_prompt, rendered.user_prompt


async def generate_itinerary(
    trip: TripInput,
    llm: LLMService,
    options: GenerationOptions | None = None,
) -> LLMResponse[ItineraryOutput]:
    """Generates a structured ItineraryOutput using the compiled LangGraph workflow."""
    start_time = time.perf_counter()
    logger.info(
        "Executing LangGraph generation workflow: destination=%s, days=%d",
        trip.destination,
        trip.duration_days,
    )

    initial_state: dict[str, Any] = {
        "trip": trip,
        "options": options,
        "llm": llm,
        "repair_attempts": 0,
        "violations": [],
        "warnings": [],
    }

    final_state = await generation_graph.ainvoke(initial_state)

    final_itinerary: ItineraryOutput | None = final_state.get("final_output")
    if final_itinerary is None:
        raise ValueError("LangGraph itinerary generation did not produce a final_output")

    metadata = final_state.get("metadata", {})
    latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

    return LLMResponse[ItineraryOutput](
        content=final_itinerary,
        model=metadata.get("model") or getattr(llm, "default_model", "llama-3.3-70b-versatile"),
        latency_ms=latency_ms,
        usage=metadata.get("usage"),
    )
