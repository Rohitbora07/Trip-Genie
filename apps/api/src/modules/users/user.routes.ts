import { Router } from "express";
import { userAuthMiddleware } from "../../middleware/user.auth";
import { getMeController, updateProfileController } from "./user.controller";

const router = Router();

router.use(userAuthMiddleware);

router.get("/me", getMeController);
router.patch("/me", updateProfileController);

export default router;