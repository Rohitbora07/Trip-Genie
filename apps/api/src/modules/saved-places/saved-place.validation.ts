import { z } from "zod";
import { createPlaceSchema } from "../places/places.validation";

export const savedPlaceIdParamSchema = z.object({
    savedPlaceId: z.string().trim().uuid("Invalid saved place ID format")
});

export const savePlaceSchema = z.object({
    placeId: z.string().trim().uuid("Invalid place ID format").optional(),
    place: createPlaceSchema.optional(),
    name: z.string().trim().min(1).optional(),
    address: z.string().trim().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    placeCategory: z.string().trim().optional(),
    provider: z.string().trim().optional(),
    providerPlaceId: z.string().trim().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    notes: z.string().trim().optional(),
    category: z.string().trim().optional()
}).refine((data) => {
    return Boolean(data.placeId || data.place?.name || data.name);
}, {
    message: "Either placeId or place details (with name) must be provided"
});

export const updateSavedPlaceSchema = z.object({
    notes: z.string().trim().nullable().optional(),
    category: z.string().trim().nullable().optional()
}).refine((data) => data.notes !== undefined || data.category !== undefined, {
    message: "At least one field (notes or category) must be provided to update"
});

export const getSavedPlacesQuerySchema = z.object({
    category: z.string().trim().optional()
});
