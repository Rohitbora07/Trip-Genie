import { prisma } from "../../db/prisma";
import { enqueueGenerationJob } from "../generation-jobs/generation-job.worker";
import type { CreateDisruptionInput } from "./disruption.validation";

export class TripNotFoundError extends Error {
    constructor(message = "Trip not found") {
        super(message);
        this.name = "TripNotFoundError";
    }
}

export class ForbiddenError extends Error {
    constructor(message = "You are not authorized to perform this action") {
        super(message);
        this.name = "ForbiddenError";
    }
}

export async function createDisruptionEvent(
    tripId: string,
    userId: string,
    data: CreateDisruptionInput
) {
    const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        select: { id: true, userId: true, title: true }
    });

    if (!trip) {
        throw new TripNotFoundError("Trip not found");
    }

    if (trip.userId !== userId) {
        throw new ForbiddenError("You are not authorized to report disruptions for this trip");
    }

    // 1. Create the disruption event
    const disruptionEvent = await prisma.disruptionEvent.create({
        data: {
            tripId,
            type: data.type,
            severity: data.severity,
            description: data.description,
            details: (data.details ?? {}) as any
        }
    });

    // 2. Automatically queue a DISRUPTION_RECOVERY generation job
    const generationJob = await prisma.generationJob.create({
        data: {
            userId,
            tripId,
            jobType: "DISRUPTION_RECOVERY",
            status: "PENDING",
            input: {
                disruptionEventId: disruptionEvent.id,
                disruptionType: data.type,
                severity: data.severity,
                description: data.description,
                details: data.details ?? {}
            }
        }
    });

    enqueueGenerationJob(generationJob.id);

    // 3. Record AuditLog entry
    await prisma.auditLog.create({
        data: {
            tripId,
            actorType: "USER",
            action: "DISRUPTION_REPORTED",
            metadata: {
                disruptionEventId: disruptionEvent.id,
                generationJobId: generationJob.id,
                type: data.type,
                severity: data.severity
            }
        }
    }).catch((err: unknown) => {
        console.error("Non-fatal: failed to create audit log for disruption:", err);
    });

    return {
        disruptionEvent,
        generationJob
    };
}

export async function getTripDisruptions(tripId: string, userId: string) {
    const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        select: { id: true, userId: true }
    });

    if (!trip) {
        throw new TripNotFoundError("Trip not found");
    }

    if (trip.userId !== userId) {
        throw new ForbiddenError("You are not authorized to view disruptions for this trip");
    }

    const [disruptions, auditLogs] = await Promise.all([
        prisma.disruptionEvent.findMany({
            where: { tripId },
            orderBy: { createdAt: "desc" },
            include: {
                proposals: {
                    orderBy: { createdAt: "asc" }
                }
            }
        }),
        prisma.auditLog.findMany({
            where: { tripId },
            orderBy: { createdAt: "desc" },
            take: 50
        })
    ]);

    return { disruptions, auditLogs };
}
