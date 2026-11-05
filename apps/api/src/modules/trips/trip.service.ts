import { prisma } from "../../db/prisma"

type TripInput = {
    userId: string;
    title: string;
    description?: string;
    startDate: Date;
    endDate: Date;
    origin?: string;
    destination: string;
    budget?: number;
    currency?: string;
    travelerCount?: number;
    preferences?: any;
    timezone?: string;
}

type UpdateTripInput = {
    title?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    origin?: string;
    destination?: string;
    budget?: number;
    currency?: string;
    travelerCount?: number;
    preferences?: any;
    timezone?: string;
}

type GetUserTripsOptions = {
    status?: string;
}

export async function createTrip(input: TripInput){
    try{
        const trip = await prisma.trip.create({
            data: {
                userId: input.userId,
                title: input.title,
                description: input.description,
                startDate: input.startDate,
                endDate: input.endDate,
                origin: input.origin,
                destination: input.destination,
                budget: input.budget,
                currency: input.currency,
                travelerCount: input.travelerCount,
                preferences: input.preferences,
                timezone: input.timezone
            }
        })
        return trip
    }catch (error: any) {
        if (error?.code === "P2002") {
            throw new Error("You have already created this trip.");
        }
        if (error?.code === "P2003") {
            const err = new Error("User not found");
            err.name = "UserNotFoundError";
            throw err;
        }

        throw error;
    }
}

export async function getUserTrips(userId: string, options?: GetUserTripsOptions){
    const where: any = { userId };
    if (options?.status) {
        where.status = options.status;
    }

    return prisma.trip.findMany({
        where,
        orderBy: { createdAt: "desc" }
    })
}

export async function getTripById(tripId: string, userId: string){
    const trip = await prisma.trip.findUnique({
        where: { id: tripId }
    })

    if (!trip) {
        const error = new Error("Trip not found");
        error.name = "TripNotFoundError";
        throw error;
    }

    if (trip.userId !== userId) {
        const error = new Error("You are not authorized to access this trip");
        error.name = "ForbiddenError";
        throw error;
    }

    return trip;
}

export async function updateTrip(tripId: string, userId: string, data: UpdateTripInput){
    const existingTrip = await prisma.trip.findUnique({
        where: { id: tripId }
    })

    if (!existingTrip) {
        const error = new Error("Trip not found");
        error.name = "TripNotFoundError";
        throw error;
    }

    if (existingTrip.userId !== userId) {
        const error = new Error("You are not authorized to update this trip");
        error.name = "ForbiddenError";
        throw error;
    }

    const startDate = data.startDate ? new Date(data.startDate) : existingTrip.startDate;
    const endDate = data.endDate ? new Date(data.endDate) : existingTrip.endDate;

    if (endDate < startDate) {
        const error = new Error("End date must be on or after start date");
        error.name = "ValidationError";
        throw error;
    }

    return prisma.trip.update({
        where: { id: tripId },
        data: {
            ...(data.title !== undefined && { title: data.title }),
            ...(data.description !== undefined && { description: data.description }),
            ...(data.startDate !== undefined && { startDate }),
            ...(data.endDate !== undefined && { endDate }),
            ...(data.origin !== undefined && { origin: data.origin }),
            ...(data.destination !== undefined && { destination: data.destination }),
            ...(data.budget !== undefined && { budget: data.budget }),
            ...(data.currency !== undefined && { currency: data.currency }),
            ...(data.travelerCount !== undefined && { travelerCount: data.travelerCount }),
            ...(data.preferences !== undefined && { preferences: data.preferences }),
            ...(data.timezone !== undefined && { timezone: data.timezone }),
        }
    })
}

export async function deleteTrip(tripId: string, userId: string){
    const existingTrip = await prisma.trip.findUnique({
        where: { id: tripId }
    })

    if (!existingTrip) {
        const error = new Error("Trip not found");
        error.name = "TripNotFoundError";
        throw error;
    }

    if (existingTrip.userId !== userId) {
        const error = new Error("You are not authorized to delete this trip");
        error.name = "ForbiddenError";
        throw error;
    }

    await prisma.trip.delete({
        where: { id: tripId }
    })

    return { success: true }
}
