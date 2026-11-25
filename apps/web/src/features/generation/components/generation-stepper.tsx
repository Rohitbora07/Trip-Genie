"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Check, Loader2, Sparkles, AlertCircle, ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";

export interface GenerationStep {
  id: number;
  label: string;
  detail: string;
}

interface GenerationStepperProps {
  tripId: string;
  isOpen: boolean;
  onClose: () => void;
  onCompleted?: () => void;
}

const STEPS: GenerationStep[] = [
  {
    id: 1,
    label: "Job Submitted to Travel-Ops Queue",
    detail: "Recording generation job in PostgreSQL and loading trip preferences.",
  },
  {
    id: 2,
    label: "Drafting Schedule with Groq & LangGraph",
    detail: "Synthesizing daily highlights, timing windows, and local dining spots.",
  },
  {
    id: 3,
    label: "Persisting Day Rails & Place Coordinates",
    detail: "Validating schedule coherence and saving versioned itinerary to database.",
  },
  {
    id: 4,
    label: "Autonomous Itinerary Ready",
    detail: "Generated schedule saved and activated for your expedition.",
  },
];

export function GenerationStepper({
  tripId,
  isOpen,
  onClose,
  onCompleted,
}: GenerationStepperProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatusLabel, setJobStatusLabel] = useState<string>("SUBMITTING");

  const startOrRetryGeneration = useCallback(async () => {
    setCurrentStepIndex(0);
    setElapsedSeconds(0);
    setIsFinished(false);
    setErrorMessage(null);
    setJobStatusLabel("SUBMITTING");

    try {
      let activeJobId: string | null = null;
      if (jobId && errorMessage) {
        const retried = await api.generationJobs.retry(jobId);
        activeJobId = retried.id;
      } else {
        const job = await api.trips.createGenerationJob(tripId, {
          jobType: "ITINERARY_GENERATION",
          input: {},
        });
        activeJobId = job.id;
      }
      setJobId(activeJobId);
      setJobStatusLabel("PENDING");
      setCurrentStepIndex(1);
    } catch (err) {
      if (err instanceof ApiError) {
        const details = err.details as { activeJob?: { id?: string } } | undefined;
        // If a duplicate active job already exists, poll that existing job
        const activeExistingId = details?.activeJob?.id;
        if (err.status === 409 && activeExistingId) {
          setJobId(activeExistingId);
          setJobStatusLabel("PROCESSING");
          setCurrentStepIndex(1);
          return;
        }
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Could not queue AI generation job. Ensure Express API (port 4000) is running.");
      }
    }
  }, [tripId, jobId, errorMessage]);

  // Kick off job when modal opens
  useEffect(() => {
    if (!isOpen) {
      setCurrentStepIndex(0);
      setElapsedSeconds(0);
      setIsFinished(false);
      setErrorMessage(null);
      setJobId(null);
      setJobStatusLabel("SUBMITTING");
      return;
    }

    startOrRetryGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, tripId]);

  // Elapsed seconds ticker while running
  useEffect(() => {
    if (!isOpen || isFinished || errorMessage) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, isFinished, errorMessage]);

  // Poll GET /api/generation-jobs/:jobId until COMPLETED or FAILED
  useEffect(() => {
    if (!isOpen || !jobId || isFinished || errorMessage) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const job = await api.generationJobs.getById(jobId);
        if (cancelled) return;

        setJobStatusLabel(job.status);

        if (job.status === "PENDING") {
          setCurrentStepIndex(1);
        } else if (job.status === "PROCESSING") {
          setCurrentStepIndex(2);
        } else if (job.status === "COMPLETED") {
          setCurrentStepIndex(3);
          setIsFinished(true);
          if (onCompleted) onCompleted();
        } else if (job.status === "FAILED" || job.status === "CANCELLED") {
          setErrorMessage(
            job.errorDetails?.message ||
              "AI generation failed. Ensure ai-service is running on port 8000 with a valid GROQ_API_KEY."
          );
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setErrorMessage(err.message);
        } else {
          setErrorMessage("Lost connection while checking generation job status.");
        }
      }
    };

    poll();
    const timer = setInterval(poll, 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isOpen, jobId, isFinished, errorMessage, onCompleted]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Frosted Backdrop */}
      <div
        className="fixed inset-0 bg-[#0F1A15]/60 backdrop-blur-xs transition-opacity animate-in fade-in-50"
        onClick={isFinished || errorMessage ? onClose : undefined}
      />

      {/* Stepper Card */}
      <div className="relative w-full max-w-lg bg-[var(--surface)] rounded-2xl border border-[var(--border-default)] shadow-2xl p-6 sm:p-8 z-10 animate-in zoom-in-95 fade-in-50 duration-150 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5 text-[#B85D38]" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-semibold text-[var(--ink-primary)]">
                {errorMessage
                  ? "Generation Failed"
                  : isFinished
                  ? "Itinerary Generated"
                  : "Drafting Schedule with AI"}
              </h3>
              <p className="text-xs text-[var(--ink-secondary)]">
                LangGraph &amp; Groq Pipeline • Status: <span className="font-mono">{jobStatusLabel}</span>
              </p>
            </div>
          </div>
          <span className="font-mono text-xs text-[var(--ink-tertiary)] bg-[var(--surface-muted)] px-2.5 py-1 rounded-full border border-[var(--border-subtle)]">
            {elapsedSeconds}s
          </span>
        </div>

        {/* Error Box */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-[var(--status-cancelled-bg)] border border-[var(--status-cancelled-border)] flex items-start gap-3 text-xs text-[var(--status-cancelled-text)]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">AI Service Error</p>
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Steps List */}
        <div className="space-y-4 py-2">
          {STEPS.map((step, idx) => {
            const isDone = (idx < currentStepIndex && !errorMessage) || isFinished;
            const isCurrent = idx === currentStepIndex && !isFinished && !errorMessage;

            return (
              <div
                key={step.id}
                className={`flex items-start gap-3.5 p-3 rounded-xl border transition-all ${
                  isCurrent
                    ? "bg-[var(--surface-muted)] border-[var(--primary)] shadow-xs"
                    : isDone
                    ? "bg-[var(--surface-card)] border-[var(--status-confirmed-border)]"
                    : "bg-transparent border-transparent opacity-40"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-mono font-bold ${
                    isDone
                      ? "bg-[var(--primary)] text-white"
                      : isCurrent
                      ? "bg-[var(--status-confirmed-bg)] text-[var(--primary)] border border-[var(--primary)]"
                      : "bg-[var(--surface-muted)] text-[var(--ink-tertiary)] border border-[var(--border-default)]"
                  }`}
                >
                  {isDone ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : isCurrent ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    step.id
                  )}
                </div>

                <div className="space-y-0.5">
                  <p
                    className={`text-xs font-semibold ${
                      isCurrent
                        ? "text-[var(--primary)]"
                        : isDone
                        ? "text-[var(--ink-primary)]"
                        : "text-[var(--ink-tertiary)]"
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="text-[11px] text-[var(--ink-secondary)] leading-relaxed">
                    {step.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        {errorMessage ? (
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="outline" size="md" onClick={onClose}>
              Close
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              className="gap-2"
              onClick={startOrRetryGeneration}
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Job</span>
            </Button>
          </div>
        ) : isFinished ? (
          <Button
            variant="primary"
            size="lg"
            className="w-full gap-2 shadow-xs"
            onClick={onClose}
          >
            <span>View Generated Schedule</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <div className="text-center text-xs text-[var(--ink-tertiary)] pt-2 font-mono">
            Waiting for FastAPI AI Service (port 8000) &amp; PostgreSQL...
          </div>
        )}
      </div>
    </div>
  );
}
