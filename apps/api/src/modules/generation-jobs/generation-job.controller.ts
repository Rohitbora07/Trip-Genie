import type { Request, Response } from "express";
import {
    createGenerationJob,
    getUserGenerationJobs,
    getGenerationJobById,
    cancelGenerationJob,
    retryGenerationJob,
    TripNotFoundError,
    JobNotFoundError,
    ForbiddenError,
    DuplicateJobConflictError,
    InvalidStateTransitionError,
    MaxRetriesExceededError
} from "./generation-job.service";
import {
    tripIdParamSchema,
    jobIdParamSchema,
    createGenerationJobSchema,
    getGenerationJobsQuerySchema
} from "./generation-job.validation";

export async function createGenerationJobController(req: Request, res: Response) {
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

    const bodyValidation = createGenerationJobSchema.safeParse(req.body);
    if (!bodyValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid generation job data",
                details: bodyValidation.error.issues
            }
        });
    }

    try {
        const job = await createGenerationJob(
            paramValidation.data.tripId,
            req.user.id,
            bodyValidation.data
        );

        return res.status(201).json({
            success: true,
            data: {
                message: "Generation job created successfully",
                job
            }
        });
    } catch (error) {
        console.error("Error creating generation job:", error);

        if (error instanceof TripNotFoundError) {
            return res.status(404).json({
                success: false,
                error: { message: error.message }
            });
        }

        if (error instanceof ForbiddenError) {
            return res.status(403).json({
                success: false,
                error: { message: error.message }
            });
        }

        if (error instanceof DuplicateJobConflictError) {
            return res.status(409).json({
                success: false,
                error: {
                    message: error.message,
                    activeJob: error.activeJob
                }
            });
        }

        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" }
        });
    }
}

export async function getUserGenerationJobsController(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        });
    }

    const queryValidation = getGenerationJobsQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid query parameters",
                details: queryValidation.error.issues
            }
        });
    }

    try {
        const result = await getUserGenerationJobs(req.user.id, queryValidation.data);

        return res.status(200).json({
            success: true,
            data: {
                jobs: result.jobs,
                pagination: result.pagination
            }
        });
    } catch (error) {
        console.error("Error fetching generation jobs:", error);
        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" }
        });
    }
}

export async function getGenerationJobByIdController(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        });
    }

    const paramValidation = jobIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid job ID parameter",
                details: paramValidation.error.issues
            }
        });
    }

    try {
        const job = await getGenerationJobById(paramValidation.data.jobId, req.user.id);

        return res.status(200).json({
            success: true,
            data: { job }
        });
    } catch (error) {
        console.error("Error fetching generation job:", error);

        if (error instanceof JobNotFoundError) {
            return res.status(404).json({
                success: false,
                error: { message: error.message }
            });
        }

        if (error instanceof ForbiddenError) {
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

export async function cancelGenerationJobController(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        });
    }

    const paramValidation = jobIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid job ID parameter",
                details: paramValidation.error.issues
            }
        });
    }

    try {
        const job = await cancelGenerationJob(paramValidation.data.jobId, req.user.id);

        return res.status(200).json({
            success: true,
            data: {
                message: "Generation job cancelled successfully",
                job
            }
        });
    } catch (error) {
        console.error("Error cancelling generation job:", error);

        if (error instanceof JobNotFoundError) {
            return res.status(404).json({
                success: false,
                error: { message: error.message }
            });
        }

        if (error instanceof ForbiddenError) {
            return res.status(403).json({
                success: false,
                error: { message: error.message }
            });
        }

        if (error instanceof InvalidStateTransitionError) {
            return res.status(400).json({
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

export async function retryGenerationJobController(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        });
    }

    const paramValidation = jobIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid job ID parameter",
                details: paramValidation.error.issues
            }
        });
    }

    try {
        const job = await retryGenerationJob(paramValidation.data.jobId, req.user.id);

        return res.status(200).json({
            success: true,
            data: {
                message: "Generation job reset and queued for retry",
                job
            }
        });
    } catch (error) {
        console.error("Error retrying generation job:", error);

        if (error instanceof JobNotFoundError) {
            return res.status(404).json({
                success: false,
                error: { message: error.message }
            });
        }

        if (error instanceof ForbiddenError) {
            return res.status(403).json({
                success: false,
                error: { message: error.message }
            });
        }

        if (error instanceof InvalidStateTransitionError || error instanceof MaxRetriesExceededError) {
            return res.status(400).json({
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
