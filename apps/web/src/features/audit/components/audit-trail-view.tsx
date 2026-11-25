"use client";

import React, { useState } from "react";
import { History, RotateCcw, Sparkles, AlertTriangle, ShieldCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { AuditLog, Itinerary } from "@/types/api";

interface AuditTrailViewProps {
  logs: AuditLog[];
  itineraries?: Itinerary[];
  onRollbackCompleted?: (restoredVersion: number) => void;
}

function formatActionTitle(action: string, meta?: Record<string, unknown> | null): string {
  switch (action) {
    case "ITINERARY_GENERATED":
      return `Itinerary v${meta?.version ?? "?"} Generated`;
    case "DISRUPTION_REPORTED":
      return `Disruption Reported (${String(meta?.type ?? "INCIDENT").replace(/_/g, " ")})`;
    case "RECOVERY_PROPOSALS_GENERATED":
      return `AI Synthesized ${meta?.proposalCount ?? 3} Recovery Options`;
    case "PROPOSAL_APPROVED":
      return `Recovery Proposal Approved (${String(meta?.strategy ?? "ACTIVE")})`;
    case "PROPOSAL_REJECTED":
      return `Recovery Proposal Rejected (${String(meta?.strategy ?? "")})`;
    case "VERSION_ROLLBACK":
      return "Itinerary Rolled Back";
    default:
      return action.replace(/_/g, " ");
  }
}

function formatActionDetail(log: AuditLog): string {
  const m = log.metadata || {};
  if (log.action === "PROPOSAL_APPROVED") {
    return `Human approval applied proposal ${String(m.strategy || "")}. Cost delta: ${m.costDelta ?? 0}.`;
  }
  if (log.action === "DISRUPTION_REPORTED") {
    return `Severity: ${String(m.severity || "MEDIUM")}. Recovery workflow queued automatically.`;
  }
  if (log.action === "RECOVERY_PROPOSALS_GENERATED") {
    return `Recommended strategy: ${String(m.selectedStrategy || "MINIMAL_DISRUPTION")}.`;
  }
  return Object.keys(m).length > 0
    ? Object.entries(m)
        .slice(0, 4)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(" • ")
    : "Recorded in database audit ledger.";
}

export function AuditTrailView({
  logs,
  itineraries = [],
  onRollbackCompleted,
}: AuditTrailViewProps) {
  const [isRollingBack, setIsRollingBack] = useState(false);

  const sortedVersions = [...itineraries].sort((a, b) => a.version - b.version);
  const currentItin = itineraries.find((i) => i.isCurrent);
  const previousItin = sortedVersions.find(
    (i) => i.id !== currentItin?.id && i.version === 1
  ) || sortedVersions.find((i) => i.id !== currentItin?.id);

  const handleRollback = async () => {
    if (!previousItin) return;
    setIsRollingBack(true);
    try {
      await api.itineraries.setCurrent(previousItin.id);
      if (onRollbackCompleted) {
        onRollbackCompleted(previousItin.version);
      }
    } finally {
      setIsRollingBack(false);
    }
  };

  const getActorBadge = (actor: string) => {
    const upper = actor.toUpperCase();
    if (upper === "USER" || upper === "TRAVELER") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-[var(--primary)] bg-[var(--status-confirmed-bg)] px-2 py-0.5 rounded-full border border-[var(--status-confirmed-border)]">
          <ShieldCheck className="w-3 h-3" />
          <span>TRAVELER</span>
        </span>
      );
    }
    if (upper.includes("MONITOR") || upper.includes("INCIDENT")) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-[var(--status-cancelled-text)] bg-[var(--status-cancelled-bg)] px-2 py-0.5 rounded-full border border-[var(--status-cancelled-border)]">
          <AlertTriangle className="w-3 h-3" />
          <span>INCIDENT</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-[var(--accent)] bg-[var(--accent-muted)] px-2 py-0.5 rounded-full border border-[var(--accent)]/30">
        <Sparkles className="w-3 h-3" />
        <span>AI AGENT</span>
      </span>
    );
  };

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface)] p-6 sm:p-8 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[var(--border-subtle)]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[var(--primary)]" />
            <h3 className="font-serif text-xl sm:text-2xl font-semibold text-[var(--ink-primary)]">
              Operations Audit Trail &amp; Version History
            </h3>
          </div>
          <p className="text-xs text-[var(--ink-secondary)]">
            PostgreSQL audit ledger tracking every disruption event, AI recovery synthesis, approval, and version switch.
          </p>
        </div>

        {previousItin && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 self-start sm:self-auto text-xs"
            disabled={isRollingBack}
            isLoading={isRollingBack}
            onClick={() => void handleRollback()}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Rollback to Version {previousItin.version}</span>
          </Button>
        )}
      </div>

      {/* Audit Trail Timeline Rail */}
      {logs.length === 0 ? (
        <p className="text-xs text-[var(--ink-tertiary)] py-4">
          No audit events recorded for this trip yet.
        </p>
      ) : (
        <div className="relative pl-6 sm:pl-8 space-y-5">
          <div className="absolute left-[11px] sm:left-[15px] top-3 bottom-3 w-[2px] bg-[var(--border-default)]" />

          {logs.map((event) => (
            <div key={event.id} className="relative flex items-start gap-4">
              <div className="absolute -left-[19px] sm:-left-[23px] top-1.5 w-3 h-3 rounded-full bg-[var(--surface)] border-2 border-[var(--primary)] ring-2 ring-[var(--canvas)] z-10" />

              <div className="flex-1 p-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)]/50 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-xs text-[var(--ink-primary)]">
                    {formatActionTitle(event.action, event.metadata)}
                  </span>
                  <div className="flex items-center gap-2">
                    {getActorBadge(event.actorType)}
                    <span className="font-mono text-[11px] text-[var(--ink-tertiary)] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(event.createdAt).toLocaleString()}</span>
                    </span>
                  </div>
                </div>
                <p className="text-xs text-[var(--ink-secondary)] leading-relaxed">
                  {formatActionDetail(event)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
