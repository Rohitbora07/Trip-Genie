import datetime
import unittest
from typing import Any
from unittest.mock import AsyncMock, patch

from app.schemas.api import GenerationOptions
from app.schemas.itinerary import (
    ActivityTiming,
    ItineraryActivity,
    ItineraryDay,
    ItineraryOutput,
    PlaceInfo,
)
from app.schemas.trip import TravelPreferences, TripConstraints, TripInput
from app.services.llm_service import LLMResponse, LLMUsage
from app.workflows.generation import (
    analyze_requirements,
    finalize_output,
    generation_graph,
    repair_itinerary,
    research_places_and_weather,
    should_repair_or_finalize,
    validate_constraints,
)
from app.workflows.state import ItineraryGenerationState


def create_sample_trip(
    destination: str = "Kyoto, Japan",
    days: int = 2,
    budget: float = 1000.0,
    pace: str = "moderate",
) -> TripInput:
    start = datetime.date(2026, 6, 1)
    end = start + datetime.timedelta(days=days - 1)
    return TripInput(
        destination=destination,
        start_date=start,
        end_date=end,
        budget=budget,
        currency="USD",
        traveler_count=2,
        preferences=TravelPreferences(
            pace=pace,  # type: ignore[arg-type]
            interests=["Culture", "Temples", "Gastronomy"],
        ),
        constraints=TripConstraints(
            dietary=["Vegetarian"],
            accessibility=[],
        ),
    )


def create_sample_itinerary(days_count: int = 2, is_valid_chronology: bool = True) -> ItineraryOutput:
    days: list[ItineraryDay] = []
    for day_num in range(1, days_count + 1):
        act1 = ItineraryActivity(
            title=f"Morning Temple Visit Day {day_num}",
            description="Visit historical shrine",
            timing=ActivityTiming(start_time="09:00", end_time="11:00", duration_minutes=120),
            place=PlaceInfo(name="Shrine A", category="ATTRACTION"),
            estimated_cost=25.0,
        )
        if is_valid_chronology:
            act2_start = "11:30"
            act2_end = "13:00"
        else:
            act2_start = "10:30"  # Overlaps with 09:00-11:00!
            act2_end = "12:00"

        act2 = ItineraryActivity(
            title=f"Lunch Exploration Day {day_num}",
            description="Local lunch",
            timing=ActivityTiming(start_time=act2_start, end_time=act2_end, duration_minutes=90),
            place=PlaceInfo(name="Restaurant B", category="RESTAURANT"),
            estimated_cost=35.0,
        )
        days.append(
            ItineraryDay(
                day_number=day_num,
                title=f"Exploration Day {day_num}",
                activities=[act1, act2],
            )
        )

    return ItineraryOutput(
        title="Kyoto Cultural Expedition",
        summary="A balanced cultural exploration of Kyoto",
        currency="USD",
        days=days,
        highlights=["Historic Temples", "Traditional Cuisine"],
    )


class MockWorkflowLLM:
    def __init__(self, responses: list[Any]) -> None:
        self.responses = list(responses)
        self.call_count = 0
        self.default_model = "llama-3.3-70b-versatile"

    async def generate_structured(self, **kwargs: Any) -> LLMResponse[ItineraryOutput]:
        idx = min(self.call_count, len(self.responses) - 1)
        resp = self.responses[idx]
        self.call_count += 1
        if isinstance(resp, Exception):
            raise resp
        return LLMResponse[ItineraryOutput](
            content=resp,
            model="mock-groq-model",
            latency_ms=15.0,
            usage=LLMUsage(input_tokens=200, output_tokens=300, total_tokens=500),
        )


class TestWorkflowNodes(unittest.IsolatedAsyncioTestCase):
    async def test_analyze_requirements_relaxed_pace(self) -> None:
        trip = create_sample_trip(pace="relaxed", days=3, budget=600.0)
        state: ItineraryGenerationState = {"trip": trip}

        result = await analyze_requirements(state)
        reqs = result["requirements"]

        self.assertEqual(reqs["pace"], "relaxed")
        self.assertEqual(reqs["max_daily_activities"], 3)
        self.assertEqual(reqs["daily_budget"], 200.0)
        self.assertIn("Vegetarian", reqs["dietary"])

    async def test_analyze_requirements_packed_pace(self) -> None:
        trip = create_sample_trip(pace="packed", days=4, budget=800.0)
        state: ItineraryGenerationState = {"trip": trip}

        result = await analyze_requirements(state)
        reqs = result["requirements"]

        self.assertEqual(reqs["pace"], "packed")
        self.assertEqual(reqs["max_daily_activities"], 6)
        self.assertEqual(reqs["daily_budget"], 200.0)

    async def test_research_places_and_weather(self) -> None:
        trip = create_sample_trip()
        state: ItineraryGenerationState = {"trip": trip}

        mock_places = {
            "status": "success",
            "candidates": [
                {
                    "name": "Kinkaku-ji",
                    "address": "Kyoto, Japan",
                    "latitude": 35.0394,
                    "longitude": 135.7292,
                    "category": "ATTRACTION",
                }
            ],
        }
        mock_weather = {
            "status": "success",
            "estimated": False,
            "forecasts": [{"date": "2026-06-01", "temperature_2m_max": 24.5, "precipitation_probability_max": 10}],
        }

        with (
            patch("app.workflows.generation.search_places", new_callable=AsyncMock) as mock_sp,
            patch("app.workflows.generation.get_weather_forecast", new_callable=AsyncMock) as mock_gw,
        ):
            mock_sp.return_value = mock_places
            mock_gw.return_value = mock_weather

            res = await research_places_and_weather(state)

            self.assertEqual(len(res["candidate_places"]), 1)
            self.assertEqual(res["candidate_places"][0].name, "Kinkaku-ji")
            self.assertFalse(res["weather_summary"]["estimated"])

    async def test_validate_constraints_detects_overlap(self) -> None:
        trip = create_sample_trip()
        invalid_draft = create_sample_itinerary(days_count=2, is_valid_chronology=False)
        state: ItineraryGenerationState = {"trip": trip, "draft_itinerary": invalid_draft}

        result = await validate_constraints(state)
        self.assertGreater(len(result["violations"]), 0)
        self.assertIn("starts", result["violations"][0])

    async def test_validate_constraints_passes_valid(self) -> None:
        trip = create_sample_trip()
        valid_draft = create_sample_itinerary(days_count=2, is_valid_chronology=True)
        state: ItineraryGenerationState = {"trip": trip, "draft_itinerary": valid_draft}

        result = await validate_constraints(state)
        self.assertEqual(len(result["violations"]), 0)

    def test_should_repair_or_finalize_routing(self) -> None:
        # 1. No violations -> finalize_output
        state_pass: ItineraryGenerationState = {"violations": [], "repair_attempts": 0}
        self.assertEqual(should_repair_or_finalize(state_pass), "finalize_output")

        # 2. Violations, attempt 0 < 2 -> repair_itinerary
        state_repair0: ItineraryGenerationState = {"violations": ["Overlap"], "repair_attempts": 0}
        self.assertEqual(should_repair_or_finalize(state_repair0), "repair_itinerary")

        # 3. Violations, attempt 1 < 2 -> repair_itinerary
        state_repair1: ItineraryGenerationState = {"violations": ["Overlap"], "repair_attempts": 1}
        self.assertEqual(should_repair_or_finalize(state_repair1), "repair_itinerary")

        # 4. Violations, attempt 2 >= 2 -> finalize_output
        state_exhausted: ItineraryGenerationState = {"violations": ["Overlap"], "repair_attempts": 2}
        self.assertEqual(should_repair_or_finalize(state_exhausted), "finalize_output")

    async def test_repair_itinerary_constructs_prompt(self) -> None:
        trip = create_sample_trip()
        draft = create_sample_itinerary(days_count=1, is_valid_chronology=False)
        state: ItineraryGenerationState = {
            "trip": trip,
            "draft_itinerary": draft,
            "violations": ["Day 1: Activity 2 starts before Activity 1 ends"],
            "repair_attempts": 0,
        }

        result = await repair_itinerary(state)
        self.assertEqual(result["repair_attempts"], 1)
        self.assertIn("VIOLATIONS DETECTED:", result["repair_prompt"])
        self.assertIn("Activity 2 starts before Activity 1 ends", result["repair_prompt"])

    async def test_finalize_output_backfills_dates_and_totals(self) -> None:
        trip = create_sample_trip(days=2)
        draft = create_sample_itinerary(days_count=2)
        # Clear date to test backfill
        draft.days[0].date = None
        draft.days[1].date = None

        state: ItineraryGenerationState = {
            "trip": trip,
            "draft_itinerary": draft,
            "violations": [],
            "repair_attempts": 0,
        }

        result = await finalize_output(state)
        final = result["final_output"]

        self.assertEqual(final.days[0].date, trip.start_date)
        self.assertEqual(final.days[1].date, trip.start_date + datetime.timedelta(days=1))
        self.assertGreater(final.total_estimated_cost, 0.0)


class TestWorkflowEndToEnd(unittest.IsolatedAsyncioTestCase):
    async def test_graph_happy_path(self) -> None:
        trip = create_sample_trip()
        valid_itinerary = create_sample_itinerary(days_count=2, is_valid_chronology=True)
        mock_llm = MockWorkflowLLM([valid_itinerary])

        mock_places = {
            "status": "success",
            "candidates": [
                {
                    "name": "Fushimi Inari",
                    "latitude": 34.9671,
                    "longitude": 135.7727,
                    "category": "ATTRACTION",
                }
            ],
        }
        mock_weather = {
            "status": "success",
            "estimated": False,
            "forecasts": [{"date": "2026-06-01", "temperature_2m_max": 25.0, "precipitation_probability_max": 5}],
        }

        with (
            patch("app.workflows.generation.search_places", new_callable=AsyncMock) as mock_sp,
            patch("app.workflows.generation.get_weather_forecast", new_callable=AsyncMock) as mock_gw,
        ):
            mock_sp.return_value = mock_places
            mock_gw.return_value = mock_weather

            initial_state: dict[str, Any] = {
                "trip": trip,
                "options": GenerationOptions(temperature=0.2),
                "llm": mock_llm,
                "repair_attempts": 0,
                "violations": [],
                "warnings": [],
            }

            final_state = await generation_graph.ainvoke(initial_state)

            self.assertIsNotNone(final_state.get("final_output"))
            self.assertEqual(len(final_state["final_output"].days), 2)
            self.assertEqual(len(final_state.get("warnings", [])), 0)
            self.assertEqual(mock_llm.call_count, 1)

    async def test_graph_self_healing_repair_loop(self) -> None:
        trip = create_sample_trip()
        # 1st call returns overlapping schedule (fails validation)
        invalid_itinerary = create_sample_itinerary(days_count=2, is_valid_chronology=False)
        # 2nd call returns repaired valid schedule (passes validation)
        valid_itinerary = create_sample_itinerary(days_count=2, is_valid_chronology=True)

        mock_llm = MockWorkflowLLM([invalid_itinerary, valid_itinerary])

        mock_places = {"status": "success", "candidates": []}
        mock_weather = {"status": "success", "estimated": True, "forecasts": []}

        with (
            patch("app.workflows.generation.search_places", new_callable=AsyncMock) as mock_sp,
            patch("app.workflows.generation.get_weather_forecast", new_callable=AsyncMock) as mock_gw,
        ):
            mock_sp.return_value = mock_places
            mock_gw.return_value = mock_weather

            initial_state: dict[str, Any] = {
                "trip": trip,
                "llm": mock_llm,
                "repair_attempts": 0,
                "violations": [],
                "warnings": [],
            }

            final_state = await generation_graph.ainvoke(initial_state)

            self.assertIsNotNone(final_state.get("final_output"))
            # Verified repair loop was triggered: call_count == 2
            self.assertEqual(mock_llm.call_count, 2)
            self.assertEqual(final_state.get("repair_attempts"), 1)
            self.assertEqual(len(final_state.get("warnings", [])), 0)

    async def test_graph_exhaustion_attaches_warnings(self) -> None:
        trip = create_sample_trip()
        # Always returns invalid schedule
        invalid_itinerary = create_sample_itinerary(days_count=2, is_valid_chronology=False)
        mock_llm = MockWorkflowLLM([invalid_itinerary, invalid_itinerary, invalid_itinerary])

        mock_places = {"status": "success", "candidates": []}
        mock_weather = {"status": "success", "estimated": True, "forecasts": []}

        with (
            patch("app.workflows.generation.search_places", new_callable=AsyncMock) as mock_sp,
            patch("app.workflows.generation.get_weather_forecast", new_callable=AsyncMock) as mock_gw,
        ):
            mock_sp.return_value = mock_places
            mock_gw.return_value = mock_weather

            initial_state: dict[str, Any] = {
                "trip": trip,
                "llm": mock_llm,
                "repair_attempts": 0,
                "violations": [],
                "warnings": [],
            }

            final_state = await generation_graph.ainvoke(initial_state)

            self.assertIsNotNone(final_state.get("final_output"))
            # 1 initial + 2 repairs = 3 LLM calls
            self.assertEqual(mock_llm.call_count, 3)
            self.assertEqual(final_state.get("repair_attempts"), 2)
            # Unresolved violations attached as non-fatal warnings
            self.assertGreater(len(final_state.get("warnings", [])), 0)


if __name__ == "__main__":
    unittest.main()
