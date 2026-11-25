"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { User as UserIcon, Mail, Phone, ShieldCheck, CheckCircle2, AlertTriangle, Save } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/providers/auth-provider";
import { api, ApiError } from "@/lib/api";

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setPhoneNumber(user.phoneNumber || "");
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      await api.auth.updateProfile({
        name: name.trim() || undefined,
        phoneNumber: phoneNumber.trim() ? phoneNumber.trim() : null,
      });
      await refreshUser();
      setMessage("Profile updated cleanly.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink-primary)]">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        <div className="space-y-2 border-b border-[var(--border-default)] pb-6">
          <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[var(--primary)] font-semibold">
            <UserIcon className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>TRAVELER ACCOUNT</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl font-semibold tracking-tight">
            Profile &amp; Verification
          </h1>
          <p className="text-xs sm:text-sm text-[var(--ink-secondary)]">
            Manage your contact identity used for trip alerts and disruption notifications.
          </p>
        </div>

        {message && (
          <div className="p-3.5 rounded-xl bg-[var(--status-confirmed-bg)] border border-[var(--status-confirmed-border)] text-xs text-[var(--status-confirmed-text)] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-[var(--status-disrupted-bg)] border border-[var(--status-disrupted-border)] text-xs text-[var(--status-disrupted-text)] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface)] p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-serif text-lg font-semibold">
                {(user?.name || user?.email || "T").charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-sm">{user?.name || "Traveler"}</p>
                <p className="text-xs font-mono text-[var(--ink-tertiary)] flex items-center gap-1.5">
                  <Mail className="w-3 h-3" />
                  <span>{user?.email}</span>
                </p>
              </div>
            </div>

            {user?.isEmailVerified ? (
              <Badge variant="confirmed" size="sm" className="gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Email Verified</span>
              </Badge>
            ) : (
              <Link href="/verify-email">
                <Button variant="outline" size="sm" className="text-xs">
                  Verify Email Now &rarr;
                </Button>
              </Link>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--ink-secondary)]">
                Full Name
              </label>
              <input
                type="text"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)]/40 px-3.5 py-2.5 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--ink-secondary)] flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[var(--ink-tertiary)]" />
                <span>Phone Number (Optional, for travel alerts)</span>
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)]/40 px-3.5 py-2.5 text-sm font-mono"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] font-mono text-[var(--ink-tertiary)]">
                Status: {user?.status || "ACTIVE"}
              </span>
              <Button type="submit" variant="primary" size="md" isLoading={isSaving} className="gap-2">
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
