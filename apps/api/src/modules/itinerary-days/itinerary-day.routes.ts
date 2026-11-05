import { Router } from "express";
import { userAuthMiddleware } from "../../middleware/user.auth";
import {
    updateItineraryDayController,
    deleteItineraryDayController
} from "./itinerary-day.controller";
import {
    createActivityController,
    getDayActivitiesController,
    reorderActivitiesController
} from "../activities/activity.controller";

const router = Router();

router.use(userAuthMiddleware);

router.patch("/:dayId", updateItineraryDayController);
router.delete("/:dayId", deleteItineraryDayController);

// Nested Activities
router.post("/:dayId/activities", createActivityController);
router.get("/:dayId/activities", getDayActivitiesController);
router.patch("/:dayId/activities/reorder", reorderActivitiesController);

export default router;
