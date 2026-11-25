import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "accent" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading = false, children, disabled, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 ease-out select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed active:scale-[0.98]";

    const variantStyles = {
      primary:
        "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] shadow-xs border border-[var(--primary-hover)]/20 focus-visible:ring-[var(--primary)]",
      secondary:
        "bg-[var(--surface-muted)] text-[var(--ink-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border-default)] focus-visible:ring-[var(--border-strong)]",
      accent:
        "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] shadow-xs border border-[var(--accent-hover)]/20 focus-visible:ring-[var(--accent)]",
      outline:
        "bg-transparent text-[var(--ink-primary)] hover:bg-[var(--surface-muted)] border border-[var(--border-default)] hover:border-[var(--border-strong)] focus-visible:ring-[var(--primary)]",
      ghost:
        "bg-transparent text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] hover:bg-[var(--surface-muted)] focus-visible:ring-[var(--primary)]",
      destructive:
        "bg-[var(--status-cancelled-bg)] text-[var(--status-cancelled-text)] border border-[var(--status-cancelled-border)] hover:bg-[#F9E2DF] focus-visible:ring-[var(--status-cancelled-text)]",
    };

    const sizeStyles = {
      sm: "h-8 px-3 text-xs gap-1.5",
      md: "h-10 px-4 text-sm gap-2",
      lg: "h-12 px-6 text-base gap-2.5",
      icon: "h-10 w-10 p-0",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
