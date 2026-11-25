"use client";

import React from "react";
import { Plus } from "lucide-react";
import type { ItineraryDay } from "@/types/api";

interface DaySelectorProps {
  days: ItineraryDay[];
  selectedDayId: string;
  onSelectDay: (dayId: string) => void;
  onAddDay?: () => void;
}

export function DaySelector({
  days,
  selectedDayId,
  onSelectDay,
  onAddDay,
}: DaySelectorProps) {
  return (
    <div className="w-full border-b border-[var(--border-default)] bg-[var(--surface-muted)]/50 backdrop-blur-xs py-3 px-3 sm:px-4 overflow-x-auto scrollbar-none">
      <div className="flex items-center gap-3 min-w-max">
        {days.map((day) => {
          const isSelected = day.id === selectedDayId;
          const activityCount = day.activities?.length || 0;

          let dateFormatted = "";
          if (day.date) {
            try {
              const d = new Date(day.date);
              dateFormatted = d.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
            } catch {
              dateFormatted = "";
            }
          }

          return (
            <button
              key={day.id}
              type="button"
              onClick={() => onSelectDay(day.id)}
              className={`group relative text-left px-4 py-3 rounded-xl border transition-all duration-150 select-none ${
                isSelected
                  ? "bg-[var(--surface)] border-[var(--primary)] shadow-sm ring-1 ring-[var(--primary)]/20"
                  : "bg-[var(--surface)]/70 border-[var(--border-default)] hover:bg-[var(--surface)] hover:border-[var(--border-strong)]"
              }`}
            >
              {/* Day Number & Real Date */}
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded-sm ${
                      isSelected
                        ? "bg-[var(--primary)] text-white"
                        : "bg-[var(--surface-muted)] text-[var(--ink-secondary)] border border-[var(--border-subtle)]"
                    }`}
                  >
                    DAY {day.dayNumber.toString().padStart(2, "0")}
                  </span>
                  {dateFormatted && (
                    <span className="text-xs text-[var(--ink-tertiary)] font-mono">
                      {dateFormatted}
                    </span>
                  )}
                </div>

                <span className="text-[10px] text-[var(--ink-tertiary)] font-mono shrink-0">
                  {activityCount} {activityCount === 1 ? "stop" : "stops"}
                </span>
              </div>

              {/* Day Title */}
              <p
                className={`text-xs font-semibold max-w-[200px] truncate ${
                  isSelected ? "text-[var(--primary)]" : "text-[var(--ink-primary)]"
                }`}
              >
                {day.title || `Day ${day.dayNumber} Schedule`}
              </p>
            </button>
          );
        })}

        {/* Add Day Button */}
        {onAddDay && (
          <button
            type="button"
            onClick={onAddDay}
            className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-dashed border-[var(--border-default)] hover:border-[var(--border-strong)] bg-transparent hover:bg-[var(--surface-muted)] text-xs font-medium text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] transition-all select-none self-stretch"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Day</span>
          </button>
        )}
      </div>
    </div>
  );
}
