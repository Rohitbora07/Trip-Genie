import { Router } from "express";
import { userAuthMiddleware } from "../../middleware/user.auth";
import {
    approveRecoveryProposalController,
    rejectRecoveryProposalController
} from "./recovery-proposal.controller";

const router = Router();

router.use(userAuthMiddleware);

router.post("/:id/approve", approveRecoveryProposalController);
router.post("/:id/reject", rejectRecoveryProposalController);

export default router;
