"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MailCheck, AlertCircle, ArrowLeft, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/auth/otp-input";
import { api, ApiError } from "@/lib/api";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Resend countdown ticker
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleVerify = async (codeToVerify?: string) => {
    const code = codeToVerify || otp;
    if (code.length < 6) {
      setErrorMessage("Please enter the full 6-digit verification code.");
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      await api.auth.verifyEmail({ token: code });
      setSuccessMessage("Email verified successfully! Redirecting to your dashboard...");
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Invalid or expired verification token. Please request a new code.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || isResending) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsResending(true);

    try {
      await api.auth.sendVerificationToken({ identifier: email });
      setSuccessMessage("A fresh verification code has been dispatched to your inbox.");
      setCountdown(60);
      setOtp("");
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Failed to resend code. Please try again shortly.");
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Icon & Title */}
      <div className="space-y-3">
        <div className="w-12 h-12 rounded-xl bg-[var(--status-confirmed-bg)] border border-[var(--status-confirmed-border)] flex items-center justify-center text-[var(--status-confirmed-text)]">
          <MailCheck className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--ink-primary)]">
            Verify your email
          </h2>
          <p className="text-sm text-[var(--ink-secondary)]">
            We dispatched a 6-digit verification code to{" "}
            <span className="font-medium text-[var(--ink-primary)] font-mono">
              {email || "your inbox"}
            </span>.
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

      {/* OTP Inputs */}
      <div className="space-y-4 py-2">
        <OtpInput
          length={6}
          value={otp}
          onChange={(val) => {
            setOtp(val);
            if (errorMessage) setErrorMessage(null);
          }}
          onComplete={(fullCode) => handleVerify(fullCode)}
          disabled={isLoading}
          error={!!errorMessage}
        />

        <Button
          type="button"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={otp.length !== 6 || isLoading}
          isLoading={isLoading}
          onClick={() => handleVerify()}
        >
          Confirm & Enter Dashboard
        </Button>
      </div>

      {/* Resend Timer & Action */}
      <div className="flex items-center justify-between text-xs text-[var(--ink-secondary)] pt-2 border-t border-[var(--border-subtle)]">
        <span>Didn&apos;t receive the code?</span>
        {countdown > 0 ? (
          <span className="font-mono text-[var(--ink-tertiary)]">
            Resend in {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, "0")}
          </span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="inline-flex items-center gap-1.5 text-[var(--accent)] font-semibold hover:underline disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResending ? "animate-spin" : ""}`} />
            <span>Resend Code</span>
          </button>
        )}
      </div>

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

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-[var(--ink-tertiary)]">Loading verification...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
