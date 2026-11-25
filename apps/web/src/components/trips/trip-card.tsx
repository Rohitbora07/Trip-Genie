import React from "react";
import Link from "next/link";
import { Calendar, MapPin, Users, ArrowUpRight, Sparkles, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyAmount } from "@/lib/utils";
import type { Trip, TripStatus } from "@/types/api";

interface TripCardProps {
  trip: Trip;
}

const DESTINATION_THEMES: Record<string, { gradient: string; code: string; tag: string }> = {
  india: {
    gradient: "from-[#5A2D1A] via-[#7E4126] to-[#3B1D10]",
    code: "IN • HERITAGE",
    tag: "Indian Expedition",
  },
  tokyo: {
    gradient: "from-[#17382B] via-[#244E3D] to-[#122A20]",
    code: "NRT • HND",
    tag: "Metropolis & Lanterns",
  },
  kyoto: {
    gradient: "from-[#38261F] via-[#523B30] to-[#261A15]",
    code: "UKY • KIX",
    tag: "Zen Gardens & Shrines",
  },
  paris: {
    gradient: "from-[#1F2B38] via-[#2F4257] to-[#141C24]",
    code: "CDG • ORY",
    tag: "Architecture & Arts",
  },
  swiss: {
    gradient: "from-[#1A2E35] via-[#2B4B57] to-[#101C20]",
    code: "ZRH • GVA",
    tag: "Alpine Rail Manifest",
  },
  default: {
    gradient: "from-[#17382B] via-[#244E3D] to-[#122A20]",
    code: "EXPEDITION",
    tag: "Curated Journey",
  },
};

export function TripCard({ trip }: TripCardProps) {
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const startFormatted = formatDate(trip.startDate);
  const endFormatted = formatDate(trip.endDate);

  const start = new Date(trip.startDate);
  const end = new Date(trip.endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const nights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  const statusConfig: Record<
    TripStatus,
    { label: string; variant: "confirmed" | "planned" | "outline" | "accent" | "cancelled" }
  > = {
    ACTIVE: { label: "Active Expedition", variant: "confirmed" },
    PLANNED: { label: "Scheduled", variant: "planned" },
    DRAFT: { label: "Draft Itinerary", variant: "outline" },
    COMPLETED: { label: "Concluded", variant: "planned" },
    CANCELLED: { label: "Archived", variant: "cancelled" },
  };

  const status = statusConfig[trip.status] || { label: trip.status, variant: "planned" };

  const pace = trip.preferences?.pace || "MODERATE";
  const paceDisplay = {
    RELAXED: { label: "Relaxed Pace", icon: "🌿" },
    MODERATE: { label: "Moderate Pace", icon: "⚖️" },
    PACKED: { label: "Packed Schedule", icon: "⚡" },
  }[pace];

  const budgetNum = trip.budget ? Number(trip.budget) : null;

  const destLower = trip.destination.toLowerCase();
  const indianKeywords = ["india", "bihar", "patna", "delhi", "mumbai", "goa", "jaipur", "kerala", "varanasi", "kolkata", "bengaluru", "hyderabad", "ladakh", "shimla", "manali", "udaipur", "agra", "rishikesh"];
  const theme = indianKeywords.some((k) => destLower.includes(k))
    ? DESTINATION_THEMES.india
    : destLower.includes("tokyo")
    ? DESTINATION_THEMES.tokyo
    : destLower.includes("kyoto")
    ? DESTINATION_THEMES.kyoto
    : destLower.includes("paris")
    ? DESTINATION_THEMES.paris
    : destLower.includes("swiss") || destLower.includes("alps")
    ? DESTINATION_THEMES.swiss
    : DESTINATION_THEMES.default;

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group block relative bg-[var(--surface)] rounded-2xl border border-[var(--border-default)] hover:border-[var(--primary)] shadow-xs hover:shadow-lg transition-all duration-300 overflow-hidden -translate-y-0 hover:-translate-y-1"
    >
      {/* Top Banner with Filmic Editorial Aesthetic */}
      <div
        className={`h-40 w-full bg-gradient-to-br ${theme.gradient} relative p-5 flex flex-col justify-between text-white overflow-hidden`}
      >
        {/* Subtle architectural grain */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />

        {/* Top bar: Status Pill & Arrow Link */}
        <div className="relative z-10 flex items-center justify-between">
          <Badge variant={status.variant} size="sm" className="shadow-xs backdrop-blur-md">
            {status.label}
          </Badge>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-widest uppercase text-white/75 bg-white/10 px-2 py-0.5 rounded-sm">
              {theme.code}
            </span>
            <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Bottom banner info: Destination & Tag */}
        <div className="relative z-10 space-y-0.5">
          <span className="text-[10px] font-mono uppercase tracking-widest text-white/65">
            {theme.tag}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-white font-mono font-medium">
            <MapPin className="w-3.5 h-3.5 text-[#A8D5B8] shrink-0" />
            <span className="font-semibold text-white tracking-wide uppercase truncate">
              {trip.destination}
            </span>
            {trip.origin && (
              <span className="text-white/65 text-[11px] truncate max-w-[120px] shrink-0">
                from {trip.origin.split(",")[0]}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Perforated boarding pass line */}
      <div className="h-2 bg-[var(--surface-muted)] perforated-border-b" />

      {/* Card Content Body */}
      <div className="p-5 sm:p-6 space-y-4">
        {/* Title & Description */}
        <div className="space-y-1.5">
          <h3 className="font-serif text-xl sm:text-2xl font-semibold text-[var(--ink-primary)] group-hover:text-[var(--primary)] transition-colors line-clamp-1">
            {trip.title}
          </h3>
          {trip.description && (
            <p className="text-xs text-[var(--ink-secondary)] line-clamp-2 leading-relaxed font-sans">
              {trip.description}
            </p>
          )}
        </div>

        {/* Boarding-pass Manifest Metadata */}
        <div className="grid grid-cols-2 gap-3 py-2.5 border-y border-[var(--border-subtle)] text-xs text-[var(--ink-secondary)]">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-[var(--ink-tertiary)] shrink-0" />
            <span className="font-mono text-[11px]">
              {startFormatted} – {endFormatted}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[var(--ink-tertiary)] shrink-0" />
            <span className="font-mono text-[11px]">{nights} Nights / {nights + 1} Days</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-[var(--ink-tertiary)] shrink-0" />
            <span>{trip.travelerCount} {trip.travelerCount === 1 ? "Traveler" : "Travelers"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>{paceDisplay.icon}</span>
            <span className="font-medium text-[var(--ink-primary)]">{paceDisplay.label}</span>
          </div>
        </div>

        {/* Bottom Bar: Budget & Call to Action */}
        <div className="flex items-center justify-between text-xs pt-1">
          {budgetNum ? (
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase tracking-wider text-[var(--ink-tertiary)] font-mono">
                Expedition Allocation
              </span>
              <p className="font-mono font-semibold text-sm text-[var(--ink-primary)]">
                {formatCurrencyAmount(budgetNum, trip.currency)} {trip.currency}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[var(--primary)] text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>AI Assisted Schedule</span>
            </div>
          )}

          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] group-hover:underline">
            <span>Inspect Workspace</span>
            <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </span>
        </div>
      </div>
    </Link>
  );
}
