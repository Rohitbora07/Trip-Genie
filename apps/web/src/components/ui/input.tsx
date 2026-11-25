import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, hint, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-secondary)]"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-[var(--ink-tertiary)] pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            type={type}
            ref={ref}
            className={cn(
              "w-full h-11 px-3.5 bg-[var(--surface)] text-[var(--ink-primary)] text-sm rounded-lg border border-[var(--border-default)] transition-all duration-150 placeholder:text-[var(--ink-tertiary)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] disabled:opacity-50 disabled:bg-[var(--surface-muted)]",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              error && "border-[var(--status-cancelled-text)] focus:border-[var(--status-cancelled-text)] focus:ring-[var(--status-cancelled-text)]",
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 text-[var(--ink-tertiary)] flex items-center">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="text-xs text-[var(--status-cancelled-text)] font-medium transition-all">
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-xs text-[var(--ink-tertiary)]">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
