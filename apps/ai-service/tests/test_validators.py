import unittest

from app.schemas.itinerary import (
    ActivityTiming,
    ItineraryActivity,
    ItineraryDay,
    PlaceInfo,
)
from app.tools.validators import (
    validate_budget_cap,
    validate_confirmed_preservation,
    validate_schedule_chronology,
)


class TestValidators(unittest.TestCase):
    """Tests chronological time overlap detection, budget threshold logic, and locked activity preservation."""

    def setUp(self) -> None:
        self.act1 = ItineraryActivity(
            title="Eiffel Tower Visit",
            description="Explore Eiffel Tower",
            timing=ActivityTiming(start_time="09:00", end_time="11:00", duration_minutes=120),
            place=PlaceInfo(name="Eiffel Tower", category="ATTRACTION"),
            estimated_cost=30.0,
        )
        self.act2_valid = ItineraryActivity(
            title="Seine Lunch Cruise",
            description="Lunch along Seine river",
            timing=ActivityTiming(start_time="11:30", end_time="13:30", duration_minutes=120),
            place=PlaceInfo(name="Port de la Bourdonnais", category="RESTAURANT"),
            estimated_cost=65.0,
        )
        self.act2_overlap = ItineraryActivity(
            title="Louvre Museum",
            description="Visit the Louvre",
            timing=ActivityTiming(start_time="10:30", end_time="12:30", duration_minutes=120),  # Starts before 11:00!
            place=PlaceInfo(name="Louvre", category="ATTRACTION"),
            estimated_cost=20.0,
        )

    def test_schedule_chronology_valid(self) -> None:
        day = ItineraryDay(
            day_number=1,
            title="Day 1",
            activities=[self.act1, self.act2_valid],
        )
        result = validate_schedule_chronology([day])
        self.assertTrue(result["is_valid"])
        self.assertEqual(len(result["violations"]), 0)

    def test_schedule_chronology_detects_overlap(self) -> None:
        day = ItineraryDay(
            day_number=1,
            title="Day 1",
            activities=[self.act1, self.act2_overlap],
        )
        result = validate_schedule_chronology([day])
        self.assertFalse(result["is_valid"])
        self.assertEqual(len(result["violations"]), 1)
        self.assertIn("Louvre Museum", result["violations"][0])
        self.assertIn("overlap: 10:30 < 11:00", result["violations"][0])

    def test_schedule_chronology_with_raw_dicts(self) -> None:
        raw_days = [
            {
                "day_number": 1,
                "activities": [
                    {"title": "Breakfast", "timing": {"start_time": "08:00", "end_time": "09:00"}},
                    {"title": "Museum Tour", "timing": {"start_time": "08:45", "end_time": "10:30"}},
                ],
            }
        ]
        result = validate_schedule_chronology(raw_days)
        self.assertFalse(result["is_valid"])
        self.assertEqual(len(result["violations"]), 1)
        self.assertIn("Museum Tour", result["violations"][0])

    def test_budget_cap_within_budget(self) -> None:
        day = ItineraryDay(
            day_number=1,
            title="Day 1",
            activities=[self.act1, self.act2_valid],  # 30 + 65 = 95
        )
        result = validate_budget_cap([day], budget_cap=100.0, tolerance_pct=0.10)
        self.assertTrue(result["is_valid"])
        self.assertEqual(result["total_cost"], 95.0)
        self.assertEqual(result["allowed_cap"], 110.0)
        self.assertEqual(result["exceeded_by"], 0.0)

    def test_budget_cap_within_10_percent_tolerance(self) -> None:
        day = ItineraryDay(
            day_number=1,
            title="Day 1",
            activities=[self.act1, self.act2_valid],  # 95
        )
        # Budget cap 90.0 + 10% = 99.0. Total 95.0 <= 99.0 passes
        result = validate_budget_cap([day], budget_cap=90.0, tolerance_pct=0.10)
        self.assertTrue(result["is_valid"])
        self.assertEqual(result["total_cost"], 95.0)
        self.assertEqual(result["allowed_cap"], 99.0)

    def test_budget_cap_exceeds_tolerance(self) -> None:
        day = ItineraryDay(
            day_number=1,
            title="Day 1",
            activities=[self.act1, self.act2_valid],  # 95
        )
        # Budget cap 80.0 + 10% = 88.0. Total 95.0 exceeds 88.0 by 7.0
        result = validate_budget_cap([day], budget_cap=80.0, tolerance_pct=0.10)
        self.assertFalse(result["is_valid"])
        self.assertEqual(result["total_cost"], 95.0)
        self.assertEqual(result["allowed_cap"], 88.0)
        self.assertEqual(result["exceeded_by"], 7.0)
        self.assertEqual(len(result["violations"]), 1)
        self.assertIn("exceeds allowed budget cap", result["violations"][0])

    def test_budget_cap_unconstrained(self) -> None:
        day = ItineraryDay(
            day_number=1,
            title="Day 1",
            activities=[self.act1],
        )
        result = validate_budget_cap([day], budget_cap=None)
        self.assertTrue(result["is_valid"])
        self.assertIsNone(result["allowed_cap"])

    def test_confirmed_preservation_success(self) -> None:
        day = ItineraryDay(
            day_number=1,
            title="Day 1",
            activities=[self.act1, self.act2_valid],
        )
        locked_keys = ["Eiffel Tower Visit", "Seine Lunch Cruise"]
        result = validate_confirmed_preservation([day], locked_keys)
        self.assertTrue(result["is_valid"])
        self.assertEqual(len(result["missing_locked_keys"]), 0)
        self.assertEqual(len(result["violations"]), 0)

    def test_confirmed_preservation_detects_deleted_booking(self) -> None:
        day = ItineraryDay(
            day_number=1,
            title="Day 1",
            activities=[self.act1],  # Seine Lunch Cruise was removed
        )
        locked_keys = ["Eiffel Tower Visit", "Seine Lunch Cruise", "Hotel Booking #12345"]
        result = validate_confirmed_preservation([day], locked_keys)
        self.assertFalse(result["is_valid"])
        self.assertEqual(len(result["missing_locked_keys"]), 2)
        self.assertIn("Seine Lunch Cruise", result["missing_locked_keys"])
        self.assertIn("Hotel Booking #12345", result["missing_locked_keys"])
        self.assertEqual(len(result["violations"]), 2)


if __name__ == "__main__":
    unittest.main()
