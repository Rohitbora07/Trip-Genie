import { randomUUID } from "node:crypto";
import { prisma } from "../../db/prisma";
import {
    AiServiceError,
    generateItineraryFromAi,
    recoverItineraryFromAi
} from "../../integrations/ai/ai.client";
import {
    type MappedPlaceForPersistence,
    mapAiItineraryToPersistenceData,
    mapTripToGenerateItineraryRequest
} from "../../integrations/ai/ai.mapper";
import type {
    AiItineraryOutput,
    AiResponseMetadata,
    PlaceCategory,
    RecoveryItineraryRequest
} from "../../integrations/ai/ai.types";

const TRANSACTION_TIMEOUT_MS = 30_000;
const TRANSACTION_MAX_WAIT_MS = 10_000;

const queuedOrRunningJobIds = new Set<string>();
const activeJobControllers = new Map<string, AbortController>();

class JobCancelledMidRunError extends Error {
    constructor(jobId: string) {
        super(`Generation job ${jobId} was cancelled mid-run`);
        this.name = "JobCancelledMidRunError";
    }
}

function buildPlaceCacheKey(place: MappedPlaceForPersistence): string {
    return `${place.name.toLowerCase()}::${(place.address ?? "").toLowerCase()}`;
}

async function findOrCreatePlaceInTx(
    tx: any,
    place: MappedPlaceForPersistence,
    cache: Map<string, string>
): Promise<string> {
    const cacheKey = buildPlaceCacheKey(place);
    const cachedId = cache.get(cacheKey);
    if (cachedId) {
        return cachedId;
    }

    const existing = await tx.place.findFirst({
        where: {
            name: { equals: place.name, mode: "insensitive" },
            ...(place.address
                ? { address: { equals: place.address, mode: "insensitive" } }
                : {})
        },
        select: { id: true }
    });

    if (existing) {
        cache.set(cacheKey, existing.id);
        return existing.id;
    }

    const created = await tx.place.create({
        data: {
            name: place.name,
            address: place.address,
            latitude: place.latitude,
            longitude: place.longitude,
            category: place.category,
            provider: "AI_GENERATED"
        },
        select: { id: true }
    });

    cache.set(cacheKey, created.id);
    return created.id;
}

async function persistGeneratedItinerary(params: {
    jobId: string;
    userId: string;
    tripId: string;
    tripStartDate: Date;
    aiItinerary: AiItineraryOutput;
    aiMetadata: AiResponseMetadata;
    requestId: string;
}): Promise<{ itineraryId: string; version: number }> {
    const { jobId, userId, tripId, tripStartDate, aiItinerary, aiMetadata, requestId } = params;
    const mapped = mapAiItineraryToPersistenceData({
        tripStartDate,
        itinerary: aiItinerary
    });

    return prisma.$transaction(
        async (tx: any) => {
            const currentJob = await tx.generationJob.findUnique({
                where: { id: jobId },
                select: { status: true }
            });

            if (!currentJob || currentJob.status !== "PROCESSING") {
                throw new JobCancelledMidRunError(jobId);
            }

            const latestItinerary = await tx.itinerary.findFirst({
                where: { tripId },
                orderBy: { version: "desc" },
                select: { version: true }
            });

            const nextVersion = latestItinerary ? latestItinerary.version + 1 : 1;

            await tx.itinerary.updateMany({
                where: { tripId },
                data: { isCurrent: false }
            });

            const createdItinerary = await tx.itinerary.create({
                data: {
                    tripId,
                    version: nextVersion,
                    status: "DRAFT",
                    title: mapped.title,
                    description: mapped.description,
                    creatorId: userId,
                    generationJobId: jobId,
                    isCurrent: true
                },
                select: { id: true, version: true }
            });

            const placeCache = new Map<string, string>();
            let activitiesCount = 0;

            for (const day of mapped.days) {
                const createdDay = await tx.itineraryDay.create({
                    data: {
                        itineraryId: createdItinerary.id,
                        dayNumber: day.dayNumber,
                        date: day.date,
                        title: day.title,
                        description: day.description
                    },
                    select: { id: true }
                });

                for (const activity of day.activities) {
                    const placeId = await findOrCreatePlaceInTx(tx, activity.place, placeCache);

                    await tx.activity.create({
                        data: {
                            itineraryDayId: createdDay.id,
                            placeId,
                            title: activity.title,
                            description: activity.description,
                            startTime: activity.startTime,
                            endTime: activity.endTime,
                            durationMinutes: activity.durationMinutes,
                            sortOrder: activity.sortOrder,
                            estimatedCost: activity.estimatedCost,
                            currency: activity.currency,
                            status: "PLANNED",
                            metadata: activity.metadata
                        }
                    });

                    activitiesCount += 1;
                }
            }

            const completionUpdate = await tx.generationJob.updateMany({
                where: { id: jobId, status: "PROCESSING" },
                data: {
                    status: "COMPLETED",
                    completedAt: new Date(),
                    errorDetails: null,
                    result: {
                        requestId,
                        itineraryId: createdItinerary.id,
                        version: createdItinerary.version,
                        title: mapped.title,
                        currency: mapped.currency,
                        totalEstimatedCost: mapped.totalEstimatedCost,
                        daysCount: mapped.days.length,
                        activitiesCount,
                        highlights: mapped.highlights,
                        metadata: aiMetadata
                    }
                }
            });

            if (completionUpdate.count !== 1) {
                throw new JobCancelledMidRunError(jobId);
            }

            return {
                itineraryId: createdItinerary.id,
                version: createdItinerary.version
            };
        },
        {
            timeout: TRANSACTION_TIMEOUT_MS,
            maxWait: TRANSACTION_MAX_WAIT_MS
        }
    );
}

async function markJobFailedIfProcessing(
    jobId: string,
    errorDetails: Record<string, unknown>
): Promise<void> {
    await prisma.generationJob.updateMany({
        where: { id: jobId, status: "PROCESSING" },
        data: {
            status: "FAILED",
            completedAt: new Date(),
            errorDetails
        }
    });
}

function toHHMMUtc(value: Date | null | undefined, fallback: string): string {
    if (!value) {
        return fallback;
    }
    const h = String(value.getUTCHours()).padStart(2, "0");
    const m = String(value.getUTCMinutes()).padStart(2, "0");
    return `${h}:${m}`;
}

function normalizePlaceCategory(raw?: string | null): PlaceCategory {
    const val = (raw ?? "OTHER").toUpperCase();
    const allowed: ReadonlySet<string> = new Set([
        "ATTRACTION",
        "RESTAURANT",
        "HOTEL",
        "AIRPORT",
        "TRANSIT",
        "ACTIVITY",
        "OTHER"
    ]);
    return (allowed.has(val) ? val : "OTHER") as PlaceCategory;
}

async function processDisruptionRecoveryJob(params: {
    jobId: string;
    userId: string;
    trip: {
        id: string;
        title: string;
        description: string | null;
        origin: string | null;
        destination: string;
        startDate: Date;
        endDate: Date;
        budget: unknown;
        currency: string;
        travelerCount: number;
        preferences: unknown;
    };
    jobInput: unknown;
    signal: AbortSignal;
}) {
    const { jobId, trip, jobInput, signal } = params;
    const inputObj =
        typeof jobInput === "object" && jobInput !== null
            ? (jobInput as Record<string, unknown>)
            : {};

    const disruptionEventId =
        typeof inputObj.disruptionEventId === "string" ? inputObj.disruptionEventId : null;

    if (!disruptionEventId) {
        await markJobFailedIfProcessing(jobId, {
            code: "MISSING_DISRUPTION_EVENT",
            message: "Disruption recovery job missing disruptionEventId",
            retryable: false
        });
        return;
    }

    const currentItinerary =
        (await prisma.itinerary.findFirst({
            where: { tripId: trip.id, isCurrent: true },
            include: {
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
        })) ??
        (await prisma.itinerary.findFirst({
            where: { tripId: trip.id },
            orderBy: { version: "desc" },
            include: {
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
        }));

    if (!currentItinerary) {
        await markJobFailedIfProcessing(jobId, {
            code: "NO_ITINERARY_TO_RECOVER",
            message: "Generate an itinerary before running disruption recovery",
            retryable: false
        });
        return;
    }

    const mappedDays = (currentItinerary.days as Array<any>).map((day: any) => {
        const mappedActs = (day.activities as Array<any>).map((act: any) => {
            const cost = act.estimatedCost ? Number(act.estimatedCost) : 0;
            return {
                title: String(act.title),
                description: String(act.description || act.title),
                timing: {
                    start_time: toHHMMUtc(act.startTime, "09:00"),
                    end_time: toHHMMUtc(act.endTime, "10:30"),
                    duration_minutes: Math.max(15, Number(act.durationMinutes) || 90)
                },
                place: {
                    name: String(act.place?.name || act.title),
                    address: act.place?.address ?? null,
                    category: normalizePlaceCategory(act.place?.category),
                    latitude: act.place?.latitude ? Number(act.place.latitude) : null,
                    longitude: act.place?.longitude ? Number(act.place.longitude) : null
                },
                estimated_cost: cost,
                currency: String(act.currency || trip.currency)
            };
        });
        const dayTotal = mappedActs.reduce((acc: number, a) => acc + a.estimated_cost, 0);
        return {
            day_number: Number(day.dayNumber),
            date: day.date ? new Date(day.date).toISOString().slice(0, 10) : null,
            title: String(day.title || `Day ${day.dayNumber}`),
            summary: day.description ? String(day.description) : null,
            activities: mappedActs,
            daily_cost_total: Number(dayTotal.toFixed(2))
        };
    });

    const totalCost = mappedDays.reduce((acc: number, d) => acc + d.daily_cost_total, 0);
    const requestId = randomUUID();
    const baseReq = mapTripToGenerateItineraryRequest({
        requestId,
        trip,
        generationJobId: jobId,
        jobInput
    });

    const detailsObj =
        typeof inputObj.details === "object" && inputObj.details !== null
            ? (inputObj.details as Record<string, unknown>)
            : {};

    const recoveryReq: RecoveryItineraryRequest = {
        request_id: requestId,
        trip_id: trip.id,
        generation_job_id: jobId,
        trip: baseReq.trip,
        current_itinerary: {
            title: currentItinerary.title,
            summary: currentItinerary.description || trip.title,
            currency: trip.currency,
            days: mappedDays,
            total_estimated_cost: Number(totalCost.toFixed(2)),
            highlights: []
        },
        disruption: {
            type: String(inputObj.disruptionType ?? "OTHER"),
            description: String(inputObj.description ?? "Travel disruption reported"),
            affected_day_number:
                typeof detailsObj.dayAffected === "number" ? detailsObj.dayAffected : 1,
            delay_minutes:
                typeof detailsObj.delayMinutes === "number" ? detailsObj.delayMinutes : 120
        },
        preserve_confirmed_activities: true
    };

    const aiResponse = await recoverItineraryFromAi(recoveryReq, { signal });
    if (signal.aborted) {
        return;
    }

    await prisma.$transaction(async (tx: any) => {
        const proposals = aiResponse.data.recovery_options ?? [];
        for (const opt of proposals) {
            await tx.recoveryProposal.create({
                data: {
                    disruptionEventId,
                    generationJobId: jobId,
                    title: opt.title,
                    summary: opt.summary,
                    strategy: opt.strategy,
                    estimatedCostDelta: opt.estimated_cost_delta ?? 0,
                    tradeOffs: opt.trade_offs ?? [],
                    diffPayload: (opt.diff_payload ?? {}) as any,
                    status: "PENDING_APPROVAL"
                }
            });
        }

        await tx.auditLog.create({
            data: {
                tripId: trip.id,
                actorType: "AI",
                action: "RECOVERY_PROPOSALS_GENERATED",
                beforeItineraryId: currentItinerary.id,
                metadata: {
                    disruptionEventId,
                    proposalCount: proposals.length,
                    selectedStrategy: aiResponse.data.selected_strategy
                }
            }
        });

        await tx.generationJob.updateMany({
            where: { id: jobId, status: "PROCESSING" },
            data: {
                status: "COMPLETED",
                completedAt: new Date(),
                errorDetails: null,
                result: {
                    requestId: aiResponse.request_id,
                    disruptionEventId,
                    proposalCount: proposals.length,
                    selectedStrategy: aiResponse.data.selected_strategy,
                    metadata: aiResponse.data.metadata
                }
            }
        });
    });
}

/**
 * Executes a single `PENDING` generation job in-process via PostgreSQL state transitions.
 */
export async function processGenerationJob(jobId: string): Promise<void> {
    const claimed = await prisma.generationJob.updateMany({
        where: { id: jobId, status: "PENDING" },
        data: {
            status: "PROCESSING",
            startedAt: new Date(),
            completedAt: null,
            errorDetails: null
        }
    });

    if (claimed.count === 0) {
        queuedOrRunningJobIds.delete(jobId);
        return;
    }

    const abortController = new AbortController();
    activeJobControllers.set(jobId, abortController);

    try {
        const job = await prisma.generationJob.findUnique({
            where: { id: jobId },
            include: {
                trip: {
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        origin: true,
                        destination: true,
                        startDate: true,
                        endDate: true,
                        budget: true,
                        currency: true,
                        travelerCount: true,
                        preferences: true
                    }
                }
            }
        });

        if (!job || job.status !== "PROCESSING" || abortController.signal.aborted) {
            return;
        }

        if (!job.trip) {
            await markJobFailedIfProcessing(jobId, {
                code: "TRIP_NOT_FOUND",
                message: "Associated trip no longer exists for this generation job",
                retryable: false
            });
            return;
        }

        if (job.jobType === "DISRUPTION_RECOVERY") {
            await processDisruptionRecoveryJob({
                jobId: job.id,
                userId: job.userId,
                trip: job.trip,
                jobInput: job.input,
                signal: abortController.signal
            });
            return;
        }

        if (job.jobType !== "ITINERARY_GENERATION") {
            await markJobFailedIfProcessing(jobId, {
                code: "UNSUPPORTED_JOB_TYPE",
                message: `Job type '${job.jobType}' is not yet implemented by the AI worker`,
                retryable: false
            });
            return;
        }

        const requestId = randomUUID();
        const aiRequest = mapTripToGenerateItineraryRequest({
            requestId,
            trip: job.trip,
            generationJobId: job.id,
            jobInput: job.input
        });

        const aiResponse = await generateItineraryFromAi(aiRequest, {
            signal: abortController.signal
        });

        if (abortController.signal.aborted) {
            return;
        }

        await persistGeneratedItinerary({
            jobId: job.id,
            userId: job.userId,
            tripId: job.trip.id,
            tripStartDate: job.trip.startDate,
            aiItinerary: aiResponse.data.itinerary,
            aiMetadata: aiResponse.data.metadata,
            requestId: aiResponse.request_id
        });
    } catch (error) {
        if (error instanceof JobCancelledMidRunError || abortController.signal.aborted) {
            return;
        }

        const latestStatus = await prisma.generationJob.findUnique({
            where: { id: jobId },
            select: { status: true }
        });
        if (latestStatus?.status === "CANCELLED") {
            return;
        }

        const errorDetails: Record<string, unknown> =
            error instanceof AiServiceError
                ? { ...error.toErrorDetails() }
                : {
                      code: "GENERATION_WORKER_ERROR",
                      message:
                          error instanceof Error
                              ? error.message
                              : "Unexpected error while executing generation job",
                      retryable: true
                  };

        console.error(`Generation job ${jobId} failed:`, errorDetails);

        try {
            await markJobFailedIfProcessing(jobId, errorDetails);
        } catch (updateError) {
            console.error(
                `Failed to persist FAILED status for generation job ${jobId}:`,
                updateError
            );
        }
    } finally {
        activeJobControllers.delete(jobId);
        queuedOrRunningJobIds.delete(jobId);
    }
}

/** Schedules an async generation job in the background without blocking HTTP responses. */
export function enqueueGenerationJob(jobId: string): void {
    if (queuedOrRunningJobIds.has(jobId)) {
        return;
    }

    queuedOrRunningJobIds.add(jobId);
    setImmediate(() => {
        void processGenerationJob(jobId).catch((error) => {
            console.error(`Unhandled error in generation job worker for ${jobId}:`, error);
        });
    });
}

/** Aborts an in-flight AI request for a running job if it is active in this process. */
export function abortRunningGenerationJob(jobId: string): boolean {
    const controller = activeJobControllers.get(jobId);
    if (!controller) {
        return false;
    }

    controller.abort(new Error("Generation job cancelled by user"));
    return true;
}

/**
 * Recovers jobs stranded by an unexpected process crash/restart:
 * - Marks stale `PROCESSING` jobs as `FAILED` (`WORKER_INTERRUPTED`).
 * - Re-enqueues any `PENDING` jobs waiting in PostgreSQL.
 */
export async function recoverStaleGenerationJobs(): Promise<{
    failedStaleProcessing: number;
    requeuedPending: number;
}> {
    const staleResult = await prisma.generationJob.updateMany({
        where: { status: "PROCESSING" },
        data: {
            status: "FAILED",
            completedAt: new Date(),
            errorDetails: {
                code: "WORKER_INTERRUPTED",
                message:
                    "Generation job was interrupted because the API server restarted while it was processing",
                retryable: true,
                recoveredAt: new Date().toISOString()
            }
        }
    });

    const pendingJobs = await prisma.generationJob.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        select: { id: true }
    });

    for (const job of pendingJobs) {
        enqueueGenerationJob(job.id);
    }

    return {
        failedStaleProcessing: staleResult.count,
        requeuedPending: pendingJobs.length
    };
}
