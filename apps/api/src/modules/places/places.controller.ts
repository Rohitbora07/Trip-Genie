import type { Request, Response } from "express";
import { searchPlaces, getPlaceById, findOrCreatePlace } from "./places.service";
import { placeIdParamSchema, searchPlacesQuerySchema, createPlaceSchema } from "./places.validation";

export async function searchPlacesController(req: Request, res: Response) {
    const queryValidation = searchPlacesQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid search query parameters",
                details: queryValidation.error.issues
            }
        });
    }

    try {
        const places = await searchPlaces(
            queryValidation.data.q,
            queryValidation.data.limit
        );

        return res.status(200).json({
            success: true,
            data: { places }
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" }
        });
    }
}

export async function getPlaceByIdController(req: Request, res: Response) {
    const paramValidation = placeIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid place ID parameter",
                details: paramValidation.error.issues
            }
        });
    }

    try {
        const place = await getPlaceById(paramValidation.data.placeId);

        return res.status(200).json({
            success: true,
            data: { place }
        });
    } catch (error) {
        console.log(error);
        if (error instanceof Error && error.name === "PlaceNotFoundError") {
            return res.status(404).json({
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

export async function createPlaceController(req: Request, res: Response) {
    const bodyValidation = createPlaceSchema.safeParse(req.body);
    if (!bodyValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid place data",
                details: bodyValidation.error.issues
            }
        });
    }

    try {
        const { place, isNew } = await findOrCreatePlace(bodyValidation.data);

        return res.status(isNew ? 201 : 200).json({
            success: true,
            data: {
                message: isNew ? "Place created successfully" : "Place already exists",
                place
            }
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" }
        });
    }
}
