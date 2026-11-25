import React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  shimmer?: boolean;
}

export function Skeleton({ className, shimmer = true, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-[#E8E4DA]/70 relative overflow-hidden",
        shimmer &&
          "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.8s_infinite] after:bg-gradient-to-r after:from-transparent after:via-white/40 after:to-transparent",
        className
      )}
      {...props}
    />
  );
}

// ------------------------------------------------------
// PRESET COMPOSITE SKELETONS
// ------------------------------------------------------

export function TripCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface)] overflow-hidden shadow-xs space-y-4 p-0">
      {/* Cover banner skeleton */}
      <Skeleton className="h-40 w-full rounded-none" />

      {/* Body */}
      <div className="p-5 sm:p-6 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-3/4 rounded-md" />
          <Skeleton className="h-3.5 w-full rounded-md" />
          <Skeleton className="h-3.5 w-5/6 rounded-md" />
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-3 py-3 border-y border-[var(--border-subtle)]">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-4 w-20 rounded-md" />
          <Skeleton className="h-4 w-24 rounded-md" />
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-6 w-24 rounded-md" />
          <Skeleton className="h-4 w-20 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function TimelineSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border-default)] space-y-4">
        <Skeleton className="h-4 w-36 rounded-md" />
        <Skeleton className="h-10 w-2/3 rounded-lg" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-32 rounded-md" />
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-4 w-28 rounded-md" />
        </div>
      </div>

      {/* Map Skeleton */}
      <Skeleton className="h-[360px] w-full rounded-2xl" />

      {/* Days Strip Skeleton */}
      <div className="flex gap-3 overflow-hidden p-4 rounded-xl bg-[var(--surface)] border border-[var(--border-default)]">
        <Skeleton className="h-14 w-44 shrink-0 rounded-xl" />
        <Skeleton className="h-14 w-44 shrink-0 rounded-xl" />
        <Skeleton className="h-14 w-44 shrink-0 rounded-xl" />
      </div>

      {/* Activity Cards Skeleton */}
      <div className="space-y-4 p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border-default)]">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4 items-start">
            <Skeleton className="h-6 w-16 rounded-md shrink-0 mt-2" />
            <div className="flex-1 space-y-2 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]/40">
              <Skeleton className="h-5 w-1/2 rounded-md" />
              <Skeleton className="h-3 w-3/4 rounded-md" />
              <Skeleton className="h-3 w-1/3 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
