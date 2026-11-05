import type { Request, Response } from "express";
import {
    createActivity,
    getDayActivities,
    getActivityById,
    updateActivity,
    deleteActivity,
    changeActivityStatus,
    reorderActivities
} from "./activity.service";
import {
    activityIdParamSchema,
    dayIdParamSchema,
    createActivitySchema,
    updateActivitySchema,
    updateActivityStatusSchema,
    reorderActivitiesSchema
} from "./activity.validation";

export async function createActivityController(req: Request, res: Response) {
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

    const bodyValidation = createActivitySchema.safeParse(req.body);
    if (!bodyValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid activity data",
                details: bodyValidation.error.issues
            }
        });
    }

    try {
        const activity = await createActivity(
            paramValidation.data.dayId,
            req.user.id,
            bodyValidation.data
        );

        return res.status(201).json({
            success: true,
            data: {
                message: "Activity created successfully",
                activity
            }
        });
    } catch (error) {
        console.log(error);
        if (error instanceof Error && error.name === "ValidationError") {
            return res.status(400).json({
                success: false,
                error: { message: error.message }
            });
        } else if (error instanceof Error && (error.name === "DayNotFoundError" || error.name === "PlaceNotFoundError")) {
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

export async function getDayActivitiesController(req: Request, res: Response) {
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
        const activities = await getDayActivities(
            paramValidation.data.dayId,
            req.user.id
        );

        return res.status(200).json({
            success: true,
            data: { activities }
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

export async function getActivityByIdController(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        });
    }

    const paramValidation = activityIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid activity ID parameter",
                details: paramValidation.error.issues
            }
        });
    }

    try {
        const activity = await getActivityById(
            paramValidation.data.activityId,
            req.user.id
        );

        return res.status(200).json({
            success: true,
            data: { activity }
        });
    } catch (error) {
        console.log(error);
        if (error instanceof Error && error.name === "ActivityNotFoundError") {
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

export async function updateActivityController(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        });
    }

    const paramValidation = activityIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid activity ID parameter",
                details: paramValidation.error.issues
            }
        });
    }

    const bodyValidation = updateActivitySchema.safeParse(req.body);
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
        const activity = await updateActivity(
            paramValidation.data.activityId,
            req.user.id,
            bodyValidation.data
        );

        return res.status(200).json({
            success: true,
            data: {
                message: "Activity updated successfully",
                activity
            }
        });
    } catch (error) {
        console.log(error);
        if (error instanceof Error && error.name === "ValidationError") {
            return res.status(400).json({
                success: false,
                error: { message: error.message }
            });
        } else if (error instanceof Error && (error.name === "ActivityNotFoundError" || error.name === "PlaceNotFoundError")) {
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

export async function deleteActivityController(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        });
    }

    const paramValidation = activityIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid activity ID parameter",
                details: paramValidation.error.issues
            }
        });
    }

    try {
        await deleteActivity(paramValidation.data.activityId, req.user.id);

        return res.status(200).json({
            success: true,
            data: { message: "Activity deleted successfully" }
        });
    } catch (error) {
        console.log(error);
        if (error instanceof Error && error.name === "ActivityNotFoundError") {
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

export async function changeActivityStatusController(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        });
    }

    const paramValidation = activityIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid activity ID parameter",
                details: paramValidation.error.issues
            }
        });
    }

    const bodyValidation = updateActivityStatusSchema.safeParse(req.body);
    if (!bodyValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid status data",
                details: bodyValidation.error.issues
            }
        });
    }

    try {
        const activity = await changeActivityStatus(
            paramValidation.data.activityId,
            req.user.id,
            bodyValidation.data.status
        );

        return res.status(200).json({
            success: true,
            data: {
                message: "Activity status updated successfully",
                activity
            }
        });
    } catch (error) {
        console.log(error);
        if (error instanceof Error && error.name === "ActivityNotFoundError") {
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

export async function reorderActivitiesController(req: Request, res: Response) {
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

    const bodyValidation = reorderActivitiesSchema.safeParse(req.body);
    if (!bodyValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid reorder data",
                details: bodyValidation.error.issues
            }
        });
    }

    try {
        const activities = await reorderActivities(
            paramValidation.data.dayId,
            req.user.id,
            bodyValidation.data.activityIds
        );

        return res.status(200).json({
            success: true,
            data: {
                message: "Activities reordered successfully",
                activities
            }
        });
    } catch (error) {
        console.log(error);
        if (error instanceof Error && error.name === "ValidationError") {
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
