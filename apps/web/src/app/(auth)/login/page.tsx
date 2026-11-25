"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/providers/auth-provider";
import { api, ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage("Please provide both email and password.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.auth.login({ email, password });
      await refreshUser();
      if (response.user.isEmailVerified) {
        router.push("/dashboard");
      } else {
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("An unexpected error occurred. Please try again.");
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
          Welcome back
        </h2>
        <p className="text-sm text-[var(--ink-secondary)]">
          Sign in to access your curated journeys and real-time operations.
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
          label="Email Address"
          type="email"
          placeholder="traveler@tripgenie.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail className="w-4 h-4" />}
          required
          autoComplete="email"
        />

        <div className="space-y-1">
          <Input
            label="Password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••••••"
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
            autoComplete="current-password"
          />
          <div className="flex justify-end pt-1">
            <Link
              href="/forgot-password"
              className="text-xs text-[var(--accent)] hover:underline font-medium"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full mt-2"
          isLoading={isLoading}
        >
          Sign In to Atelier
        </Button>
      </form>

      {/* Demo Credentials Box */}
      <div className="p-3.5 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-default)] space-y-1">
        <div className="flex items-center justify-between text-xs font-semibold text-[var(--ink-secondary)]">
          <span>PORTFOLIO DEMO CREDENTIALS</span>
          <span className="text-[10px] text-[var(--primary)] font-mono">SEEDED</span>
        </div>
        <p className="text-xs text-[var(--ink-tertiary)] font-mono">
          traveler@tripgenie.com / Password123!
        </p>
      </div>

      {/* Switch to Register */}
      <p className="text-center text-sm text-[var(--ink-secondary)]">
        Don&apos;t have an atelier account?{" "}
        <Link
          href="/register"
          className="text-[var(--primary)] font-semibold hover:underline"
        >
          Create one now
        </Link>
      </p>
    </div>
  );
}
