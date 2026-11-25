"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, KeyRound, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage("Please provide your account email address.");
      return;
    }

    setIsLoading(true);
    try {
      await api.auth.forgotPassword({ email: email.trim().toLowerCase() });
      // Redirect to reset password with email in query
      router.push(`/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Unable to initiate password reset. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Icon & Title */}
      <div className="space-y-3">
        <div className="w-12 h-12 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-default)] flex items-center justify-center text-[var(--primary)]">
          <KeyRound className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--ink-primary)]">
            Reset Password
          </h2>
          <p className="text-sm text-[var(--ink-secondary)]">
            Enter your email to receive a 6-digit verification code to reset your credentials.
          </p>
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-[var(--status-cancelled-bg)] border border-[var(--status-cancelled-border)] flex items-start gap-3 text-sm text-[var(--status-cancelled-text)]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Account Email"
          type="email"
          placeholder="traveler@tripgenie.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail className="w-4 h-4" />}
          required
          autoComplete="email"
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full mt-2"
          isLoading={isLoading}
        >
          Send Reset Code
        </Button>
      </form>

      {/* Back to sign in */}
      <div className="text-center pt-2">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to sign in</span>
        </Link>
      </div>
    </div>
  );
}
