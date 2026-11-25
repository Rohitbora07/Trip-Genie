import copy
import logging
import math
import time
from datetime import timedelta

from app.schemas.api import (
    OptimizeItineraryData,
    OptimizeItineraryRequest,
    OptimizeItineraryResponse,
    ResponseMetadata,
)
from app.schemas.itinerary import ActivityTiming, ItineraryActivity, ItineraryOutput
from app.tools.validators import validate_budget_cap, validate_schedule_chronology

logger = logging.getLogger("app.services.optimization_service")


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two GPS coordinates in kilometers."""
    radius_km = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return radius_km * c


def _calculate_route_distance(activities: list[ItineraryActivity]) -> float:
    """Calculates total transit distance in kilometers across consecutive activities with coordinates."""
    total_km = 0.0
    valid_coords: list[tuple[float, float]] = []
    for act in activities:
        if act.place.latitude is not None and act.place.longitude is not None:
            valid_coords.append((act.place.latitude, act.place.longitude))

    for i in range(len(valid_coords) - 1):
        total_km += haversine_distance_km(
            valid_coords[i][0],
            valid_coords[i][1],
            valid_coords[i + 1][0],
            valid_coords[i + 1][1],
        )
    return total_km


def _parse_hhmm_to_minutes(time_str: str) -> int:
    hours, minutes = time_str.split(":")
    return int(hours) * 60 + int(minutes)


def _minutes_to_hhmm(minutes: int) -> str:
    bounded = max(0, min(1439, minutes))
    h = bounded // 60
    m = bounded % 60
    return f"{h:02d}:{m:02d}"


def _optimize_day_geographic_clustering(
    activities: list[ItineraryActivity],
    day_number: int,
) -> tuple[list[ItineraryActivity], str | None]:
    """Re-orders activities within a day by coordinate proximity to minimize transit time."""
    if len(activities) <= 2:
        return activities, None

    # Filter activities that have valid GPS coordinates
    has_coords = [
        act.place.latitude is not None and act.place.longitude is not None
        for act in activities
    ]
    if sum(has_coords) < 3:
        return activities, None

    initial_distance = _calculate_route_distance(activities)

    # Nearest Neighbor routing: start with the first activity as day anchor
    unvisited = list(activities)
    ordered: list[ItineraryActivity] = [unvisited.pop(0)]

    while unvisited:
        last = ordered[-1]
        last_lat = last.place.latitude
        last_lon = last.place.longitude

        if last_lat is not None and last_lon is not None:
            best_idx = 0
            best_dist = float("inf")
            for idx, candidate in enumerate(unvisited):
                c_lat = candidate.place.latitude
                c_lon = candidate.place.longitude
                if c_lat is not None and c_lon is not None:
                    d = haversine_distance_km(last_lat, last_lon, c_lat, c_lon)
                    if d < best_dist:
                        best_dist = d
                        best_idx = idx
                else:
                    # If candidate has no coords, keep stable relative order
                    best_idx = idx
                    break
            ordered.append(unvisited.pop(best_idx))
        else:
            ordered.append(unvisited.pop(0))

    optimized_distance = _calculate_route_distance(ordered)
    saved_km = round(initial_distance - optimized_distance, 1)

    if saved_km <= 0.2:
        return activities, None

    # Re-calculate timing sequence: preserve duration, maintain 20-minute transit gaps
    current_start_min = _parse_hhmm_to_minutes(activities[0].timing.start_time)

    adjusted_activities: list[ItineraryActivity] = []
    for idx, act in enumerate(ordered):
        dur = act.timing.duration_minutes
        end_min = min(1430, current_start_min + dur)
        new_timing = ActivityTiming(
            start_time=_minutes_to_hhmm(current_start_min),
            end_time=_minutes_to_hhmm(end_min),
            duration_minutes=end_min - current_start_min,
        )

        adjusted_act = act.model_copy(
            update={
                "timing": new_timing,
                "notes": (
                    f"{act.notes}; Route-optimized"
                    if act.notes
                    else "Route-optimized for coordinate proximity"
                ),
            }
        )
        adjusted_activities.append(adjusted_act)
        # 20-minute buffer for transit between locations
        current_start_min = end_min + 20

    summary_msg = (
        f"Day {day_number}: Re-ordered {len(activities)} activities by coordinate proximity, "
        f"saving ~{saved_km} km of transit."
    )
    return adjusted_activities, summary_msg


def _trim_budget(
    itinerary: ItineraryOutput,
    target_budget: float,
) -> tuple[ItineraryOutput, list[str], float]:
    """Suggests cost-effective alternatives for highest-cost activities when budget cap is exceeded."""
    original_total = itinerary.total_estimated_cost
    if original_total <= target_budget:
        return itinerary, [], 0.0

    changes: list[str] = []
    current_total = original_total

    # Gather non-zero cost activities across all days
    costly_activities: list[tuple[int, int, ItineraryActivity]] = []
    for d_idx, day in enumerate(itinerary.days):
        for a_idx, act in enumerate(day.activities):
            if act.estimated_cost > 20.0:
                costly_activities.append((d_idx, a_idx, act))

    # Sort descending by cost
    costly_activities.sort(key=lambda item: item[2].estimated_cost, reverse=True)

    for d_idx, a_idx, act in costly_activities:
        if current_total <= target_budget:
            break

        old_cost = act.estimated_cost
        # Reduce cost by suggesting cost-effective alternative
        if old_cost >= 100.0:
            new_cost = round(old_cost * 0.40, 2)
            alt_title = f"{act.title} (Value Tier / Self-Guided)"
            alt_desc = f"{act.description} (Adjusted to self-guided admission/passes to optimize budget)."
        elif old_cost >= 50.0:
            new_cost = round(old_cost * 0.50, 2)
            alt_title = f"{act.title} (Standard Entry)"
            alt_desc = f"{act.description} (Optimized with standard entry rather than premium ticketing)."
        else:
            new_cost = round(old_cost * 0.60, 2)
            alt_title = f"{act.title} (Off-Peak Pass)"
            alt_desc = f"{act.description} (Optimized with advance off-peak discount)."

        saved = round(old_cost - new_cost, 2)
        current_total = round(current_total - saved, 2)

        updated_act = act.model_copy(
            update={
                "title": alt_title,
                "description": alt_desc,
                "estimated_cost": new_cost,
                "notes": f"Cost trimmed from {old_cost:.2f} to {new_cost:.2f} {itinerary.currency} for budget goal.",
            }
        )

        itinerary.days[d_idx].activities[a_idx] = updated_act
        changes.append(
            f"Day {itinerary.days[d_idx].day_number}: Trimmed '{act.title}' ({old_cost:.2f} {itinerary.currency}) "
            f"-> '{alt_title}' ({new_cost:.2f} {itinerary.currency}), saving {saved:.2f} {itinerary.currency}."
        )

    # Reconcile daily and total costs
    for day in itinerary.days:
        day.daily_cost_total = round(sum(a.estimated_cost for a in day.activities), 2)
    itinerary.total_estimated_cost = round(sum(d.daily_cost_total for d in itinerary.days), 2)

    delta = round(itinerary.total_estimated_cost - original_total, 2)
    return itinerary, changes, delta


def optimize_itinerary(
    request: OptimizeItineraryRequest,
) -> OptimizeItineraryResponse:
    """Executes geographic clustering and budget trimming according to the optimization_goal."""
    start_time = time.perf_counter()
    original_itinerary = request.current_itinerary
    goal = request.optimization_goal
    target_budget = (
        request.target_budget
        if request.target_budget is not None
        else request.trip.budget
    )

    # Deep copy to leave original untouched
    optimized = copy.deepcopy(original_itinerary)
    changes_summary: list[str] = []
    budget_delta = 0.0

    # 1. Geographic Clustering (Routing / Balanced / Pace)
    if goal in ("routing", "balanced", "pace"):
        for idx, day in enumerate(optimized.days):
            new_activities, change_note = _optimize_day_geographic_clustering(
                day.activities,
                day.day_number,
            )
            if change_note:
                optimized.days[idx].activities = new_activities
                changes_summary.append(change_note)

    # 2. Budget Trimming (Budget / Balanced)
    if goal in ("budget", "balanced") and target_budget is not None and target_budget > 0:
        optimized, budget_changes, delta = _trim_budget(optimized, target_budget)
        changes_summary.extend(budget_changes)
        budget_delta = delta

    # 3. Ensure date backfill and total cost consistency
    for day in optimized.days:
        if day.date is None:
            day.date = request.trip.start_date + timedelta(days=day.day_number - 1)
        day.daily_cost_total = round(sum(a.estimated_cost for a in day.activities), 2)
    optimized.total_estimated_cost = round(sum(d.daily_cost_total for d in optimized.days), 2)

    if not changes_summary:
        changes_summary.append(
            f"Itinerary was already optimal for goal '{goal}'. No major timing or cost adjustments were required."
        )

    # 4. Deterministic validation assertions
    chronology_res = validate_schedule_chronology(optimized.days)
    if not chronology_res["is_valid"]:
        logger.warning(
            "Optimized itinerary has chronology warnings: %s",
            chronology_res["violations"],
        )

    if target_budget:
        budget_res = validate_budget_cap(optimized, target_budget, tolerance_pct=0.10)
        if not budget_res["is_valid"]:
            logger.warning(
                "Optimized itinerary exceeds target budget cap: %s",
                budget_res["violations"],
            )

    latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
    effective_req_id = request.request_id or "req-optimize-01"

    return OptimizeItineraryResponse(
        success=True,
        request_id=effective_req_id,
        data=OptimizeItineraryData(
            trip_id=request.trip_id,
            generation_job_id=request.generation_job_id,
            itinerary=optimized,
            changes_summary=changes_summary,
            budget_delta=budget_delta,
            metadata=ResponseMetadata(
                model="deterministic-clustering-v1",
                latency_ms=latency_ms,
                usage=None,
            ),
        ),
    )
