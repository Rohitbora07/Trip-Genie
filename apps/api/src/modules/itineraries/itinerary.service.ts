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

export async function compareItineraries(baseId: string, targetId: string, userId: string) {
    const [baseItinerary, targetItinerary] = await Promise.all([
        prisma.itinerary.findUnique({
            where: { id: baseId },
            include: {
                trip: { select: { id: true, userId: true } },
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
        }),
        prisma.itinerary.findUnique({
            where: { id: targetId },
            include: {
                trip: { select: { id: true, userId: true } },
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
        })
    ]);

    if (!baseItinerary || !targetItinerary) {
        const error = new Error("One or both itineraries not found");
        error.name = "ItineraryNotFoundError";
        throw error;
    }

    if (baseItinerary.trip.userId !== userId || targetItinerary.trip.userId !== userId) {
        const error = new Error("You are not authorized to compare these itineraries");
        error.name = "ForbiddenError";
        throw error;
    }

    // Flatten activities for both versions
    const baseActivities = baseItinerary.days.flatMap((day: any) =>
        day.activities.map((act: any) => ({
            ...act,
            dayNumber: day.dayNumber
        }))
    );

    const targetActivities = targetItinerary.days.flatMap((day: any) =>
        day.activities.map((act: any) => ({
            ...act,
            dayNumber: day.dayNumber
        }))
    );

    const baseCost = baseActivities.reduce(
        (sum: number, act: any) => sum + Number(act.estimatedCost ?? 0),
        0
    );
    const targetCost = targetActivities.reduce(
        (sum: number, act: any) => sum + Number(act.estimatedCost ?? 0),
        0
    );
    const costDelta = Number((targetCost - baseCost).toFixed(2));

    // Matching key helper: normalized title
    const getKey = (act: any) => act.title.trim().toLowerCase();

    const baseMap = new Map<string, any>();
    for (const act of baseActivities) {
        baseMap.set(getKey(act), act);
    }

    const targetMap = new Map<string, any>();
    for (const act of targetActivities) {
        targetMap.set(getKey(act), act);
    }

    const added: any[] = [];
    const removed: any[] = [];
    const modified: any[] = [];
    let shiftedCount = 0;
    const summary: string[] = [];

    // Find added activities & modified activities
    for (const targetAct of targetActivities) {
        const baseMatch = baseMap.get(getKey(targetAct));
        if (!baseMatch) {
            added.push({
                dayNumber: targetAct.dayNumber,
                title: targetAct.title,
                place: targetAct.place?.name ?? null,
                startTime: targetAct.startTime,
                endTime: targetAct.endTime,
                estimatedCost: Number(targetAct.estimatedCost ?? 0)
            });
            summary.push(`Added '${targetAct.title}' to Day ${targetAct.dayNumber}`);
        } else {
            // Check for modifications
            const timeChanged =
                String(baseMatch.startTime) !== String(targetAct.startTime) ||
                String(baseMatch.endTime) !== String(targetAct.endTime);
            const costChanged =
                Number(baseMatch.estimatedCost ?? 0) !== Number(targetAct.estimatedCost ?? 0);
            const dayChanged = baseMatch.dayNumber !== targetAct.dayNumber;

            if (timeChanged) {
                shiftedCount++;
            }

            if (timeChanged || costChanged || dayChanged) {
                modified.push({
                    title: targetAct.title,
                    place: targetAct.place?.name ?? null,
                    changes: {
                        ...(dayChanged && {
                            previousDay: baseMatch.dayNumber,
                            newDay: targetAct.dayNumber
                        }),
                        ...(timeChanged && {
                            previousStartTime: baseMatch.startTime,
                            newStartTime: targetAct.startTime,
                            previousEndTime: baseMatch.endTime,
                            newEndTime: targetAct.endTime
                        }),
                        ...(costChanged && {
                            previousCost: Number(baseMatch.estimatedCost ?? 0),
                            newCost: Number(targetAct.estimatedCost ?? 0)
                        })
                    }
                });

                if (costChanged) {
                    const diff = Number(targetAct.estimatedCost ?? 0) - Number(baseMatch.estimatedCost ?? 0);
                    summary.push(
                        `Modified '${targetAct.title}' cost: ${diff > 0 ? "+" : ""}${diff.toFixed(2)}`
                    );
                }
                if (timeChanged) {
                    summary.push(`Shifted schedule timing for '${targetAct.title}'`);
                }
            }
        }
    }

    // Find removed activities
    for (const baseAct of baseActivities) {
        if (!targetMap.has(getKey(baseAct))) {
            removed.push({
                dayNumber: baseAct.dayNumber,
                title: baseAct.title,
                place: baseAct.place?.name ?? null,
                estimatedCost: Number(baseAct.estimatedCost ?? 0)
            });
            summary.push(`Removed '${baseAct.title}' from Day ${baseAct.dayNumber}`);
        }
    }

    if (costDelta !== 0) {
        summary.unshift(
            `Total cost delta: ${costDelta > 0 ? "+" : ""}${costDelta.toFixed(2)} (${baseCost.toFixed(2)} -> ${targetCost.toFixed(2)})`
        );
    }

    return {
        tripId: baseItinerary.tripId,
        base: {
            id: baseItinerary.id,
            version: baseItinerary.version,
            title: baseItinerary.title,
            totalCost: Number(baseCost.toFixed(2)),
            activitiesCount: baseActivities.length,
            daysCount: baseItinerary.days.length
        },
        target: {
            id: targetItinerary.id,
            version: targetItinerary.version,
            title: targetItinerary.title,
            totalCost: Number(targetCost.toFixed(2)),
            activitiesCount: targetActivities.length,
            daysCount: targetItinerary.days.length
        },
        costDelta,
        scheduleChanges: {
            added,
            removed,
            modified,
            shiftedTimingsCount: shiftedCount,
            summary
        }
    };
}
