"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  MapPin,
  Calendar,
  Users,
  Search,
  AlertTriangle,
  RefreshCw,
  GitBranch,
  Map,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DaySelector } from "@/features/itinerary/components/day-selector";
import { ActivityList } from "@/features/itinerary/components/activity-list";
import { PlaceLookupDrawer } from "@/features/itinerary/components/place-lookup-drawer";
import { FloatingActionBar } from "@/features/itinerary/components/floating-action-bar";
import { ItineraryRouteMap } from "@/features/itinerary/components/itinerary-route-map";
import { TimelineSkeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import type { Trip, ItineraryDay, Activity, Place } from "@/types/api";

interface TripTimelineViewProps {
  tripId: string;
}

export function TripTimelineView({ tripId }: TripTimelineViewProps) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [selectedDayId, setSelectedDayId] = useState<string>("");
  const [selectedVersion, setSelectedVersion] = useState<string>("v1");
  const [isPlaceDrawerOpen, setIsPlaceDrawerOpen] = useState(false);
  const [showRouteMap, setShowRouteMap] = useState(true);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generateTrigger, setGenerateTrigger] = useState(0);

  const loadTripData = React.useCallback(async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    setLoadError(null);
    try {
      const data = await api.trips.getById(tripId);
      if (data) {
        setTrip(data);
        const currentItin =
          data.itineraries?.find((it) => it.isCurrent) || data.itineraries?.[0];
        if (currentItin) {
          setSelectedVersion(`v${currentItin.version}`);
        }
        if (currentItin?.days && currentItin.days.length > 0) {
          setDays(currentItin.days);
          setSelectedDayId((prev) =>
            currentItin.days?.some((d) => d.id === prev)
              ? prev
              : currentItin.days![0].id
          );
        } else {
          setDays([]);
        }
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Unable to load trip itinerary from backend.";
      setLoadError(msg);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  }, [tripId]);

  // Fetch real trip details from API
  useEffect(() => {
    void loadTripData(true);
  }, [loadTripData]);

  if (isLoading) {
    return <TimelineSkeleton />;
  }

  if (loadError && !trip) {
    return (
      <div className="p-8 rounded-2xl border border-[var(--status-disrupted-border)] bg-[var(--status-disrupted-bg)]/40 text-center space-y-4">
        <div className="w-11 h-11 mx-auto rounded-xl bg-[var(--surface)] border border-[var(--status-disrupted-border)] flex items-center justify-center text-[var(--status-disrupted-text)]">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h3 className="font-serif text-xl font-semibold text-[var(--ink-primary)]">
            Could not load this expedition
          </h3>
          <p className="text-xs text-[var(--ink-secondary)] max-w-md mx-auto">
            {loadError}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Expeditions</span>
            </Button>
          </Link>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void loadTripData(true)}
            className="gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </Button>
        </div>
      </div>
    );
  }

  const currentDay = days.find((d) => d.id === selectedDayId) || days[0];

  const handleAddPlaceToDay = async (place: Place) => {
    if (!currentDay) return;

    const newActivityPayload: Partial<Activity> = {
      title: place.name,
      description: place.address || "Venue added from place lookup.",
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
      durationMinutes: 90,
      sortOrder: (currentDay.activities?.length || 0),
      estimatedCost: 0,
      currency: trip?.currency || "INR",
      status: "PLANNED",
    };

    // Optimistic local add
    const tempActivity: Activity = {
      id: `act-${Date.now()}`,
      itineraryDayId: currentDay.id,
      title: place.name,
      description: place.address || "Venue added from place lookup.",
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
      durationMinutes: 90,
      sortOrder: (currentDay.activities?.length || 0),
      estimatedCost: 0,
      currency: trip?.currency || "INR",
      status: "PLANNED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      place,
    };

    const updatedDays = days.map((d) => {
      if (d.id === currentDay.id) {
        return {
          ...d,
          activities: [...(d.activities || []), tempActivity],
        };
      }
      return d;
    });
    setDays(updatedDays);

    try {
      await api.itineraries.createActivity(currentDay.id, newActivityPayload);
      void loadTripData(false);
    } catch (err) {
      console.error("Failed to persist activity to backend:", err);
    }
  };

  const handleActivitiesChange = (updatedActivities: Activity[]) => {
    if (!currentDay) return;
    const updatedDays = days.map((d) => {
      if (d.id === currentDay.id) {
        return { ...d, activities: updatedActivities };
      }
      return d;
    });
    setDays(updatedDays);
  };

  return (
    <div className="space-y-6">
      {/* Refresh error banner if trip already loaded */}
      {loadError && (
        <div className="p-3.5 rounded-xl bg-[var(--status-disrupted-bg)]/50 border border-[var(--status-disrupted-border)] flex items-center justify-between text-xs text-[var(--status-disrupted-text)]">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => void loadTripData(false)}
            className="font-mono underline hover:opacity-80"
          >
            Retry
          </button>
        </div>
      )}

      {/* Back Link & Quick Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Expeditions</span>
        </Link>

        {/* Version Badge & Disruption Indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--surface)] border border-[var(--border-default)] text-xs font-mono text-[var(--ink-secondary)] shadow-2xs">
            <GitBranch className="w-3.5 h-3.5 text-[var(--primary)]" />
            <span>Itinerary {selectedVersion} (Active)</span>
          </div>
          {trip && (
            <Badge variant="confirmed" size="sm">
              {trip.status}
            </Badge>
          )}
        </div>
      </div>

      {/* Editorial Trip Header with Warm Contrasting Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border-default)] shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono text-[var(--primary)] uppercase tracking-wider font-semibold">
              <MapPin className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>{trip?.destination}</span>
              {trip?.origin && (
                <span className="text-[var(--ink-tertiary)]">• Origin: {trip.origin}</span>
              )}
            </div>
            <h1 className="font-serif text-3xl sm:text-5xl font-semibold tracking-tight text-[var(--ink-primary)]">
              {trip?.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--ink-secondary)] pt-1">
              <span className="flex items-center gap-1.5 font-mono">
                <Calendar className="w-3.5 h-3.5 text-[var(--ink-tertiary)]" />
                <span>
                  {trip?.startDate && trip?.endDate
                    ? (() => {
                        const s = new Date(trip.startDate);
                        const e = new Date(trip.endDate);
                        const nights = Math.max(
                          1,
                          Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))
                        );
                        return `${s.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })} – ${e.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })} (${nights} ${nights === 1 ? "Night" : "Nights"})`;
                      })()
                    : "Schedule pending"}
                </span>
              </span>
              <span className="flex items-center gap-1.5 font-mono">
                <Users className="w-3.5 h-3.5 text-[var(--ink-tertiary)]" />
                <span>{trip?.travelerCount} Travelers</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--primary)]">
                🌿 {trip?.preferences?.pace || "Moderate"} Pace
              </span>
            </div>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode Toggle: Map vs List */}
            <button
              type="button"
              onClick={() => setShowRouteMap(!showRouteMap)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                showRouteMap
                  ? "bg-[var(--surface-muted)] border-[var(--primary)] text-[var(--primary)] shadow-2xs font-semibold"
                  : "bg-[var(--surface)] border-[var(--border-default)] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              <span>{showRouteMap ? "Map Active" : "Show Map"}</span>
            </button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPlaceDrawerOpen(true)}
              className="gap-1.5 bg-[var(--surface)] shadow-xs"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Place Lookup</span>
            </Button>

            <Link href={`/trips/${tripId}/settings`}>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 bg-[var(--surface)] shadow-xs"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Settings</span>
              </Button>
            </Link>

            <Link href={`/trips/${tripId}/disruptions`}>
              <Button
                variant="primary"
                size="sm"
                className="gap-1.5 shadow-xs"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-[#B85D38]" />
                <span>Disruption Ops</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Interactive Geographical Route Map (When Active) */}
      {showRouteMap && currentDay && (
        <div className="space-y-2">
          <ItineraryRouteMap
            day={currentDay}
            destination={trip?.destination}
            selectedActivityId={selectedActivityId}
            onSelectActivity={(actId) => setSelectedActivityId(actId)}
          />
        </div>
      )}

      {/* 3. Main Workspace Layout */}
      {days.length > 0 ? (
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface)] shadow-xs overflow-hidden">
          {/* Day Selector Strip */}
          <DaySelector
            days={days}
            selectedDayId={selectedDayId}
            onSelectDay={(dayId) => {
              setSelectedDayId(dayId);
              setSelectedActivityId(null);
            }}
            onAddDay={() => {
              const nextDayNumber = days.length + 1;
              const currentItinId =
                trip?.itineraries?.find((it) => it.isCurrent)?.id ||
                trip?.itineraries?.[0]?.id ||
                "pending";
              const newDay: ItineraryDay = {
                id: `day-${nextDayNumber}`,
                itineraryId: currentItinId,
                dayNumber: nextDayNumber,
                title: `Day ${nextDayNumber} Exploration`,
                activities: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              setDays([...days, newDay]);
              setSelectedDayId(newDay.id);
            }}
          />

          {/* Selected Day Header */}
          <div className="p-6 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-serif text-xl sm:text-2xl font-semibold text-[var(--ink-primary)]">
                {currentDay?.title || `Day ${currentDay?.dayNumber}`}
              </h3>
              {currentDay?.description && (
                <p className="text-xs text-[var(--ink-secondary)] mt-0.5">
                  {currentDay.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs font-mono text-[var(--ink-tertiary)]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--status-confirmed-text)]" />
                <span>OSM Route Active</span>
              </span>
              <span>•</span>
              <span>24-Hour Chronological Rail</span>
            </div>
          </div>

          {/* 24h Activity List */}
          <div className="p-6 sm:p-8">
            <ActivityList
              key={currentDay?.id}
              dayId={currentDay?.id || "day-1"}
              initialActivities={currentDay?.activities || []}
              onOpenPlaceLookup={() => setIsPlaceDrawerOpen(true)}
              onActivitiesChange={handleActivitiesChange}
            />
          </div>
        </div>
      ) : (
        /* Empty Itinerary State (Freshly created trip needing AI generation) */
        <div className="py-16 px-6 text-center rounded-2xl bg-[var(--surface)] border border-dashed border-[var(--border-default)] space-y-5">
          <div className="w-12 h-12 mx-auto rounded-xl bg-[var(--surface-muted)] flex items-center justify-center text-[var(--primary)] shadow-2xs">
            <Sparkles className="w-6 h-6 text-[var(--accent)]" />
          </div>
          <div className="space-y-1.5">
            <h3 className="font-serif text-xl font-semibold text-[var(--ink-primary)]">
              No itinerary generated for this expedition yet
            </h3>
            <p className="text-xs text-[var(--ink-secondary)] max-w-md mx-auto leading-relaxed">
              Generate an optimized day-by-day schedule using LangGraph &amp; Groq based on your dates, pace, and budget.
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            size="md"
            className="gap-2 shadow-xs"
            onClick={() => setGenerateTrigger((c) => c + 1)}
          >
            <Sparkles className="w-4 h-4 text-[#B85D38]" />
            <span>Generate Itinerary with AI</span>
          </Button>
        </div>
      )}

      {/* Place Lookup Drawer */}
      <PlaceLookupDrawer
        isOpen={isPlaceDrawerOpen}
        onClose={() => setIsPlaceDrawerOpen(false)}
        onAddPlaceToDay={handleAddPlaceToDay}
        dayTitle={currentDay?.title || `Day ${currentDay?.dayNumber}`}
        destination={trip?.destination}
      />

      {/* Docked AI Floating Action Bar */}
      <FloatingActionBar
        tripId={tripId}
        itineraries={trip?.itineraries || []}
        triggerGenerationCount={generateTrigger}
        onVersionChanged={setSelectedVersion}
        onItineraryGenerated={() => void loadTripData(false)}
      />
    </div>
  );
}
