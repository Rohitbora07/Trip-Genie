from collections.abc import Sequence
from typing import Any

from app.schemas.itinerary import ItineraryActivity, ItineraryDay, ItineraryOutput


def _parse_hhmm_to_minutes(time_str: str) -> int:
    """Converts a 24-hour HH:MM time string to minutes since midnight."""
    hours, minutes = time_str.strip().split(":")
    return int(hours) * 60 + int(minutes)


def _get_activity_timing(activity: Any) -> tuple[str, str, int, int]:
    """Extracts start_time, end_time, start_minutes, and end_minutes from an activity object or dict."""
    if isinstance(activity, ItineraryActivity):
        s_time = activity.timing.start_time
        e_time = activity.timing.end_time
    elif isinstance(activity, dict):
        timing = activity.get("timing", {})
        s_time = timing.get("start_time") or activity.get("start_time", "00:00")
        e_time = timing.get("end_time") or activity.get("end_time", "00:00")
    else:
        timing = getattr(activity, "timing", activity)
        s_time = getattr(timing, "start_time", "00:00")
        e_time = getattr(timing, "end_time", "00:00")

    s_min = _parse_hhmm_to_minutes(s_time)
    e_min = _parse_hhmm_to_minutes(e_time)
    return s_time, e_time, s_min, e_min


def _get_activity_title(activity: Any) -> str:
    """Extracts activity title from an activity object or dict."""
    if isinstance(activity, ItineraryActivity):
        return activity.title
    if isinstance(activity, dict):
        return activity.get("title") or activity.get("name") or "Untitled Activity"
    return getattr(activity, "title", "Untitled Activity")


def _get_activity_cost(activity: Any) -> float:
    """Extracts estimated cost from an activity object or dict."""
    if isinstance(activity, ItineraryActivity):
        return float(activity.estimated_cost)
    if isinstance(activity, dict):
        return float(activity.get("estimated_cost", 0.0) or 0.0)
    return float(getattr(activity, "estimated_cost", 0.0) or 0.0)


def _extract_days(data: Any) -> list[Any]:
    """Normalizes input into a list of day objects or day dicts."""
    if isinstance(data, ItineraryOutput):
        return list(data.days)
    if isinstance(data, dict) and "days" in data:
        return list(data["days"])
    if isinstance(data, (list, tuple)):
        return list(data)
    return []


def _extract_activities_from_day(day: Any) -> list[Any]:
    """Extracts activities list from a day object or day dict."""
    if isinstance(day, ItineraryDay):
        return list(day.activities)
    if isinstance(day, dict):
        return list(day.get("activities", []))
    return list(getattr(day, "activities", []))


def _get_day_number(day: Any, default_idx: int) -> int:
    """Extracts day number from a day object or day dict."""
    if isinstance(day, ItineraryDay):
        return day.day_number
    if isinstance(day, dict):
        return day.get("day_number", default_idx)
    return getattr(day, "day_number", default_idx)


# ============================================================================
# 1. Schedule Chronology Validator
# ============================================================================

def validate_schedule_chronology(days_input: Any) -> dict[str, Any]:
    """Verifies within each day that activity i+1 has start_time >= end_time of activity i.
    
    Guarantees that activities never overlap in physical schedule timing.
    Returns exact violation messages detailing which activities conflict.
    """
    days = _extract_days(days_input)
    violations: list[str] = []

    for day_idx, day in enumerate(days, start=1):
        day_num = _get_day_number(day, day_idx)
        activities = _extract_activities_from_day(day)

        for i in range(len(activities) - 1):
            curr_act = activities[i]
            next_act = activities[i + 1]

            curr_title = _get_activity_title(curr_act)
            next_title = _get_activity_title(next_act)

            try:
                _curr_s, curr_e, _curr_s_min, curr_e_min = _get_activity_timing(curr_act)
                next_s, _next_e, next_s_min, _next_e_min = _get_activity_timing(next_act)
            except Exception as exc:  # noqa: BLE001
                violations.append(
                    f"Day {day_num}: Invalid timing format between Activity {i + 1} and Activity {i + 2}: {exc}"
                )
                continue

            # Core chronology assertion: start_time(i+1) >= end_time(i)
            if next_s_min < curr_e_min:
                overlap_mins = curr_e_min - next_s_min
                violations.append(
                    f"Day {day_num}: Activity {i + 2} ('{next_title}' at {next_s}) starts {overlap_mins}m "
                    f"before Activity {i + 1} ('{curr_title}') ends at {curr_e} (overlap: {next_s} < {curr_e})."
                )

    return {
        "is_valid": len(violations) == 0,
        "violations": violations,
    }


# ============================================================================
# 2. Budget Cap Validator
# ============================================================================

def validate_budget_cap(
    itinerary_input: Any,
    budget_cap: float | None,
    tolerance_pct: float = 0.10,
) -> dict[str, Any]:
    """Verifies that sum(activity.estimated_cost) <= budget_cap * (1 + tolerance_pct).
    
    - Never trusts the LLM's own self-reported total sum; recalculates from bottom up.
    - If budget_cap is None, validation passes as unconstrained.
    - Default tolerance_pct is 0.10 (10% allowable flexibility).
    """
    days = _extract_days(itinerary_input)
    
    # Calculate bottom-up sum from raw activities
    total_cost = 0.0
    activity_count = 0
    for day in days:
        for activity in _extract_activities_from_day(day):
            total_cost += _get_activity_cost(activity)
            activity_count += 1

    total_cost = round(total_cost, 2)

    # Unconstrained budget case
    if budget_cap is None or budget_cap <= 0:
        return {
            "is_valid": True,
            "total_cost": total_cost,
            "budget_cap": budget_cap,
            "allowed_cap": None,
            "tolerance_pct": tolerance_pct,
            "exceeded_by": 0.0,
            "violations": [],
        }

    cap_float = float(budget_cap)
    allowed_cap = round(cap_float * (1.0 + tolerance_pct), 2)
    is_valid = total_cost <= allowed_cap
    exceeded_by = round(max(0.0, total_cost - allowed_cap), 2)

    violations: list[str] = []
    if not is_valid:
        violations.append(
            f"Total cost {total_cost:.2f} exceeds allowed budget cap {allowed_cap:.2f} "
            f"(target budget {cap_float:.2f} + {int(tolerance_pct * 100)}% tolerance) "
            f"by {exceeded_by:.2f} across {activity_count} activities."
        )

    return {
        "is_valid": is_valid,
        "total_cost": total_cost,
        "budget_cap": cap_float,
        "allowed_cap": allowed_cap,
        "tolerance_pct": tolerance_pct,
        "exceeded_by": exceeded_by,
        "violations": violations,
    }


# ============================================================================
# 3. Confirmed Reservation Preservation Validator
# ============================================================================

def _normalize_key(key: Any) -> str:
    """Normalizes an activity key string for robust case-insensitive comparison."""
    if isinstance(key, dict):
        # Extract title or id or composite key
        key_str = key.get("id") or key.get("key") or key.get("title") or ""
        timing = key.get("timing") or {}
        start_time = timing.get("start_time") if isinstance(timing, dict) else ""
        if start_time:
            key_str = f"{key_str}::{start_time}"
        return key_str.strip().lower()
    return str(key).strip().lower()


def _extract_activity_signatures(activity: Any) -> set[str]:
    """Generates all matching signature keys for an activity (title, composite title::start_time, id)."""
    signatures: set[str] = set()

    title = _get_activity_title(activity).strip().lower()
    if title:
        signatures.add(title)

    try:
        s_time, _, _, _ = _get_activity_timing(activity)
        if s_time and title:
            signatures.add(f"{title}::{s_time.lower()}")
    except (KeyError, ValueError, AttributeError):
        pass

    # Check for custom attributes or dictionary keys like id, booking_id, key
    if isinstance(activity, dict):
        for attr in ("id", "booking_id", "key", "confirmation_code"):
            val = activity.get(attr)
            if val:
                signatures.add(str(val).strip().lower())
    else:
        for attr in ("id", "booking_id", "key", "confirmation_code"):
            val = getattr(activity, attr, None)
            if val:
                signatures.add(str(val).strip().lower())

    return signatures


def validate_confirmed_preservation(
    new_days_input: Any,
    locked_activity_keys: Sequence[Any],
) -> dict[str, Any]:
    """Guarantees user-confirmed bookings were not deleted or modified during planning.
    
    Checks that every locked key (e.g. booking reference, activity title, or composite key)
    is preserved in the revised itinerary days.
    """
    days = _extract_days(new_days_input)
    
    # Collect all signatures present across all activities in the new days
    present_signatures: set[str] = set()
    for day in days:
        for activity in _extract_activities_from_day(day):
            present_signatures.update(_extract_activity_signatures(activity))

    missing_locked_keys: list[str] = []
    violations: list[str] = []

    for locked_item in locked_activity_keys:
        norm_key = _normalize_key(locked_item)
        if not norm_key:
            continue

        # Check if direct match or any partial signature matches
        is_preserved = norm_key in present_signatures

        # If key contains '::' (e.g. "Flight AA100::14:00"), also check title prefix
        if not is_preserved and "::" in norm_key:
            title_part = norm_key.split("::")[0].strip()
            if title_part in present_signatures:
                is_preserved = True

        if not is_preserved:
            missing_locked_keys.append(str(locked_item))
            violations.append(
                f"Confirmed booking '{locked_item}' was deleted or modified during itinerary generation."
            )

    return {
        "is_valid": len(violations) == 0,
        "missing_locked_keys": missing_locked_keys,
        "violations": violations,
    }
