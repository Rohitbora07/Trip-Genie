import type { Request, Response } from "express";
import {
    createDisruptionEvent,
    getTripDisruptions,
    TripNotFoundError,
    ForbiddenError
} from "./disruption.service";
import {
    tripIdParamSchema,
    createDisruptionSchema
} from "./disruption.validation";

export async function createDisruptionController(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        });
    }

    const paramValidation = tripIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid trip ID parameter",
                details: paramValidation.error.issues
            }
        });
    }

    const bodyValidation = createDisruptionSchema.safeParse(req.body);
    if (!bodyValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid disruption event data",
                details: bodyValidation.error.issues
            }
        });
    }

    try {
        const result = await createDisruptionEvent(
            paramValidation.data.tripId,
            req.user.id,
            bodyValidation.data
        );

        return res.status(201).json({
            success: true,
            data: {
                message: "Disruption event recorded and recovery job queued successfully",
                disruption: result.disruptionEvent,
                generationJob: result.generationJob
            }
        });
    } catch (error) {
        console.error("Error creating disruption event:", error);

        if (error instanceof TripNotFoundError) {
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

        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" }
        });
    }
}

export async function getTripDisruptionsController(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        });
    }

    const paramValidation = tripIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid trip ID parameter",
                details: paramValidation.error.issues
            }
        });
    }

    try {
        const { disruptions, auditLogs } = await getTripDisruptions(
            paramValidation.data.tripId,
            req.user.id
        );

        return res.status(200).json({
            success: true,
            data: {
                disruptions,
                auditLogs
            }
        });
    } catch (error) {
        console.error("Error fetching trip disruptions:", error);

        if (error instanceof TripNotFoundError) {
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

        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" }
        });
    }
}
