from __future__ import annotations

from app.prompts.base import RenderedPrompt, delimit_user_instructions
from app.prompts.system import ITINERARY_SYSTEM_PROMPT_V1, SYSTEM_PROMPT_VERSION
from app.schemas.trip import TripInput

ITINERARY_TASK_VERSION = "v1"


def render_itinerary_prompt(trip: TripInput) -> RenderedPrompt:
    """
    Renders the task prompt for generating an itinerary from a validated TripInput,
    applying isolation delimiters to untrusted user instructions and attaching version tags.
    """
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
        delimited_instructions = delimit_user_instructions(trip.additional_instructions)
        if delimited_instructions:
            lines.append(f"Additional User Instructions:\n{delimited_instructions}")

    lines.append(
        f"Create a complete {trip.duration_days}-day itinerary with accurate calendar dates "
        f"starting on {trip.start_date.isoformat()}."
    )

    user_prompt = "\n".join(lines)

    return RenderedPrompt(
        system_prompt=ITINERARY_SYSTEM_PROMPT_V1,
        user_prompt=user_prompt,
        system_version=SYSTEM_PROMPT_VERSION,
        task_version=ITINERARY_TASK_VERSION,
    )
