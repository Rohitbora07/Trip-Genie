from datetime import timedelta

from app.schemas.api import GenerationOptions
from app.schemas.itinerary import ItineraryOutput
from app.schemas.trip import TripInput
from app.services.llm_service import LLMResponse, LLMService

ITINERARY_SYSTEM_PROMPT = (
    "You are an expert travel planner for Trip-Genie. "
    "Generate realistic, geographically coherent, day-by-day travel itineraries "
    "that match the requested destination, dates, budget, traveler count, pace, "
    "and dietary or accessibility constraints. "
    "Every day must use sequential day_number values starting at 1, "
    "every activity must have 24-hour HH:MM start_time and end_time (with end_time after start_time), "
    "positive duration_minutes, and a PlaceInfo category from: "
    "ATTRACTION, RESTAURANT, HOTEL, AIRPORT, TRANSIT, ACTIVITY, OTHER."
)


def build_itinerary_prompts(trip: TripInput) -> tuple[str, str]:
    """Builds the system and user prompts from validated TripInput data."""
    lines: list[str] = [
        f"Destination: {trip.destination}",
        f"Dates: {trip.start_date.isoformat()} to {trip.end_date.isoformat()} ({trip.duration_days} days)",
        f"Travelers: {trip.traveler_count}",
        f"Currency: {trip.currency}",
    ]

    if trip.origin:
        lines.append(f"Origin: {trip.origin}")
    if trip.budget is not None:
        lines.append(f"Total Budget Target: {trip.budget:.2f} {trip.currency}")

    if trip.preferences:
        if trip.preferences.pace:
            lines.append(f"Travel Pace: {trip.preferences.pace}")
        if trip.preferences.interests:
            lines.append(f"Interests: {', '.join(trip.preferences.interests)}")
        if trip.preferences.accommodation_style:
            lines.append(f"Accommodation Style: {trip.preferences.accommodation_style}")
        if trip.preferences.transport_preference:
            lines.append(f"Transport Preference: {trip.preferences.transport_preference}")

    if trip.constraints:
        if trip.constraints.dietary:
            lines.append(f"Dietary Constraints: {', '.join(trip.constraints.dietary)}")
        if trip.constraints.accessibility:
            lines.append(f"Accessibility Constraints: {', '.join(trip.constraints.accessibility)}")

    if trip.additional_instructions:
        lines.append(f"Additional Instructions: {trip.additional_instructions}")

    lines.append(
        f"Create a complete {trip.duration_days}-day itinerary with accurate calendar dates "
        f"starting on {trip.start_date.isoformat()}."
    )

    return ITINERARY_SYSTEM_PROMPT, "\n".join(lines)


async def generate_itinerary(
    trip: TripInput,
    llm: LLMService,
    options: GenerationOptions | None = None,
) -> LLMResponse[ItineraryOutput]:
    """Generates a structured ItineraryOutput for the given TripInput."""
    system_prompt, prompt = build_itinerary_prompts(trip)

    result = await llm.generate_structured(
        prompt=prompt,
        response_model=ItineraryOutput,
        system_prompt=system_prompt,
        model=options.model if options else None,
        temperature=options.temperature if options else None,
        max_tokens=options.max_tokens if options else None,
    )

    for day in result.content.days:
        if day.date is None:
            day.date = trip.start_date + timedelta(days=day.day_number - 1)

    return result
