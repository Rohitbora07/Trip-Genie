import type { Request, Response } from "express";
import {
    saveUserPlace,
    getUserSavedPlaces,
    updateSavedPlace,
    deleteSavedPlace
} from "./saved-place.service";
import {
    savedPlaceIdParamSchema,
    savePlaceSchema,
    updateSavedPlaceSchema,
    getSavedPlacesQuerySchema
} from "./saved-place.validation";

export async function savePlaceController(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        });
    }

    const bodyValidation = savePlaceSchema.safeParse(req.body);
    if (!bodyValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid save place request",
                details: bodyValidation.error.issues
            }
        });
    }

    try {
        const savedPlace = await saveUserPlace(req.user.id, bodyValidation.data);

        return res.status(201).json({
            success: true,
            data: { savedPlace }
        });
    } catch (error) {
        console.log(error);
        if (error instanceof Error) {
            if (error.name === "DuplicateSavedPlaceError") {
                return res.status(409).json({
                    success: false,
                    error: { message: error.message }
                });
            }
            if (error.name === "PlaceNotFoundError") {
                return res.status(404).json({
                    success: false,
                    error: { message: error.message }
                });
            }
        }

        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" }
        });
    }
}

export async function getUserSavedPlacesController(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        });
    }

    const queryValidation = getSavedPlacesQuerySchema.safeParse(req.query);
    const category = queryValidation.success ? queryValidation.data.category : undefined;

    try {
        const savedPlaces = await getUserSavedPlaces(req.user.id, category);

        return res.status(200).json({
            success: true,
            data: { savedPlaces }
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" }
        });
    }
}

export async function updateSavedPlaceController(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        });
    }

    const paramValidation = savedPlaceIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid saved place ID parameter",
                details: paramValidation.error.issues
            }
        });
    }

    const bodyValidation = updateSavedPlaceSchema.safeParse(req.body);
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
        const savedPlace = await updateSavedPlace(
            paramValidation.data.savedPlaceId,
            req.user.id,
            bodyValidation.data
        );

        return res.status(200).json({
            success: true,
            data: { savedPlace }
        });
    } catch (error) {
        console.log(error);
        if (error instanceof Error) {
            if (error.name === "SavedPlaceNotFoundError") {
                return res.status(404).json({
                    success: false,
                    error: { message: error.message }
                });
            }
            if (error.name === "SavedPlaceForbiddenError") {
                return res.status(403).json({
                    success: false,
                    error: { message: error.message }
                });
            }
        }

        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" }
        });
    }
}

export async function deleteSavedPlaceController(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        });
    }

    const paramValidation = savedPlaceIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid saved place ID parameter",
                details: paramValidation.error.issues
            }
        });
    }

    try {
        await deleteSavedPlace(paramValidation.data.savedPlaceId, req.user.id);

        return res.status(200).json({
            success: true,
            data: { message: "Saved place removed successfully" }
        });
    } catch (error) {
        console.log(error);
        if (error instanceof Error) {
            if (error.name === "SavedPlaceNotFoundError") {
                return res.status(404).json({
                    success: false,
                    error: { message: error.message }
                });
            }
            if (error.name === "SavedPlaceForbiddenError") {
                return res.status(403).json({
                    success: false,
                    error: { message: error.message }
                });
            }
        }

        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" }
        });
    }
}
