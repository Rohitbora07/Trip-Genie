import type { Request, Response } from "express";
import {
    approveRecoveryProposal,
    rejectRecoveryProposal,
    ProposalNotFoundError,
    ForbiddenError,
    InvalidProposalStateError
} from "./recovery-proposal.service";
import { proposalIdParamSchema } from "./recovery-proposal.validation";

export async function approveRecoveryProposalController(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        });
    }

    const paramValidation = proposalIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid proposal ID parameter",
                details: paramValidation.error.issues
            }
        });
    }

    try {
        const result = await approveRecoveryProposal(
            paramValidation.data.id,
            req.user.id
        );

        return res.status(200).json({
            success: true,
            data: {
                message: "Recovery proposal approved and applied successfully",
                itinerary: result.newItinerary,
                proposal: result.proposal
            }
        });
    } catch (error) {
        console.error("Error approving recovery proposal:", error);

        if (error instanceof ProposalNotFoundError) {
            return res.status(404).json({
                success: false,
                error: { message: error.message }
            });
        }

        if (error instanceof ForbiddenError) {
            return res.status(403).json({
                success: false,
                error: { message: error.message }
            });
        }

        if (error instanceof InvalidProposalStateError) {
            return res.status(400).json({
                success: false,
                error: { message: error.message }
            });
        }

        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" }
        });
    }
}

export async function rejectRecoveryProposalController(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        });
    }

    const paramValidation = proposalIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid proposal ID parameter",
                details: paramValidation.error.issues
            }
        });
    }

    try {
        const proposal = await rejectRecoveryProposal(
            paramValidation.data.id,
            req.user.id
        );

        return res.status(200).json({
            success: true,
            data: {
                message: "Recovery proposal rejected",
                proposal
            }
        });
    } catch (error) {
        console.error("Error rejecting recovery proposal:", error);

        if (error instanceof ProposalNotFoundError) {
            return res.status(404).json({
                success: false,
                error: { message: error.message }
            });
        }

        if (error instanceof ForbiddenError) {
            return res.status(403).json({
                success: false,
                error: { message: error.message }
            });
        }

        if (error instanceof InvalidProposalStateError) {
            return res.status(400).json({
                success: false,
                error: { message: error.message }
            });
        }

        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" }
        });
    }
}
