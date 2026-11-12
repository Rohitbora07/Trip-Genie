import type {
    AiGenerationOptions,
    AiItineraryOutput,
    AiTravelPreferences,
    AiTripConstraints,
    GenerateItineraryRequest,
    PlaceCategory,
    TravelPace
} from "./ai.types";

export interface TripForAiMapping {
    id: string;
    title: string;
    description?: string | null;
    origin?: string | null;
    destination: string;
    startDate: Date;
    endDate: Date;
    budget?: unknown;
    currency: string;
    travelerCount: number;
    preferences?: unknown;
}

export interface MappedPlaceForPersistence {
    name: string;
    address: string | null;
    category: PlaceCategory;
    latitude: number | null;
    longitude: number | null;
}

export interface MappedActivityForPersistence {
    title: string;
    description: string;
    startTime: Date | null;
    endTime: Date | null;
    durationMinutes: number;
    sortOrder: number;
    estimatedCost: number;
    currency: string;
    metadata: Record<string, unknown> | null;
    place: MappedPlaceForPersistence;
}

export interface MappedDayForPersistence {
    dayNumber: number;
    date: Date;
    title: string;
    description: string | null;
    activities: MappedActivityForPersistence[];
}

export interface MappedItineraryForPersistence {
    title: string;
    description: string;
    currency: string;
    totalEstimatedCost: number;
    highlights: string[];
    days: MappedDayForPersistence[];
}

const VALID_PACES: ReadonlySet<string> = new Set(["relaxed", "moderate", "packed"]);
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toCleanString(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function toCleanStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) {
        return undefined;
    }
    const cleaned = value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    return cleaned;
}

function toOptionalNumber(value: unknown): number | null {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
    }
    if (isPlainRecord(value) && typeof value.toNumber === "function") {
        const parsed = (value as { toNumber: () => number }).toNumber();
        return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof (value as { toString?: () => string }).toString === "function") {
        const parsed = Number(String(value));
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

/** Formats a Date as YYYY-MM-DD in UTC (matching Prisma `@db.Date` storage). */
export function formatDateOnlyUtc(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function extractPreferences(
    tripPreferences: unknown,
    jobPreferences: unknown
): AiTravelPreferences | null {
    const merged: Record<string, unknown> = {
        ...(isPlainRecord(tripPreferences) ? tripPreferences : {}),
        ...(isPlainRecord(jobPreferences) ? jobPreferences : {})
    };

    const rawPace = toCleanString(merged.pace)?.toLowerCase();
    const pace: TravelPace | null | undefined =
        rawPace && VALID_PACES.has(rawPace) ? (rawPace as TravelPace) : undefined;
    const interests = toCleanStringArray(merged.interests);
    const accommodationStyle = toCleanString(
        merged.accommodationStyle ?? merged.accommodation_style
    );
    const transportPreference = toCleanString(
        merged.transportPreference ?? merged.transport_preference
    );

    const result: AiTravelPreferences = {};
    if (pace !== undefined) {
        result.pace = pace;
    }
    if (interests !== undefined) {
        result.interests = interests;
    }
    if (accommodationStyle !== null) {
        result.accommodation_style = accommodationStyle;
    }
    if (transportPreference !== null) {
        result.transport_preference = transportPreference;
    }

    return Object.keys(result).length > 0 ? result : null;
}

function extractConstraints(
    tripPreferences: unknown,
    jobConstraints: unknown
): AiTripConstraints | null {
    const tripNestedConstraints =
        isPlainRecord(tripPreferences) && isPlainRecord(tripPreferences.constraints)
            ? tripPreferences.constraints
            : {};

    const merged: Record<string, unknown> = {
        ...tripNestedConstraints,
        ...(isPlainRecord(jobConstraints) ? jobConstraints : {})
    };

    const dietary = toCleanStringArray(merged.dietary);
    const accessibility = toCleanStringArray(merged.accessibility);

    const result: AiTripConstraints = {};
    if (dietary !== undefined) {
        result.dietary = dietary;
    }
    if (accessibility !== undefined) {
        result.accessibility = accessibility;
    }

    return Object.keys(result).length > 0 ? result : null;
}

function extractGenerationOptions(rawOptions: unknown): AiGenerationOptions | null {
    if (!isPlainRecord(rawOptions)) {
        return null;
    }

    const model = toCleanString(rawOptions.model);
    const temperature = toOptionalNumber(rawOptions.temperature);
    const maxTokens = toOptionalNumber(rawOptions.maxTokens ?? rawOptions.max_tokens);

    const options: AiGenerationOptions = {};
    if (model !== null) {
        options.model = model;
    }
    if (temperature !== null) {
        options.temperature = temperature;
    }
    if (maxTokens !== null) {
        options.max_tokens = Math.trunc(maxTokens);
    }

    return Object.keys(options).length > 0 ? options : null;
}

/**
 * Translates Express/Prisma Trip & GenerationJob input (`camelCase`, `Date`, `Decimal`)
 * into FastAPI's `GenerateItineraryRequest` (`snake_case`, `YYYY-MM-DD`).
 */
export function mapTripToGenerateItineraryRequest(params: {
    requestId: string;
    trip: TripForAiMapping;
    generationJobId: string;
    jobInput: unknown;
}): GenerateItineraryRequest {
    const { requestId, trip, generationJobId, jobInput } = params;
    const inputRecord = isPlainRecord(jobInput) ? jobInput : {};

    const budget = toOptionalNumber(inputRecord.budget ?? trip.budget);
    const travelerCountRaw = toOptionalNumber(
        inputRecord.travelerCount ?? inputRecord.traveler_count ?? trip.travelerCount
    );
    const travelerCount = travelerCountRaw && travelerCountRaw >= 1 ? Math.trunc(travelerCountRaw) : 1;

    const currencyRaw =
        toCleanString(inputRecord.currency) ?? toCleanString(trip.currency) ?? "USD";
    const currency = currencyRaw.toUpperCase().slice(0, 3);

    const preferences = extractPreferences(trip.preferences, inputRecord.preferences);
    const constraints = extractConstraints(trip.preferences, inputRecord.constraints);
    const additionalInstructions = toCleanString(
        inputRecord.additionalInstructions ??
            inputRecord.additional_instructions ??
            inputRecord.instructions ??
            inputRecord.prompt
    );
    const options = extractGenerationOptions(inputRecord.options);

    return {
        request_id: requestId,
        trip_id: trip.id,
        generation_job_id: generationJobId,
        trip: {
            destination: trip.destination.trim(),
            origin: toCleanString(trip.origin),
            start_date: formatDateOnlyUtc(trip.startDate),
            end_date: formatDateOnlyUtc(trip.endDate),
            traveler_count: travelerCount,
            budget,
            currency,
            preferences,
            constraints,
            additional_instructions: additionalInstructions
        },
        options
    };
}

/** Resolves a calendar Date (UTC midnight) for an itinerary day. */
export function resolveItineraryDayDate(
    tripStartDate: Date,
    dayNumber: number,
    aiDayDate?: string | null
): Date {
    if (aiDayDate && DATE_ONLY_REGEX.test(aiDayDate.trim())) {
        return new Date(`${aiDayDate.trim()}T00:00:00.000Z`);
    }

    const base = new Date(`${formatDateOnlyUtc(tripStartDate)}T00:00:00.000Z`);
    base.setUTCDate(base.getUTCDate() + Math.max(0, dayNumber - 1));
    return base;
}

/** Combines a calendar Date and a 24-hour `HH:MM` string into a UTC DateTime. */
export function combineDayDateAndHHMM(dayDate: Date, hhmm: string): Date | null {
    const match = HHMM_REGEX.exec(hhmm.trim());
    if (!match) {
        return null;
    }
    const ymd = formatDateOnlyUtc(dayDate);
    return new Date(`${ymd}T${match[1]}:${match[2]}:00.000Z`);
}

/**
 * Translates FastAPI's `ItineraryOutput` (`snake_case`, `HH:MM`) into normalized
 * Prisma-ready structures (`camelCase`, `Date`) for transactional persistence.
 */
export function mapAiItineraryToPersistenceData(params: {
    tripStartDate: Date;
    itinerary: AiItineraryOutput;
}): MappedItineraryForPersistence {
    const { tripStartDate, itinerary } = params;

    return {
        title: itinerary.title.trim(),
        description: itinerary.summary.trim(),
        currency: itinerary.currency.trim().toUpperCase(),
        totalEstimatedCost: itinerary.total_estimated_cost,
        highlights: itinerary.highlights ?? [],
        days: itinerary.days.map((day) => {
            const dayDate = resolveItineraryDayDate(tripStartDate, day.day_number, day.date);

            return {
                dayNumber: day.day_number,
                date: dayDate,
                title: day.title.trim(),
                description: toCleanString(day.summary),
                activities: day.activities.map((activity, index) => {
                    const startTime = combineDayDateAndHHMM(dayDate, activity.timing.start_time);
                    const endTime = combineDayDateAndHHMM(dayDate, activity.timing.end_time);
                    const notes = toCleanString(activity.notes);

                    return {
                        title: activity.title.trim(),
                        description: activity.description.trim(),
                        startTime,
                        endTime,
                        durationMinutes: activity.timing.duration_minutes,
                        sortOrder: index + 1,
                        estimatedCost: activity.estimated_cost,
                        currency: activity.currency.trim().toUpperCase(),
                        metadata: notes
                            ? {
                                  notes,
                                  aiGenerated: true
                              }
                            : { aiGenerated: true },
                        place: {
                            name: activity.place.name.trim(),
                            address: toCleanString(activity.place.address),
                            category: activity.place.category,
                            latitude: activity.place.latitude ?? null,
                            longitude: activity.place.longitude ?? null
                        }
                    };
                })
            };
        })
    };
}
