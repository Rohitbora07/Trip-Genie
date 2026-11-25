import asyncio
import logging
import time
from datetime import timedelta
from typing import Any

from langgraph.graph import END, START, StateGraph

from app.prompts import render_itinerary_prompt
from app.schemas.api import GenerationOptions
from app.schemas.itinerary import ItineraryOutput, PlaceInfo
from app.schemas.trip import TripInput
from app.services.llm_service import LLMService, llm_service
from app.tools.places import (
    build_viewbox,
    fetch_regional_travel_guide,
    is_informative_place_name,
    search_places,
)
from app.tools.validators import validate_budget_cap, validate_schedule_chronology
from app.tools.weather import get_weather_forecast
from app.workflows.state import ItineraryGenerationState

logger = logging.getLogger("app.workflows.generation")

MAX_REPAIR_ATTEMPTS = 2


# ============================================================================
# Node 1: analyze_requirements
# ============================================================================

async def analyze_requirements(state: ItineraryGenerationState) -> dict[str, Any]:
    """Node 1: Calculates daily pace limits, budget distribution, and constraint profiles."""
    trip: TripInput = state["trip"]
    pace = trip.preferences.pace if trip.preferences and trip.preferences.pace else "moderate"

    # Daily pace mapping
    if pace == "relaxed":
        max_daily_activities = 3
        pace_instruction = "Relaxed pace: schedule 2 to 3 well-spaced activities per day with ample leisure time."
    elif pace == "packed":
        max_daily_activities = 6
        pace_instruction = "Packed pace: schedule 4 to 6 activities per day, maximizing sightseeing and experiences."
    else:
        max_daily_activities = 4
        pace_instruction = "Moderate pace: schedule 3 to 4 activities per day with balanced timing and meal breaks."

    # Daily budget distribution
    daily_budget: float | None = None
    if trip.budget is not None and trip.budget > 0:
        daily_budget = round(trip.budget / max(1, trip.duration_days), 2)

    dietary = trip.constraints.dietary if trip.constraints else []
    accessibility = trip.constraints.accessibility if trip.constraints else []
    interests = trip.preferences.interests if trip.preferences else []

    requirements = {
        "pace": pace,
        "max_daily_activities": max_daily_activities,
        "pace_instruction": pace_instruction,
        "total_budget": trip.budget,
        "daily_budget": daily_budget,
        "currency": trip.currency,
        "dietary": dietary,
        "accessibility": accessibility,
        "interests": interests,
    }

    logger.info(
        "Workflow analyze_requirements complete for %s: pace=%s, daily_budget=%s %s",
        trip.destination,
        pace,
        daily_budget,
        trip.currency,
    )
    return {"requirements": requirements}


# ============================================================================
# Node 2: research_places_and_weather
# ============================================================================

def _pick_best_candidate(
    candidates: list[dict[str, Any]],
    destination: str,
) -> dict[str, Any] | None:
    """Selects the candidate with real coordinates best matching the requested destination tokens."""
    valid = [
        c
        for c in candidates
        if c.get("latitude") is not None and c.get("longitude") is not None
    ]
    if not valid:
        return None

    hints = [part.strip().lower() for part in destination.split(",")[1:] if part.strip()]
    if not hints:
        return valid[0]

    def score(cand: dict[str, Any]) -> int:
        haystack = " ".join(
            str(cand.get(k) or "")
            for k in ("display_name", "address", "county", "state_district", "state", "country")
        ).lower()
        return sum(1 for h in hints if h in haystack)

    return max(valid, key=score)


async def research_places_and_weather(state: ItineraryGenerationState) -> dict[str, Any]:
    """Node 2: Concurrently executes Nominatim geocoding, bounded POI discovery, and Open-Meteo weather tools."""
    trip: TripInput = state["trip"]

    # Step 1: Resolve primary destination coordinates & administrative hierarchy
    dest_res = await search_places(trip.destination, limit=5)
    dest_candidates = dest_res.get("candidates", []) if isinstance(dest_res, dict) else []
    resolved_dest = _pick_best_candidate(dest_candidates, trip.destination)

    # Step 2: If full "Place, State, Country" returned 0 valid hits (common for rural hamlets/towns),
    # try just the primary place name first (e.g. "Bora Bunga" -> Didihat, Pithoragarh, Uttarakhand)
    if resolved_dest is None and "," in trip.destination:
        primary_name = trip.destination.split(",")[0].strip()
        if primary_name:
            primary_res = await search_places(primary_name, limit=5)
            primary_candidates = (
                primary_res.get("candidates", []) if isinstance(primary_res, dict) else []
            )
            resolved_dest = _pick_best_candidate(primary_candidates, trip.destination)
            if primary_candidates:
                dest_candidates = primary_candidates

    # Step 3: Broader region fallback only if even the primary place name returned no coordinates
    if resolved_dest is None and "," in trip.destination:
        broader_region = trip.destination.split(",", 1)[1].strip()
        if broader_region:
            broader_res = await search_places(broader_region, limit=5)
            broader_candidates = (
                broader_res.get("candidates", []) if isinstance(broader_res, dict) else []
            )
            resolved_dest = _pick_best_candidate(broader_candidates, trip.destination)
            if broader_candidates:
                dest_candidates = broader_candidates

    lat: float | None = resolved_dest.get("latitude") if resolved_dest else None
    lon: float | None = resolved_dest.get("longitude") if resolved_dest else None

    resolved_location: dict[str, Any] = {}
    attr_candidates: list[dict[str, Any]] = []

    if lat is not None and lon is not None and resolved_dest is not None:
        viewbox = build_viewbox(float(lat), float(lon), radius_deg=0.45)
        resolved_location = {
            "name": resolved_dest.get("name") or trip.destination.split(",")[0].strip(),
            "display_name": resolved_dest.get("display_name") or resolved_dest.get("address") or trip.destination,
            "county": resolved_dest.get("county"),
            "state_district": resolved_dest.get("state_district"),
            "state": resolved_dest.get("state"),
            "country": resolved_dest.get("country"),
            "latitude": float(lat),
            "longitude": float(lon),
            "viewbox": viewbox,
        }

        # Step 4: Bounded local POI discovery + district-level attraction search + real weather
        poi_terms = ["attraction", "temple", "viewpoint", "hotel", "restaurant"]
        poi_tasks = [
            search_places(term, limit=5, viewbox=viewbox, bounded=True)
            for term in poi_terms
        ]
        district_anchor = (
            resolved_dest.get("county")
            or resolved_dest.get("state_district")
            or trip.destination
        )
        poi_tasks.append(
            search_places(
                f"attractions in {district_anchor}",
                limit=5,
                viewbox=viewbox,
                bounded=False,
            )
        )
        weather_task = get_weather_forecast(
            latitude=float(lat),
            longitude=float(lon),
            start_date=trip.start_date,
            end_date=trip.end_date,
        )

        guide_terms = [
            t
            for t in (
                resolved_dest.get("county"),
                resolved_dest.get("state_district"),
                resolved_dest.get("name"),
            )
            if t
        ]
        should_fetch_guide = bool(resolved_dest.get("display_name") and guide_terms)

        if should_fetch_guide:
            guide_task = fetch_regional_travel_guide(guide_terms)
            gathered = await asyncio.gather(
                *poi_tasks, weather_task, guide_task, return_exceptions=True
            )
            poi_results = gathered[:-2]
            weather_raw = gathered[-2]
            travel_guide_summary = gathered[-1] if isinstance(gathered[-1], str) else ""
        else:
            gathered = await asyncio.gather(*poi_tasks, weather_task, return_exceptions=True)
            poi_results = gathered[:-1]
            weather_raw = gathered[-1]
            travel_guide_summary = ""

        for r in poi_results:
            if isinstance(r, dict) and isinstance(r.get("candidates"), list):
                attr_candidates.extend(r["candidates"])

        weather_res = (
            weather_raw
            if isinstance(weather_raw, dict)
            else {"status": "fallback", "estimated": True, "forecasts": [], "note": "Weather lookup unavailable"}
        )
    else:
        travel_guide_summary = ""
        # Un-geocoded fallback
        attr_res, weather_raw = await asyncio.gather(
            search_places(f"top attractions in {trip.destination}", limit=5),
            get_weather_forecast(
                latitude=35.0,
                longitude=135.0,
                start_date=trip.start_date,
                end_date=trip.end_date,
            ),
            return_exceptions=True,
        )
        if isinstance(attr_res, dict):
            attr_candidates = attr_res.get("candidates", [])
        weather_res = (
            weather_raw
            if isinstance(weather_raw, dict)
            else {"status": "fallback", "estimated": True, "forecasts": []}
        )
        weather_res["note"] = "Seasonal estimate for un-geocoded destination"

    # Convert candidates into verified PlaceInfo schemas (filtering generic/highway OSM tags)
    candidate_places: list[PlaceInfo] = []
    seen_names: set[str] = set()

    for item in attr_candidates + dest_candidates:
        name = item.get("name")
        if not is_informative_place_name(name) or name.lower() in seen_names:
            continue
        seen_names.add(name.lower())

        candidate_places.append(
            PlaceInfo(
                name=name,
                address=item.get("address") or item.get("display_name"),
                category=item.get("category", "ATTRACTION"),
                latitude=item.get("latitude"),
                longitude=item.get("longitude"),
            )
        )

    logger.info(
        "Workflow research_places_and_weather complete for %s (resolved=%s): %d candidate places, guide_len=%d, weather estimated=%s",
        trip.destination,
        resolved_location.get("display_name", "unresolved"),
        len(candidate_places),
        len(travel_guide_summary),
        weather_res.get("estimated", True),
    )
    return {
        "resolved_location": resolved_location,
        "travel_guide_summary": travel_guide_summary,
        "candidate_places": candidate_places,
        "weather_summary": weather_res,
    }


# ============================================================================
# Node 3: draft_itinerary
# ============================================================================

def _build_grounded_prompt(state: ItineraryGenerationState) -> tuple[str, str]:
    """Renders the prompt injected with grounded places, weather, and requirement context."""
    trip = state["trip"]
    requirements = state.get("requirements", {})
    weather = state.get("weather_summary", {})
    places = state.get("candidate_places", [])
    resolved = state.get("resolved_location", {})
    travel_guide = state.get("travel_guide_summary", "")

    base_rendered = render_itinerary_prompt(trip)
    system_prompt = base_rendered.system_prompt

    user_lines = [base_rendered.user_prompt, "", "### REAL-WORLD GROUNDING CONTEXT:"]

    # Inject verified geographic anchor
    primary_dest_name = trip.destination.split(",")[0].strip()
    region_parts = [
        resolved.get(k)
        for k in ("county", "state_district", "state", "country")
        if resolved.get(k)
    ]
    region_label = ", ".join(region_parts) if region_parts else trip.destination

    if resolved:
        user_lines.append(
            f"- Verified Destination Location: {resolved.get('display_name')} "
            f"(Coordinates: {resolved.get('latitude')}, {resolved.get('longitude')})"
        )
        user_lines.append(f"- Administrative District / Region: {region_label}")

    if travel_guide:
        user_lines.append(f"\n### REAL-WORLD REGIONAL TRAVEL GUIDE:\n{travel_guide}\n")

    # Inject requirements
    if requirements:
        user_lines.append(f"- Pacing Guidance: {requirements.get('pace_instruction')}")
        if requirements.get("daily_budget") is not None:
            user_lines.append(
                f"- Target Daily Budget: ~{requirements['daily_budget']:.2f} {requirements['currency']} per day"
            )

    # Inject grounded places
    if places:
        formatted_places = [
            f"{p.name} ({p.category}" + (f" - {p.address}" if p.address else "") + ")"
            for p in places[:18]
        ]
        user_lines.append(
            f"- Verified Nearby OpenStreetMap Venues around {primary_dest_name} ({region_label}):\n  * "
            + "\n  * ".join(formatted_places)
        )

    # Inject weather context
    if weather and "forecasts" in weather:
        forecasts = weather.get("forecasts", [])
        weather_notes: list[str] = []
        for f in forecasts[:5]:
            t_max = f.get("temperature_2m_max")
            p_prob = f.get("precipitation_probability_max")
            weather_notes.append(f"{f.get('date')}: max {t_max}°C, rain {p_prob}%")
        user_lines.append(f"- Weather Outlook: {'; '.join(weather_notes)}")
        if weather.get("estimated"):
            user_lines.append(f"  (Note: {weather.get('note')})")

    max_acts = requirements.get("max_daily_activities", 4) if requirements else 4
    base_town = resolved.get("county") or resolved.get("state_district") or primary_dest_name
    user_lines.append(
        "\nIMPORTANT SCHEDULING & GEOGRAPHY RULES:\n"
        "1. Every activity in a day must strictly have start_time >= previous activity's end_time.\n"
        "2. Ensure activities leave at least 15-30 minutes for transit/transition between venues.\n"
        "3. Sum of estimated costs across all days should not exceed the requested budget.\n"
        f"4. Keep each day concise: schedule around {max_acts} key activities per day with brief 1-sentence descriptions and standard ASCII punctuation.\n"
        f"5. STRICT GEOGRAPHIC ACCURACY: Keep ALL hotels, restaurants, temples, viewpoints, and local activities inside {region_label}"
        + (f" near ({resolved['latitude']}, {resolved['longitude']})" if resolved.get("latitude") is not None else "")
        + f". NEVER substitute distant cities from elsewhere in the state/country.\n"
        f"6. NO FABRICATED VENUES: Strongly prefer the Verified Nearby OpenStreetMap Venues listed above or authentic, real-world places in {base_town} / {region_label}. Never invent fake hotels or waterfalls just by adding 'Resort', 'Lounge', 'Trail', or 'Waterfall' to '{primary_dest_name}' or an existing hotel name.\n"
        f"7. VENUE DIVERSITY: Never schedule the exact same restaurant or cafe more than once on the same day. Spread meals and sightseeing across diverse local spots, viewpoints, temples, markets, and villages in {region_label}."
    )

    return system_prompt, "\n".join(user_lines)


async def draft_itinerary(state: ItineraryGenerationState) -> dict[str, Any]:
    """Node 3: Prompts Groq with grounded place names and weather context to generate or repair the itinerary."""
    active_llm: LLMService = state.get("llm") or llm_service
    options: GenerationOptions | None = state.get("options")
    trip: TripInput = state["trip"]

    repair_prompt = state.get("repair_prompt")

    start_time = time.perf_counter()
    if repair_prompt:
        logger.info(
            "Drafting itinerary REPAIR attempt %d for %s",
            state.get("repair_attempts", 1),
            trip.destination,
        )
        system_prompt = "You are an expert itinerary repair specialist. Correct all reported schedule and budget errors."
        user_prompt = repair_prompt
    else:
        logger.info("Drafting INITIAL itinerary for %s", trip.destination)
        system_prompt, user_prompt = _build_grounded_prompt(state)

    llm_resp = await active_llm.generate_structured(
        prompt=user_prompt,
        response_model=ItineraryOutput,
        system_prompt=system_prompt,
        model=options.model if options else None,
        temperature=options.temperature if options else None,
        max_tokens=options.max_tokens if options else None,
    )

    latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
    metadata = {
        "model": llm_resp.model,
        "latency_ms": latency_ms,
        "usage": llm_resp.usage,
    }

    return {
        "draft_itinerary": llm_resp.content,
        "repair_prompt": None,
        "metadata": metadata,
    }


# ============================================================================
# Node 4: validate_constraints
# ============================================================================

async def validate_constraints(state: ItineraryGenerationState) -> dict[str, Any]:
    """Node 4: Runs pure Python deterministic checks from app/tools/validators.py."""
    draft = state.get("draft_itinerary")
    trip = state["trip"]

    if not draft or not draft.days:
        return {"violations": ["Draft itinerary contains no days"]}

    violations: list[str] = []

    # 1. Chronology check: start_time(i+1) >= end_time(i)
    chronology_result = validate_schedule_chronology(draft.days)
    if not chronology_result["is_valid"]:
        violations.extend(chronology_result["violations"])

    # 2. Budget cap check: sum(estimated_cost) <= budget * 1.10
    budget_result = validate_budget_cap(draft, trip.budget, tolerance_pct=0.10)
    if not budget_result["is_valid"]:
        violations.extend(budget_result["violations"])

    logger.info(
        "Workflow validate_constraints for %s: %d violations found",
        trip.destination,
        len(violations),
    )
    return {"violations": violations}


# ============================================================================
# Conditional Edge: should_repair_or_finalize
# ============================================================================

def should_repair_or_finalize(state: ItineraryGenerationState) -> str:
    """Decision diamond: Checks if violations were found and whether repair budget remains."""
    violations = state.get("violations", [])
    repair_attempts = state.get("repair_attempts", 0)

    if not violations:
        logger.info("Validation passed without violations. Routing to finalize_output.")
        return "finalize_output"

    if repair_attempts < MAX_REPAIR_ATTEMPTS:
        logger.info(
            "Validation found %d violations; repair_attempts=%d < %d. Routing to repair_itinerary.",
            len(violations),
            repair_attempts,
            MAX_REPAIR_ATTEMPTS,
        )
        return "repair_itinerary"

    logger.warning(
        "Validation violations remain but exhausted max attempts (%d). Attaching warnings and finalizing.",
        MAX_REPAIR_ATTEMPTS,
    )
    return "finalize_output"


# ============================================================================
# Node 5: repair_itinerary
# ============================================================================

async def repair_itinerary(state: ItineraryGenerationState) -> dict[str, Any]:
    """Node 5: Appends structured error messages to the repair prompt (max 2 attempts)."""
    current_attempts = state.get("repair_attempts", 0) + 1
    violations = state.get("violations", [])
    draft = state.get("draft_itinerary")
    trip = state["trip"]

    violations_text = "\n".join(f"- {v}" for v in violations)
    draft_summary_text = ""
    if draft:
        draft_summary_text = (
            f"Draft Title: {draft.title}\n"
            f"Current Total Cost: {draft.total_estimated_cost} {draft.currency}\n"
            f"Days count: {len(draft.days)}\n"
        )

    repair_prompt = (
        f"Your previously drafted itinerary for {trip.destination} ({trip.duration_days} days) "
        f"has {len(violations)} deterministic constraint violation(s):\n\n"
        f"VIOLATIONS DETECTED:\n"
        f"{violations_text}\n\n"
        f"{draft_summary_text}\n"
        f"REQUIRED REPAIR ACTIONS:\n"
        f"1. Fix every schedule overlap: adjust start_time and end_time so that within every day, "
        f"each activity begins after the previous activity ends.\n"
        f"2. Fix budget overages: ensure total cost does not exceed {trip.budget} {trip.currency}.\n"
        f"3. Return a completely valid, full {ItineraryOutput.__name__} JSON object."
    )

    return {
        "repair_attempts": current_attempts,
        "repair_prompt": repair_prompt,
    }


# ============================================================================
# Node 6: finalize_output
# ============================================================================

async def _ground_output_coordinates(
    draft: ItineraryOutput,
    candidate_places: list[PlaceInfo],
    resolved_location: dict[str, Any],
) -> None:
    """Populates real GPS coordinates on generated PlaceInfo objects from candidates or Nominatim."""
    by_name: dict[str, PlaceInfo] = {}
    for cand in candidate_places:
        if cand.latitude is not None and cand.longitude is not None:
            by_name[cand.name.strip().lower()] = cand

    viewbox = resolved_location.get("viewbox") if resolved_location else None
    region_hint = ", ".join(
        str(resolved_location.get(k))
        for k in ("county", "state_district", "state", "country")
        if resolved_location.get(k)
    )

    pending_places: list[PlaceInfo] = []
    for day in draft.days:
        for act in day.activities:
            place = act.place
            if place.latitude is not None and place.longitude is not None:
                continue
            norm = place.name.strip().lower()
            matched = by_name.get(norm)
            if not matched:
                for cand_key, cand_val in by_name.items():
                    if len(cand_key) >= 5 and (cand_key in norm or norm in cand_key):
                        matched = cand_val
                        break
            if matched:
                place.latitude = matched.latitude
                place.longitude = matched.longitude
                if not place.address and matched.address:
                    place.address = matched.address
            elif resolved_location:
                pending_places.append(place)

    if not pending_places:
        return

    # Deduplicate Nominatim lookups for remaining un-geocoded places
    unique_names: list[str] = []
    seen_queries: set[str] = set()
    for p in pending_places:
        key = p.name.strip().lower()
        if key and key not in seen_queries:
            seen_queries.add(key)
            unique_names.append(p.name.strip())

    # Cap external lookups at 8 per generation to stay responsive and polite to Nominatim
    unique_names = unique_names[:8]

    dest_lat = resolved_location.get("latitude") if resolved_location else None
    dest_lon = resolved_location.get("longitude") if resolved_location else None

    def _is_geographically_plausible(cand: dict[str, Any], place_category: str | None) -> bool:
        clat = cand.get("latitude")
        clon = cand.get("longitude")
        if clat is None or clon is None:
            return False
        if dest_lat is None or dest_lon is None:
            return True
        if place_category in {"AIRPORT", "TRANSIT"}:
            return True
        # Local restaurants, hotels, temples, and sights should stay within ~2.2 degrees (~240km)
        return abs(float(clat) - float(dest_lat)) <= 2.2 and abs(float(clon) - float(dest_lon)) <= 2.2

    category_by_name = {
        p.name.strip().lower(): p.category for p in pending_places if p.name
    }

    async def lookup_one(place_name: str) -> tuple[str, dict[str, Any] | None]:
        cat = category_by_name.get(place_name.lower())
        query = (
            f"{place_name}, {region_hint}"
            if region_hint and region_hint.split(",")[0].lower() not in place_name.lower()
            else place_name
        )
        res = await search_places(query, limit=2, viewbox=viewbox, bounded=False)
        cands = res.get("candidates", []) if isinstance(res, dict) else []
        for c in cands:
            if _is_geographically_plausible(c, cat):
                return place_name.lower(), c
        # Retry bare name strictly bounded inside local viewbox (never global LA/Australia matches!)
        if query != place_name and viewbox and cat not in {"AIRPORT", "TRANSIT"}:
            res2 = await search_places(place_name, limit=2, viewbox=viewbox, bounded=True)
            cands2 = res2.get("candidates", []) if isinstance(res2, dict) else []
            for c in cands2:
                if _is_geographically_plausible(c, cat):
                    return place_name.lower(), c
        return place_name.lower(), None

    lookups = await asyncio.gather(*(lookup_one(n) for n in unique_names), return_exceptions=True)
    geo_map: dict[str, dict[str, Any]] = {}
    for item in lookups:
        if isinstance(item, tuple) and item[1] is not None:
            geo_map[item[0]] = item[1]

    for p in pending_places:
        hit = geo_map.get(p.name.strip().lower())
        if hit:
            p.latitude = hit.get("latitude")
            p.longitude = hit.get("longitude")
            if not p.address and hit.get("address"):
                p.address = hit.get("address")


async def finalize_output(state: ItineraryGenerationState) -> dict[str, Any]:
    """Node 6: Backfills missing dates, attaches real GPS coordinates, reconciles costs, and produces final output."""
    draft = state.get("draft_itinerary")
    trip = state["trip"]
    violations = state.get("violations", [])
    repair_attempts = state.get("repair_attempts", 0)
    candidate_places = state.get("candidate_places", [])
    resolved_location = state.get("resolved_location", {})

    if draft is None:
        raise ValueError("Cannot finalize itinerary: draft_itinerary is None in workflow state.")

    # 1. Date backfill
    for day in draft.days:
        if day.date is None:
            day.date = trip.start_date + timedelta(days=day.day_number - 1)

    # 2. Ground GPS coordinates on generated places for live map plotting
    await _ground_output_coordinates(draft, candidate_places, resolved_location)

    # 3. Cost reconciliation
    for day in draft.days:
        day.daily_cost_total = round(sum(act.estimated_cost for act in day.activities), 2)
    draft.total_estimated_cost = round(sum(d.daily_cost_total for d in draft.days), 2)

    # 4. Handle non-fatal warnings if repair attempts exhausted with violations remaining
    warnings: list[str] = []
    if violations and repair_attempts >= MAX_REPAIR_ATTEMPTS:
        warnings = list(violations)
        notice = f"Note: Itinerary contains {len(warnings)} non-fatal schedule/budget warning(s)."
        if notice not in draft.highlights:
            draft.highlights.append(notice)

    logger.info(
        "Workflow finalize_output complete for %s: %d days, total_cost=%.2f %s, warnings=%d",
        trip.destination,
        len(draft.days),
        draft.total_estimated_cost,
        draft.currency,
        len(warnings),
    )

    return {
        "final_output": draft,
        "warnings": warnings,
    }


# ============================================================================
# Build and Compile LangGraph StateGraph
# ============================================================================

def build_itinerary_generation_graph() -> Any:
    """Builds and compiles the StateGraph workflow for itinerary generation."""
    workflow = StateGraph(ItineraryGenerationState)

    # Add Nodes
    workflow.add_node("analyze_requirements", analyze_requirements)
    workflow.add_node("research_places_and_weather", research_places_and_weather)
    workflow.add_node("draft_itinerary", draft_itinerary)
    workflow.add_node("validate_constraints", validate_constraints)
    workflow.add_node("repair_itinerary", repair_itinerary)
    workflow.add_node("finalize_output", finalize_output)

    # Add Linear & Fan-out Edges
    workflow.add_edge(START, "analyze_requirements")
    workflow.add_edge("analyze_requirements", "research_places_and_weather")
    workflow.add_edge("research_places_and_weather", "draft_itinerary")
    workflow.add_edge("draft_itinerary", "validate_constraints")

    # Add Conditional Decision Diamond Edge
    workflow.add_conditional_edges(
        "validate_constraints",
        should_repair_or_finalize,
        {
            "repair_itinerary": "repair_itinerary",
            "finalize_output": "finalize_output",
        },
    )

    # Repair loops back to draft_itinerary
    workflow.add_edge("repair_itinerary", "draft_itinerary")

    # Finalize routes to END
    workflow.add_edge("finalize_output", END)

    return workflow.compile()


# Singleton compiled graph instance
generation_graph = build_itinerary_generation_graph()
