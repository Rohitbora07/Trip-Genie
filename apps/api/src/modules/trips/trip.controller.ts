import type { Request, Response } from "express"
import { createTrip, getUserTrips, getTripById, updateTrip, deleteTrip } from "./trip.service"
import { createTripSchema, updateTripSchema, tripIdParamSchema, getUserTripsQuerySchema } from "./trip.validation"

export async function createTripController(req: Request, res: Response){
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        })
    }

    const validation = createTripSchema.safeParse(req.body)

    if( !validation.success ){
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid trip data",
                details: validation.error.issues
            }
        })
    }

    try{
        const trip = await createTrip({
            ...validation.data,
            userId: req.user.id,
            startDate: new Date(validation.data.startDate),
            endDate: new Date(validation.data.endDate)
        })

        return res.status(201).json({
            success: true,
            data: {
                message: "Trip created successfully",
                trip
            }
        })
    }catch(error){
        console.log(error)
        if( error instanceof Error && error.name === "UserNotFoundError" ){
            return res.status(404).json({
                success: false,
                error: { message: error.message }
            })
        }

        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" }
        })
    }
}

export async function getUserTripsController(req: Request, res: Response){
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        })
    }

    const queryValidation = getUserTripsQuerySchema.safeParse(req.query)

    if( !queryValidation.success ){
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid query parameters",
                details: queryValidation.error.issues
            }
        })
    }

    try {
        const trips = await getUserTrips(req.user.id, queryValidation.data)

        return res.status(200).json({
            success: true,
            data: { trips }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" }
        })
    }
}

export async function getTripByIdController(req: Request, res: Response){
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        })
    }

    const paramValidation = tripIdParamSchema.safeParse(req.params)

    if( !paramValidation.success ){
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid trip ID parameter",
                details: paramValidation.error.issues
            }
        })
    }

    try {
        const trip = await getTripById(paramValidation.data.tripId, req.user.id)

        return res.status(200).json({
            success: true,
            data: { trip }
        })
    } catch (error) {
        console.log(error)
        if( error instanceof Error && error.name === "TripNotFoundError" ){
            return res.status(404).json({
                success: false,
                error: { message: error.message }
            })
        } else if( error instanceof Error && error.name === "ForbiddenError" ){
            return res.status(403).json({
                success: false,
                error: { message: error.message }
            })
        }

        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" }
        })
    }
}

export async function updateTripController(req: Request, res: Response){
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        })
    }

    const paramValidation = tripIdParamSchema.safeParse(req.params)

    if( !paramValidation.success ){
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid trip ID parameter",
                details: paramValidation.error.issues
            }
        })
    }

    const bodyValidation = updateTripSchema.safeParse(req.body)

    if( !bodyValidation.success ){
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid update data",
                details: bodyValidation.error.issues
            }
        })
    }

    try {
        const trip = await updateTrip(paramValidation.data.tripId, req.user.id, bodyValidation.data)

        return res.status(200).json({
            success: true,
            data: {
                message: "Trip updated successfully",
                trip
            }
        })
    } catch (error) {
        console.log(error)
        if( error instanceof Error && (error.name === "ValidationError") ){
            return res.status(400).json({
                success: false,
                error: { message: error.message }
            })
        } else if( error instanceof Error && error.name === "TripNotFoundError" ){
            return res.status(404).json({
                success: false,
                error: { message: error.message }
            })
        } else if( error instanceof Error && error.name === "ForbiddenError" ){
            return res.status(403).json({
                success: false,
                error: { message: error.message }
            })
        }

        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" }
        })
    }
}

export async function deleteTripController(req: Request, res: Response){
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        })
    }

    const paramValidation = tripIdParamSchema.safeParse(req.params)

    if( !paramValidation.success ){
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid trip ID parameter",
                details: paramValidation.error.issues
            }
        })
    }

    try {
        await deleteTrip(paramValidation.data.tripId, req.user.id)

        return res.status(200).json({
            success: true,
            data: { message: "Trip deleted successfully" }
        })
    } catch (error) {
        console.log(error)
        if( error instanceof Error && error.name === "TripNotFoundError" ){
            return res.status(404).json({
                success: false,
                error: { message: error.message }
            })
        } else if( error instanceof Error && error.name === "ForbiddenError" ){
            return res.status(403).json({
                success: false,
                error: { message: error.message }
            })
        }

        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" }
        })
    }
}
