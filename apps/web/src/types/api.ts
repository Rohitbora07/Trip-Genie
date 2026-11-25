export type UserStatus = "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl?: string | null;
  phoneNumber?: string | null;
  isEmailVerified: boolean;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export type TripStatus = "DRAFT" | "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export interface TripPreferences {
  pace?: "RELAXED" | "MODERATE" | "PACKED";
  dietary?: string[];
  accessibility?: string[];
  travelStyle?: string;
  interests?: string[];
  [key: string]: unknown;
}

export interface Trip {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  origin?: string | null;
  destination: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  budget?: number | string | null;
  currency: string;
  travelerCount: number;
  timezone?: string | null;
  preferences?: TripPreferences | null;
  createdAt: string;
  updatedAt: string;
  itineraries?: Itinerary[];
}

export type ItineraryStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface Itinerary {
  id: string;
  tripId: string;
  version: number;
  status: ItineraryStatus;
  title: string;
  description?: string | null;
  isCurrent: boolean;
  generationJobId?: string | null;
  createdAt: string;
  updatedAt: string;
  days?: ItineraryDay[];
}

export interface ItineraryDay {
  id: string;
  itineraryId: string;
  dayNumber: number;
  date?: string | null;
  title?: string | null;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  activities?: Activity[];
}

export type ActivityStatus = "PLANNED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface Activity {
  id: string;
  itineraryDayId: string;
  placeId?: string | null;
  title: string;
  description?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
  sortOrder: number;
  estimatedCost?: number | string | null;
  currency: string;
  status: ActivityStatus;
  bookingReference?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  place?: Place | null;
}

export interface Place {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  countryCode?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  category?: string | null;
  provider?: string | null;
  providerPlaceId?: string | null;
  metadata?: {
    rating?: number;
    photos?: string[];
    openingHours?: string[];
    priceLevel?: number;
    website?: string;
    phone?: string;
    addressDetails?: {
      city?: string;
      town?: string;
      village?: string;
      state_district?: string;
      state?: string;
      country?: string;
      country_code?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  } | null;
  createdAt?: string;
  updatedAt?: string;
}

export type JobType = 
  | "ITINERARY_GENERATION"
  | "ITINERARY_UPDATE"
  | "DISRUPTION_RECOVERY"
  | "ACTIVITY_RECOMMENDATION"
  | "BUDGET_OPTIMIZATION";

export type JobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface GenerationJob<TInput = Record<string, unknown>, TResult = Record<string, unknown>> {
  id: string;
  userId: string;
  tripId?: string | null;
  jobType: JobType;
  status: JobStatus;
  input: TInput;
  result?: TResult | null;
  errorDetails?: {
    message?: string;
    code?: string;
    stack?: string;
    [key: string]: unknown;
  } | null;
  retryCount: number;
  maxRetries: number;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    details?: unknown;
    code?: string;
  };
}

export type DisruptionType =
  | "FLIGHT_DELAY"
  | "FLIGHT_CANCELLATION"
  | "HOTEL_OVERBOOKING"
  | "ATTRACTION_CLOSURE"
  | "WEATHER_ALERT"
  | "TRANSIT_STRIKE"
  | "OTHER";

export type ProposalStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "APPLIED";

export interface DisruptionEvent {
  id: string;
  tripId: string;
  type: DisruptionType;
  severity?: string;
  title?: string;
  description?: string | null;
  resolved?: boolean;
  affectedDate?: string | null;
  details?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  proposals?: RecoveryProposal[];
}

export interface RecoveryProposal {
  id: string;
  disruptionEventId: string;
  generationJobId?: string | null;
  itineraryId?: string | null;
  status: ProposalStatus;
  title: string;
  summary?: string | null;
  strategy?: string;
  diffPayload?: {
    added?: Array<string | { title?: string }>;
    removed?: Array<string | { title?: string }>;
    modified?: Array<{
      title?: string;
      previous_start_time?: string | null;
      new_start_time?: string | null;
      new_end_time?: string | null;
    }>;
  } | null;
  tradeOffs?: string[] | null;
  changes?: Record<string, unknown> | unknown[];
  tradeoffs?: Record<string, unknown> | unknown[] | null;
  estimatedCostDelta?: number | string | null;
  confidenceScore?: number | string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  tripId: string;
  actorType: string;
  action: string;
  beforeItineraryId?: string | null;
  afterItineraryId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface SavedPlaceItem {
  id: string;
  userId: string;
  placeId: string;
  notes?: string | null;
  category?: string | null;
  createdAt: string;
  place: Place;
}

