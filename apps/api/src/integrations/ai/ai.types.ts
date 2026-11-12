export type TravelPace = "relaxed" | "moderate" | "packed";

export type PlaceCategory =
    | "ATTRACTION"
    | "RESTAURANT"
    | "HOTEL"
    | "AIRPORT"
    | "TRANSIT"
    | "ACTIVITY"
    | "OTHER";

export interface AiTravelPreferences {
    pace?: TravelPace | null;
    interests?: string[];
    accommodation_style?: string | null;
    transport_preference?: string | null;
}

export interface AiTripConstraints {
    dietary?: string[];
    accessibility?: string[];
}

export interface AiTripInput {
    destination: string;
    origin?: string | null;
    start_date: string;
    end_date: string;
    traveler_count: number;
    budget?: number | null;
    currency: string;
    preferences?: AiTravelPreferences | null;
    constraints?: AiTripConstraints | null;
    additional_instructions?: string | null;
}

export interface AiGenerationOptions {
    model?: string | null;
    temperature?: number | null;
    max_tokens?: number | null;
}

export interface GenerateItineraryRequest {
    request_id?: string | null;
    trip_id?: string | null;
    generation_job_id?: string | null;
    trip: AiTripInput;
    options?: AiGenerationOptions | null;
}

export interface AiPlaceInfo {
    name: string;
    address?: string | null;
    category: PlaceCategory;
    latitude?: number | null;
    longitude?: number | null;
}

export interface AiActivityTiming {
    start_time: string;
    end_time: string;
    duration_minutes: number;
}

export interface AiItineraryActivity {
    title: string;
    description: string;
    timing: AiActivityTiming;
    place: AiPlaceInfo;
    estimated_cost: number;
    currency: string;
    notes?: string | null;
}

export interface AiItineraryDay {
    day_number: number;
    date?: string | null;
    title: string;
    summary?: string | null;
    activities: AiItineraryActivity[];
    daily_cost_total: number;
}

export interface AiItineraryOutput {
    title: string;
    summary: string;
    currency: string;
    days: AiItineraryDay[];
    total_estimated_cost: number;
    highlights: string[];
}

export interface AiTokenUsage {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
}

export interface AiResponseMetadata {
    model: string;
    latency_ms: number;
    usage?: AiTokenUsage | null;
}

export interface GenerateItineraryData {
    trip_id?: string | null;
    generation_job_id?: string | null;
    itinerary: AiItineraryOutput;
    metadata: AiResponseMetadata;
}

export interface GenerateItineraryResponse {
    success: true;
    request_id: string;
    data: GenerateItineraryData;
}

export interface AiApiErrorDetail {
    code: string;
    message: string;
    retryable: boolean;
    details?: Array<Record<string, unknown>> | Record<string, unknown> | null;
}

export interface AiErrorEnvelope {
    success: false;
    request_id?: string;
    error: AiApiErrorDetail;
}

export interface AiServiceErrorDetails {
    code: string;
    message: string;
    retryable: boolean;
    httpStatus?: number;
    requestId?: string;
    details?: unknown;
}
