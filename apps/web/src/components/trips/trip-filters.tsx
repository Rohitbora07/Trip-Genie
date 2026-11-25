import React from "react";
import type { Trip, TripStatus } from "@/types/api";

export type FilterCategory = "ALL" | "ACTIVE" | "DRAFT" | "COMPLETED";

interface TripFiltersProps {
  currentFilter: FilterCategory;
  onFilterChange: (filter: FilterCategory) => void;
  trips: Trip[];
}

export function TripFilters({ currentFilter, onFilterChange, trips }: TripFiltersProps) {
  // Calculate counts
  const totalCount = trips.length;
  const activeCount = trips.filter((t) => t.status === "ACTIVE").length;
  const draftCount = trips.filter((t) => t.status === "DRAFT" || t.status === "PLANNED").length;
  const completedCount = trips.filter((t) => t.status === "COMPLETED").length;

  const filters: Array<{ id: FilterCategory; label: string; count: number }> = [
    { id: "ALL", label: "All Journeys", count: totalCount },
    { id: "ACTIVE", label: "Active", count: activeCount },
    { id: "DRAFT", label: "Drafts & Planned", count: draftCount },
    { id: "COMPLETED", label: "Completed", count: completedCount },
  ];

  return (
    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-default)] overflow-x-auto">
      {filters.map((f) => {
        const isSelected = currentFilter === f.id;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onFilterChange(f.id)}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-150 select-none ${
              isSelected
                ? "bg-[var(--surface)] text-[var(--ink-primary)] shadow-xs border border-[var(--border-default)]"
                : "text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            <span>{f.label}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                isSelected
                  ? "bg-[var(--primary)] text-white"
                  : "bg-[var(--surface)] text-[var(--ink-tertiary)] border border-[var(--border-subtle)]"
              }`}
            >
              {f.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
