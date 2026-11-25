"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Zap, GitCompare } from "lucide-react";
import { GenerationStepper } from "@/features/generation/components/generation-stepper";
import { VersionComparisonDrawer } from "@/features/itinerary/components/version-comparison-drawer";
import type { Itinerary } from "@/types/api";

interface FloatingActionBarProps {
  tripId: string;
  itineraries?: Itinerary[];
  triggerGenerationCount?: number;
  onVersionChanged?: (version: string) => void;
  onItineraryGenerated?: () => void;
}

export function FloatingActionBar({
  tripId,
  itineraries = [],
  triggerGenerationCount = 0,
  onVersionChanged,
  onItineraryGenerated,
}: FloatingActionBarProps) {
  const [isStepperOpen, setIsStepperOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  useEffect(() => {
    if (triggerGenerationCount > 0) {
      setIsStepperOpen(true);
    }
  }, [triggerGenerationCount]);

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-6 duration-300">
        <div className="px-4 py-2.5 rounded-full bg-[#121E18]/95 text-white backdrop-blur-md border border-[#244637] shadow-2xl flex items-center gap-2 select-none">
          {/* Generate with AI */}
          <button
            type="button"
            onClick={() => setIsStepperOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-xs font-semibold text-white shadow-xs transition-all active:scale-[0.98]"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#B85D38]" />
            <span>Generate with AI</span>
          </button>

          <div className="w-[1px] h-4 bg-white/20" />

          {/* Version Diff */}
          <button
            type="button"
            onClick={() => setIsCompareOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-white/10 text-xs font-medium text-white/90 transition-all active:scale-[0.98]"
          >
            <GitCompare className="w-3.5 h-3.5 text-[#A8D5B8]" />
            <span>Compare Versions</span>
          </button>
        </div>
      </div>

      {/* Real Generation Stepper Modal (wired to POST /api/trips/:tripId/generation-jobs) */}
      <GenerationStepper
        tripId={tripId}
        isOpen={isStepperOpen}
        onClose={() => {
          setIsStepperOpen(false);
        }}
        onCompleted={() => {
          if (onItineraryGenerated) onItineraryGenerated();
        }}
      />

      {/* Version Comparison Drawer */}
      <VersionComparisonDrawer
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        itineraries={itineraries}
        onVersionActivated={() => {
          if (onItineraryGenerated) onItineraryGenerated();
          if (onVersionChanged) onVersionChanged("");
        }}
      />
    </>
  );
}
