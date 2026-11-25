"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import {
  Compass,
  Plus,
  Sparkles,
  Plane,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Zap,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TripCard } from "@/components/trips/trip-card";
import { TripFilters, type FilterCategory } from "@/components/trips/trip-filters";
import { TripCardSkeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import type { Trip } from "@/types/api";

function DashboardContent() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [filter, setFilter] = useState<FilterCategory>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Fetch real trips from backend API
  const loadTrips = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const serverTrips = await api.trips.getAll();
      setTrips(Array.isArray(serverTrips) ? serverTrips : []);
    } catch (err) {
      if (err instanceof ApiError) {
        setApiError(err.message);
      } else {
        setApiError("Unable to connect to Trip Genie API (port 4000). Ensure the backend server is running.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTrips();
  }, []);

  const safeTrips = Array.isArray(trips) ? trips : [];

  // Filter trips
  const filteredTrips = safeTrips.filter((trip) => {
    if (filter === "ALL") return true;
    if (filter === "ACTIVE") return trip.status === "ACTIVE";
    if (filter === "DRAFT") return trip.status === "DRAFT" || trip.status === "PLANNED";
    if (filter === "COMPLETED") return trip.status === "COMPLETED";
    return true;
  });

  return (
    <div className="space-y-8">
      {/* 1. Atelier Header & Title */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[var(--border-default)]">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-muted)] text-[var(--primary)] border border-[var(--border-default)] text-[11px] font-semibold tracking-wide uppercase font-mono shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse" />
            <span>OPERATIONAL MANIFEST ATELIER</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl font-semibold tracking-tight text-[var(--ink-primary)]">
            Expeditions &amp; Manifests
          </h1>
          <p className="text-sm text-[var(--ink-secondary)] max-w-xl font-sans leading-relaxed">
            Curated travel portfolios backed by continuous disruption telemetry, multi-option AI recovery, and cryptographic audit ledgers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="md"
            onClick={loadTrips}
            isLoading={isLoading}
            className="gap-2 bg-[var(--surface)] border-[var(--border-default)] shadow-xs hover:border-[var(--border-strong)]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sync Backend</span>
          </Button>

          <Link href="/trips/new">
            <Button variant="accent" size="md" className="gap-2 shadow-xs">
              <Plus className="w-4 h-4" />
              <span>Plan New Journey</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Operations Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border-default)] shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--ink-secondary)] font-mono">
            <span>REGISTERED EXPEDITIONS</span>
            <Plane className="w-3.5 h-3.5 text-[var(--primary)]" />
          </div>
          <p className="font-serif text-3xl font-semibold text-[var(--ink-primary)]">
            {isLoading ? "—" : safeTrips.length.toString().padStart(2, "0")}
          </p>
          <p className="text-[11px] text-[var(--ink-secondary)] font-mono truncate">
            {safeTrips.length > 0
              ? `${safeTrips.filter((t) => t.status === "ACTIVE").length} Active in Database`
              : "Ready to plan"}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border-default)] shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--ink-secondary)] font-mono">
            <span>TELEMETRY SENSORS</span>
            <Activity className="w-3.5 h-3.5 text-[var(--accent)] animate-pulse" />
          </div>
          <p className="font-serif text-3xl font-semibold text-[var(--ink-primary)]">14</p>
          <p className="text-[11px] text-[var(--ink-secondary)] font-mono">
            OSM • Open-Meteo • Aviation
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border-default)] shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--ink-secondary)] font-mono">
            <span>LANGGRAPH ENGINE</span>
            <Zap className="w-3.5 h-3.5 text-[var(--primary)]" />
          </div>
          <p className="font-serif text-3xl font-semibold text-[var(--ink-primary)]">&lt; 30s</p>
          <p className="text-[11px] text-[var(--status-confirmed-text)] font-medium">
            FastAPI + Groq Active
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border-default)] shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--ink-secondary)] font-mono">
            <span>HUMAN SOVEREIGNTY</span>
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--primary)]" />
          </div>
          <p className="font-serif text-3xl font-semibold text-[var(--ink-primary)]">100%</p>
          <p className="text-[11px] text-[var(--ink-secondary)] font-mono">
            Immutable Audit Trail
          </p>
        </div>
      </div>

      {/* API Connection Banner (if backend unreachable) */}
      {apiError && (
        <div className="p-4 rounded-xl bg-[var(--status-cancelled-bg)] border border-[var(--status-cancelled-border)] flex items-start justify-between gap-4 text-xs text-[var(--status-cancelled-text)]">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Backend Connection Notice</p>
              <p className="text-[11px] text-[var(--ink-secondary)] mt-0.5">{apiError}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadTrips}
            className="text-[11px] h-7 px-2.5 shrink-0 bg-[var(--surface)]"
          >
            Retry Connection
          </Button>
        </div>
      )}

      {/* 3. Real-Time Disruption Demo Highlight Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-[var(--surface)] via-[var(--surface-muted)] to-[var(--surface)] border border-[var(--border-default)] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-[var(--status-confirmed-bg)] border border-[var(--status-confirmed-border)] flex items-center justify-center text-[var(--status-confirmed-text)] shrink-0 shadow-2xs">
            <Sparkles className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-lg font-semibold text-[var(--ink-primary)]">
                Autonomous Travel-Ops Disruption Console
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-[var(--status-confirmed-bg)] text-[var(--status-confirmed-text)] text-[10px] font-mono font-semibold border border-[var(--status-confirmed-border)]">
                LANGGRAPH LINKED
              </span>
            </div>
            <p className="text-xs text-[var(--ink-secondary)] leading-relaxed max-w-2xl font-sans">
              Test real-world incident handling: simulate heavy rainstorms, flight delays, or museum closures to review side-by-side recovery diffs with human approval.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link href={safeTrips.length > 0 ? `/trips/${safeTrips[0].id}/disruptions` : "/trips/new"}>
            <Button variant="primary" size="md" className="gap-2 shadow-xs">
              <AlertTriangle className="w-4 h-4 text-[#B85D38]" />
              <span>{safeTrips.length > 0 ? "Simulate Disruption" : "Plan First Trip"}</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* 4. Filter Strip & Count */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <TripFilters currentFilter={filter} onFilterChange={setFilter} trips={safeTrips} />
        <span className="text-xs text-[var(--ink-tertiary)] font-mono">
          Showing {filteredTrips.length} of {safeTrips.length} expeditions
        </span>
      </div>

      {/* 5. Expeditions Grid or Skeletons or Empty State */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <TripCardSkeleton />
          <TripCardSkeleton />
          <TripCardSkeleton />
        </div>
      ) : filteredTrips.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTrips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      ) : (
        <div className="py-16 px-6 text-center rounded-2xl bg-[var(--surface)] border border-dashed border-[var(--border-default)] space-y-4 shadow-xs">
          <div className="w-12 h-12 mx-auto rounded-xl bg-[var(--surface-muted)] border border-[var(--border-default)] flex items-center justify-center text-[var(--primary)] shadow-2xs">
            <Compass className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="font-serif text-xl font-semibold text-[var(--ink-primary)]">
              No expeditions in your manifest yet
            </h3>
            <p className="text-xs text-[var(--ink-secondary)] max-w-md mx-auto leading-relaxed">
              Create your first journey with custom destination, dates, pace, and dietary guidelines to trigger autonomous itinerary synthesis.
            </p>
          </div>
          <Link href="/trips/new" className="inline-block">
            <Button variant="accent" size="md" className="gap-2 shadow-xs">
              <Plus className="w-4 h-4" />
              <span>Create Your First Journey</span>
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-[var(--ink-tertiary)] font-serif">
          Opening Atelier Dashboard...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
