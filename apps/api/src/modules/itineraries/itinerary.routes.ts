import { Router } from "express";
import { userAuthMiddleware } from "../../middleware/user.auth";
import {
    getItineraryByIdController,
    updateItineraryController,
    deleteItineraryController,
    publishItineraryController,
    setCurrentItineraryController
} from "./itinerary.controller";
import {
    createItineraryDayController,
    getItineraryDaysController
} from "../itinerary-days/itinerary-day.controller";

const router = Router();

router.use(userAuthMiddleware);

router.get("/:itineraryId", getItineraryByIdController);
router.patch("/:itineraryId", updateItineraryController);
router.delete("/:itineraryId", deleteItineraryController);
router.patch("/:itineraryId/publish", publishItineraryController);
router.patch("/:itineraryId/set-current", setCurrentItineraryController);

// Nested Itinerary Days
router.post("/:itineraryId/days", createItineraryDayController);
router.get("/:itineraryId/days", getItineraryDaysController);

export default router;
