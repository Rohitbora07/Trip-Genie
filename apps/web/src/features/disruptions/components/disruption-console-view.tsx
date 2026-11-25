"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Activity,
  Radio,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimulatorPanel, type DisruptionScenario } from "@/features/simulator/components/simulator-panel";
import {
  RecoveryOptionsView,
  type RecoveryOption,
  type RecoveryDiffItem,
} from "@/features/recovery/components/recovery-options-view";
import { ApprovalModal } from "@/features/approvals/components/approval-modal";
import { AuditTrailView } from "@/features/audit/components/audit-trail-view";
import { api, ApiError } from "@/lib/api";
import { formatCurrencyAmount } from "@/lib/utils";
import type { AuditLog, DisruptionEvent, RecoveryProposal, Trip } from "@/types/api";

interface DisruptionConsoleViewProps {
  tripId: string;
}

function mapProposalToViewOption(p: RecoveryProposal, currency: string): RecoveryOption {
  const deltaNum = p.estimatedCostDelta ? Number(p.estimatedCostDelta) : 0;
  const isCostIncrease = deltaNum > 0;
  const formattedDelta = formatCurrencyAmount(Math.abs(deltaNum), currency);
  const costDeltaText =
    deltaNum === 0
      ? `No Cost Change (${currency})`
      : isCostIncrease
      ? `+${formattedDelta}`
      : `-${formattedDelta} (Savings)`;

  const diffs: RecoveryDiffItem[] = [];
  const diffPayload = p.diffPayload || {};

  (diffPayload.removed || []).forEach((item, idx) => {
    const title = typeof item === "string" ? item : item?.title || "Removed activity";
    diffs.push({
      id: `${p.id}-rem-${idx}`,
      type: "CANCELLED",
      title,
      timeText: "",
      note: "Removed to resolve disruption conflict.",
    });
  });

  (diffPayload.added || []).forEach((item, idx) => {
    const title = typeof item === "string" ? item : item?.title || "Alternative activity";
    diffs.push({
      id: `${p.id}-add-${idx}`,
      type: "ADDED",
      title,
      timeText: "Flexible timing",
      note: "Added by LangGraph recovery engine.",
    });
  });

  (diffPayload.modified || []).forEach((mod, idx) => {
    diffs.push({
      id: `${p.id}-mod-${idx}`,
      type: "SHIFTED",
      title: mod.title || "Rescheduled activity",
      timeText: `${mod.previous_start_time || "?"} → ${mod.new_start_time || "?"}`,
      note: `New slot: ${mod.new_start_time || "?"} – ${mod.new_end_time || "?"}`,
    });
  });

  const scoreByStrategy: Record<string, number> = {
    MINIMAL_DISRUPTION: 94,
    PACE_RELAXED: 91,
    BUDGET_FOCUSED: 88,
  };

  return {
    id: p.id,
    title: p.title,
    subtitle: p.summary || "AI-generated itinerary adjustment plan.",
    status: p.status,
    costDeltaText,
    isCostIncrease,
    scheduleMatchScore: scoreByStrategy[p.strategy || ""] || 90,
    diffs,
    pros: Array.isArray(p.tradeOffs) ? p.tradeOffs.map(String) : [],
    cons: [],
  };
}

export function DisruptionConsoleView({ tripId }: DisruptionConsoleViewProps) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationStep, setSimulationStep] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [selectedRecoveryOption, setSelectedRecoveryOption] = useState<RecoveryOption | null>(null);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [disruptions, setDisruptions] = useState<DisruptionEvent[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const loadWorkspace = useCallback(async () => {
    try {
      const [tripData, workspace] = await Promise.all([
        api.trips.getById(tripId),
        api.disruptions.getWorkspace(tripId),
      ]);
      setTrip(tripData);
      setDisruptions(workspace.disruptions);
      setAuditLogs(workspace.auditLogs);
    } catch (err) {
      setErrorBanner(err instanceof ApiError ? err.message : "Failed to load disruption console.");
    }
  }, [tripId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const currentItin =
    trip?.itineraries?.find((it) => it.isCurrent) || trip?.itineraries?.[0] || null;
  const currentVersionLabel = currentItin ? `v${currentItin.version}` : "None";
  const currency = trip?.currency || "INR";

  const latestProposals: RecoveryOption[] = (disruptions[0]?.proposals || []).map((p) =>
    mapProposalToViewOption(p, currency)
  );

  const handleSimulate = async (scenario: DisruptionScenario) => {
    setIsSimulating(true);
    setErrorBanner(null);
    setSuccessToast(null);
    setSimulationStep("1/3 Recording disruption event & queueing LangGraph recovery job...");

    try {
      const created = await api.disruptions.create(tripId, {
        type: scenario.id,
        severity: "HIGH",
        description: `${scenario.title}: ${scenario.alertText}`,
        details: {
          title: scenario.title,
          dayAffected: scenario.dayAffected,
          delayMinutes: scenario.delayMinutes,
          impactDescription: scenario.impactDescription,
        },
      });

      setSimulationStep("2/3 LangGraph analyzing schedule conflicts & computing recovery diffs...");

      const jobId = created.generationJob?.id;
      if (jobId) {
        const deadline = Date.now() + 45_000;
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 1200));
          const job = await api.generationJobs.getById(jobId);
          if (job.status === "COMPLETED") {
            break;
          }
          if (job.status === "FAILED" || job.status === "CANCELLED") {
            throw new Error(job.errorDetails?.message || "Recovery job failed on backend.");
          }
        }
      }

      setSimulationStep("3/3 Loading generated proposals & audit ledger...");
      await loadWorkspace();
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : "Unable to generate AI recovery proposals."
      );
    } finally {
      setIsSimulating(false);
      setSimulationStep(null);
    }
  };

  const handleSelectOption = (option: RecoveryOption) => {
    setSelectedRecoveryOption(option);
    setIsApprovalModalOpen(true);
  };

  const handleApprove = async (option: RecoveryOption) => {
    try {
      await api.recoveryProposals.approve(option.id);
      await loadWorkspace();
      setSuccessToast(`Approved ${option.title}! New recovered itinerary version activated.`);
    } catch (err) {
      setErrorBanner(
        err instanceof ApiError ? err.message : "Failed to approve recovery proposal."
      );
    }
  };

  const handleReject = async (option: RecoveryOption) => {
    try {
      await api.recoveryProposals.reject(option.id, "Declined by traveler");
      await loadWorkspace();
    } catch (err) {
      setErrorBanner(
        err instanceof ApiError ? err.message : "Failed to reject recovery proposal."
      );
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Top Navigation & Operational Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-default)]">
        <Link
          href={`/trips/${tripId}`}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Itinerary Workspace</span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface)] border border-[var(--border-default)] text-xs font-mono text-[var(--ink-secondary)] shadow-2xs">
            <Radio className="w-3 h-3 text-[var(--accent)] animate-pulse" />
            <span>{trip?.destination || "Travel-Ops Active"}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--status-confirmed-bg)] border border-[var(--status-confirmed-border)] text-xs font-mono font-semibold text-[var(--status-confirmed-text)] shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Itinerary {currentVersionLabel}</span>
          </div>
        </div>
      </div>

      {errorBanner && (
        <div className="p-4 rounded-xl bg-[var(--status-disrupted-bg)] border border-[var(--status-disrupted-border)] flex items-center gap-2.5 text-xs text-[var(--status-disrupted-text)]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {successToast && (
        <div className="p-4 rounded-xl bg-[var(--status-confirmed-bg)] border border-[var(--status-confirmed-border)] shadow-md flex items-center justify-between gap-4 text-xs font-semibold text-[var(--status-confirmed-text)]">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successToast}</span>
          </div>
          <Link href={`/trips/${tripId}`}>
            <Button variant="primary" size="sm" className="text-[11px] h-7 px-3">
              View Updated Itinerary &rarr;
            </Button>
          </Link>
        </div>
      )}

      {/* Headline Banner */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border-default)] shadow-xs space-y-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-[var(--accent)]">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
            <span>TRAVEL-OPS INCIDENT RECOVERY CONSOLE</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl font-semibold tracking-tight text-[var(--ink-primary)]">
            Disruption &amp; Recovery Engine
          </h1>
          <p className="text-xs sm:text-sm text-[var(--ink-secondary)] max-w-2xl leading-relaxed font-sans">
            Trigger real or simulated disruptions for {trip?.title || "your trip"}. LangGraph evaluates schedule collisions, synthesizes trade-offs, and awaits your approval before versioning the itinerary.
          </p>
        </div>

        {isSimulating && simulationStep && (
          <div className="p-3.5 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-default)] shadow-xs flex items-center gap-3">
            <Activity className="w-4 h-4 text-[var(--accent)] animate-spin shrink-0" />
            <span className="text-xs font-mono font-semibold text-[var(--ink-primary)]">
              {simulationStep}
            </span>
          </div>
        )}
      </div>

      {/* Simulator / Custom Incident Reporter */}
      <SimulatorPanel
        destination={trip?.destination}
        totalDays={currentItin?.days?.length || 3}
        onSimulate={handleSimulate}
        isSimulating={isSimulating}
      />

      {/* Real DB-backed AI Proposals */}
      <RecoveryOptionsView
        options={latestProposals}
        onSelectOption={handleSelectOption}
        onRejectOption={handleReject}
      />

      {/* Real DB-backed Audit Ledger & Version Rollback */}
      <AuditTrailView
        logs={auditLogs}
        itineraries={trip?.itineraries || []}
        onRollbackCompleted={(ver) => {
          void loadWorkspace();
          setSuccessToast(`Rolled back active itinerary to Version ${ver}.`);
        }}
      />

      {/* Approval Confirmation Modal */}
      <ApprovalModal
        isOpen={isApprovalModalOpen}
        option={selectedRecoveryOption}
        onClose={() => setIsApprovalModalOpen(false)}
        onApprove={handleApprove}
      />
    </div>
  );
}
