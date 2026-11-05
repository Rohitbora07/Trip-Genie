import { Router } from "express";
import { userAuthMiddleware } from "../../middleware/user.auth";
import { 
    createTripController, 
    getUserTripsController,
    getTripByIdController, 
    updateTripController, 
    deleteTripController 
} from "./trip.controller";
import {
    createItineraryController,
    getTripItinerariesController
} from "../itineraries/itinerary.controller";

const router = Router();

router.use(userAuthMiddleware);

router.post("/", createTripController);
router.get("/", getUserTripsController);
router.get("/:tripId", getTripByIdController);
router.patch("/:tripId", updateTripController);
router.delete("/:tripId", deleteTripController);

// Trip Itineraries
router.post("/:tripId/itineraries", createItineraryController);
router.get("/:tripId/itineraries", getTripItinerariesController);

export default router;
