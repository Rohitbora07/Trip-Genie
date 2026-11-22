import logging
from typing import Any

import httpx

from app.schemas.itinerary import PlaceCategory

logger = logging.getLogger("app.tools.places")

NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
DEFAULT_USER_AGENT = "TripGenie/1.0 (ai-service@tripgenie.local; https://github.com/trip-genie)"
DEFAULT_TIMEOUT_SECONDS = 3.0


def classify_osm_category(osm_class: str | None, osm_type: str | None) -> PlaceCategory:
    """Classifies an OpenStreetMap result into a domain-specific PlaceCategory."""
    c = (osm_class or "").lower().strip()
    t = (osm_type or "").lower().strip()

    # Restaurant / Food & Beverage
    if c == "amenity" and t in {
        "restaurant",
        "cafe",
        "fast_food",
        "bar",
        "pub",
        "food_court",
        "bistro",
        "biergarten",
        "ice_cream",
    }:
        return "RESTAURANT"

    # Lodging / Accommodations
    if (c in {"tourism", "building"} and t in {
        "hotel",
        "hostel",
        "motel",
        "guest_house",
        "apartment",
        "chalet",
        "bed_and_breakfast",
        "resort",
    }) or t == "hotel":
        return "HOTEL"

    # Airport / Aviation
    if c == "aeroway" or t in {"airport", "aerodrome", "terminal", "airfield"}:
        return "AIRPORT"

    # Transit / Transport
    if c in {"railway", "public_transport"} or t in {
        "station",
        "subway",
        "subway_entrance",
        "bus_stop",
        "bus_station",
        "tram_stop",
        "ferry_terminal",
        "train_station",
        "transit_station",
    }:
        return "TRANSIT"

    # Cultural & Tourist Attractions
    if (c in {"tourism", "historic", "leisure"} and t in {
        "attraction",
        "museum",
        "artwork",
        "monument",
        "memorial",
        "castle",
        "ruins",
        "viewpoint",
        "theme_park",
        "zoo",
        "aquarium",
        "gallery",
        "archaeological_site",
    }) or c in {"historic", "heritage"}:
        return "ATTRACTION"

    # Activity / Sports / Recreation
    if c in {"leisure", "sport"} or t in {
        "stadium",
        "pitch",
        "sports_centre",
        "fitness_centre",
        "swimming_pool",
        "water_park",
        "golf_course",
        "park",
        "garden",
    }:
        return "ACTIVITY"

    return "OTHER"


def _format_address(display_name: str | None, address_obj: dict[str, Any] | None) -> str | None:
    """Formats address into a concise street / neighborhood / city string."""
    if not address_obj:
        return display_name

    parts: list[str] = []
    road = address_obj.get("road") or address_obj.get("pedestrian")
    house_number = address_obj.get("house_number")
    if road:
        if house_number:
            parts.append(f"{house_number} {road}")
        else:
            parts.append(road)

    neighborhood = (
        address_obj.get("neighbourhood")
        or address_obj.get("suburb")
        or address_obj.get("city_district")
    )
    if neighborhood:
        parts.append(neighborhood)

    city = (
        address_obj.get("city")
        or address_obj.get("town")
        or address_obj.get("village")
        or address_obj.get("municipality")
    )
    if city:
        parts.append(city)

    country = address_obj.get("country")
    if country:
        parts.append(country)

    if parts:
        return ", ".join(parts)
    return display_name


def parse_nominatim_item(item: dict[str, Any]) -> dict[str, Any]:
    """Extracts verified name, address, coordinates, and category from raw Nominatim JSON."""
    raw_name = item.get("name")
    display_name = item.get("display_name", "")
    address_obj = item.get("address") if isinstance(item.get("address"), dict) else None

    # Determine primary name
    name = raw_name if raw_name else display_name.split(",")[0].strip()
    if not name:
        name = "Unknown Location"

    # Parse coordinates safely
    lat_val: float | None = None
    lon_val: float | None = None
    try:
        if "lat" in item and item["lat"] is not None:
            lat_val = round(float(item["lat"]), 6)
        if "lon" in item and item["lon"] is not None:
            lon_val = round(float(item["lon"]), 6)
    except (ValueError, TypeError):
        lat_val = None
        lon_val = None

    category = classify_osm_category(
        osm_class=item.get("class"),
        osm_type=item.get("type"),
    )
    formatted_address = _format_address(display_name, address_obj)

    return {
        "name": name,
        "address": formatted_address,
        "latitude": lat_val,
        "longitude": lon_val,
        "category": category,
        "osm_id": item.get("osm_id"),
        "osm_type": item.get("osm_type"),
    }


def make_fallback_response(query: str, error_reason: str) -> dict[str, Any]:
    """Generates a structured fallback response when Nominatim request fails or times out."""
    return {
        "status": "fallback",
        "query": query,
        "candidates": [
            {
                "name": query.strip() or "Unknown Place",
                "address": None,
                "latitude": None,
                "longitude": None,
                "category": "OTHER",
                "osm_id": None,
                "osm_type": None,
            }
        ],
        "error": error_reason,
    }


async def search_places(
    query: str,
    limit: int = 5,
    user_agent: str = DEFAULT_USER_AGENT,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """Asynchronously calls OpenStreetMap Nominatim to resolve place candidates.
    
    Guarantees resilience: If network times out (default 3s) or fails, returns
    a clean fallback candidate dictionary instead of throwing an unhandled exception.
    """
    clean_query = query.strip()
    if not clean_query:
        return make_fallback_response(query, "Empty query string provided")

    params = {
        "q": clean_query,
        "format": "jsonv2",
        "limit": max(1, min(limit, 20)),
        "addressdetails": "1",
    }
    headers = {
        "User-Agent": user_agent,
        "Accept": "application/json",
    }

    try:
        if client is not None:
            response = await client.get(
                NOMINATIM_SEARCH_URL,
                params=params,
                headers=headers,
                timeout=timeout_seconds,
            )
        else:
            async with httpx.AsyncClient(timeout=timeout_seconds) as local_client:
                response = await local_client.get(
                    NOMINATIM_SEARCH_URL,
                    params=params,
                    headers=headers,
                )

        if response.status_code != 200:
            logger.warning(
                "Nominatim returned non-200 status %d for query '%s'",
                response.status_code,
                clean_query,
            )
            return make_fallback_response(
                clean_query,
                f"Nominatim returned HTTP {response.status_code}",
            )

        data = response.json()
        if not isinstance(data, list):
            logger.warning("Nominatim response unexpected payload structure: %s", type(data))
            return make_fallback_response(clean_query, "Unexpected Nominatim response structure")

        if not data:
            # No results found; return empty success candidates rather than crashing
            return {
                "status": "success",
                "query": clean_query,
                "candidates": [],
                "error": None,
            }

        candidates = [parse_nominatim_item(item) for item in data]
        return {
            "status": "success",
            "query": clean_query,
            "candidates": candidates,
            "error": None,
        }

    except httpx.TimeoutException:
        logger.warning(
            "Nominatim request timed out after %.1fs for query '%s'",
            timeout_seconds,
            clean_query,
        )
        return make_fallback_response(clean_query, f"Request timed out after {timeout_seconds}s")
    except httpx.RequestError as exc:
        logger.warning("Nominatim network request error for query '%s': %s", clean_query, exc)
        return make_fallback_response(clean_query, f"Network request error: {exc!s}")
    except Exception as exc:  # noqa: BLE001
        logger.error("Unhandled error querying Nominatim for query '%s': %s", clean_query, exc)
        return make_fallback_response(clean_query, f"Unexpected error: {exc!s}")
