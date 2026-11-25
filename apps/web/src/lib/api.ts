import type {
  User,
  Trip,
  Itinerary,
  ItineraryDay,
  Activity,
  Place,
  SavedPlaceItem,
  GenerationJob,
  JobType,
  TripStatus,
  TripPreferences,
  DisruptionEvent,
  RecoveryProposal,
  AuditLog,
  DisruptionType,
} from "@/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  details?: unknown;
  code?: string;

  constructor(message: string, status: number, details?: unknown, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
}

export async function apiFetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, ...restOptions } = options;

  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query.append(key, String(value));
      }
    });
    const queryString = query.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  const defaultHeaders: Record<string, string> = {
    Accept: "application/json",
  };

  if (restOptions.body && !(restOptions.body instanceof FormData)) {
    defaultHeaders["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...restOptions,
    // Always include cookies for JWT session handling across subdomains / ports
    credentials: "include",
    headers: {
      ...defaultHeaders,
      ...headers,
    },
  });

  const contentType = response.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}`;
    let details: unknown = undefined;
    let code: string | undefined = undefined;

    if (isJson && typeof payload === "object" && payload !== null) {
      const err = (payload as { error?: { message?: string; details?: unknown; code?: string } }).error;
      if (err) {
        errorMessage = err.message || errorMessage;
        details = err.details;
        code = err.code;
      } else if ("message" in payload && typeof (payload as { message: unknown }).message === "string") {
        errorMessage = (payload as { message: string }).message;
      }
    }

    throw new ApiError(errorMessage, response.status, details, code);
  }

  if (isJson && typeof payload === "object" && payload !== null && "data" in payload) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}

// Helpers to safely unwrap Express envelope properties like { trips: [...] } or { trip: {...} }
function unwrapItem<T>(res: unknown, key: string): T {
  if (res && typeof res === "object" && key in res) {
    return (res as Record<string, T>)[key];
  }
  return res as T;
}

function unwrapArray<T>(res: unknown, key: string): T[] {
  if (Array.isArray(res)) {
    return res as T[];
  }
  if (res && typeof res === "object" && key in res) {
    const val = (res as Record<string, unknown>)[key];
    return Array.isArray(val) ? (val as T[]) : [];
  }
  return [];
}

// ------------------------------------------------------
// TYPED API MODULES
// ------------------------------------------------------

export const api = {
  auth: {
    register: async (body: { name: string; email: string; password: string }) => {
      const res = await apiFetch<User | { user: User }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      });
      return unwrapItem<User>(res, "user");
    },

    login: (body: { email: string; password: string }) =>
      apiFetch<{ user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    logout: () =>
      apiFetch<{ message: string }>("/api/auth/logout", {
        method: "POST",
      }),

    sendVerificationToken: (body: { identifier: string }) =>
      apiFetch<{ message: string }>("/api/auth/send-verification-token", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    verifyEmail: (body: { token: string }) =>
      apiFetch<{ user: User; message: string }>("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    forgotPassword: (body: { email: string }) =>
      apiFetch<{ message: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    resetPassword: (body: { token: string; newPassword: string }) =>
      apiFetch<{ message: string }>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    me: async () => {
      const res = await apiFetch<User | { user: User }>("/api/users/me");
      return unwrapItem<User>(res, "user");
    },

    updateProfile: async (body: {
      name?: string;
      phoneNumber?: string | null;
      avatarUrl?: string | null;
    }) => {
      const res = await apiFetch<User | { user: User }>("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      return unwrapItem<User>(res, "user");
    },
  },

  trips: {
    getAll: async (params?: { status?: TripStatus }) => {
      const res = await apiFetch<Trip[] | { trips: Trip[] }>("/api/trips", { params });
      return unwrapArray<Trip>(res, "trips");
    },

    getById: async (tripId: string) => {
      const res = await apiFetch<Trip | { trip: Trip }>(`/api/trips/${tripId}`);
      return unwrapItem<Trip>(res, "trip");
    },

    create: async (body: {
      title: string;
      description?: string;
      startDate: string;
      endDate: string;
      origin?: string;
      destination: string;
      budget?: number;
      currency?: string;
      travelerCount?: number;
      preferences?: TripPreferences;
      timezone?: string;
    }) => {
      const res = await apiFetch<Trip | { trip: Trip }>("/api/trips", {
        method: "POST",
        body: JSON.stringify(body),
      });
      return unwrapItem<Trip>(res, "trip");
    },

    update: async (tripId: string, body: Partial<Trip>) => {
      const res = await apiFetch<Trip | { trip: Trip }>(`/api/trips/${tripId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      return unwrapItem<Trip>(res, "trip");
    },

    delete: (tripId: string) =>
      apiFetch<{ message: string }>(`/api/trips/${tripId}`, {
        method: "DELETE",
      }),

    getItineraries: async (tripId: string) => {
      const res = await apiFetch<Itinerary[] | { itineraries: Itinerary[] }>(
        `/api/trips/${tripId}/itineraries`
      );
      return unwrapArray<Itinerary>(res, "itineraries");
    },

    createGenerationJob: async (
      tripId: string,
      body: { jobType: JobType; input: Record<string, unknown> }
    ) => {
      const res = await apiFetch<GenerationJob | { job: GenerationJob }>(
        `/api/trips/${tripId}/generation-jobs`,
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );
      return unwrapItem<GenerationJob>(res, "job");
    },
  },

  itineraries: {
    getById: async (itineraryId: string) => {
      const res = await apiFetch<Itinerary | { itinerary: Itinerary }>(
        `/api/itineraries/${itineraryId}`
      );
      return unwrapItem<Itinerary>(res, "itinerary");
    },

    getDays: async (itineraryId: string) => {
      const res = await apiFetch<ItineraryDay[] | { days: ItineraryDay[] }>(
        `/api/itineraries/${itineraryId}/days`
      );
      return unwrapArray<ItineraryDay>(res, "days");
    },

    setCurrent: async (itineraryId: string) => {
      const res = await apiFetch<Itinerary | { itinerary: Itinerary }>(
        `/api/itineraries/${itineraryId}/set-current`,
        {
          method: "PATCH",
        }
      );
      return unwrapItem<Itinerary>(res, "itinerary");
    },

    publish: async (itineraryId: string) => {
      const res = await apiFetch<Itinerary | { itinerary: Itinerary }>(
        `/api/itineraries/${itineraryId}/publish`,
        {
          method: "PATCH",
        }
      );
      return unwrapItem<Itinerary>(res, "itinerary");
    },

    compare: (baseItineraryId: string, comparisonItineraryId: string) =>
      apiFetch<{
        base: Itinerary;
        comparison: Itinerary;
        summary: Record<string, unknown>;
      }>("/api/itineraries/compare", {
        params: { baseId: baseItineraryId, targetId: comparisonItineraryId },
      }),

    reorderActivities: async (dayId: string, activityIds: string[]) => {
      const res = await apiFetch<Activity[] | { activities: Activity[] }>(
        `/api/itinerary-days/${dayId}/activities/reorder`,
        {
          method: "PATCH",
          body: JSON.stringify({ activityIds }),
        }
      );
      return unwrapArray<Activity>(res, "activities");
    },

    createActivity: async (dayId: string, body: Partial<Activity>) => {
      const res = await apiFetch<Activity | { activity: Activity }>(
        `/api/itinerary-days/${dayId}/activities`,
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );
      return unwrapItem<Activity>(res, "activity");
    },

    deleteActivity: (activityId: string) =>
      apiFetch<{ message: string }>(`/api/activities/${activityId}`, {
        method: "DELETE",
      }),
  },

  places: {
    search: async (query: string, limit = 8) => {
      const res = await apiFetch<Place[] | { places: Place[] }>("/api/places/search", {
        params: { q: query, limit },
      });
      const list = unwrapArray<Place>(res, "places");
      return list.map((p, idx) => ({
        ...p,
        id: p.id || p.providerPlaceId || `${p.name}-${idx}`,
      }));
    },

    getById: async (placeId: string) => {
      const res = await apiFetch<Place | { place: Place }>(`/api/places/${placeId}`);
      return unwrapItem<Place>(res, "place");
    },

    saveToFavorites: async (body: {
      placeId?: string;
      name?: string;
      address?: string;
      latitude?: number;
      longitude?: number;
      placeCategory?: string;
      provider?: string;
      providerPlaceId?: string;
      notes?: string;
      category?: string;
    }) => {
      const res = await apiFetch<SavedPlaceItem | { savedPlace: SavedPlaceItem }>(
        "/api/users/me/saved-places",
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );
      return unwrapItem<SavedPlaceItem>(res, "savedPlace");
    },

    getSavedFavorites: async (category?: string) => {
      const res = await apiFetch<SavedPlaceItem[] | { savedPlaces: SavedPlaceItem[] }>(
        "/api/users/me/saved-places",
        { params: category ? { category } : undefined }
      );
      return unwrapArray<SavedPlaceItem>(res, "savedPlaces");
    },

    updateSavedFavorite: async (
      savedPlaceId: string,
      body: { notes?: string | null; category?: string | null }
    ) => {
      const res = await apiFetch<SavedPlaceItem | { savedPlace: SavedPlaceItem }>(
        `/api/users/me/saved-places/${savedPlaceId}`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        }
      );
      return unwrapItem<SavedPlaceItem>(res, "savedPlace");
    },

    removeSavedFavorite: (savedPlaceId: string) =>
      apiFetch<{ message: string }>(`/api/users/me/saved-places/${savedPlaceId}`, {
        method: "DELETE",
      }),
  },

  generationJobs: {
    getAll: async () => {
      const res = await apiFetch<GenerationJob[] | { jobs: GenerationJob[] }>(
        "/api/generation-jobs"
      );
      return unwrapArray<GenerationJob>(res, "jobs");
    },

    getById: async (jobId: string) => {
      const res = await apiFetch<GenerationJob | { job: GenerationJob }>(
        `/api/generation-jobs/${jobId}`
      );
      return unwrapItem<GenerationJob>(res, "job");
    },

    cancel: async (jobId: string) => {
      const res = await apiFetch<GenerationJob | { job: GenerationJob }>(
        `/api/generation-jobs/${jobId}/cancel`,
        {
          method: "POST",
        }
      );
      return unwrapItem<GenerationJob>(res, "job");
    },

    retry: async (jobId: string) => {
      const res = await apiFetch<GenerationJob | { job: GenerationJob }>(
        `/api/generation-jobs/${jobId}/retry`,
        {
          method: "POST",
        }
      );
      return unwrapItem<GenerationJob>(res, "job");
    },
  },

  disruptions: {
    create: (
      tripId: string,
      body: {
        type: DisruptionType;
        severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
        description: string;
        details?: Record<string, unknown>;
      }
    ) =>
      apiFetch<{ message: string; disruption: DisruptionEvent; generationJob: GenerationJob }>(
        `/api/trips/${tripId}/disruptions`,
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      ),

    getByTrip: async (tripId: string) => {
      const res = await apiFetch<
        DisruptionEvent[] | { disruptions: DisruptionEvent[]; auditLogs?: AuditLog[] }
      >(`/api/trips/${tripId}/disruptions`);
      return unwrapArray<DisruptionEvent>(res, "disruptions");
    },

    getWorkspace: async (tripId: string) => {
      const res = await apiFetch<{ disruptions?: DisruptionEvent[]; auditLogs?: AuditLog[] }>(
        `/api/trips/${tripId}/disruptions`
      );
      return {
        disruptions: Array.isArray(res?.disruptions) ? res.disruptions : [],
        auditLogs: Array.isArray(res?.auditLogs) ? res.auditLogs : [],
      };
    },
  },

  recoveryProposals: {
    approve: (proposalId: string) =>
      apiFetch<{ message: string; proposal: RecoveryProposal }>(
        `/api/recovery-proposals/${proposalId}/approve`,
        {
          method: "POST",
        }
      ),

    reject: (proposalId: string, reason?: string) =>
      apiFetch<{ message: string; proposal: RecoveryProposal }>(
        `/api/recovery-proposals/${proposalId}/reject`,
        {
          method: "POST",
          body: JSON.stringify({ reason }),
        }
      ),
  },
};
