import { prisma } from "../../db/prisma";

type CreateItineraryInput = {
    title: string;
    description?: string;
    isCurrent?: boolean;
};

type UpdateItineraryInput = {
    title?: string;
    description?: string;
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
};

export async function createItinerary(tripId: string, userId: string, data: CreateItineraryInput) {
    const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        select: { id: true, userId: true }
    });

    if (!trip) {
        const error = new Error("Trip not found");
        error.name = "TripNotFoundError";
        throw error;
    }

    if (trip.userId !== userId) {
        const error = new Error("You are not authorized to add itineraries to this trip");
        error.name = "ForbiddenError";
        throw error;
    }

    const latestItinerary = await prisma.itinerary.findFirst({
        where: { tripId },
        orderBy: { version: "desc" },
        select: { version: true }
    });

    const nextVersion = latestItinerary ? latestItinerary.version + 1 : 1;
    const shouldBeCurrent = data.isCurrent ?? (nextVersion === 1);

    if (shouldBeCurrent) {
        return prisma.$transaction(async (tx: any) => {
            await tx.itinerary.updateMany({
                where: { tripId },
                data: { isCurrent: false }
            });

            return tx.itinerary.create({
                data: {
                    tripId,
                    version: nextVersion,
                    title: data.title,
                    description: data.description,
                    creatorId: userId,
                    isCurrent: true
                }
            });
        });
    }

    return prisma.itinerary.create({
        data: {
            tripId,
            version: nextVersion,
            title: data.title,
            description: data.description,
            creatorId: userId,
            isCurrent: false
        }
    });
}

export async function getTripItineraries(tripId: string, userId: string) {
    const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        select: { id: true, userId: true }
    });

    if (!trip) {
        const error = new Error("Trip not found");
        error.name = "TripNotFoundError";
        throw error;
    }

    if (trip.userId !== userId) {
        const error = new Error("You are not authorized to view itineraries for this trip");
        error.name = "ForbiddenError";
        throw error;
    }

    return prisma.itinerary.findMany({
        where: { tripId },
        orderBy: { version: "desc" },
        include: {
            _count: {
                select: { days: true }
            }
        }
    });
}

export async function getItineraryById(itineraryId: string, userId: string) {
    const itinerary = await prisma.itinerary.findUnique({
        where: { id: itineraryId },
        include: {
            trip: {
                select: { id: true, userId: true, title: true, destination: true }
            },
            days: {
                orderBy: { dayNumber: "asc" },
                include: {
                    activities: {
                        orderBy: { sortOrder: "asc" },
                        include: { place: true }
                    }
                }
            }
        }
    });

    if (!itinerary) {
        const error = new Error("Itinerary not found");
        error.name = "ItineraryNotFoundError";
        throw error;
    }

    if (itinerary.trip.userId !== userId) {
        const error = new Error("You are not authorized to access this itinerary");
        error.name = "ForbiddenError";
        throw error;
    }

    return itinerary;
}

export async function updateItinerary(itineraryId: string, userId: string, data: UpdateItineraryInput) {
    const existing = await prisma.itinerary.findUnique({
        where: { id: itineraryId },
        include: { trip: { select: { userId: true } } }
    });

    if (!existing) {
        const error = new Error("Itinerary not found");
        error.name = "ItineraryNotFoundError";
        throw error;
    }

    if (existing.trip.userId !== userId) {
        const error = new Error("You are not authorized to update this itinerary");
        error.name = "ForbiddenError";
        throw error;
    }

    return prisma.itinerary.update({
        where: { id: itineraryId },
        data: {
            ...(data.title !== undefined && { title: data.title }),
            ...(data.description !== undefined && { description: data.description }),
            ...(data.status !== undefined && { status: data.status })
        }
    });
}

export async function deleteItinerary(itineraryId: string, userId: string) {
    const existing = await prisma.itinerary.findUnique({
        where: { id: itineraryId },
        include: { trip: { select: { userId: true } } }
    });

    if (!existing) {
        const error = new Error("Itinerary not found");
        error.name = "ItineraryNotFoundError";
        throw error;
    }

    if (existing.trip.userId !== userId) {
        const error = new Error("You are not authorized to delete this itinerary");
        error.name = "ForbiddenError";
        throw error;
    }

    await prisma.itinerary.delete({
        where: { id: itineraryId }
    });

    return { success: true };
}

export async function publishItinerary(itineraryId: string, userId: string) {
    const existing = await prisma.itinerary.findUnique({
        where: { id: itineraryId },
        include: { trip: { select: { userId: true } } }
    });

    if (!existing) {
        const error = new Error("Itinerary not found");
        error.name = "ItineraryNotFoundError";
        throw error;
    }

    if (existing.trip.userId !== userId) {
        const error = new Error("You are not authorized to publish this itinerary");
        error.name = "ForbiddenError";
        throw error;
    }

    return prisma.itinerary.update({
        where: { id: itineraryId },
        data: { status: "PUBLISHED" }
    });
}

export async function setCurrentItinerary(itineraryId: string, userId: string) {
    return prisma.$transaction(async (tx: any) => {
        const existing = await tx.itinerary.findUnique({
            where: { id: itineraryId },
            include: { trip: { select: { userId: true } } }
        });

        if (!existing) {
            const error = new Error("Itinerary not found");
            error.name = "ItineraryNotFoundError";
            throw error;
        }

        if (existing.trip.userId !== userId) {
            const error = new Error("You are not authorized to update this itinerary");
            error.name = "ForbiddenError";
            throw error;
        }

        await tx.itinerary.updateMany({
            where: { tripId: existing.tripId },
            data: { isCurrent: false }
        });

        return tx.itinerary.update({
            where: { id: itineraryId },
            data: { isCurrent: true }
        });
    });
}
