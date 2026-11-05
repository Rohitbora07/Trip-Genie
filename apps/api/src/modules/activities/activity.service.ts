import { prisma } from "../../db/prisma";

type ActivityStatus = "PLANNED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

type CreateActivityInput = {
    title: string;
    description?: string;
    placeId?: string;
    startTime?: string;
    endTime?: string;
    durationMinutes?: number;
    sortOrder?: number;
    estimatedCost?: number;
    currency?: string;
    status?: ActivityStatus;
    bookingReference?: string;
    metadata?: Record<string, any>;
};

type UpdateActivityInput = {
    title?: string;
    description?: string | null;
    placeId?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    durationMinutes?: number | null;
    sortOrder?: number;
    estimatedCost?: number | null;
    currency?: string;
    status?: ActivityStatus;
    bookingReference?: string | null;
    metadata?: Record<string, any> | null;
};

export async function createActivity(dayId: string, userId: string, data: CreateActivityInput) {
    const day = await prisma.itineraryDay.findUnique({
        where: { id: dayId },
        include: {
            itinerary: {
                include: {
                    trip: { select: { userId: true } }
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
        const error = new Error("You are not authorized to add activities to this day");
        error.name = "ForbiddenError";
        throw error;
    }

    if (data.placeId) {
        const place = await prisma.place.findUnique({ where: { id: data.placeId } });
        if (!place) {
            const error = new Error("Place not found");
            error.name = "PlaceNotFoundError";
            throw error;
        }
    }

    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
        const latestActivity = await prisma.activity.findFirst({
            where: { itineraryDayId: dayId },
            orderBy: { sortOrder: "desc" },
            select: { sortOrder: true }
        });
        sortOrder = latestActivity ? latestActivity.sortOrder + 1 : 1;
    }

    const startTime = data.startTime ? new Date(data.startTime) : undefined;
    const endTime = data.endTime ? new Date(data.endTime) : undefined;

    let durationMinutes = data.durationMinutes;
    if (!durationMinutes && startTime && endTime) {
        durationMinutes = Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)));
    }

    return prisma.activity.create({
        data: {
            itineraryDayId: dayId,
            placeId: data.placeId,
            title: data.title,
            description: data.description,
            startTime,
            endTime,
            durationMinutes,
            sortOrder,
            estimatedCost: data.estimatedCost,
            currency: data.currency ?? "USD",
            status: data.status ?? "PLANNED",
            bookingReference: data.bookingReference,
            metadata: data.metadata
        },
        include: {
            place: true
        }
    });
}

export async function getDayActivities(dayId: string, userId: string) {
    const day = await prisma.itineraryDay.findUnique({
        where: { id: dayId },
        include: {
            itinerary: {
                include: {
                    trip: { select: { userId: true } }
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
        const error = new Error("You are not authorized to view activities for this day");
        error.name = "ForbiddenError";
        throw error;
    }

    return prisma.activity.findMany({
        where: { itineraryDayId: dayId },
        orderBy: { sortOrder: "asc" },
        include: {
            place: true
        }
    });
}

export async function getActivityById(activityId: string, userId: string) {
    const activity = await prisma.activity.findUnique({
        where: { id: activityId },
        include: {
            place: true,
            itineraryDay: {
                include: {
                    itinerary: {
                        include: {
                            trip: { select: { id: true, userId: true, title: true } }
                        }
                    }
                }
            }
        }
    });

    if (!activity) {
        const error = new Error("Activity not found");
        error.name = "ActivityNotFoundError";
        throw error;
    }

    if (activity.itineraryDay.itinerary.trip.userId !== userId) {
        const error = new Error("You are not authorized to access this activity");
        error.name = "ForbiddenError";
        throw error;
    }

    return activity;
}

export async function updateActivity(activityId: string, userId: string, data: UpdateActivityInput) {
    const activity = await prisma.activity.findUnique({
        where: { id: activityId },
        include: {
            itineraryDay: {
                include: {
                    itinerary: {
                        include: {
                            trip: { select: { userId: true } }
                        }
                    }
                }
            }
        }
    });

    if (!activity) {
        const error = new Error("Activity not found");
        error.name = "ActivityNotFoundError";
        throw error;
    }

    if (activity.itineraryDay.itinerary.trip.userId !== userId) {
        const error = new Error("You are not authorized to update this activity");
        error.name = "ForbiddenError";
        throw error;
    }

    if (data.placeId) {
        const place = await prisma.place.findUnique({ where: { id: data.placeId } });
        if (!place) {
            const error = new Error("Place not found");
            error.name = "PlaceNotFoundError";
            throw error;
        }
    }

    const startTime = data.startTime !== undefined
        ? (data.startTime ? new Date(data.startTime) : null)
        : activity.startTime;

    const endTime = data.endTime !== undefined
        ? (data.endTime ? new Date(data.endTime) : null)
        : activity.endTime;

    if (startTime && endTime && endTime < startTime) {
        const error = new Error("End time must be on or after start time");
        error.name = "ValidationError";
        throw error;
    }

    let durationMinutes = data.durationMinutes !== undefined
        ? data.durationMinutes
        : activity.durationMinutes;

    if (durationMinutes === undefined && startTime && endTime) {
        durationMinutes = Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)));
    }

    return prisma.activity.update({
        where: { id: activityId },
        data: {
            ...(data.title !== undefined && { title: data.title }),
            ...(data.description !== undefined && { description: data.description }),
            ...(data.placeId !== undefined && { placeId: data.placeId }),
            ...(data.startTime !== undefined && { startTime }),
            ...(data.endTime !== undefined && { endTime }),
            ...(durationMinutes !== undefined && { durationMinutes }),
            ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
            ...(data.estimatedCost !== undefined && { estimatedCost: data.estimatedCost }),
            ...(data.currency !== undefined && { currency: data.currency }),
            ...(data.status !== undefined && { status: data.status }),
            ...(data.bookingReference !== undefined && { bookingReference: data.bookingReference }),
            ...(data.metadata !== undefined && { metadata: data.metadata })
        },
        include: {
            place: true
        }
    });
}

export async function deleteActivity(activityId: string, userId: string) {
    const activity = await prisma.activity.findUnique({
        where: { id: activityId },
        include: {
            itineraryDay: {
                include: {
                    itinerary: {
                        include: {
                            trip: { select: { userId: true } }
                        }
                    }
                }
            }
        }
    });

    if (!activity) {
        const error = new Error("Activity not found");
        error.name = "ActivityNotFoundError";
        throw error;
    }

    if (activity.itineraryDay.itinerary.trip.userId !== userId) {
        const error = new Error("You are not authorized to delete this activity");
        error.name = "ForbiddenError";
        throw error;
    }

    await prisma.activity.delete({
        where: { id: activityId }
    });

    return { success: true };
}

export async function changeActivityStatus(activityId: string, userId: string, status: ActivityStatus) {
    const activity = await prisma.activity.findUnique({
        where: { id: activityId },
        include: {
            itineraryDay: {
                include: {
                    itinerary: {
                        include: {
                            trip: { select: { userId: true } }
                        }
                    }
                }
            }
        }
    });

    if (!activity) {
        const error = new Error("Activity not found");
        error.name = "ActivityNotFoundError";
        throw error;
    }

    if (activity.itineraryDay.itinerary.trip.userId !== userId) {
        const error = new Error("You are not authorized to update this activity");
        error.name = "ForbiddenError";
        throw error;
    }

    return prisma.activity.update({
        where: { id: activityId },
        data: { status },
        include: {
            place: true
        }
    });
}

export async function reorderActivities(dayId: string, userId: string, activityIds: string[]) {
    const day = await prisma.itineraryDay.findUnique({
        where: { id: dayId },
        include: {
            itinerary: {
                include: {
                    trip: { select: { userId: true } }
                }
            },
            activities: {
                select: { id: true }
            }
        }
    });

    if (!day) {
        const error = new Error("Itinerary day not found");
        error.name = "DayNotFoundError";
        throw error;
    }

    if (day.itinerary.trip.userId !== userId) {
        const error = new Error("You are not authorized to reorder activities for this day");
        error.name = "ForbiddenError";
        throw error;
    }

    const dayActivityIds = new Set(day.activities.map((a: any) => a.id));
    for (const id of activityIds) {
        if (!dayActivityIds.has(id)) {
            const error = new Error(`Activity ${id} does not belong to this itinerary day`);
            error.name = "ValidationError";
            throw error;
        }
    }

    return prisma.$transaction(async (tx: any) => {
        const updates = activityIds.map((id, index) =>
            tx.activity.update({
                where: { id },
                data: { sortOrder: index + 1 }
            })
        );
        await Promise.all(updates);

        return tx.activity.findMany({
            where: { itineraryDayId: dayId },
            orderBy: { sortOrder: "asc" },
            include: { place: true }
        });
    });
}
