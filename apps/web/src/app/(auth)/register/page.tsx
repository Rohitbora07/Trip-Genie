"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User as UserIcon, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Simple password strength checks matching backend schema
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage("Please enter your name.");
      return;
    }
    if (!email.trim()) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!hasMinLength) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }

    setIsLoading(true);
    try {
      await api.auth.register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      // Redirect directly to 6-digit OTP verification page
      router.push(`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Registration failed. Please check your details and try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--ink-primary)]">
          Join the Atelier
        </h2>
        <p className="text-sm text-[var(--ink-secondary)]">
          Create an account to begin planning and experiencing autonomous journeys.
        </p>
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
          label="Full Name"
          type="text"
          placeholder="Alexander Wright"
          value={name}
          onChange={(e) => setName(e.target.value)}
          leftIcon={<UserIcon className="w-4 h-4" />}
          required
          autoComplete="name"
        />

        <Input
          label="Email Address"
          type="email"
          placeholder="alexander@traveler.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail className="w-4 h-4" />}
          required
          autoComplete="email"
        />

        <div className="space-y-2">
          <Input
            label="Create Password"
            type={showPassword ? "text" : "password"}
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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

          {/* Password requirement micro-indicators */}
          <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
            <div className={`flex items-center gap-1.5 ${hasMinLength ? "text-[var(--primary)]" : "text-[var(--ink-tertiary)]"}`}>
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>8+ chars</span>
            </div>
            <div className={`flex items-center gap-1.5 ${hasLetter ? "text-[var(--primary)]" : "text-[var(--ink-tertiary)]"}`}>
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Letter</span>
            </div>
            <div className={`flex items-center gap-1.5 ${hasNumber ? "text-[var(--primary)]" : "text-[var(--ink-tertiary)]"}`}>
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Number</span>
            </div>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full mt-2"
          isLoading={isLoading}
        >
          Create Atelier Account
        </Button>
      </form>

      {/* Switch to Login */}
      <p className="text-center text-sm text-[var(--ink-secondary)]">
        Already have an atelier account?{" "}
        <Link
          href="/login"
          className="text-[var(--primary)] font-semibold hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
