"use client";

import React, { useState } from "react";
import { X, GitCompare, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatCurrencyAmount } from "@/lib/utils";
import type { Itinerary } from "@/types/api";

interface VersionComparisonDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  itineraries: Itinerary[];
  onVersionActivated?: () => void;
}

export function VersionComparisonDrawer({
  isOpen,
  onClose,
  itineraries,
  onVersionActivated,
}: VersionComparisonDrawerProps) {
  const [activatingId, setActivatingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const sorted = [...itineraries].sort((a, b) => a.version - b.version);

  const handleSetCurrent = async (itineraryId: string) => {
    setActivatingId(itineraryId);
    try {
      await api.itineraries.setCurrent(itineraryId);
      if (onVersionActivated) onVersionActivated();
      onClose();
    } catch (err) {
      console.error("Failed to switch active itinerary version:", err);
    } finally {
      setActivatingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Frosted Backdrop */}
      <div
        className="fixed inset-0 bg-[#0F1A15]/50 backdrop-blur-xs transition-opacity animate-in fade-in-50"
        onClick={onClose}
      />

      {/* Slide-in Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-4xl bg-[var(--surface)] border-l border-[var(--border-default)] shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-default)] flex items-center justify-between bg-[var(--surface-muted)]/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center shadow-xs">
              <GitCompare className="w-5 h-5 text-[#E0EFE6]" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-semibold text-[var(--ink-primary)]">
                Itinerary Versions &amp; History
              </h3>
              <p className="text-xs text-[var(--ink-secondary)]">
                {sorted.length > 0
                  ? `Comparing ${sorted.length} saved schedule version${sorted.length > 1 ? "s" : ""} in database`
                  : "No generated itinerary versions saved yet"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Versions Grid */}
        <div className="flex-1 overflow-y-auto p-6 bg-[var(--canvas)]">
          {sorted.length === 0 ? (
            <div className="py-16 text-center rounded-2xl bg-[var(--surface)] border border-dashed border-[var(--border-default)] space-y-2">
              <p className="font-serif text-lg font-semibold text-[var(--ink-primary)]">
                No versions generated yet
              </p>
              <p className="text-xs text-[var(--ink-secondary)] max-w-sm mx-auto">
                Generate your first itinerary with AI to inspect and compare versions here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sorted.map((itin) => (
                <div
                  key={itin.id}
                  className={`rounded-2xl border p-5 bg-[var(--surface)] flex flex-col justify-between space-y-4 ${
                    itin.isCurrent
                      ? "border-[var(--primary)] ring-1 ring-[var(--primary)]/20 shadow-sm"
                      : "border-[var(--border-default)]"
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge variant={itin.isCurrent ? "confirmed" : "outline"} size="md">
                        Version {itin.version} {itin.isCurrent ? "(Active)" : ""}
                      </Badge>
                      <span className="text-xs font-mono text-[var(--ink-tertiary)]">
                        {itin.days?.length || 0} Days
                      </span>
                    </div>

                    <div>
                      <h4 className="font-serif text-base font-semibold text-[var(--ink-primary)]">
                        {itin.title}
                      </h4>
                      {itin.description && (
                        <p className="text-xs text-[var(--ink-secondary)] mt-1 line-clamp-2">
                          {itin.description}
                        </p>
                      )}
                    </div>

                    {/* Preview of days & activities */}
                    <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                      {(itin.days || []).map((day) => (
                        <div
                          key={day.id}
                          className="p-3 rounded-xl bg-[var(--surface-muted)]/60 border border-[var(--border-subtle)] text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between font-mono text-[11px] text-[var(--primary)] font-semibold">
                            <span>Day {day.dayNumber}</span>
                            <span>{day.activities?.length || 0} stops</span>
                          </div>
                          <p className="font-medium text-[var(--ink-primary)]">
                            {day.title || `Day ${day.dayNumber}`}
                          </p>
                          <ul className="space-y-1 text-[11px] text-[var(--ink-secondary)]">
                            {(day.activities || []).slice(0, 4).map((act) => (
                              <li key={act.id} className="flex items-center justify-between gap-2">
                                <span className="truncate">• {act.title}</span>
                                {act.estimatedCost && Number(act.estimatedCost) > 0 ? (
                                  <span className="font-mono shrink-0">
                                    {formatCurrencyAmount(act.estimatedCost, act.currency)}
                                  </span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    variant={itin.isCurrent ? "secondary" : "primary"}
                    size="md"
                    className="w-full text-xs gap-1.5"
                    disabled={itin.isCurrent || activatingId === itin.id}
                    isLoading={activatingId === itin.id}
                    onClick={() => handleSetCurrent(itin.id)}
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {itin.isCurrent ? "Currently Active Version" : `Switch to Version ${itin.version}`}
                    </span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
