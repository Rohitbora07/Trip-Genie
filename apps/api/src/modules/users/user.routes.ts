import { Router } from "express";
import { userAuthMiddleware } from "../../middleware/user.auth";
import { getMeController, updateProfileController } from "./user.controller";
import savedPlaceRouter from "../saved-places/saved-place.routes";

const router = Router();

router.use(userAuthMiddleware);

router.get("/me", getMeController);
router.patch("/me", updateProfileController);

// Saved Places
router.use("/me/saved-places", savedPlaceRouter);

export default router;
