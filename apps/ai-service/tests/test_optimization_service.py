import datetime
import unittest

from app.schemas.api import OptimizeItineraryRequest
from app.schemas.itinerary import (
    ActivityTiming,
    ItineraryActivity,
    ItineraryDay,
    ItineraryOutput,
    PlaceInfo,
)
from app.schemas.trip import TripInput
from app.services.optimization_service import (
    haversine_distance_km,
    optimize_itinerary,
)


class TestOptimizationService(unittest.TestCase):
    def setUp(self) -> None:
        self.trip = TripInput(
            destination="Kyoto, Japan",
            start_date=datetime.date(2026, 6, 1),
            end_date=datetime.date(2026, 6, 2),
            budget=200.0,
            currency="USD",
        )

        # Place 1: Southern Kyoto (Fushimi Inari)
        self.place_south = PlaceInfo(
            name="Fushimi Inari Taisha",
            category="ATTRACTION",
            latitude=34.9671,
            longitude=135.7727,
        )
        # Place 2: Northern Kyoto (Kinkaku-ji)
        self.place_north = PlaceInfo(
            name="Kinkaku-ji",
            category="ATTRACTION",
            latitude=35.0394,
            longitude=135.7292,
        )
        # Place 3: Central/East Kyoto (Gion, close to South)
        self.place_central = PlaceInfo(
            name="Gion District",
            category="RESTAURANT",
            latitude=35.0037,
            longitude=135.7770,
        )

    def test_haversine_distance(self) -> None:
        # Distance between Tokyo and Kyoto is approximately 370 km
        tokyo_lat, tokyo_lon = 35.6762, 139.6503
        kyoto_lat, kyoto_lon = 35.0116, 135.7681
        dist = haversine_distance_km(tokyo_lat, tokyo_lon, kyoto_lat, kyoto_lon)
        self.assertGreater(dist, 350.0)
        self.assertLess(dist, 400.0)

    def test_geographic_clustering_reorders_zigzag_route(self) -> None:
        # Day with zigzag route: South -> North -> Central (close to South!)
        # Optimal route should be: South -> Central -> North (or reverse)
        act1 = ItineraryActivity(
            title="South Morning",
            description="Start south",
            timing=ActivityTiming(start_time="09:00", end_time="10:30", duration_minutes=90),
            place=self.place_south,
            estimated_cost=10.0,
        )
        act2_zigzag = ItineraryActivity(
            title="North Lunch",
            description="Drive all the way north",
            timing=ActivityTiming(start_time="11:30", end_time="13:00", duration_minutes=90),
            place=self.place_north,
            estimated_cost=20.0,
        )
        act3_back_south = ItineraryActivity(
            title="Central Dinner",
            description="Drive all the way back central/south",
            timing=ActivityTiming(start_time="14:00", end_time="15:30", duration_minutes=90),
            place=self.place_central,
            estimated_cost=30.0,
        )

        day = ItineraryDay(
            day_number=1,
            title="Day 1 Zigzag",
            activities=[act1, act2_zigzag, act3_back_south],
        )
        itinerary = ItineraryOutput(
            title="Zigzag Trip",
            summary="Needs geographic optimization",
            currency="USD",
            days=[day],
        )

        req = OptimizeItineraryRequest(
            trip=self.trip,
            current_itinerary=itinerary,
            optimization_goal="routing",
        )

        res = optimize_itinerary(req)
        self.assertTrue(res.success)
        opt_day = res.data.itinerary.days[0]
        # In optimized order, the central activity should follow the south activity!
        self.assertEqual(opt_day.activities[1].place.name, "Gion District")
        self.assertEqual(opt_day.activities[2].place.name, "Kinkaku-ji")
        self.assertIn("saving", res.data.changes_summary[0])

    def test_budget_trimming_reduces_high_cost_activities(self) -> None:
        # Trip budget is 200.0. Current itinerary cost is 350.0!
        expensive_act = ItineraryActivity(
            title="Luxury Helicopter Tour",
            description="Helicopter tour over Kyoto",
            timing=ActivityTiming(start_time="10:00", end_time="11:30", duration_minutes=90),
            place=self.place_north,
            estimated_cost=250.0,
        )
        normal_act = ItineraryActivity(
            title="Tea Ceremony",
            description="Traditional tea",
            timing=ActivityTiming(start_time="13:00", end_time="14:30", duration_minutes=90),
            place=self.place_central,
            estimated_cost=100.0,
        )

        day = ItineraryDay(
            day_number=1,
            title="Expensive Day",
            activities=[expensive_act, normal_act],
        )
        itinerary = ItineraryOutput(
            title="Over Budget Trip",
            summary="Needs trimming",
            currency="USD",
            days=[day],
        )

        req = OptimizeItineraryRequest(
            trip=self.trip,
            current_itinerary=itinerary,
            optimization_goal="budget",
            target_budget=200.0,
        )

        res = optimize_itinerary(req)
        self.assertTrue(res.success)
        self.assertLessEqual(res.data.itinerary.total_estimated_cost, 220.0)  # within 10% tolerance
        self.assertLess(res.data.budget_delta, 0.0)  # money was saved!
        self.assertGreater(len(res.data.changes_summary), 0)


if __name__ == "__main__":
    unittest.main()
