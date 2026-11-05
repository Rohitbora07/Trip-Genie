import { z } from "zod";

export const itineraryIdParamSchema = z.object({
    itineraryId: z.string().trim().uuid("Invalid itinerary ID format")
});

export const dayIdParamSchema = z.object({
    dayId: z.string().trim().uuid("Invalid day ID format")
});

export const createItineraryDaySchema = z.object({
    dayNumber: z.number().int().min(1, "Day number must be at least 1").optional(),
    date: z.string().trim().refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid date format"
    }).optional(),
    title: z.string().trim().optional(),
    description: z.string().trim().optional()
});

export const updateItineraryDaySchema = z.object({
    dayNumber: z.number().int().min(1, "Day number must be at least 1").optional(),
    date: z.string().trim().refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid date format"
    }).nullable().optional(),
    title: z.string().trim().nullable().optional(),
    description: z.string().trim().nullable().optional()
}).strict().refine(
    (data: Record<string, unknown>) => Object.keys(data).length > 0,
    { message: "Provide at least one field to update" }
);
