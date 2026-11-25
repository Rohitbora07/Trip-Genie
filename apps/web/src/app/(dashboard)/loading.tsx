import React from "react";
import { Skeleton, TripCardSkeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-in fade-in-50 duration-200">
      {/* Header skeleton */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
        <div className="space-y-2">
          <Skeleton className="h-5 w-44 rounded-full" />
          <Skeleton className="h-10 w-72 rounded-lg" />
          <Skeleton className="h-4 w-96 rounded-md" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
      </div>

      {/* Metrics bar skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border-default)] shadow-2xs space-y-2"
          >
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-7 w-12 rounded" />
            <Skeleton className="h-3 w-32 rounded" />
          </div>
        ))}
      </div>

      {/* Banner skeleton */}
      <Skeleton className="h-24 w-full rounded-2xl" />

      {/* Filter strip skeleton */}
      <div className="flex justify-between items-center">
        <Skeleton className="h-10 w-80 rounded-xl" />
        <Skeleton className="h-4 w-32 rounded" />
      </div>

      {/* Grid of Trip Card Skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <TripCardSkeleton />
        <TripCardSkeleton />
        <TripCardSkeleton />
      </div>
    </div>
  );
}
