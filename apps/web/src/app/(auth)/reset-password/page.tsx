"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/auth/otp-input";
import { api, ApiError } from "@/lib/api";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (token.length !== 6) {
      setErrorMessage("Please enter the 6-digit reset token sent to your email.");
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await api.auth.resetPassword({
        token,
        newPassword,
      });

      setSuccessMessage("Password reset successfully! Redirecting to login...");
      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Password reset failed. The code may be expired.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Icon & Title */}
      <div className="space-y-3">
        <div className="w-12 h-12 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-default)] flex items-center justify-center text-[var(--accent)]">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--ink-primary)]">
            Create New Password
          </h2>
          <p className="text-sm text-[var(--ink-secondary)]">
            Enter the 6-digit code sent to{" "}
            <span className="font-medium text-[var(--ink-primary)] font-mono">
              {email || "your email"}
            </span>{" "}
            and set your new credentials.
          </p>
        </div>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-[var(--status-cancelled-bg)] border border-[var(--status-cancelled-border)] flex items-start gap-3 text-sm text-[var(--status-cancelled-text)]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 rounded-lg bg-[var(--status-confirmed-bg)] border border-[var(--status-confirmed-border)] flex items-start gap-3 text-sm text-[var(--status-confirmed-text)]">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-secondary)]">
            6-Digit Reset Code
          </label>
          <OtpInput
            length={6}
            value={token}
            onChange={(val) => {
              setToken(val);
              if (errorMessage) setErrorMessage(null);
            }}
            disabled={isLoading}
            error={!!errorMessage}
          />
        </div>

        <Input
          label="New Password"
          type={showPassword ? "text" : "password"}
          placeholder="At least 8 characters"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          leftIcon={<Lock className="w-4 h-4" />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)] transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          }
          required
          autoComplete="new-password"
        />

        <Input
          label="Confirm New Password"
          type={showPassword ? "text" : "password"}
          placeholder="Repeat new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          leftIcon={<Lock className="w-4 h-4" />}
          required
          autoComplete="new-password"
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full mt-2"
          disabled={token.length !== 6 || isLoading}
          isLoading={isLoading}
        >
          Update Password & Sign In
        </Button>
      </form>

      {/* Back to sign in */}
      <div className="text-center pt-2">
        <Link
          href="/login"
          className="text-xs text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] font-medium"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-[var(--ink-tertiary)]">Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
