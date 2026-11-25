import datetime
import unittest

from app.schemas.api import DisruptionDetails, RecoveryItineraryRequest
from app.schemas.itinerary import (
    ActivityTiming,
    ItineraryActivity,
    ItineraryDay,
    ItineraryOutput,
    PlaceInfo,
)
from app.schemas.trip import TravelPreferences, TripConstraints, TripInput
from app.workflows.disruption_recovery import (
    classify_impact,
    generate_recovery_proposals,
    minutes_to_time,
    recover_itinerary,
    time_to_minutes,
)


def create_sample_trip() -> TripInput:
    return TripInput(
        destination="Kyoto, Japan",
        start_date=datetime.date(2026, 7, 1),
        end_date=datetime.date(2026, 7, 3),
        budget=1200.0,
        currency="USD",
        traveler_count=2,
        preferences=TravelPreferences(pace="moderate", interests=["culture", "food"]),
        constraints=TripConstraints(dietary=[], accessibility=[]),
    )


def create_sample_itinerary() -> ItineraryOutput:
    day1_activities = [
        ItineraryActivity(
            title="Morning Shrine Visit",
            description="Explore Fushimi Inari",
            timing=ActivityTiming(start_time="09:00", end_time="11:00", duration_minutes=120),
            place=PlaceInfo(name="Fushimi Inari Taisha", category="ATTRACTION"),
            estimated_cost=0.0,
        ),
        ItineraryActivity(
            title="Traditional Kaiseki Lunch",
            description="Prepaid lunch reservation",
            timing=ActivityTiming(start_time="11:30", end_time="13:00", duration_minutes=90),
            place=PlaceInfo(name="Gion Kaiseki", category="RESTAURANT"),
            estimated_cost=80.0,
        ),
        ItineraryActivity(
            title="Kiyomizu-dera Temple Tour",
            description="Historic wooden stage temple",
            timing=ActivityTiming(start_time="14:00", end_time="16:00", duration_minutes=120),
            place=PlaceInfo(name="Kiyomizu-dera", category="ATTRACTION"),
            estimated_cost=30.0,
        ),
        ItineraryActivity(
            title="Hotel Check-in & Rest",
            description="Check into ryokan",
            timing=ActivityTiming(start_time="17:00", end_time="18:30", duration_minutes=90),
            place=PlaceInfo(name="Kyoto Ryokan", category="HOTEL"),
            estimated_cost=0.0,
        ),
    ]

    day2_activities = [
        ItineraryActivity(
            title="Arashiyama Bamboo Grove",
            description="Morning walk",
            timing=ActivityTiming(start_time="09:00", end_time="11:00", duration_minutes=120),
            place=PlaceInfo(name="Bamboo Grove", category="ATTRACTION"),
            estimated_cost=0.0,
        ),
    ]

    return ItineraryOutput(
        title="Kyoto 2-Day Adventure",
        summary="A cultural journey through Kyoto",
        currency="USD",
        days=[
            ItineraryDay(day_number=1, title="Day 1 - Central Kyoto", date=datetime.date(2026, 7, 1), activities=day1_activities),
            ItineraryDay(day_number=2, title="Day 2 - Arashiyama", date=datetime.date(2026, 7, 2), activities=day2_activities),
        ],
        highlights=["Fushimi Inari", "Kiyomizu-dera"],
    )


class TestDisruptionRecoveryWorkflow(unittest.IsolatedAsyncioTestCase):
    def test_time_conversions(self) -> None:
        self.assertEqual(time_to_minutes("09:00"), 540)
        self.assertEqual(time_to_minutes("13:30"), 810)
        self.assertEqual(minutes_to_time(540), "09:00")
        self.assertEqual(minutes_to_time(810), "13:30")
        self.assertEqual(minutes_to_time(1500), "23:59")  # Clamped

    async def test_classify_impact_identifies_collisions_and_locked_activities(self) -> None:
        trip = create_sample_trip()
        itinerary = create_sample_itinerary()

        disruption = DisruptionDetails(
            type="FLIGHT_DELAY",
            description="Flight delayed by 180 minutes",
            affected_day_number=1,
            delay_minutes=180,
        )

        state = {
            "trip": trip,
            "current_itinerary": itinerary,
            "disruption": disruption,
            "preserve_confirmed_activities": True,
        }

        impact = await classify_impact(state)
        self.assertEqual(impact["affected_day_number"], 1)
        self.assertEqual(impact["delay_minutes"], 180)
        self.assertIn("Hotel Check-in & Rest", impact["locked_activity_titles"])
        self.assertGreater(impact["impact_analysis"]["collided_activities_count"], 0)

    async def test_generate_recovery_proposals_produces_3_ranked_options(self) -> None:
        trip = create_sample_trip()
        itinerary = create_sample_itinerary()
        disruption = DisruptionDetails(
            type="FLIGHT_DELAY",
            description="Flight delayed by 120 minutes",
            affected_day_number=1,
            delay_minutes=120,
        )

        state = {
            "trip": trip,
            "current_itinerary": itinerary,
            "disruption": disruption,
            "affected_day_number": 1,
            "delay_minutes": 120,
            "locked_activity_titles": ["Hotel Check-in & Rest"],
        }

        proposals = await generate_recovery_proposals(state)
        options = proposals["recovery_options"]
        self.assertEqual(len(options), 3)

        strategies = [opt.strategy for opt in options]
        self.assertIn("MINIMAL_DISRUPTION", strategies)
        self.assertIn("PACE_RELAXED", strategies)
        self.assertIn("BUDGET_FOCUSED", strategies)

        # Option A: shifts schedule without removing activities
        option_a = next(o for o in options if o.strategy == "MINIMAL_DISRUPTION")
        self.assertEqual(option_a.estimated_cost_delta, 0.0)
        self.assertEqual(len(option_a.diff_payload["removed"]), 0)
        self.assertGreater(len(option_a.diff_payload["modified"]), 0)

        # Option B: drops an activity to protect rest & hotel check-in
        option_b = next(o for o in options if o.strategy == "PACE_RELAXED")
        self.assertGreater(len(option_b.diff_payload["removed"]), 0)

        # Option C: replaces with budget/evening stroll
        option_c = next(o for o in options if o.strategy == "BUDGET_FOCUSED")
        self.assertGreater(len(option_c.diff_payload["added"]), 0)
        self.assertGreater(len(option_c.diff_payload["removed"]), 0)

    async def test_end_to_end_recovery_graph(self) -> None:
        trip = create_sample_trip()
        itinerary = create_sample_itinerary()
        disruption = DisruptionDetails(
            type="ATTRACTION_CLOSURE",
            description="Kiyomizu-dera closed for preservation works",
            affected_day_number=1,
            delay_minutes=60,
        )

        request = RecoveryItineraryRequest(
            trip=trip,
            current_itinerary=itinerary,
            disruption=disruption,
        )

        response = await recover_itinerary(request)
        self.assertTrue(response.success)
        self.assertIsNotNone(response.data)
        self.assertEqual(response.data.selected_strategy, "MINIMAL_DISRUPTION")
        self.assertEqual(len(response.data.recovery_options), 3)
        self.assertGreater(response.data.itinerary.total_estimated_cost, 0.0)
        self.assertEqual(response.data.impacted_days, [1])


if __name__ == "__main__":
    unittest.main()
