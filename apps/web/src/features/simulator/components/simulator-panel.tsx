"use client";

import React, { useMemo, useState } from "react";
import { CloudRain, Plane, Building2, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DisruptionType } from "@/types/api";

export type { DisruptionType };

export interface DisruptionScenario {
  id: DisruptionType;
  title: string;
  icon: React.ReactNode;
  alertText: string;
  impactDescription: string;
  dayAffected: number;
  delayMinutes: number;
}

interface SimulatorPanelProps {
  destination?: string;
  totalDays?: number;
  onSimulate: (scenario: DisruptionScenario) => void;
  isSimulating?: boolean;
}

export function SimulatorPanel({
  destination = "this destination",
  totalDays = 3,
  onSimulate,
  isSimulating = false,
}: SimulatorPanelProps) {
  const shortDest = destination.split(",")[0].trim() || "your destination";
  const midDay = Math.min(2, Math.max(1, totalDays));

  const scenarios: DisruptionScenario[] = useMemo(
    () => [
      {
        id: "WEATHER_ALERT",
        title: `Heavy Weather Alert on Day ${midDay}`,
        icon: <CloudRain className="w-5 h-5 text-[#B85D38]" />,
        alertText: `Severe rainfall and visibility warning reported in ${shortDest}.`,
        impactDescription: `Disrupts outdoor sightseeing on Day ${midDay} and proposes sheltered or rescheduled alternatives.`,
        dayAffected: midDay,
        delayMinutes: 120,
      },
      {
        id: "FLIGHT_DELAY",
        title: "Inbound Transit Delayed 3 Hours",
        icon: <Plane className="w-5 h-5 text-[#B85D38]" />,
        alertText: `Arrival transport into ${shortDest} delayed by 180 minutes.`,
        impactDescription: "Pushes Day 1 check-in and downstream stops later while preserving priority bookings.",
        dayAffected: 1,
        delayMinutes: 180,
      },
      {
        id: "ATTRACTION_CLOSURE",
        title: `Key Landmark Closure on Day ${midDay}`,
        icon: <Building2 className="w-5 h-5 text-[#B85D38]" />,
        alertText: `Unexpected local closure reported around ${shortDest}.`,
        impactDescription: "Replaces the affected stop with an alternative local experience fitting your budget.",
        dayAffected: midDay,
        delayMinutes: 90,
      },
    ],
    [shortDest, midDay]
  );

  const [activeScenarioId, setActiveScenarioId] = useState<string>("WEATHER_ALERT");
  const [customType, setCustomType] = useState<DisruptionType>("TRANSIT_STRIKE");
  const [customDay, setCustomDay] = useState<number>(1);
  const [customDelay, setCustomDelay] = useState<number>(120);
  const [customDescription, setCustomDescription] = useState<string>("");

  const handleTrigger = (scenario: DisruptionScenario) => {
    setActiveScenarioId(scenario.id);
    onSimulate(scenario);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDescription.trim() || isSimulating) return;
    setActiveScenarioId("CUSTOM");
    onSimulate({
      id: customType,
      title: `Custom ${customType.replace(/_/g, " ")} (Day ${customDay})`,
      icon: <AlertTriangle className="w-5 h-5 text-[#B85D38]" />,
      alertText: customDescription.trim(),
      impactDescription: customDescription.trim(),
      dayAffected: customDay,
      delayMinutes: customDelay,
    });
  };

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface)] p-6 sm:p-8 shadow-xs space-y-6">
      {/* Incident Console Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[var(--border-subtle)]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] animate-pulse" />
            <h2 className="font-serif text-xl sm:text-2xl font-semibold text-[var(--ink-primary)]">
              Travel-Ops Incident Console
            </h2>
            <Badge variant="accent" size="sm">
              LANGGRAPH ENGINE
            </Badge>
          </div>
          <p className="text-xs text-[var(--ink-secondary)]">
            Report a real incident or run a scenario for {shortDest} to compute multi-option recovery diffs and apply them cleanly to a new version.
          </p>
        </div>
      </div>

      {/* 3 Destination-Aware Scenario Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {scenarios.map((scenario) => {
          const isSelected = activeScenarioId === scenario.id;

          return (
            <div
              key={scenario.id}
              className={`p-5 rounded-xl border transition-all duration-200 flex flex-col justify-between space-y-4 ${
                isSelected
                  ? "bg-[var(--surface-muted)] border-[var(--primary)] shadow-sm ring-1 ring-[var(--primary)]/20"
                  : "bg-[var(--surface)] border-[var(--border-default)] hover:border-[var(--border-strong)]"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[var(--surface)] border border-[var(--border-default)] flex items-center justify-center shadow-2xs">
                    {scenario.icon}
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--status-shifted-bg)] text-[var(--status-shifted-text)] border border-[var(--status-shifted-border)]">
                    Day {scenario.dayAffected}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="font-semibold text-sm text-[var(--ink-primary)]">
                    {scenario.title}
                  </h3>
                  <p className="text-xs text-[var(--status-cancelled-text)] font-medium">
                    {scenario.alertText}
                  </p>
                  <p className="text-[11px] text-[var(--ink-secondary)] leading-relaxed pt-1">
                    {scenario.impactDescription}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant={isSelected ? "primary" : "secondary"}
                size="sm"
                className="w-full gap-2 text-xs"
                disabled={isSimulating}
                onClick={() => handleTrigger(scenario)}
              >
                {isSimulating && isSelected ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Running AI Recovery...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-[#B85D38]" />
                    <span>Run AI Recovery</span>
                  </>
                )}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Custom Real Disruption Form */}
      <form
        onSubmit={handleCustomSubmit}
        className="p-4 sm:p-5 rounded-xl bg-[var(--surface-muted)]/60 border border-[var(--border-default)] space-y-3"
      >
        <p className="text-[11px] font-mono uppercase tracking-wider font-semibold text-[var(--ink-secondary)]">
          Report Custom Real Disruption
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <select
            value={customType}
            onChange={(e) => setCustomType(e.target.value as DisruptionType)}
            className="sm:col-span-3 rounded-lg border border-[var(--border-default)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink-primary)]"
          >
            <option value="WEATHER_ALERT">Weather Alert</option>
            <option value="FLIGHT_DELAY">Flight Delay</option>
            <option value="FLIGHT_CANCELLATION">Flight Cancellation</option>
            <option value="TRANSIT_STRIKE">Road / Transit Block</option>
            <option value="HOTEL_OVERBOOKING">Hotel Issue</option>
            <option value="ATTRACTION_CLOSURE">Attraction Closure</option>
            <option value="OTHER">Other</option>
          </select>

          <select
            value={customDay}
            onChange={(e) => setCustomDay(Number(e.target.value))}
            className="sm:col-span-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink-primary)]"
          >
            {Array.from({ length: Math.max(1, totalDays) }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                Day {d}
              </option>
            ))}
          </select>

          <input
            type="number"
            min={15}
            max={720}
            step={15}
            value={customDelay}
            onChange={(e) => setCustomDelay(Number(e.target.value) || 60)}
            placeholder="Delay mins"
            className="sm:col-span-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink-primary)]"
          />

          <input
            type="text"
            value={customDescription}
            onChange={(e) => setCustomDescription(e.target.value)}
            placeholder={`Describe what went wrong in ${shortDest} (e.g., Landslide closed road for 3 hours)...`}
            className="sm:col-span-5 rounded-lg border border-[var(--border-default)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink-primary)]"
          />
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={!customDescription.trim() || isSimulating}
            className="gap-1.5 text-xs"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-[#B85D38]" />
            <span>Submit Custom Incident</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
