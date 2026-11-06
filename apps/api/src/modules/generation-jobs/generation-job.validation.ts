import { z } from "zod";

export const jobTypeSchema = z.enum([
    "ITINERARY_GENERATION",
    "ITINERARY_UPDATE",
    "DISRUPTION_RECOVERY",
    "ACTIVITY_RECOMMENDATION",
    "BUDGET_OPTIMIZATION"
]);

export const jobStatusSchema = z.enum([
    "PENDING",
    "PROCESSING",
    "COMPLETED",
    "FAILED",
    "CANCELLED"
]);

export const tripIdParamSchema = z.object({
    tripId: z.string().trim().uuid("Invalid trip ID format")
});

export const jobIdParamSchema = z.object({
    jobId: z.string().trim().uuid("Invalid job ID format")
});

export const createGenerationJobSchema = z.object({
    jobType: jobTypeSchema.default("ITINERARY_GENERATION"),
    input: z.record(z.string(), z.any()).optional().default({}),
    maxRetries: z.number().int().min(1, "maxRetries must be at least 1").max(10, "maxRetries cannot exceed 10").optional().default(3)
});

export const getGenerationJobsQuerySchema = z.object({
    status: jobStatusSchema.optional(),
    jobType: jobTypeSchema.optional(),
    tripId: z.string().trim().uuid("Invalid trip ID format").optional(),
    page: z.coerce.number().int().min(1, "Page must be at least 1").optional().default(1),
    limit: z.coerce.number().int().min(1, "Limit must be at least 1").max(100, "Limit cannot exceed 100").optional().default(20)
});
