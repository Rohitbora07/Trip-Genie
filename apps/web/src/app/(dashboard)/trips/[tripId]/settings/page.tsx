"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Trash2,
  Settings,
  CheckCircle2,
  AlertTriangle,
  GitBranch,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, ApiError } from "@/lib/api";
import type { Trip } from "@/types/api";

export default function TripSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = String(params?.tripId || "");

  const [trip, setTrip] = useState<Trip | null>(null);
  const [title, setTitle] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [travelerCount, setTravelerCount] = useState(1);
  const [pace, setPace] = useState<"RELAXED" | "MODERATE" | "PACKED">("MODERATE");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTrip = async () => {
    setIsLoading(true);
    try {
      const data = await api.trips.getById(tripId);
      setTrip(data);
      setTitle(data.title);
      setOrigin(data.origin || "");
      setDestination(data.destination);
      setStartDate(data.startDate.slice(0, 10));
      setEndDate(data.endDate.slice(0, 10));
      setBudget(data.budget !== null && data.budget !== undefined ? String(data.budget) : "");
      setCurrency(data.currency || "INR");
      setTravelerCount(data.travelerCount || 1);
      setPace((data.preferences?.pace as "RELAXED" | "MODERATE" | "PACKED") || "MODERATE");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load trip.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (tripId) void loadTrip();
  }, [tripId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      await api.trips.update(tripId, {
        title: title.trim(),
        origin: origin.trim() || undefined,
        destination: destination.trim(),
        startDate,
        endDate,
        budget: budget ? Number(budget) : undefined,
        currency,
        travelerCount,
        preferences: {
          ...(trip?.preferences || {}),
          pace,
        },
      });
      await loadTrip();
      setMessage("Trip settings saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishItinerary = async (itineraryId: string) => {
    try {
      await api.itineraries.publish(itineraryId);
      await loadTrip();
      setMessage("Itinerary version published.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to publish itinerary.");
    }
  };

  const handleDeleteTrip = async () => {
    setIsDeleting(true);
    try {
      await api.trips.delete(tripId);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete trip.");
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink-primary)]">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-4">
          <Link
            href={`/trips/${tripId}`}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Itinerary Workspace</span>
          </Link>
          <Badge variant="outline" size="sm">
            {trip?.status || "DRAFT"}
          </Badge>
        </div>

        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[var(--primary)] font-semibold">
            <Settings className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>EXPEDITION CONFIGURATION</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight">
            Trip Settings &amp; Version Publishing
          </h1>
        </div>

        {message && (
          <div className="p-3.5 rounded-xl bg-[var(--status-confirmed-bg)] border border-[var(--status-confirmed-border)] text-xs text-[var(--status-confirmed-text)] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-[var(--status-disrupted-bg)] border border-[var(--status-disrupted-border)] text-xs text-[var(--status-disrupted-text)] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="h-64 rounded-2xl bg-[var(--surface)] border border-[var(--border-default)] animate-pulse" />
        ) : (
          <>
            <form
              onSubmit={handleSave}
              className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface)] p-6 sm:p-8 shadow-xs space-y-5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--ink-secondary)]">Trip Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)]/40 px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--ink-secondary)]">Origin City</label>
                  <input
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="e.g., Delhi, India"
                    className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)]/40 px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--ink-secondary)]">Destination</label>
                  <input
                    type="text"
                    required
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)]/40 px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--ink-secondary)]">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)]/40 px-3.5 py-2.5 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--ink-secondary)]">End Date</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)]/40 px-3.5 py-2.5 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--ink-secondary)]">Budget</label>
                  <input
                    type="number"
                    min={0}
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)]/40 px-3.5 py-2.5 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--ink-secondary)]">Currency &amp; Travelers</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)]/40 px-3 py-2.5 text-sm font-mono"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="JPY">JPY (¥)</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={travelerCount}
                      onChange={(e) => setTravelerCount(Math.max(1, Number(e.target.value)))}
                      className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)]/40 px-3 py-2.5 text-sm font-mono"
                    />
                  </div>
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--ink-secondary)]">Travel Pace</label>
                  <select
                    value={pace}
                    onChange={(e) => setPace(e.target.value as "RELAXED" | "MODERATE" | "PACKED")}
                    className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)]/40 px-3.5 py-2.5 text-sm"
                  >
                    <option value="RELAXED">Relaxed (2-3 activities/day)</option>
                    <option value="MODERATE">Moderate (3-4 activities/day)</option>
                    <option value="PACKED">Packed (5-6 activities/day)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" variant="primary" size="md" isLoading={isSaving} className="gap-2">
                  <Save className="w-4 h-4" />
                  <span>Save Trip Changes</span>
                </Button>
              </div>
            </form>

            {/* Itinerary Versions Publisher */}
            {trip?.itineraries && trip.itineraries.length > 0 && (
              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface)] p-6 space-y-4">
                <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-[var(--primary)]" />
                  <span>Itinerary Versions ({trip.itineraries.length})</span>
                </h2>
                <div className="space-y-2.5">
                  {trip.itineraries.map((it) => (
                    <div
                      key={it.id}
                      className="p-3.5 rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)]/40 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-xs font-semibold">
                          v{it.version} — {it.title}
                        </p>
                        <p className="text-[11px] font-mono text-[var(--ink-tertiary)]">
                          Status: {it.status} {it.isCurrent ? "• CURRENT" : ""}
                        </p>
                      </div>
                      {it.status !== "PUBLISHED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handlePublishItinerary(it.id)}
                          className="text-xs"
                        >
                          Publish Version
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Danger Zone */}
            <div className="rounded-2xl border border-[var(--status-cancelled-border)] bg-[var(--status-cancelled-bg)]/30 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="font-serif text-lg font-semibold text-[var(--status-cancelled-text)]">
                  Delete Expedition
                </h3>
                <p className="text-xs text-[var(--ink-secondary)]">
                  Permanently removes this trip, generated versions, disruptions, and audit logs.
                </p>
              </div>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={isDeleting}
                    onClick={() => void handleDeleteTrip()}
                    className="bg-[var(--status-cancelled-text)] hover:opacity-90 gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                  className="text-[var(--status-cancelled-text)] border-[var(--status-cancelled-border)] gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Trip</span>
                </Button>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
