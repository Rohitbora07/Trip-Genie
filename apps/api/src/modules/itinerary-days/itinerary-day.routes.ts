import { Router } from "express";
import { userAuthMiddleware } from "../../middleware/user.auth";
import {
    updateItineraryDayController,
    deleteItineraryDayController
} from "./itinerary-day.controller";

const router = Router();

router.use(userAuthMiddleware);

router.patch("/:dayId", updateItineraryDayController);
router.delete("/:dayId", deleteItineraryDayController);

export default router;
