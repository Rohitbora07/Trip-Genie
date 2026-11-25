import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function DisruptionLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Top breadcrumb */}
      <div className="flex justify-between items-center pb-4 border-b border-[var(--border-subtle)]">
        <Skeleton className="h-4 w-48 rounded" />
        <Skeleton className="h-6 w-36 rounded-full" />
      </div>

      {/* Header card */}
      <div className="p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border-default)] space-y-3">
        <Skeleton className="h-4 w-40 rounded-full" />
        <Skeleton className="h-9 w-80 rounded-lg" />
        <Skeleton className="h-4 w-full max-w-xl rounded" />
      </div>

      {/* 3 Presets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-5 rounded-xl border border-[var(--border-default)] bg-[var(--surface)] space-y-4">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-5 w-3/4 rounded" />
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-5/6 rounded" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>

      {/* 2 Recovery options */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="p-6 rounded-2xl border border-[var(--border-default)] bg-[var(--surface)] space-y-4">
            <div className="flex justify-between">
              <Skeleton className="h-6 w-32 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <Skeleton className="h-6 w-2/3 rounded" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
