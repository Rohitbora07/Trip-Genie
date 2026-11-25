"use client";

import React, { useState } from "react";
import {
  Check,
  Plus,
  Minus,
  Clock,
  TrendingDown,
  TrendingUp,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ProposalStatus } from "@/types/api";

export interface RecoveryDiffItem {
  id: string;
  type: "ADDED" | "CANCELLED" | "SHIFTED";
  title: string;
  timeText: string;
  note: string;
}

export interface RecoveryOption {
  id: string;
  title: string;
  subtitle: string;
  status?: ProposalStatus;
  costDeltaText: string;
  isCostIncrease: boolean;
  scheduleMatchScore: number;
  diffs: RecoveryDiffItem[];
  pros: string[];
  cons: string[];
}

interface RecoveryOptionsViewProps {
  options: RecoveryOption[];
  onSelectOption: (option: RecoveryOption) => void;
  onRejectOption?: (option: RecoveryOption) => void;
}

export function RecoveryOptionsView({
  options,
  onSelectOption,
  onRejectOption,
}: RecoveryOptionsViewProps) {
  const [selectedOptId, setSelectedOptId] = useState<string>(options[0]?.id || "");

  if (options.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--surface)] p-10 text-center space-y-2">
        <Sparkles className="w-6 h-6 text-[var(--accent)] mx-auto" />
        <h3 className="font-serif text-lg font-semibold text-[var(--ink-primary)]">
          No active recovery proposals yet
        </h3>
        <p className="text-xs text-[var(--ink-secondary)] max-w-md mx-auto">
          Trigger a scenario or submit a real disruption above to generate AI-backed recovery options with schedule diffs and budget impact.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="font-serif text-2xl font-semibold text-[var(--ink-primary)]">
            AI Recovery Proposals Comparison
          </h3>
          <p className="text-xs text-[var(--ink-secondary)] mt-0.5">
            Compare generated recovery strategies side-by-side. Your current itinerary stays unchanged until you approve one.
          </p>
        </div>

        <Badge variant="accent" size="sm" className="self-start sm:self-auto gap-1">
          <Sparkles className="w-3 h-3" />
          <span>{options.length} AI Proposals Ready</span>
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {options.map((option) => {
          const isSelected = selectedOptId === option.id;
          const isApplied = option.status === "APPLIED" || option.status === "APPROVED";
          const isRejected = option.status === "REJECTED";

          return (
            <div
              key={option.id}
              className={`rounded-2xl border p-6 flex flex-col justify-between space-y-6 transition-all duration-200 ${
                isApplied
                  ? "bg-[var(--status-confirmed-bg)]/30 border-[var(--status-confirmed-border)] shadow-sm"
                  : isSelected
                  ? "bg-[var(--surface)] border-[var(--primary)] shadow-md ring-1 ring-[var(--primary)]/20"
                  : "bg-[var(--surface)] border-[var(--border-default)] hover:border-[var(--border-strong)]"
              } ${isRejected ? "opacity-60" : ""}`}
            >
              {/* Option Header */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={isApplied ? "confirmed" : "outline"} size="sm">
                    {isApplied
                      ? "APPLIED VERSION"
                      : isRejected
                      ? "REJECTED"
                      : `${option.scheduleMatchScore}% Schedule Match`}
                  </Badge>

                  {/* Financial Ledger Tag */}
                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold ${
                      option.isCostIncrease
                        ? "bg-[var(--status-shifted-bg)] text-[var(--status-shifted-text)] border border-[var(--status-shifted-border)]"
                        : "bg-[var(--status-confirmed-bg)] text-[var(--status-confirmed-text)] border border-[var(--status-confirmed-border)]"
                    }`}
                  >
                    {option.isCostIncrease ? (
                      <TrendingUp className="w-3.5 h-3.5" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5" />
                    )}
                    <span>{option.costDeltaText}</span>
                  </div>
                </div>

                <div>
                  <h4 className="font-serif text-lg sm:text-xl font-semibold text-[var(--ink-primary)]">
                    {option.title}
                  </h4>
                  <p className="text-xs text-[var(--ink-secondary)] leading-relaxed mt-0.5">
                    {option.subtitle}
                  </p>
                </div>
              </div>

              {/* Semantic Visual Diff Items */}
              <div className="space-y-2.5 pt-2 border-t border-[var(--border-subtle)]">
                <p className="text-[10px] uppercase font-mono tracking-wider font-semibold text-[var(--ink-tertiary)]">
                  Schedule Adjustments (Diff Ledger)
                </p>

                {option.diffs.length === 0 ? (
                  <p className="text-xs text-[var(--ink-tertiary)] italic">
                    Preserves current sequence with minimal buffer adjustments.
                  </p>
                ) : (
                  option.diffs.map((diff) => {
                    if (diff.type === "ADDED") {
                      return (
                        <div
                          key={diff.id}
                          className="p-3 rounded-xl bg-[var(--status-confirmed-bg)]/60 border border-[var(--status-confirmed-border)] text-xs space-y-0.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 font-semibold text-[var(--status-confirmed-text)] font-mono text-[11px]">
                              <Plus className="w-3 h-3" />
                              <span>ADDED ACTIVITY</span>
                            </span>
                            {diff.timeText && (
                              <span className="font-mono text-[11px] text-[var(--ink-tertiary)]">
                                {diff.timeText}
                              </span>
                            )}
                          </div>
                          <p className="font-medium text-[var(--ink-primary)]">{diff.title}</p>
                          <p className="text-[11px] text-[var(--ink-secondary)]">{diff.note}</p>
                        </div>
                      );
                    }

                    if (diff.type === "CANCELLED") {
                      return (
                        <div
                          key={diff.id}
                          className="p-3 rounded-xl bg-[var(--status-cancelled-bg)]/60 border border-[var(--status-cancelled-border)] text-xs space-y-0.5 opacity-85"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 font-semibold text-[var(--status-cancelled-text)] font-mono text-[11px]">
                              <Minus className="w-3 h-3" />
                              <span>REMOVED ACTIVITY</span>
                            </span>
                            {diff.timeText && (
                              <span className="font-mono text-[11px] text-[var(--ink-tertiary)]">
                                {diff.timeText}
                              </span>
                            )}
                          </div>
                          <p className="font-medium text-[var(--ink-primary)] line-through">
                            {diff.title}
                          </p>
                          <p className="text-[11px] text-[var(--status-cancelled-text)]">
                            {diff.note}
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={diff.id}
                        className="p-3 rounded-xl bg-[var(--status-shifted-bg)]/60 border border-[var(--status-shifted-border)] text-xs space-y-0.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 font-semibold text-[var(--status-shifted-text)] font-mono text-[11px]">
                            <Clock className="w-3 h-3" />
                            <span>SHIFTED TIMING</span>
                          </span>
                          <span className="font-mono text-[11px] text-[var(--status-shifted-text)] font-semibold">
                            {diff.timeText}
                          </span>
                        </div>
                        <p className="font-medium text-[var(--ink-primary)]">{diff.title}</p>
                        <p className="text-[11px] text-[var(--ink-secondary)]">{diff.note}</p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Trade-offs */}
              {option.pros.length > 0 && (
                <div className="p-3.5 rounded-xl bg-[var(--surface-muted)]/70 border border-[var(--border-default)] text-xs space-y-2">
                  <p className="text-[10px] uppercase font-mono tracking-wider font-semibold text-[var(--ink-tertiary)]">
                    Trade-off Analysis
                  </p>
                  <ul className="space-y-1 text-[11px] text-[var(--ink-secondary)]">
                    {option.pros.map((pro, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="font-bold text-[var(--primary)]">•</span>
                        <span>{pro}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={isApplied ? "secondary" : isSelected ? "primary" : "outline"}
                  size="md"
                  disabled={isApplied || isRejected}
                  className="flex-1 gap-2 shadow-xs"
                  onClick={() => {
                    setSelectedOptId(option.id);
                    onSelectOption(option);
                  }}
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isApplied
                      ? "Applied to Itinerary"
                      : isRejected
                      ? "Rejected"
                      : "Review & Approve"}
                  </span>
                </Button>

                {onRejectOption && !isApplied && !isRejected && (
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    title="Reject proposal"
                    onClick={() => onRejectOption(option)}
                    className="px-3 text-[var(--ink-secondary)] hover:text-[var(--status-cancelled-text)]"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
