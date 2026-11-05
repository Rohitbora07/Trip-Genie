import { z } from "zod";

export const activityIdParamSchema = z.object({
    activityId: z.string().trim().uuid("Invalid activity ID format")
});

export const dayIdParamSchema = z.object({
    dayId: z.string().trim().uuid("Invalid day ID format")
});

export const activityStatusEnum = z.enum([
    "PLANNED",
    "CONFIRMED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED"
]);

export const createActivitySchema = z.object({
    title: z.string().trim().min(1, "Activity title is required"),
    description: z.string().trim().optional(),
    placeId: z.string().trim().uuid("Invalid place ID format").optional(),
    startTime: z.string().trim().refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid start time format"
    }).optional(),
    endTime: z.string().trim().refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid end time format"
    }).optional(),
    durationMinutes: z.number().int().min(1, "Duration must be at least 1 minute").optional(),
    sortOrder: z.number().int().min(0).optional(),
    estimatedCost: z.number().min(0, "Estimated cost cannot be negative").optional(),
    currency: z.string().trim().length(3, "Currency code must be 3 characters").transform((val) => val.toUpperCase()).optional(),
    status: activityStatusEnum.optional(),
    bookingReference: z.string().trim().optional(),
    metadata: z.record(z.string(), z.any()).optional()
}).refine(
    (data) => {
        if (data.startTime && data.endTime) {
            return new Date(data.endTime) >= new Date(data.startTime);
        }
        return true;
    },
    {
        message: "End time must be on or after start time",
        path: ["endTime"]
    }
);

export const updateActivitySchema = z.object({
    title: z.string().trim().min(1, "Activity title is required").optional(),
    description: z.string().trim().nullable().optional(),
    placeId: z.string().trim().uuid("Invalid place ID format").nullable().optional(),
    startTime: z.string().trim().refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid start time format"
    }).nullable().optional(),
    endTime: z.string().trim().refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid end time format"
    }).nullable().optional(),
    durationMinutes: z.number().int().min(1, "Duration must be at least 1 minute").nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
    estimatedCost: z.number().min(0, "Estimated cost cannot be negative").nullable().optional(),
    currency: z.string().trim().length(3, "Currency code must be 3 characters").transform((val) => val.toUpperCase()).optional(),
    status: activityStatusEnum.optional(),
    bookingReference: z.string().trim().nullable().optional(),
    metadata: z.record(z.string(), z.any()).nullable().optional()
}).strict().refine(
    (data: Record<string, unknown>) => Object.keys(data).length > 0,
    { message: "Provide at least one field to update" }
).refine(
    (data) => {
        if (data.startTime && data.endTime) {
            return new Date(data.endTime) >= new Date(data.startTime);
        }
        return true;
    },
    {
        message: "End time must be on or after start time",
        path: ["endTime"]
    }
);

export const updateActivityStatusSchema = z.object({
    status: activityStatusEnum
});

export const reorderActivitiesSchema = z.object({
    activityIds: z.array(z.string().trim().uuid("Invalid activity ID format")).min(1, "At least one activity ID is required")
});
