import { prisma } from "../../db/prisma";

export type JobType = 
    | "ITINERARY_GENERATION"
    | "ITINERARY_UPDATE"
    | "DISRUPTION_RECOVERY"
    | "ACTIVITY_RECOMMENDATION"
    | "BUDGET_OPTIMIZATION";

export type JobStatus = 
    | "PENDING"
    | "PROCESSING"
    | "COMPLETED"
    | "FAILED"
    | "CANCELLED";

export type CreateGenerationJobInput = {
    jobType: JobType;
    input?: Record<string, any>;
    maxRetries?: number;
};

export type GetGenerationJobsQuery = {
    status?: JobStatus;
    jobType?: JobType;
    tripId?: string;
    page?: number;
    limit?: number;
};

export class TripNotFoundError extends Error {
    constructor(message = "Trip not found") {
        super(message);
        this.name = "TripNotFoundError";
    }
}

export class JobNotFoundError extends Error {
    constructor(message = "Generation job not found") {
        super(message);
        this.name = "JobNotFoundError";
    }
}

export class ForbiddenError extends Error {
    constructor(message = "You are not authorized to perform this action") {
        super(message);
        this.name = "ForbiddenError";
    }
}

export class DuplicateJobConflictError extends Error {
    public activeJob: {
        id: string;
        jobType: JobType;
        status: JobStatus;
        createdAt: Date;
    };

    constructor(
        message: string, 
        activeJob: { id: string; jobType: JobType; status: JobStatus; createdAt: Date }
    ) {
        super(message);
        this.name = "DuplicateJobConflictError";
        this.activeJob = activeJob;
    }
}

export class InvalidStateTransitionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvalidStateTransitionError";
    }
}

export class MaxRetriesExceededError extends Error {
    constructor(message = "Maximum retry attempts reached for this job") {
        super(message);
        this.name = "MaxRetriesExceededError";
    }
}

export async function createGenerationJob(
    tripId: string,
    userId: string,
    data: CreateGenerationJobInput
) {
    const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        select: { id: true, userId: true, title: true }
    });

    if (!trip) {
        throw new TripNotFoundError("Trip not found");
    }

    if (trip.userId !== userId) {
        throw new ForbiddenError("You are not authorized to create generation jobs for this trip");
    }

    // Duplicate-request protection: check for existing active job of the same type for this trip
    const activeJob = await prisma.generationJob.findFirst({
        where: {
            tripId,
            jobType: data.jobType,
            status: { in: ["PENDING", "PROCESSING"] }
        },
        select: {
            id: true,
            jobType: true,
            status: true,
            createdAt: true
        }
    });

    if (activeJob) {
        throw new DuplicateJobConflictError(
            `A generation job of type '${data.jobType}' is already ${activeJob.status.toLowerCase()} for this trip`,
            activeJob
        );
    }

    const job = await prisma.generationJob.create({
        data: {
            userId,
            tripId,
            jobType: data.jobType,
            input: data.input ?? {},
            maxRetries: data.maxRetries ?? 3,
            status: "PENDING"
        },
        include: {
            trip: {
                select: {
                    id: true,
                    title: true,
                    destination: true
                }
            }
        }
    });

    return job;
}

export async function getUserGenerationJobs(
    userId: string,
    query: GetGenerationJobsQuery
) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: any = {
        userId,
        ...(query.status && { status: query.status }),
        ...(query.jobType && { jobType: query.jobType }),
        ...(query.tripId && { tripId: query.tripId })
    };

    const [total, jobs] = await prisma.$transaction([
        prisma.generationJob.count({ where }),
        prisma.generationJob.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            include: {
                trip: {
                    select: {
                        id: true,
                        title: true,
                        destination: true
                    }
                }
            }
        })
    ]);

    return {
        jobs,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    };
}

export async function getGenerationJobById(jobId: string, userId: string) {
    const job = await prisma.generationJob.findUnique({
        where: { id: jobId },
        include: {
            trip: {
                select: {
                    id: true,
                    title: true,
                    destination: true,
                    startDate: true,
                    endDate: true
                }
            },
            itineraries: {
                select: {
                    id: true,
                    version: true,
                    title: true,
                    status: true,
                    isCurrent: true,
                    createdAt: true
                }
            }
        }
    });

    if (!job) {
        throw new JobNotFoundError("Generation job not found");
    }

    if (job.userId !== userId) {
        throw new ForbiddenError("You are not authorized to view this generation job");
    }

    return job;
}

export async function cancelGenerationJob(jobId: string, userId: string) {
    const job = await prisma.generationJob.findUnique({
        where: { id: jobId }
    });

    if (!job) {
        throw new JobNotFoundError("Generation job not found");
    }

    if (job.userId !== userId) {
        throw new ForbiddenError("You are not authorized to cancel this generation job");
    }

    // Safe cancellation rules
    if (job.status === "CANCELLED") {
        return job; // Idempotent return
    }

    if (job.status === "COMPLETED") {
        throw new InvalidStateTransitionError("Cannot cancel a generation job that has already completed");
    }

    if (job.status === "FAILED") {
        throw new InvalidStateTransitionError("Cannot cancel a generation job that has already failed");
    }

    return prisma.generationJob.update({
        where: { id: jobId },
        data: {
            status: "CANCELLED",
            completedAt: new Date()
        },
        include: {
            trip: {
                select: {
                    id: true,
                    title: true,
                    destination: true
                }
            }
        }
    });
}

export async function retryGenerationJob(jobId: string, userId: string) {
    const job = await prisma.generationJob.findUnique({
        where: { id: jobId }
    });

    if (!job) {
        throw new JobNotFoundError("Generation job not found");
    }

    if (job.userId !== userId) {
        throw new ForbiddenError("You are not authorized to retry this generation job");
    }

    // Only FAILED or CANCELLED jobs can be retried
    if (job.status === "PENDING" || job.status === "PROCESSING") {
        throw new InvalidStateTransitionError(
            `Job is currently ${job.status.toLowerCase()}; cannot retry an active job`
        );
    }

    if (job.status === "COMPLETED") {
        throw new InvalidStateTransitionError(
            "Job has already completed successfully; please create a new generation job instead"
        );
    }

    if (job.retryCount >= job.maxRetries) {
        throw new MaxRetriesExceededError(
            `Maximum retry limit (${job.maxRetries} attempts) has been reached for this job`
        );
    }

    return prisma.generationJob.update({
        where: { id: jobId },
        data: {
            status: "PENDING",
            retryCount: { increment: 1 },
            errorDetails: null,
            startedAt: null,
            completedAt: null
        },
        include: {
            trip: {
                select: {
                    id: true,
                    title: true,
                    destination: true
                }
            }
        }
    });
}
