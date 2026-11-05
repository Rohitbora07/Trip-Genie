import { prisma } from "../../db/prisma";

type CreateItineraryDayInput = {
    dayNumber?: number;
    date?: string;
    title?: string;
    description?: string;
};

type UpdateItineraryDayInput = {
    dayNumber?: number;
    date?: string | null;
    title?: string | null;
    description?: string | null;
};

function isDateWithinRange(date: Date, start: Date, end: Date): boolean {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    const s = new Date(start);
    s.setUTCHours(0, 0, 0, 0);
    const e = new Date(end);
    e.setUTCHours(23, 59, 59, 999);
    return d >= s && d <= e;
}

export async function createItineraryDay(
    itineraryId: string,
    userId: string,
    data: CreateItineraryDayInput
) {
    const itinerary = await prisma.itinerary.findUnique({
        where: { id: itineraryId },
        include: {
            trip: {
                select: { id: true, userId: true, startDate: true, endDate: true }
            }
        }
    });

    if (!itinerary) {
        const error = new Error("Itinerary not found");
        error.name = "ItineraryNotFoundError";
        throw error;
    }

    if (itinerary.trip.userId !== userId) {
        const error = new Error("You are not authorized to add days to this itinerary");
        error.name = "ForbiddenError";
        throw error;
    }

    let dayNumber = data.dayNumber;
    if (!dayNumber) {
        const latestDay = await prisma.itineraryDay.findFirst({
            where: { itineraryId },
            orderBy: { dayNumber: "desc" },
            select: { dayNumber: true }
        });
        dayNumber = latestDay ? latestDay.dayNumber + 1 : 1;
    } else {
        const existingDay = await prisma.itineraryDay.findUnique({
            where: {
                itineraryId_dayNumber: {
                    itineraryId,
                    dayNumber
                }
            }
        });

        if (existingDay) {
            const error = new Error(`Day number ${dayNumber} already exists in this itinerary`);
            error.name = "ConflictError";
            throw error;
        }
    }

    let parsedDate: Date | undefined;
    if (data.date) {
        parsedDate = new Date(data.date);
        if (!isDateWithinRange(parsedDate, itinerary.trip.startDate, itinerary.trip.endDate)) {
            const startStr = itinerary.trip.startDate.toISOString().slice(0, 10);
            const endStr = itinerary.trip.endDate.toISOString().slice(0, 10);
            const error = new Error(`Date must fall within the trip's date range (${startStr} to ${endStr})`);
            error.name = "ValidationError";
            throw error;
        }
    }

    return prisma.itineraryDay.create({
        data: {
            itineraryId,
            dayNumber,
            date: parsedDate,
            title: data.title,
            description: data.description
        }
    });
}

export async function getItineraryDays(itineraryId: string, userId: string) {
    const itinerary = await prisma.itinerary.findUnique({
        where: { id: itineraryId },
        include: {
            trip: {
                select: { userId: true }
            }
        }
    });

    if (!itinerary) {
        const error = new Error("Itinerary not found");
        error.name = "ItineraryNotFoundError";
        throw error;
    }

    if (itinerary.trip.userId !== userId) {
        const error = new Error("You are not authorized to view days for this itinerary");
        error.name = "ForbiddenError";
        throw error;
    }

    return prisma.itineraryDay.findMany({
        where: { itineraryId },
        orderBy: { dayNumber: "asc" },
        include: {
            _count: {
                select: { activities: true }
            }
        }
    });
}

export async function updateItineraryDay(
    dayId: string,
    userId: string,
    data: UpdateItineraryDayInput
) {
    const day = await prisma.itineraryDay.findUnique({
        where: { id: dayId },
        include: {
            itinerary: {
                include: {
                    trip: {
                        select: { id: true, userId: true, startDate: true, endDate: true }
                    }
                }
            }
        }
    });

    if (!day) {
        const error = new Error("Itinerary day not found");
        error.name = "DayNotFoundError";
        throw error;
    }

    if (day.itinerary.trip.userId !== userId) {
        const error = new Error("You are not authorized to update this itinerary day");
        error.name = "ForbiddenError";
        throw error;
    }

    if (data.dayNumber !== undefined && data.dayNumber !== day.dayNumber) {
        const existing = await prisma.itineraryDay.findUnique({
            where: {
                itineraryId_dayNumber: {
                    itineraryId: day.itineraryId,
                    dayNumber: data.dayNumber
                }
            }
        });

        if (existing) {
            const error = new Error(`Day number ${data.dayNumber} already exists in this itinerary`);
            error.name = "ConflictError";
            throw error;
        }
    }

    let parsedDate: Date | null | undefined;
    if (data.date !== undefined) {
        if (data.date === null) {
            parsedDate = null;
        } else {
            parsedDate = new Date(data.date);
            const { startDate, endDate } = day.itinerary.trip;
            if (!isDateWithinRange(parsedDate, startDate, endDate)) {
                const startStr = startDate.toISOString().slice(0, 10);
                const endStr = endDate.toISOString().slice(0, 10);
                const error = new Error(`Date must fall within the trip's date range (${startStr} to ${endStr})`);
                error.name = "ValidationError";
                throw error;
            }
        }
    }

    return prisma.itineraryDay.update({
        where: { id: dayId },
        data: {
            ...(data.dayNumber !== undefined && { dayNumber: data.dayNumber }),
            ...(data.title !== undefined && { title: data.title }),
            ...(data.description !== undefined && { description: data.description }),
            ...(parsedDate !== undefined && { date: parsedDate })
        }
    });
}

export async function deleteItineraryDay(dayId: string, userId: string) {
    const day = await prisma.itineraryDay.findUnique({
        where: { id: dayId },
        include: {
            itinerary: {
                include: {
                    trip: {
                        select: { userId: true }
                    }
                }
            }
        }
    });

    if (!day) {
        const error = new Error("Itinerary day not found");
        error.name = "DayNotFoundError";
        throw error;
    }

    if (day.itinerary.trip.userId !== userId) {
        const error = new Error("You are not authorized to delete this itinerary day");
        error.name = "ForbiddenError";
        throw error;
    }

    await prisma.itineraryDay.delete({
        where: { id: dayId }
    });

    return { success: true };
}
