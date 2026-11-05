import {z} from "zod"

export const tripIdParamSchema = z.object({
    tripId: z.string().trim().uuid("Invalid trip ID format")
})

export const getUserTripsQuerySchema = z.object({
    status: z.enum(["DRAFT", "PLANNED", "ACTIVE", "COMPLETED", "CANCELLED"]).optional()
})

export const createTripSchema = z.object({
    title: z.string().trim().min(1, "Trip title is required"),
    description: z.string().trim().optional(),
    startDate: z.string().trim().refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid start date format"
    }),
    endDate: z.string().trim().refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid end date format"
    }),
    origin: z.string().trim().optional(),
    destination: z.string().trim().min(1, "Destination is required"),
    budget: z.number().min(0, "Budget cannot be negative").optional(),
    currency: z.string().trim().length(3, "Currency code must be 3 characters").transform((val) => val.toUpperCase()).optional(),
    travelerCount: z.number().int().min(1, "Traveler count must be at least 1").optional(),
    preferences: z.record(z.string(), z.any()).optional(),
    timezone: z.string().trim().optional()
}).refine(
    (data) => new Date(data.endDate) >= new Date(data.startDate),
    {
        message: "End date must be on or after start date",
        path: ["endDate"]
    }
)

export const updateTripSchema = z.object({
    title: z.string().trim().min(1, "Trip title is required").optional(),
    description: z.string().trim().optional(),
    startDate: z.string().trim().refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid start date format"
    }).optional(),
    endDate: z.string().trim().refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid end date format"
    }).optional(),
    origin: z.string().trim().optional(),
    destination: z.string().trim().min(1, "Destination is required").optional(),
    budget: z.number().min(0, "Budget cannot be negative").optional(),
    currency: z.string().trim().length(3, "Currency code must be 3 characters").transform((val) => val.toUpperCase()).optional(),
    travelerCount: z.number().int().min(1, "Traveler count must be at least 1").optional(),
    preferences: z.record(z.string(), z.any()).optional(),
    timezone: z.string().trim().optional()
}).strict().refine(
    (data: Record<string, unknown>) => Object.keys(data).length > 0,
    { message: "Provide at least one field to update" }
).refine(
    (data) => {
        if (data.startDate && data.endDate) {
            return new Date(data.endDate) >= new Date(data.startDate)
        }
        return true
    },
    {
        message: "End date must be on or after start date",
        path: ["endDate"]
    }
);
