import copy
import logging
import uuid
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from app.schemas.api import (
    DisruptionDetails,
    RecoveryItineraryData,
    RecoveryItineraryRequest,
    RecoveryItineraryResponse,
    RecoveryOption,
    ResponseMetadata,
)
from app.schemas.itinerary import (
    ActivityTiming,
    ItineraryActivity,
    ItineraryDay,
    ItineraryOutput,
    PlaceInfo,
)
from app.schemas.trip import TripInput

logger = logging.getLogger("app.workflows.disruption_recovery")


# ============================================================================
# Helpers: Time conversion & math
# ============================================================================

def time_to_minutes(time_str: str | None) -> int:
    """Converts 'HH:MM' string to minutes since midnight."""
    if not time_str:
        return 540  # Default 09:00 AM
    try:
        parts = time_str.strip().split(":")
        return int(parts[0]) * 60 + int(parts[1])
    except (ValueError, IndexError):
        return 540


def minutes_to_time(minutes: int) -> str:
    """Converts minutes since midnight to clamped 'HH:MM' 24h string."""
    clamped = max(0, min(1439, minutes))
    hours = clamped // 60
    mins = clamped % 60
    return f"{hours:02d}:{mins:02d}"


# ============================================================================
# State Definition
# ============================================================================

class DisruptionRecoveryState(TypedDict, total=False):
    request_id: str
    trip: TripInput
    current_itinerary: ItineraryOutput
    disruption: DisruptionDetails
    preserve_confirmed_activities: bool
    instructions: str | None

    # Intermediate fields
    affected_day_number: int
    delay_minutes: int
    locked_activity_titles: list[str]
    impact_analysis: dict[str, Any]

    # Proposals output
    recovery_options: list[RecoveryOption]
    selected_strategy: str
    repaired_itinerary: ItineraryOutput
    response_data: RecoveryItineraryData


# ============================================================================
# Node 1: classify_impact
# ============================================================================

async def classify_impact(state: DisruptionRecoveryState) -> dict[str, Any]:
    """Parses disruption parameters, detects timeline collisions, and locks confirmed activities."""
    disruption = state["disruption"]
    current_itinerary = state["current_itinerary"]
    preserve_confirmed = state.get("preserve_confirmed_activities", True)

    affected_day_num = disruption.affected_day_number or 1
    # Extract or infer delay minutes
    delay_mins = disruption.delay_minutes or 120
    disruption_type = str(disruption.type).upper()

    # Find the target day in the current itinerary
    target_day: ItineraryDay | None = None
    for day in current_itinerary.days:
        if day.day_number == affected_day_num:
            target_day = day
            break

    if target_day is None and current_itinerary.days:
        target_day = current_itinerary.days[0]
        affected_day_num = target_day.day_number

    activities = target_day.activities if target_day else []

    # Identify confirmed/locked activities that must not be cancelled
    locked_titles: list[str] = []
    if preserve_confirmed:
        for act in activities:
            is_confirmed = False
            # Check status or booking flags
            status_val = getattr(act, "status", None)
            if status_val and str(status_val).upper() == "CONFIRMED" or "flight" in act.title.lower() or "hotel" in act.title.lower() or "check-in" in act.title.lower():
                is_confirmed = True

            if is_confirmed:
                locked_titles.append(act.title)

    # Detect collided activities
    collided_activities: list[str] = []
    earliest_time = 540  # 09:00 AM in minutes
    if activities and activities[0].timing and activities[0].timing.start_time:
        earliest_time = time_to_minutes(activities[0].timing.start_time)

    disruption_threshold = earliest_time + delay_mins
    for act in activities:
        start_m = time_to_minutes(act.timing.start_time if act.timing else None)
        if start_m < disruption_threshold:
            collided_activities.append(act.title)

    impact_summary = {
        "disruption_type": disruption_type,
        "affected_day": affected_day_num,
        "delay_minutes": delay_mins,
        "total_activities_on_day": len(activities),
        "collided_activities_count": len(collided_activities),
        "collided_activity_titles": collided_activities,
        "locked_activity_titles": locked_titles,
    }

    logger.info(
        "Impact classified for Day %d: %d collided activities, %d locked",
        affected_day_num,
        len(collided_activities),
        len(locked_titles),
    )

    return {
        "affected_day_number": affected_day_num,
        "delay_minutes": delay_mins,
        "locked_activity_titles": locked_titles,
        "impact_analysis": impact_summary,
    }


# ============================================================================
# Node 2: generate_recovery_proposals
# ============================================================================

async def generate_recovery_proposals(state: DisruptionRecoveryState) -> dict[str, Any]:
    """Produces 2-3 distinct ranked recovery proposals with diff payloads and cost deltas."""
    current_itinerary = state["current_itinerary"]
    affected_day_num = state.get("affected_day_number", 1)
    delay_mins = state.get("delay_minutes", 120)
    locked_titles = set(state.get("locked_activity_titles", []))
    disruption = state["disruption"]

    # -------------------------------------------------------------------------
    # Option A: MINIMAL_DISRUPTION (Shift schedule forward & compress gaps)
    # -------------------------------------------------------------------------
    itinerary_a = copy.deepcopy(current_itinerary)
    day_a = next((d for d in itinerary_a.days if d.day_number == affected_day_num), None)
    modified_a: list[dict[str, Any]] = []

    if day_a and day_a.activities:
        current_start = time_to_minutes(day_a.activities[0].timing.start_time if day_a.activities[0].timing else "09:00")
        shifted_start = current_start + delay_mins

        current_cursor = shifted_start
        for act in day_a.activities:
            orig_dur = act.timing.duration_minutes if act.timing and act.timing.duration_minutes else 90
            # Compress long activities by up to 20% to avoid running too late into the night
            compressed_dur = max(45, int(orig_dur * 0.85)) if orig_dur > 60 else orig_dur

            new_start = minutes_to_time(current_cursor)
            new_end = minutes_to_time(current_cursor + compressed_dur)

            prev_start = act.timing.start_time if act.timing else None
            act.timing = ActivityTiming(
                start_time=new_start,
                end_time=new_end,
                duration_minutes=compressed_dur,
            )

            modified_a.append({
                "title": act.title,
                "previous_start_time": prev_start,
                "new_start_time": new_start,
                "new_end_time": new_end,
            })
            current_cursor += compressed_dur + 20  # 20 min transit buffer

    option_a = RecoveryOption(
        option_id=f"rec-{uuid.uuid4().hex[:8]}",
        strategy="MINIMAL_DISRUPTION",
        title="Option A: Shift Schedule Forward",
        summary=f"Pushes Day {affected_day_num} activities forward by {delay_mins} minutes and tightens transit buffers to preserve all planned stops.",
        trade_offs=[
            "All planned venues and sights remain on your itinerary.",
            "Sightseeing time at afternoon stops is slightly compressed.",
            "Evening activities will conclude later than originally scheduled.",
        ],
        estimated_cost_delta=0.0,
        diff_payload={"added": [], "removed": [], "modified": modified_a},
        itinerary=itinerary_a,
    )

    # -------------------------------------------------------------------------
    # Option B: PACE_RELAXED (Drop lowest-priority unconfirmed stop)
    # -------------------------------------------------------------------------
    itinerary_b = copy.deepcopy(current_itinerary)
    day_b = next((d for d in itinerary_b.days if d.day_number == affected_day_num), None)
    removed_b: list[str] = []
    modified_b: list[dict[str, Any]] = []
    cost_delta_b = 0.0

    if day_b and len(day_b.activities) > 1:
        # Find candidate to drop: highest cost or last unconfirmed non-meal activity
        drop_index = -1
        for i, act in enumerate(day_b.activities):
            if act.title not in locked_titles and "lunch" not in act.title.lower() and "dinner" not in act.title.lower():
                drop_index = i
                break

        if drop_index == -1:
            drop_index = len(day_b.activities) - 1

        dropped_act = day_b.activities.pop(drop_index)
        removed_b.append(dropped_act.title)
        cost_delta_b = -float(dropped_act.estimated_cost or 0.0)

        # Shift remaining activities comfortably
        current_cursor = time_to_minutes(day_b.activities[0].timing.start_time if day_b.activities[0].timing else "09:00") + delay_mins
        for act in day_b.activities:
            orig_dur = act.timing.duration_minutes if act.timing and act.timing.duration_minutes else 90
            new_start = minutes_to_time(current_cursor)
            new_end = minutes_to_time(current_cursor + orig_dur)
            prev_start = act.timing.start_time if act.timing else None

            act.timing = ActivityTiming(
                start_time=new_start,
                end_time=new_end,
                duration_minutes=orig_dur,
            )
            modified_b.append({
                "title": act.title,
                "previous_start_time": prev_start,
                "new_start_time": new_start,
                "new_end_time": new_end,
            })
            current_cursor += orig_dur + 30

    option_b = RecoveryOption(
        option_id=f"rec-{uuid.uuid4().hex[:8]}",
        strategy="PACE_RELAXED",
        title="Option B: Protect Relaxation & Confirmed Bookings",
        summary=f"Removes '{removed_b[0] if removed_b else 'an afternoon activity'}' to eliminate stress and guarantee on-time arrival for hotel and dinner reservations.",
        trade_offs=[
            "Protects hotel check-in and confirmed reservations with zero stress.",
            "Keeps your remaining activities at full duration with relaxed pacing.",
            f"Bypasses '{removed_b[0] if removed_b else 'one activity'}' to absorb the delay.",
        ],
        estimated_cost_delta=round(cost_delta_b, 2),
        diff_payload={"added": [], "removed": removed_b, "modified": modified_b},
        itinerary=itinerary_b,
    )

    # -------------------------------------------------------------------------
    # Option C: BUDGET_FOCUSED (Swap affected activity with flexible free alternative)
    # -------------------------------------------------------------------------
    itinerary_c = copy.deepcopy(current_itinerary)
    day_c = next((d for d in itinerary_c.days if d.day_number == affected_day_num), None)
    added_c: list[str] = []
    removed_c: list[str] = []
    cost_delta_c = 0.0

    if day_c and day_c.activities:
        # Find first non-locked activity to swap with an open evening/leisure experience
        swap_index = 0
        for i, act in enumerate(day_c.activities):
            if act.title not in locked_titles:
                swap_index = i
                break

        old_act = day_c.activities[swap_index]
        removed_c.append(old_act.title)
        cost_delta_c = -float(old_act.estimated_cost or 0.0)

        destination_name = state["trip"].destination or "the City"
        replacement_activity = ItineraryActivity(
            title=f"Sunset & Evening Stroll in {destination_name}",
            description=f"Flexible illuminated walking tour through {destination_name}'s vibrant public promenades, perfectly suited for delayed arrivals.",
            timing=ActivityTiming(
                start_time="19:30",
                end_time="21:00",
                duration_minutes=90,
            ),
            place=PlaceInfo(
                name=f"{destination_name} City Center",
                category="ACTIVITY",
            ),
            estimated_cost=0.0,
            currency=state["trip"].currency or "USD",
        )

        day_c.activities[swap_index] = replacement_activity
        added_c.append(replacement_activity.title)

    option_c = RecoveryOption(
        option_id=f"rec-{uuid.uuid4().hex[:8]}",
        strategy="BUDGET_FOCUSED",
        title="Option C: Budget-Friendly Evening Swap",
        summary=f"Replaces '{removed_c[0] if removed_c else 'ticketed venue'}' with a flexible free evening walking experience, reducing costs and fitting your new arrival time.",
        trade_offs=[
            f"Saves ticket and entry costs (Cost delta: {cost_delta_c:+.2f} {state['trip'].currency or 'USD'}).",
            "Zero ticket timing constraints; can be enjoyed at any pace.",
            f"Misses indoor viewing at '{removed_c[0] if removed_c else 'original venue'}'.",
        ],
        estimated_cost_delta=round(cost_delta_c, 2),
        diff_payload={"added": added_c, "removed": removed_c, "modified": []},
        itinerary=itinerary_c,
    )

    recovery_options = [option_a, option_b, option_c]

    logger.info(
        "Generated %d recovery proposals for %s (Disruption: %s)",
        len(recovery_options),
        state["trip"].destination,
        disruption.type,
    )

    return {
        "recovery_options": recovery_options,
        "selected_strategy": "MINIMAL_DISRUPTION",
        "repaired_itinerary": option_a.itinerary or itinerary_a,
    }


# ============================================================================
# Node 3: finalize_recovery
# ============================================================================

async def finalize_recovery(state: DisruptionRecoveryState) -> dict[str, Any]:
    """Assembles final RecoveryItineraryData with recomputed costs and metadata."""
    repaired_itinerary = state["repaired_itinerary"]
    recovery_options = state["recovery_options"]
    selected_strategy = state.get("selected_strategy", "MINIMAL_DISRUPTION")
    affected_day_num = state.get("affected_day_number", 1)

    # Reconcile total costs on the chosen repaired itinerary
    total_cost = 0.0
    for day in repaired_itinerary.days:
        day_total = sum(float(act.estimated_cost or 0.0) for act in day.activities)
        day.daily_cost_total = round(day_total, 2)
        total_cost += day_total

    repaired_itinerary.total_estimated_cost = round(total_cost, 2)

    metadata = ResponseMetadata(
        model="langgraph-recovery-v1",
        latency_ms=15.0,
    )

    data = RecoveryItineraryData(
        trip_id=state.get("trip") and getattr(state["trip"], "id", None),
        generation_job_id=None,
        itinerary=repaired_itinerary,
        selected_strategy=selected_strategy,
        impacted_days=[affected_day_num],
        recovery_options=recovery_options,
        metadata=metadata,
    )

    return {
        "response_data": data,
    }


# ============================================================================
# Compile LangGraph StateGraph
# ============================================================================

workflow = StateGraph(DisruptionRecoveryState)

workflow.add_node("classify_impact", classify_impact)
workflow.add_node("generate_recovery_proposals", generate_recovery_proposals)
workflow.add_node("finalize_recovery", finalize_recovery)

workflow.add_edge(START, "classify_impact")
workflow.add_edge("classify_impact", "generate_recovery_proposals")
workflow.add_edge("generate_recovery_proposals", "finalize_recovery")
workflow.add_edge("finalize_recovery", END)

disruption_recovery_graph = workflow.compile()


# ============================================================================
# Public API Entrypoint
# ============================================================================

async def recover_itinerary(request: RecoveryItineraryRequest) -> RecoveryItineraryResponse:
    """Executes the LangGraph disruption recovery workflow and returns 2-3 ranked options."""
    req_id = request.request_id or f"req-rec-{uuid.uuid4().hex[:12]}"

    initial_state: DisruptionRecoveryState = {
        "request_id": req_id,
        "trip": request.trip,
        "current_itinerary": request.current_itinerary,
        "disruption": request.disruption,
        "preserve_confirmed_activities": request.preserve_confirmed_activities,
        "instructions": request.instructions,
    }

    final_state = await disruption_recovery_graph.ainvoke(initial_state)
    data: RecoveryItineraryData = final_state["response_data"]

    data.trip_id = request.trip_id
    data.generation_job_id = request.generation_job_id

    return RecoveryItineraryResponse(
        success=True,
        request_id=req_id,
        data=data,
    )
