import { z } from "zod";

export const tripIdParamSchema = z.object({
    tripId: z.string().trim().uuid("Invalid trip ID format")
});

export const disruptionIdParamSchema = z.object({
    disruptionId: z.string().trim().uuid("Invalid disruption ID format")
});

export const disruptionTypeSchema = z.enum([
    "FLIGHT_DELAY",
    "FLIGHT_CANCELLATION",
    "HOTEL_OVERBOOKING",
    "ATTRACTION_CLOSURE",
    "WEATHER_ALERT",
    "TRANSIT_STRIKE",
    "OTHER"
]);

export const disruptionSeveritySchema = z.enum([
    "LOW",
    "MEDIUM",
    "HIGH",
    "CRITICAL"
]);

export const createDisruptionSchema = z.object({
    type: disruptionTypeSchema,
    severity: disruptionSeveritySchema.optional().default("MEDIUM"),
    description: z.string().trim().min(3, "Description must be at least 3 characters"),
    details: z.record(z.string(), z.unknown()).optional().default({})
});

export type CreateDisruptionInput = z.infer<typeof createDisruptionSchema>;
