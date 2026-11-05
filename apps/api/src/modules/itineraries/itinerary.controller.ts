import type { Request, Response } from "express";
import {
    createItinerary,
    getTripItineraries,
    getItineraryById,
    updateItinerary,
    deleteItinerary,
    publishItinerary,
    setCurrentItinerary
} from "./itinerary.service";
import {
    tripIdParamSchema,
    itineraryIdParamSchema,
    createItinerarySchema,
    updateItinerarySchema
} from "./itinerary.validation";

export async function createItineraryController(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        });
    }

    // this validation is to ensure that the tripId is a valid UUID and is present in the request parameters
    // for example, if the route is /trips/:tripId/itineraries, we need to validate that tripId is a valid UUID
    // if the tripId is not valid, we should return a 400 Bad Request response
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

    // this validation is to ensure that the itinerary data is valid and is present in the request body
    const bodyValidation = createItinerarySchema.safeParse(req.body);
    if (!bodyValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid itinerary data",
                details: bodyValidation.error.issues
            }
        });
    }

    try {
        const itinerary = await createItinerary(
            paramValidation.data.tripId,
            req.user.id,
            bodyValidation.data
        );

        return res.status(201).json({
            success: true,
            data: {
                message: "Itinerary created successfully",
                itinerary
            }
        });
    } catch (error) {
        console.log(error);
        if (error instanceof Error && error.name === "TripNotFoundError") {
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

export async function getTripItinerariesController(req: Request, res: Response) {
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
        const itineraries = await getTripItineraries(
            paramValidation.data.tripId,
            req.user.id
        );

        return res.status(200).json({
            success: true,
            data: { itineraries }
        });
    } catch (error) {
        console.log(error);
        if (error instanceof Error && error.name === "TripNotFoundError") {
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

export async function getItineraryByIdController(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        });
    }

    // this validation is to ensure that the itineraryId is a valid UUID and is present in the request parameters
    // for example, if the route is /itineraries/:itineraryId, we need to validate that itineraryId is a valid UUID
    // if the itineraryId is not valid, we should return a 400 Bad Request response
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
        const itinerary = await getItineraryById(
            paramValidation.data.itineraryId,
            req.user.id
        );

        return res.status(200).json({
            success: true,
            data: { itinerary }
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

export async function updateItineraryController(req: Request, res: Response) {
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

    const bodyValidation = updateItinerarySchema.safeParse(req.body);
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
        const itinerary = await updateItinerary(
            paramValidation.data.itineraryId,
            req.user.id,
            bodyValidation.data
        );

        return res.status(200).json({
            success: true,
            data: {
                message: "Itinerary updated successfully",
                itinerary
            }
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

export async function deleteItineraryController(req: Request, res: Response) {
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
        await deleteItinerary(
            paramValidation.data.itineraryId,
            req.user.id
        );

        return res.status(200).json({
            success: true,
            data: { message: "Itinerary deleted successfully" }
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

export async function publishItineraryController(req: Request, res: Response) {
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
        const itinerary = await publishItinerary(
            paramValidation.data.itineraryId,
            req.user.id
        );

        return res.status(200).json({
            success: true,
            data: {
                message: "Itinerary published successfully",
                itinerary
            }
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

export async function setCurrentItineraryController(req: Request, res: Response) {
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
        const itinerary = await setCurrentItinerary(
            paramValidation.data.itineraryId,
            req.user.id
        );

        return res.status(200).json({
            success: true,
            data: {
                message: "Itinerary set as current successfully",
                itinerary
            }
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
