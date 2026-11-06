import { Router } from "express";
import { userAuthMiddleware } from "../../middleware/user.auth";
import {
    getUserGenerationJobsController,
    getGenerationJobByIdController,
    cancelGenerationJobController,
    retryGenerationJobController
} from "./generation-job.controller";

const router = Router();

router.use(userAuthMiddleware);

router.get("/", getUserGenerationJobsController);
router.get("/:jobId", getGenerationJobByIdController);
router.post("/:jobId/cancel", cancelGenerationJobController);
router.post("/:jobId/retry", retryGenerationJobController);

export default router;
