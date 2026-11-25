"use client";

import React, { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  error = false,
}: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  // Split value into array of characters
  const digits = Array.from({ length }, (_, i) => value[i] || "");

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const val = e.target.value.replace(/\D/g, ""); // Allow only digits
    if (!val) return;

    const newDigits = [...digits];
    // Take the last character typed
    newDigits[index] = val.slice(-1);
    const newValue = newDigits.join("");
    onChange(newValue);

    // Auto-advance to next box if available
    if (index < length - 1) {
      inputRefs.current[index + 1]?.focus();
      setFocusedIndex(index + 1);
    }

    if (newValue.length === length && onComplete) {
      onComplete(newValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const newDigits = [...digits];

      if (newDigits[index]) {
        // Clear current cell
        newDigits[index] = "";
        onChange(newDigits.join(""));
      } else if (index > 0) {
        // Move back and clear previous cell
        newDigits[index - 1] = "";
        onChange(newDigits.join(""));
        inputRefs.current[index - 1]?.focus();
        setFocusedIndex(index - 1);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
      setFocusedIndex(index - 1);
    } else if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
      setFocusedIndex(index + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pastedData) return;

    onChange(pastedData);
    const nextFocus = Math.min(pastedData.length, length - 1);
    inputRefs.current[nextFocus]?.focus();
    setFocusedIndex(nextFocus);

    if (pastedData.length === length && onComplete) {
      onComplete(pastedData);
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 sm:gap-3" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digits[i]}
          disabled={disabled}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onFocus={() => setFocusedIndex(i)}
          className={cn(
            "w-12 h-14 sm:w-14 sm:h-16 text-center font-mono text-xl sm:text-2xl font-bold rounded-xl border transition-all duration-150 select-none bg-[var(--surface)] text-[var(--ink-primary)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent",
            focusedIndex === i && "border-[var(--primary)] shadow-sm",
            error
              ? "border-[var(--status-cancelled-text)] text-[var(--status-cancelled-text)] focus:ring-[var(--status-cancelled-text)]"
              : "border-[var(--border-default)]",
            disabled && "opacity-50 cursor-not-allowed bg-[var(--surface-muted)]"
          )}
        />
      ))}
    </div>
  );
}
