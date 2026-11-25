"use client";

import React from "react";
import {
  ChevronUp,
  ChevronDown,
  Clock,
  MapPin,
  DollarSign,
  Plane,
  Utensils,
  Landmark,
  Hotel,
  Camera,
  Train,
  Ticket,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyAmount } from "@/lib/utils";
import type { Activity, ActivityStatus } from "@/types/api";

interface ActivityCardProps {
  activity: Activity;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete?: () => void;
}

export function ActivityCard({
  activity,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
}: ActivityCardProps) {
  // Format times in 24h format
  const formatTime = (timeStr?: string | null) => {
    if (!timeStr) return "";
    try {
      const d = new Date(timeStr);
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    } catch {
      return timeStr;
    }
  };

  const startFormatted = formatTime(activity.startTime);
  const endFormatted = formatTime(activity.endTime);

  // Determine category icon & color
  const getCategoryIcon = () => {
    const text = `${activity.title} ${activity.description || ""}`.toLowerCase();
    if (text.includes("flight") || text.includes("airport") || text.includes("plane")) {
      return <Plane className="w-4 h-4 text-[#17382B]" />;
    }
    if (text.includes("dinner") || text.includes("lunch") || text.includes("food") || text.includes("ramen") || text.includes("market") || text.includes("sushi")) {
      return <Utensils className="w-4 h-4 text-[#B85D38]" />;
    }
    if (text.includes("hotel") || text.includes("check-in") || text.includes("stay")) {
      return <Hotel className="w-4 h-4 text-[#2C4A3E]" />;
    }
    if (text.includes("train") || text.includes("shinkansen") || text.includes("metro") || text.includes("station")) {
      return <Train className="w-4 h-4 text-[#4A5568]" />;
    }
    if (text.includes("temple") || text.includes("shrine") || text.includes("museum") || text.includes("art")) {
      return <Landmark className="w-4 h-4 text-[#7B341E]" />;
    }
    return <Camera className="w-4 h-4 text-[#17382B]" />;
  };

  const statusConfig: Record<
    ActivityStatus,
    { label: string; variant: "confirmed" | "planned" | "cancelled" | "shifted" }
  > = {
    CONFIRMED: { label: "Confirmed", variant: "confirmed" },
    PLANNED: { label: "Planned", variant: "planned" },
    IN_PROGRESS: { label: "In Progress", variant: "shifted" },
    COMPLETED: { label: "Completed", variant: "planned" },
    CANCELLED: { label: "Cancelled", variant: "cancelled" },
  };

  const status = statusConfig[activity.status] || { label: activity.status, variant: "planned" };
  const isCancelled = activity.status === "CANCELLED";

  return (
    <div className="relative flex items-start gap-4 sm:gap-6 group">
      {/* LEFT: 24h Time Axis & Vertical Rail Node */}
      <div className="flex flex-col items-center shrink-0 w-16 sm:w-20 pt-1">
        <span className="font-mono text-xs sm:text-sm font-semibold text-[var(--ink-primary)]">
          {startFormatted || "—:—"}
        </span>
        {endFormatted && (
          <span className="font-mono text-[10px] text-[var(--ink-tertiary)]">
            {endFormatted}
          </span>
        )}

        {/* Timeline connector circle */}
        <div
          className={`w-3.5 h-3.5 rounded-full border-2 mt-2 z-10 transition-colors ${
            isCancelled
              ? "bg-[var(--status-cancelled-bg)] border-[var(--status-cancelled-text)]"
              : activity.status === "CONFIRMED"
              ? "bg-[var(--primary)] border-white shadow-xs"
              : "bg-[var(--surface)] border-[var(--border-strong)]"
          }`}
        />
      </div>

      {/* RIGHT: Layered Boarding-Pass Activity Card */}
      <div
        className={`flex-1 rounded-2xl border transition-all duration-150 p-4 sm:p-5 relative overflow-hidden ${
          isCancelled
            ? "bg-[var(--surface-muted)]/50 border-[var(--status-cancelled-border)] opacity-75"
            : "bg-[var(--surface)] border-[var(--border-default)] hover:border-[var(--border-strong)] shadow-xs hover:shadow-sm"
        }`}
      >
        {/* Top bar: Category badge, status, cost & reorder controls */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-default)] flex items-center justify-center shrink-0">
              {getCategoryIcon()}
            </div>
            <Badge variant={status.variant} size="sm">
              {status.label}
            </Badge>
            {activity.bookingReference && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-[var(--ink-secondary)] bg-[var(--surface-muted)] px-2 py-0.5 rounded-sm border border-[var(--border-subtle)]">
                <Ticket className="w-3 h-3 text-[var(--ink-tertiary)]" />
                <span>{activity.bookingReference}</span>
              </span>
            )}
          </div>

          {/* Reordering Up/Down Micro-Buttons & Actions */}
          <div className="flex items-center gap-1">
            <div className="flex items-center border border-[var(--border-default)] rounded-lg overflow-hidden bg-[var(--surface-muted)]">
              <button
                type="button"
                onClick={onMoveUp}
                disabled={isFirst}
                title="Move earlier"
                className="p-1 hover:bg-[var(--surface-hover)] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <div className="w-[1px] h-3.5 bg-[var(--border-default)]" />
              <button
                type="button"
                onClick={onMoveDown}
                disabled={isLast}
                title="Move later"
                className="p-1 hover:bg-[var(--surface-hover)] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                title="Remove activity"
                className="p-1.5 rounded-lg text-[var(--ink-tertiary)] hover:text-[var(--status-cancelled-text)] hover:bg-[var(--status-cancelled-bg)] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Card Body */}
        <div className="pt-3 space-y-1.5">
          <h4
            className={`font-semibold text-base sm:text-lg text-[var(--ink-primary)] leading-snug ${
              isCancelled ? "line-through text-[var(--ink-tertiary)]" : ""
            }`}
          >
            {activity.title}
          </h4>

          {activity.description && (
            <p className="text-xs text-[var(--ink-secondary)] leading-relaxed">
              {activity.description}
            </p>
          )}

          {/* Venue Location / Address */}
          {activity.place && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--ink-secondary)] pt-1">
              <MapPin className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
              <span className="font-medium text-[var(--ink-primary)]">{activity.place.name}</span>
              {activity.place.address && (
                <span className="text-[var(--ink-tertiary)] truncate max-w-xs hidden sm:inline">
                  • {activity.place.address}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Card Footer: Duration & Cost */}
        <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--ink-tertiary)] font-mono">
          <div className="flex items-center gap-3">
            {activity.durationMinutes && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{activity.durationMinutes}m duration</span>
              </span>
            )}
          </div>

          {activity.estimatedCost && Number(activity.estimatedCost) > 0 ? (
            <div className="flex items-center gap-1 font-semibold text-[var(--ink-primary)]">
              <span>Cost:</span>
              <span className="text-[var(--primary)]">
                {formatCurrencyAmount(activity.estimatedCost, activity.currency)} {activity.currency}
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-[var(--ink-tertiary)]">Free / Included</span>
          )}
        </div>
      </div>
    </div>
  );
}
