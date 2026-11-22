import logging
from datetime import timedelta

from app.prompts import (
    ITINERARY_SYSTEM_PROMPT_V1,
    render_itinerary_prompt,
)
from app.schemas.api import GenerationOptions
from app.schemas.itinerary import ItineraryOutput
from app.schemas.trip import TripInput
from app.services.llm_service import LLMResponse, LLMService

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
    """Generates a structured ItineraryOutput for the given TripInput."""
    rendered = render_itinerary_prompt(trip)
    logger.info(
        "Generating itinerary with prompt version: %s (destination=%s, days=%d)",
        rendered.version_tag,
        trip.destination,
        trip.duration_days,
    )

    result = await llm.generate_structured(
        prompt=rendered.user_prompt,
        response_model=ItineraryOutput,
        system_prompt=rendered.system_prompt,
        model=options.model if options else None,
        temperature=options.temperature if options else None,
        max_tokens=options.max_tokens if options else None,
    )

    for day in result.content.days:
        if day.date is None:
            day.date = trip.start_date + timedelta(days=day.day_number - 1)

    return result
