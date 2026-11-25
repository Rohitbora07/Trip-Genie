"use client";

import React, { useState } from "react";
import { X, ShieldCheck, Check, AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RecoveryOption } from "@/features/recovery/components/recovery-options-view";

interface ApprovalModalProps {
  isOpen: boolean;
  option: RecoveryOption | null;
  onClose: () => void;
  onApprove: (option: RecoveryOption) => void;
}

export function ApprovalModal({
  isOpen,
  option,
  onClose,
  onApprove,
}: ApprovalModalProps) {
  const [isApproving, setIsApproving] = useState(false);

  if (!isOpen || !option) return null;

  const handleConfirm = async () => {
    setIsApproving(true);
    try {
      await onApprove(option);
    } finally {
      setIsApproving(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Frosted Backdrop */}
      <div
        className="fixed inset-0 bg-[#0F1A15]/60 backdrop-blur-xs transition-opacity animate-in fade-in-50"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-[var(--surface)] rounded-2xl border border-[var(--border-default)] shadow-2xl p-6 sm:p-8 z-10 animate-in zoom-in-95 fade-in-50 duration-150 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--status-confirmed-bg)] border border-[var(--status-confirmed-border)] flex items-center justify-center text-[var(--status-confirmed-text)] shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-semibold text-[var(--ink-primary)]">
                Human Approval Required
              </h3>
              <p className="text-xs text-[var(--ink-secondary)]">
                Confirm version activation for autonomous itinerary update
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Diff summary statement */}
        <div className="p-4 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-default)] text-xs space-y-2">
          <p className="font-semibold text-[var(--ink-primary)]">
            Activating: {option.title}
          </p>
          <p className="text-[11px] text-[var(--ink-secondary)] leading-relaxed">
            Approving this proposal will archive Version 1, apply {option.diffs.length} schedule adjustments, and activate Version 2 as your live operational schedule.
          </p>
          <div className="flex items-center gap-2 pt-1 font-mono text-[11px] text-[var(--primary)] font-semibold">
            <span>Net Financial Impact:</span>
            <span>{option.costDeltaText}</span>
          </div>
        </div>

        {/* Cryptographic / Ledger reassurance */}
        <div className="p-3 rounded-lg border border-[var(--border-subtle)] flex items-start gap-2.5 text-[11px] text-[var(--ink-tertiary)]">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--primary)]" />
          <span>
            An immutable record will be appended to your journey audit trail. You can safely rollback to Version 1 at any time.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="outline" size="md" onClick={onClose} disabled={isApproving}>
            Discard
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            className="gap-2 shadow-xs"
            isLoading={isApproving}
            onClick={handleConfirm}
          >
            <Check className="w-4 h-4" />
            <span>Approve &amp; Activate Version 2</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
