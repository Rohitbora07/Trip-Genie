import { Router } from "express";
import { userAuthMiddleware } from "../../middleware/user.auth";
import {
    getActivityByIdController,
    updateActivityController,
    deleteActivityController,
    changeActivityStatusController
} from "./activity.controller";

const router = Router();

router.use(userAuthMiddleware);

router.get("/:activityId", getActivityByIdController);
router.patch("/:activityId", updateActivityController);
router.delete("/:activityId", deleteActivityController);
router.patch("/:activityId/status", changeActivityStatusController);

export default router;
