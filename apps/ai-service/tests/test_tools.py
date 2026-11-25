import datetime
import unittest
from unittest.mock import AsyncMock, MagicMock

import httpx
from app.tools.places import (
    classify_osm_category,
    parse_nominatim_item,
    search_places,
)
from app.tools.weather import (
    estimate_seasonal_climate,
    get_season,
    get_weather_forecast,
    is_within_forecast_window,
)


class TestNominatimTool(unittest.IsolatedAsyncioTestCase):
    """Mocks Nominatim HTTP responses and verifies category mapping and timeout fallbacks."""

    def test_classify_osm_category(self) -> None:
        self.assertEqual(classify_osm_category("amenity", "restaurant"), "RESTAURANT")
        self.assertEqual(classify_osm_category("amenity", "cafe"), "RESTAURANT")
        self.assertEqual(classify_osm_category("tourism", "hotel"), "HOTEL")
        self.assertEqual(classify_osm_category("tourism", "hostel"), "HOTEL")
        self.assertEqual(classify_osm_category("aeroway", "aerodrome"), "AIRPORT")
        self.assertEqual(classify_osm_category("railway", "station"), "TRANSIT")
        self.assertEqual(classify_osm_category("public_transport", "bus_stop"), "TRANSIT")
        self.assertEqual(classify_osm_category("tourism", "museum"), "ATTRACTION")
        self.assertEqual(classify_osm_category("historic", "monument"), "ATTRACTION")
        self.assertEqual(classify_osm_category("leisure", "park"), "ACTIVITY")
        self.assertEqual(classify_osm_category("unknown", "unknown"), "OTHER")

    def test_parse_nominatim_item(self) -> None:
        raw_item = {
            "name": "Eiffel Tower",
            "display_name": "Eiffel Tower, 5, Avenue Anatole France, Quartier du Gros-Caillou, Paris, France",
            "lat": "48.858370",
            "lon": "2.294481",
            "class": "tourism",
            "type": "attraction",
            "osm_id": 12345,
            "osm_type": "way",
            "address": {
                "road": "Avenue Anatole France",
                "house_number": "5",
                "city": "Paris",
                "country": "France",
            },
        }
        parsed = parse_nominatim_item(raw_item)
        self.assertEqual(parsed["name"], "Eiffel Tower")
        self.assertEqual(parsed["latitude"], 48.85837)
        self.assertEqual(parsed["longitude"], 2.294481)
        self.assertEqual(parsed["category"], "ATTRACTION")
        self.assertIn("Paris", parsed["address"])
        self.assertIn("France", parsed["address"])

    async def test_search_places_success(self) -> None:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {
                "name": "Senso-ji",
                "display_name": "Senso-ji, Taito, Tokyo, Japan",
                "lat": "35.7147",
                "lon": "139.7967",
                "class": "historic",
                "type": "monument",
                "osm_id": 9999,
                "osm_type": "node",
            }
        ]

        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_client.get.return_value = mock_response

        result = await search_places("Senso-ji Tokyo", client=mock_client)
        self.assertEqual(result["status"], "success")
        self.assertEqual(len(result["candidates"]), 1)
        candidate = result["candidates"][0]
        self.assertEqual(candidate["name"], "Senso-ji")
        self.assertEqual(candidate["latitude"], 35.7147)
        self.assertEqual(candidate["longitude"], 139.7967)
        self.assertEqual(candidate["category"], "ATTRACTION")

    async def test_search_places_timeout_fallback(self) -> None:
        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_client.get.side_effect = httpx.TimeoutException("Connection timed out after 3.0s")

        result = await search_places("Tokyo Tower", timeout_seconds=3.0, client=mock_client)
        self.assertEqual(result["status"], "fallback")
        self.assertEqual(len(result["candidates"]), 1)
        self.assertEqual(result["candidates"][0]["name"], "Tokyo Tower")
        self.assertIsNone(result["candidates"][0]["latitude"])
        self.assertIn("timed out", result["error"].lower())

    async def test_search_places_network_error_fallback(self) -> None:
        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_client.get.side_effect = httpx.ConnectError("DNS resolution failed")

        result = await search_places("Fushimi Inari", client=mock_client)
        self.assertEqual(result["status"], "fallback")
        self.assertEqual(result["candidates"][0]["name"], "Fushimi Inari")
        self.assertIn("Network request error", result["error"])

    async def test_search_places_empty_query_fallback(self) -> None:
        result = await search_places("   ")
        self.assertEqual(result["status"], "fallback")
        self.assertIn("Empty query", result["error"])


class TestOpenMeteoTool(unittest.IsolatedAsyncioTestCase):
    """Mocks Open-Meteo HTTP responses and verifies 16-day window, seasonal climate, and timeout fallbacks."""

    def test_get_season(self) -> None:
        # Northern hemisphere
        self.assertEqual(get_season(1, is_northern_hemisphere=True), "winter")
        self.assertEqual(get_season(4, is_northern_hemisphere=True), "spring")
        self.assertEqual(get_season(7, is_northern_hemisphere=True), "summer")
        self.assertEqual(get_season(10, is_northern_hemisphere=True), "autumn")

        # Southern hemisphere (inverted)
        self.assertEqual(get_season(1, is_northern_hemisphere=False), "summer")
        self.assertEqual(get_season(7, is_northern_hemisphere=False), "winter")

    def test_estimate_seasonal_climate(self) -> None:
        # Tokyo in July (Northern temperate summer)
        summer_tokyo = estimate_seasonal_climate(35.6762, 139.6503, datetime.date(2027, 7, 15))
        self.assertEqual(summer_tokyo["temperature_2m_max"], 25.0)
        self.assertEqual(summer_tokyo["precipitation_probability_max"], 30)

        # Singapore in December (Equatorial)
        singapore = estimate_seasonal_climate(1.3521, 103.8198, datetime.date(2027, 12, 10))
        self.assertEqual(singapore["temperature_2m_max"], 30.5)

    def test_forecast_window_calculation(self) -> None:
        today = datetime.date(2026, 6, 1)
        in_window_date = datetime.date(2026, 6, 10)  # +9 days
        out_window_date = datetime.date(2026, 6, 25)  # +24 days

        self.assertTrue(is_within_forecast_window(in_window_date, reference_today=today))
        self.assertFalse(is_within_forecast_window(out_window_date, reference_today=today))

    async def test_weather_beyond_16_day_window_returns_estimate(self) -> None:
        today = datetime.date(2026, 1, 1)
        start_date = datetime.date(2026, 8, 10)
        end_date = datetime.date(2026, 8, 12)

        result = await get_weather_forecast(
            latitude=35.0,
            longitude=139.0,
            start_date=start_date,
            end_date=end_date,
            reference_today=today,
        )

        self.assertEqual(result["status"], "success")
        self.assertTrue(result["estimated"])
        self.assertIn("Seasonal average based on latitude/season", result["note"])
        self.assertEqual(len(result["forecasts"]), 3)
        self.assertEqual(result["forecasts"][0]["date"], "2026-08-10")

    async def test_weather_within_16_day_window_calls_open_meteo(self) -> None:
        today = datetime.date(2026, 6, 1)
        start_date = datetime.date(2026, 6, 3)
        end_date = datetime.date(2026, 6, 4)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "daily": {
                "time": ["2026-06-03", "2026-06-04"],
                "temperature_2m_max": [26.4, 27.8],
                "precipitation_probability_max": [10, 45],
            }
        }

        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_client.get.return_value = mock_response

        result = await get_weather_forecast(
            latitude=35.6762,
            longitude=139.6503,
            start_date=start_date,
            end_date=end_date,
            reference_today=today,
            client=mock_client,
        )

        self.assertEqual(result["status"], "success")
        self.assertFalse(result["estimated"])
        self.assertEqual(len(result["forecasts"]), 2)
        self.assertEqual(result["forecasts"][0]["temperature_2m_max"], 26.4)
        self.assertEqual(result["forecasts"][1]["precipitation_probability_max"], 45)

    async def test_weather_timeout_fallback_to_seasonal_estimate(self) -> None:
        today = datetime.date(2026, 6, 1)
        start_date = datetime.date(2026, 6, 3)

        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_client.get.side_effect = httpx.TimeoutException("Open-Meteo timeout after 3.0s")

        result = await get_weather_forecast(
            latitude=35.6762,
            longitude=139.6503,
            start_date=start_date,
            reference_today=today,
            client=mock_client,
        )

        self.assertEqual(result["status"], "success")
        self.assertTrue(result["estimated"])
        self.assertIn("timed out", result["note"].lower())
        self.assertEqual(len(result["forecasts"]), 1)


if __name__ == "__main__":
    unittest.main()
