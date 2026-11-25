"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  RotateCw,
  XCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, ApiError } from "@/lib/api";
import type { GenerationJob } from "@/types/api";

export default function AiJobsActivityPage() {
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadJobs = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.generationJobs.getAll();
      setJobs(data);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to load AI jobs.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadJobs();
  }, []);

  const handleRetry = async (jobId: string) => {
    try {
      await api.generationJobs.retry(jobId);
      await loadJobs();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Retry failed.");
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      await api.generationJobs.cancel(jobId);
      await loadJobs();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Cancel failed.");
    }
  };

  const getBadgeVariant = (status: GenerationJob["status"]) => {
    switch (status) {
      case "COMPLETED":
        return "confirmed" as const;
      case "FAILED":
        return "cancelled" as const;
      case "PROCESSING":
      case "PENDING":
        return "accent" as const;
      default:
        return "outline" as const;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink-primary)]">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[var(--border-default)] pb-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[var(--primary)] font-semibold">
              <Activity className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>AI PIPELINE MONITOR</span>
            </div>
            <h1 className="font-serif text-3xl sm:text-5xl font-semibold tracking-tight">
              AI Jobs &amp; Generation Ledger
            </h1>
            <p className="text-xs sm:text-sm text-[var(--ink-secondary)]">
              Inspect LangGraph itinerary generation and disruption recovery jobs queued on the worker.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadJobs()} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-[var(--status-disrupted-bg)] border border-[var(--status-disrupted-border)] text-xs text-[var(--status-disrupted-text)]">
            {errorMsg}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 rounded-2xl bg-[var(--surface)] border border-[var(--border-default)] animate-pulse"
              />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-16 text-center rounded-2xl bg-[var(--surface)] border border-dashed border-[var(--border-default)] space-y-2">
            <Clock className="w-7 h-7 text-[var(--ink-tertiary)] mx-auto" />
            <h3 className="font-serif text-xl font-semibold">No AI jobs recorded yet</h3>
            <p className="text-xs text-[var(--ink-secondary)]">
              Create a trip and run Generate with AI to view background pipeline telemetry here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const res = (job.result || {}) as Record<string, unknown>;
              const meta = (res.metadata || {}) as Record<string, unknown>;
              return (
                <div
                  key={job.id}
                  className="p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--surface)] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getBadgeVariant(job.status)} size="sm">
                        {job.status}
                      </Badge>
                      <span className="text-xs font-mono font-semibold text-[var(--ink-primary)]">
                        {job.jobType.replace(/_/g, " ")}
                      </span>
                      <span className="text-[11px] font-mono text-[var(--ink-tertiary)]">
                        {new Date(job.createdAt).toLocaleString()}
                      </span>
                    </div>

                    {job.status === "COMPLETED" && (
                      <p className="text-xs text-[var(--ink-secondary)] flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--status-confirmed-text)] shrink-0" />
                        <span>
                          {res.title ? String(res.title) : "Job completed"}
                          {meta.model ? ` • Model: ${String(meta.model)}` : ""}
                          {meta.latency_ms ? ` • ${Math.round(Number(meta.latency_ms))}ms` : ""}
                        </span>
                      </p>
                    )}

                    {job.status === "FAILED" && job.errorDetails?.message && (
                      <p className="text-xs text-[var(--status-cancelled-text)] flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{job.errorDetails.message}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {job.tripId && (
                      <Link href={`/trips/${job.tripId}`}>
                        <Button variant="outline" size="sm" className="gap-1 text-xs">
                          <span>Open Trip</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    )}
                    {job.status === "FAILED" && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => void handleRetry(job.id)}
                        className="gap-1 text-xs"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>Retry</span>
                      </Button>
                    )}
                    {(job.status === "PENDING" || job.status === "PROCESSING") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleCancel(job.id)}
                        className="gap-1 text-xs text-[var(--status-cancelled-text)]"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
