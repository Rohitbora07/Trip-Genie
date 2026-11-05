import { z } from "zod";

export const placeIdParamSchema = z.object({
    placeId: z.string().trim().uuid("Invalid place ID format")
});

export const searchPlacesQuerySchema = z.object({
    q: z.string().trim().min(1, "Search query is required"),
    limit: z.coerce.number().int().min(1).max(30).optional()
});

export const createPlaceSchema = z.object({
    name: z.string().trim().min(1, "Place name is required"),
    address: z.string().trim().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    category: z.string().trim().optional(),
    provider: z.string().trim().optional(),
    providerPlaceId: z.string().trim().optional(),
    metadata: z.record(z.string(), z.any()).optional()
});
