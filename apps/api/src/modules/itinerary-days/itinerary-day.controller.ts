import type { Request, Response } from "express";
import {
    createItineraryDay,
    getItineraryDays,
    updateItineraryDay,
    deleteItineraryDay
} from "./itinerary-day.service";
import {
    itineraryIdParamSchema,
    dayIdParamSchema,
    createItineraryDaySchema,
    updateItineraryDaySchema
} from "./itinerary-day.validation";

export async function createItineraryDayController(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        });
    }

    const paramValidation = itineraryIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid itinerary ID parameter",
                details: paramValidation.error.issues
            }
        });
    }

    const bodyValidation = createItineraryDaySchema.safeParse(req.body);
    if (!bodyValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid itinerary day data",
                details: bodyValidation.error.issues
            }
        });
    }

    try {
        const day = await createItineraryDay(
            paramValidation.data.itineraryId,
            req.user.id,
            bodyValidation.data
        );

        return res.status(201).json({
            success: true,
            data: {
                message: "Itinerary day created successfully",
                day
            }
        });
    } catch (error) {
        console.log(error);
        if (error instanceof Error && error.name === "ConflictError") {
            return res.status(409).json({
                success: false,
                error: { message: error.message }
            });
        } else if (error instanceof Error && error.name === "ValidationError") {
            return res.status(400).json({
                success: false,
                error: { message: error.message }
            });
        } else if (error instanceof Error && error.name === "ItineraryNotFoundError") {
            return res.status(404).json({
                success: false,
                error: { message: error.message }
            });
        } else if (error instanceof Error && error.name === "ForbiddenError") {
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

export async function getItineraryDaysController(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        });
    }

    const paramValidation = itineraryIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid itinerary ID parameter",
                details: paramValidation.error.issues
            }
        });
    }

    try {
        const days = await getItineraryDays(
            paramValidation.data.itineraryId,
            req.user.id
        );

        return res.status(200).json({
            success: true,
            data: { days }
        });
    } catch (error) {
        console.log(error);
        if (error instanceof Error && error.name === "ItineraryNotFoundError") {
            return res.status(404).json({
                success: false,
                error: { message: error.message }
            });
        } else if (error instanceof Error && error.name === "ForbiddenError") {
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

export async function updateItineraryDayController(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        });
    }

    const paramValidation = dayIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid day ID parameter",
                details: paramValidation.error.issues
            }
        });
    }

    const bodyValidation = updateItineraryDaySchema.safeParse(req.body);
    if (!bodyValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid update data",
                details: bodyValidation.error.issues
            }
        });
    }

    try {
        const day = await updateItineraryDay(
            paramValidation.data.dayId,
            req.user.id,
            bodyValidation.data
        );

        return res.status(200).json({
            success: true,
            data: {
                message: "Itinerary day updated successfully",
                day
            }
        });
    } catch (error) {
        console.log(error);
        if (error instanceof Error && error.name === "ConflictError") {
            return res.status(409).json({
                success: false,
                error: { message: error.message }
            });
        } else if (error instanceof Error && error.name === "ValidationError") {
            return res.status(400).json({
                success: false,
                error: { message: error.message }
            });
        } else if (error instanceof Error && error.name === "DayNotFoundError") {
            return res.status(404).json({
                success: false,
                error: { message: error.message }
            });
        } else if (error instanceof Error && error.name === "ForbiddenError") {
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

export async function deleteItineraryDayController(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        });
    }

    const paramValidation = dayIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid day ID parameter",
                details: paramValidation.error.issues
            }
        });
    }

    try {
        await deleteItineraryDay(paramValidation.data.dayId, req.user.id);

        return res.status(200).json({
            success: true,
            data: { message: "Itinerary day deleted successfully" }
        });
    } catch (error) {
        console.log(error);
        if (error instanceof Error && error.name === "DayNotFoundError") {
            return res.status(404).json({
                success: false,
                error: { message: error.message }
            });
        } else if (error instanceof Error && error.name === "ForbiddenError") {
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
