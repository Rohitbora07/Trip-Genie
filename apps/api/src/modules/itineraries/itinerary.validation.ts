import { z } from "zod";

export const tripIdParamSchema = z.object({
    tripId: z.string().trim().uuid("Invalid trip ID format")
});

export const itineraryIdParamSchema = z.object({
    itineraryId: z.string().trim().uuid("Invalid itinerary ID format")
});

export const createItinerarySchema = z.object({
    title: z.string().trim().min(1, "Itinerary title is required"),
    description: z.string().trim().optional(),
    isCurrent: z.boolean().optional()
});

export const updateItinerarySchema = z.object({
    title: z.string().trim().min(1, "Itinerary title is required").optional(),
    description: z.string().trim().optional(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional()
}).strict().refine(
    (data: Record<string, unknown>) => Object.keys(data).length > 0,
    { message: "Provide at least one field to update" }
);
