import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "confirmed" | "cancelled" | "shifted" | "planned" | "primary" | "accent" | "outline";
  size?: "sm" | "md";
}

export function Badge({
  className,
  variant = "planned",
  size = "md",
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    confirmed:
      "bg-[var(--status-confirmed-bg)] text-[var(--status-confirmed-text)] border-[var(--status-confirmed-border)]",
    cancelled:
      "bg-[var(--status-cancelled-bg)] text-[var(--status-cancelled-text)] border-[var(--status-cancelled-border)]",
    shifted:
      "bg-[var(--status-shifted-bg)] text-[var(--status-shifted-text)] border-[var(--status-shifted-border)]",
    planned:
      "bg-[var(--status-planned-bg)] text-[var(--status-planned-text)] border-[var(--status-planned-border)]",
    primary:
      "bg-[var(--primary)] text-white border-transparent",
    accent:
      "bg-[var(--accent-muted)] text-[var(--accent)] border-[var(--accent)]/30",
    outline:
      "bg-transparent text-[var(--ink-secondary)] border-[var(--border-default)]",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[11px] font-medium tracking-tight",
    md: "px-2.5 py-1 text-xs font-medium tracking-tight",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border transition-colors select-none font-sans",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
