import datetime
import logging
from typing import Any

import httpx

logger = logging.getLogger("app.tools.weather")

OPEN_METEO_BASE_URL = "https://api.open-meteo.com/v1/forecast"
FORECAST_WINDOW_DAYS = 16
DEFAULT_TIMEOUT_SECONDS = 3.0


def _parse_date(date_val: datetime.date | str) -> datetime.date:
    """Parses a date object or ISO date string (YYYY-MM-DD)."""
    if isinstance(date_val, datetime.date):
        return date_val
    return datetime.date.fromisoformat(str(date_val).strip())


def get_season(month: int, is_northern_hemisphere: bool) -> str:
    """Returns the season name ('winter', 'spring', 'summer', 'autumn') for a given month."""
    # Northern hemisphere season assignment
    if month in (12, 1, 2):
        north_season = "winter"
    elif month in (3, 4, 5):
        north_season = "spring"
    elif month in (6, 7, 8):
        north_season = "summer"
    else:
        north_season = "autumn"

    if is_northern_hemisphere:
        return north_season

    # Southern hemisphere inverts seasons
    inverted = {
        "winter": "summer",
        "spring": "autumn",
        "summer": "winter",
        "autumn": "spring",
    }
    return inverted[north_season]


def estimate_seasonal_climate(
    latitude: float,
    longitude: float,
    target_date: datetime.date,
) -> dict[str, Any]:
    """Estimates daily seasonal historical climate averages based on latitude and month.
    
    Provides reliable, zero-API-call approximations when dates are outside
    Open-Meteo's 16-day live forecast window or when network is unavailable.
    """
    abs_lat = abs(latitude)
    is_north = latitude >= 0.0
    season = get_season(target_date.month, is_north)

    # 1. Tropical / Equatorial Zone (0 - 23.5 degrees)
    if abs_lat <= 23.5:
        # Relatively constant high temperatures; monsoonal wet/dry seasons
        temp_max = 30.5
        # Months 6-9 in north tropics or 12-3 in south tropics typically wetter
        wet_months = {6, 7, 8, 9} if is_north else {12, 1, 2, 3}
        precip_prob = 50 if target_date.month in wet_months else 20

    # 2. Subtropical Zone (23.5 - 35.0 degrees)
    elif abs_lat <= 35.0:
        if season == "summer":
            temp_max = 32.0
            precip_prob = 25
        elif season == "winter":
            temp_max = 16.0
            precip_prob = 30
        elif season == "spring":
            temp_max = 24.0
            precip_prob = 25
        else:  # autumn
            temp_max = 23.0
            precip_prob = 20

    # 3. Temperate Zone (35.0 - 55.0 degrees)
    elif abs_lat <= 55.0:
        if season == "summer":
            temp_max = 25.0
            precip_prob = 30
        elif season == "winter":
            temp_max = 4.0
            precip_prob = 45
        elif season == "spring":
            temp_max = 16.0
            precip_prob = 35
        else:  # autumn
            temp_max = 14.0
            precip_prob = 35

    # 4. Subpolar / Polar Zone (> 55.0 degrees)
    else:
        if season == "summer":
            temp_max = 16.0
            precip_prob = 35
        elif season == "winter":
            temp_max = -5.0
            precip_prob = 40
        elif season == "spring":
            temp_max = 6.0
            precip_prob = 30
        else:  # autumn
            temp_max = 5.0
            precip_prob = 35

    return {
        "date": target_date.isoformat(),
        "temperature_2m_max": round(temp_max, 1),
        "precipitation_probability_max": int(precip_prob),
    }


def build_seasonal_estimate_payload(
    latitude: float,
    longitude: float,
    dates: list[datetime.date],
    custom_note: str = "Seasonal average based on latitude/season",
) -> dict[str, Any]:
    """Constructs the response dictionary for seasonal estimates."""
    daily_estimates = [
        estimate_seasonal_climate(latitude, longitude, d)
        for d in dates
    ]
    return {
        "status": "success",
        "estimated": True,
        "note": custom_note,
        "latitude": latitude,
        "longitude": longitude,
        "forecasts": daily_estimates,
    }


def is_within_forecast_window(
    target_date: datetime.date,
    reference_today: datetime.date | None = None,
) -> bool:
    """Checks whether the target date falls within the 16-day live forecast window."""
    today = reference_today or datetime.date.today()
    delta_days = (target_date - today).days
    return 0 <= delta_days < FORECAST_WINDOW_DAYS


async def get_weather_forecast(
    latitude: float,
    longitude: float,
    start_date: datetime.date | str,
    end_date: datetime.date | str | None = None,
    reference_today: datetime.date | None = None,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """Retrieves daily weather forecast using Open-Meteo (100% free, zero API key).
    
    Behavior:
    - If all requested dates are within the 16-day forecast horizon: calls Open-Meteo live API.
    - If dates fall outside the 16-day window: returns seasonal historical climate averages
      with {"estimated": True, "note": "Seasonal average based on latitude/season"}.
    - If the live network request fails or times out: gracefully falls back to seasonal
      averages with {"estimated": True, "note": "... (network fallback)"}.
    """
    s_date = _parse_date(start_date)
    e_date = _parse_date(end_date) if end_date else s_date
    if e_date < s_date:
        s_date, e_date = e_date, s_date

    today = reference_today or datetime.date.today()
    num_days = (e_date - s_date).days + 1
    requested_dates = [s_date + datetime.timedelta(days=i) for i in range(num_days)]

    # Check if any requested date falls outside the 16-day window from reference today
    all_within_window = all(is_within_forecast_window(d, today) for d in requested_dates)

    if not all_within_window:
        logger.info(
            "Dates %s to %s are beyond the 16-day forecast window. Returning seasonal climate averages.",
            s_date,
            e_date,
        )
        return build_seasonal_estimate_payload(
            latitude=latitude,
            longitude=longitude,
            dates=requested_dates,
            custom_note="Seasonal average based on latitude/season",
        )

    # Within 16 days: Query Open-Meteo live API
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "daily": "temperature_2m_max,precipitation_probability_max",
        "timezone": "auto",
        "forecast_days": 16,
    }

    try:
        if client is not None:
            response = await client.get(
                OPEN_METEO_BASE_URL,
                params=params,
                timeout=timeout_seconds,
            )
        else:
            async with httpx.AsyncClient(timeout=timeout_seconds) as local_client:
                response = await local_client.get(
                    OPEN_METEO_BASE_URL,
                    params=params,
                )

        if response.status_code != 200:
            logger.warning(
                "Open-Meteo returned status %d. Falling back to seasonal estimate.",
                response.status_code,
            )
            return build_seasonal_estimate_payload(
                latitude=latitude,
                longitude=longitude,
                dates=requested_dates,
                custom_note=f"Seasonal average based on latitude/season (Open-Meteo returned {response.status_code})",
            )

        data = response.json()
        daily = data.get("daily", {})
        times = daily.get("time", [])
        temp_maxes = daily.get("temperature_2m_max", [])
        precip_probs = daily.get("precipitation_probability_max", [])

        # Map dates to forecast objects
        forecast_by_date: dict[str, dict[str, Any]] = {}
        for idx, t_str in enumerate(times):
            t_max = temp_maxes[idx] if idx < len(temp_maxes) else None
            p_prob = precip_probs[idx] if idx < len(precip_probs) else None
            forecast_by_date[t_str] = {
                "date": t_str,
                "temperature_2m_max": round(float(t_max), 1) if t_max is not None else None,
                "precipitation_probability_max": int(p_prob) if p_prob is not None else None,
            }

        # Filter to requested dates
        matched_forecasts: list[dict[str, Any]] = []
        for d in requested_dates:
            d_str = d.isoformat()
            if d_str in forecast_by_date:
                matched_forecasts.append(forecast_by_date[d_str])
            else:
                # Fallback single day if not present in output
                matched_forecasts.append(estimate_seasonal_climate(latitude, longitude, d))

        return {
            "status": "success",
            "estimated": False,
            "note": "Live Open-Meteo forecast",
            "latitude": latitude,
            "longitude": longitude,
            "forecasts": matched_forecasts,
        }

    except httpx.TimeoutException:
        logger.warning(
            "Open-Meteo timed out after %.1fs. Falling back to seasonal estimate.",
            timeout_seconds,
        )
        return build_seasonal_estimate_payload(
            latitude=latitude,
            longitude=longitude,
            dates=requested_dates,
            custom_note="Seasonal average based on latitude/season (live forecast timed out)",
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Open-Meteo request failed: %s. Falling back to seasonal estimate.", exc)
        return build_seasonal_estimate_payload(
            latitude=latitude,
            longitude=longitude,
            dates=requested_dates,
            custom_note=f"Seasonal average based on latitude/season (live forecast unavailable: {exc!s})",
        )
