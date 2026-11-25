"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Compass,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Zap,
  CloudRain,
  Plane,
  Building2,
  Plus,
  Minus,
  Clock,
  TrendingDown,
  TrendingUp,
  MapPin,
  Calendar,
  Sparkles,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Sample scenarios for the interactive landing page disruption teaser
const LANDING_SCENARIOS = [
  {
    id: "WEATHER",
    title: "Day 2: Typhoon Rainstorm in Asakusa",
    icon: <CloudRain className="w-4 h-4 text-[#B85D38]" />,
    tag: "Meteorological Alert",
    impact: "Senso-ji outdoor walkways flooded; high wind advisory in Taito ward.",
    diffs: [
      {
        type: "CANCELLED" as const,
        title: "Senso-ji Temple Morning Walking Tour",
        time: "09:00 – 11:00",
        note: "Outdoor paths invalidated due to downpour. Automatic refund initiated.",
      },
      {
        type: "ADDED" as const,
        title: "Mori Art Museum & Indoor Roppongi Deck",
        time: "13:30 – 16:00 • $25.00",
        note: "100% weather-sheltered cultural gallery with covered metro access.",
      },
      {
        type: "SHIFTED" as const,
        title: "Ginza Omakase Dinner Reservation",
        time: "19:00 → 20:30 (+1h 30m)",
        note: "Rescheduled with host chef to align with delayed subway connection.",
      },
    ],
    savingsText: "-$15.00 Net Savings",
    isSavings: true,
  },
  {
    id: "FLIGHT",
    title: "Day 1: Flight JL006 Delayed by 4 Hours",
    icon: <Plane className="w-4 h-4 text-[#B85D38]" />,
    tag: "Aviation Telemetry",
    impact: "Pacific jetstream headwinds delay Narita arrival from 09:00 to 13:00.",
    diffs: [
      {
        type: "SHIFTED" as const,
        title: "Narita Express to Tokyo Station",
        time: "10:45 → 14:15 (+3h 30m)",
        note: "Automatically rebooked on later reserved-seat express train.",
      },
      {
        type: "SHIFTED" as const,
        title: "Hotel Check-in at Aman Tokyo",
        time: "12:15 → 15:45 (+3h 30m)",
        note: "Concierge informed of late check-in; luggage sent directly to suite.",
      },
      {
        type: "CANCELLED" as const,
        title: "Tsukiji Afternoon Tea Ceremony",
        time: "14:00 – 15:30",
        note: "Window expired; replaced with evening craft cocktails in Shinjuku.",
      },
    ],
    savingsText: "$0.00 Neutral Balance",
    isSavings: false,
  },
  {
    id: "VENUE",
    title: "Day 2: teamLab Planets Power Maintenance",
    icon: <Building2 className="w-4 h-4 text-[#B85D38]" />,
    tag: "Facility Notice",
    impact: "Unplanned electrical outage closes digital water installation in Toyosu.",
    diffs: [
      {
        type: "CANCELLED" as const,
        title: "teamLab Planets Tokyo Immersion",
        time: "14:30 – 17:00",
        note: "Full ticket credit applied directly to traveler account.",
      },
      {
        type: "ADDED" as const,
        title: "Tokyo National Museum & Master Tea Salon",
        time: "14:00 – 16:30 • $35.00",
        note: "Prime indoor imperial collection with serene sheltered gardens.",
      },
      {
        type: "SHIFTED" as const,
        title: "Evening Omoide Yokocho Stroll",
        time: "18:30 → 19:15 (+45m)",
        note: "Refocused to avoid rain squall in northern Shinjuku.",
      },
    ],
    savingsText: "+$3.00 Adjustment",
    isSavings: false,
  },
];

export default function HomePage() {
  const [activeScenarioIdx, setActiveScenarioIdx] = useState(0);
  const activeScenario = LANDING_SCENARIOS[activeScenarioIdx];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--canvas)] text-[var(--ink-primary)] selection:bg-[#E2ECE5] selection:text-[#17382B]">
      {/* 1. EDITORIAL MASTHEAD */}
      <div className="w-full border-b border-[var(--border-subtle)] bg-[var(--surface)] text-[11px] font-mono tracking-wider py-1.5 px-4 text-center text-[var(--ink-secondary)] flex items-center justify-between max-w-7xl mx-auto">
        <span className="hidden sm:inline">ISSUE Nº 04 • AUTUMN EDITION</span>
        <span className="font-semibold text-[var(--primary)] uppercase">
          Autonomous Travel Operations Atelier • Tokyo &amp; Global
        </span>
        <span className="hidden sm:inline">OSM &amp; GROQ ACCELERATED</span>
      </div>

      <header className="sticky top-0 z-40 w-full border-b border-[var(--border-default)] bg-[var(--canvas)]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Brand Wordmark */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary)] flex items-center justify-center text-white shadow-xs">
              <Compass className="w-5 h-5 text-[#E0EFE6]" />
            </div>
            <div>
              <span className="font-serif tracking-widest text-lg uppercase font-semibold text-[var(--ink-primary)] block leading-none">
                Trip Genie
              </span>
              <span className="text-[10px] tracking-widest uppercase font-mono text-[var(--ink-tertiary)] block mt-0.5">
                Travel Operations Atelier
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-[var(--ink-secondary)]">
            <a href="#how-it-works" className="hover:text-[var(--primary)] transition-colors">
              The Disruption Loop
            </a>
            <a href="#architecture" className="hover:text-[var(--primary)] transition-colors">
              Tripartite Architecture
            </a>
            <a href="#expeditions" className="hover:text-[var(--primary)] transition-colors">
              Curated Expeditions
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="primary" size="sm" className="gap-2 shadow-xs">
                <span>Enter Atelier</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. ASYMMETRIC HERO SECTION */}
      <section className="relative pt-12 pb-20 lg:pt-20 lg:pb-28 border-b border-[var(--border-default)] overflow-hidden">
        {/* Subtle architectural background grid */}
        <div className="absolute inset-0 bg-[radial-gradient(#17382B_0.75px,transparent_0.75px)] [background-size:24px_24px] opacity-[0.035] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left 7 Columns: Editorial Manifesto */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface)] text-[var(--primary)] border border-[var(--border-default)] text-xs font-mono font-medium shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                <span>REAL-TIME DISRUPTION SENSING &amp; RECOVERY</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-6xl xl:text-7xl font-normal tracking-tight text-[var(--ink-primary)] leading-[1.08]">
                Bespoke journeys that <span className="italic font-normal">flawlessly adapt</span> when plans unravel.
              </h1>

              <p className="text-base sm:text-lg text-[var(--ink-secondary)] font-sans leading-relaxed max-w-xl">
                Ordinary planners collapse when flights delay or weather strikes. Trip Genie senses schedule conflicts in real time, evaluates domino consequences, and autonomously synthesizes multi-option recoveries with human sovereignty.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
                <Link href="/dashboard">
                  <Button variant="primary" size="lg" className="w-full sm:w-auto gap-2.5 shadow-md">
                    <Compass className="w-4 h-4 text-[#E0EFE6]" />
                    <span>Explore Tokyo Demo Journey</span>
                  </Button>
                </Link>
                <Link href="/trips/demo-tokyo-1/disruptions">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2 bg-[var(--surface)]">
                    <Zap className="w-4 h-4 text-[var(--accent)]" />
                    <span>Launch Disruption Simulator</span>
                  </Button>
                </Link>
              </div>

              {/* Live operational guarantees */}
              <div className="pt-8 border-t border-[var(--border-subtle)] grid grid-cols-3 gap-4 text-left">
                <div>
                  <p className="font-mono text-xl sm:text-2xl font-semibold text-[var(--primary)]">
                    &lt; 30s
                  </p>
                  <p className="text-[11px] text-[var(--ink-secondary)] uppercase font-mono tracking-wider">
                    Recovery Synthesis
                  </p>
                </div>
                <div>
                  <p className="font-mono text-xl sm:text-2xl font-semibold text-[var(--primary)]">
                    100%
                  </p>
                  <p className="text-[11px] text-[var(--ink-secondary)] uppercase font-mono tracking-wider">
                    Human Approval
                  </p>
                </div>
                <div>
                  <p className="font-mono text-xl sm:text-2xl font-semibold text-[var(--primary)]">
                    Immutable
                  </p>
                  <p className="text-[11px] text-[var(--ink-secondary)] uppercase font-mono tracking-wider">
                    Audit Trail &amp; Rollback
                  </p>
                </div>
              </div>
            </div>

            {/* Right 5 Columns: Boarding Pass Hero Artifact */}
            <div className="lg:col-span-5">
              <div className="relative rounded-2xl bg-[var(--surface)] border border-[var(--border-default)] shadow-xl overflow-hidden">
                {/* Visual Header with Tokyo Photography banner */}
                <div className="relative h-48 sm:h-56 bg-gradient-to-br from-[#17382B] via-[#234D3D] to-[#122A21] p-6 text-white flex flex-col justify-between overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-15 pointer-events-none" />

                  <div className="relative z-10 flex items-center justify-between">
                    <span className="text-[10px] font-mono tracking-widest uppercase bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20">
                      LIVE EXPEDITION MANIFEST
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-[#A8D5B8] font-mono font-semibold">
                      <span className="w-2 h-2 rounded-full bg-[#A8D5B8] animate-pulse" />
                      MONITORED
                    </span>
                  </div>

                  <div className="relative z-10 space-y-1">
                    <p className="text-xs font-mono uppercase tracking-widest text-white/70">
                      Tokyo, Japan • 6 Nights
                    </p>
                    <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-white">
                      Tokyo Autumn Odyssey
                    </h2>
                  </div>
                </div>

                {/* Perforated separator */}
                <div className="h-4 bg-[var(--surface-muted)] perforated-border-b relative flex items-center justify-between px-2">
                  <div className="w-4 h-4 rounded-full bg-[var(--canvas)] -ml-4" />
                  <div className="w-4 h-4 rounded-full bg-[var(--canvas)] -mr-4" />
                </div>

                {/* Ticket Details & Live Incident Pulse */}
                <div className="p-6 space-y-4">
                  <div className="p-3.5 rounded-xl bg-[var(--status-shifted-bg)] border border-[var(--status-shifted-border)] flex items-start gap-3">
                    <CloudRain className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
                    <div className="text-xs space-y-0.5">
                      <p className="font-semibold text-[var(--status-shifted-text)]">
                        Active Alert: Day 2 Weather Warning
                      </p>
                      <p className="text-[11px] text-[var(--ink-secondary)]">
                        Rain squall predicted at 09:00. 2 indoor recovery options ready for review.
                      </p>
                    </div>
                  </div>

                  {/* Micro activity preview */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-subtle)] font-mono">
                      <span className="text-[var(--ink-primary)]">09:00 Narita Int&apos;l (JL006)</span>
                      <span className="text-[var(--status-confirmed-text)] font-semibold">CONFIRMED</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-subtle)] font-mono">
                      <span className="text-[var(--ink-primary)]">12:15 Aman Tokyo Suite</span>
                      <span className="text-[var(--status-confirmed-text)] font-semibold">CONFIRMED</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-subtle)] font-mono">
                      <span className="text-[var(--ink-primary)]">19:00 Ginza Sushi Omakase</span>
                      <span className="text-[var(--status-shifted-text)] font-semibold">SHIFTED (+1.5h)</span>
                    </div>
                  </div>

                  <Link href="/trips/demo-tokyo-1" className="block pt-2">
                    <Button variant="secondary" size="sm" className="w-full gap-2">
                      <span>Inspect Tokyo Itinerary Workspace</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. INTERACTIVE DISRUPTION RECOVERY IN 30 SECONDS */}
      <section id="how-it-works" className="py-20 lg:py-28 bg-[var(--surface)] border-b border-[var(--border-default)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--accent)] bg-[var(--accent-muted)] px-3 py-1 rounded-full border border-[var(--accent)]/20">
              The Core Differentiator
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl font-semibold text-[var(--ink-primary)]">
              When disaster strikes, observe the recovery in real time.
            </h2>
            <p className="text-sm sm:text-base text-[var(--ink-secondary)] font-sans">
              Choose an incident scenario below to see how Trip Genie isolates the conflict, ripples through downstream reservations, and renders an actionable visual diff.
            </p>
          </div>

          {/* Scenario Selector Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {LANDING_SCENARIOS.map((sc, idx) => {
              const isSelected = activeScenarioIdx === idx;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => setActiveScenarioIdx(idx)}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-medium border transition-all duration-150 select-none ${
                    isSelected
                      ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm scale-102"
                      : "bg-[var(--surface-muted)] text-[var(--ink-secondary)] border-[var(--border-default)] hover:text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  {sc.icon}
                  <span className="font-semibold">{sc.title}</span>
                </button>
              );
            })}
          </div>

          {/* Interactive Diff Display Card */}
          <div className="max-w-4xl mx-auto rounded-2xl border border-[var(--border-default)] bg-[var(--canvas)] p-6 sm:p-8 shadow-md space-y-6">
            {/* Header of Active Disruption */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--border-default)]">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="accent" size="sm">
                    {activeScenario.tag}
                  </Badge>
                  <span className="text-xs font-mono text-[var(--ink-tertiary)]">
                    Scenario 0{activeScenarioIdx + 1}
                  </span>
                </div>
                <h3 className="font-serif text-2xl font-semibold text-[var(--ink-primary)]">
                  {activeScenario.title}
                </h3>
                <p className="text-xs text-[var(--status-cancelled-text)] font-medium">
                  {activeScenario.impact}
                </p>
              </div>

              {/* Financial delta chip */}
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold self-start sm:self-auto ${
                  activeScenario.isSavings
                    ? "bg-[var(--status-confirmed-bg)] text-[var(--status-confirmed-text)] border border-[var(--status-confirmed-border)]"
                    : "bg-[var(--status-shifted-bg)] text-[var(--status-shifted-text)] border border-[var(--status-shifted-border)]"
                }`}
              >
                {activeScenario.isSavings ? (
                  <TrendingDown className="w-3.5 h-3.5" />
                ) : (
                  <TrendingUp className="w-3.5 h-3.5" />
                )}
                <span>{activeScenario.savingsText}</span>
              </div>
            </div>

            {/* Semantic Visual Diff Items */}
            <div className="space-y-3">
              <p className="text-[10px] uppercase font-mono tracking-wider font-semibold text-[var(--ink-tertiary)]">
                Autonomous Schedule Adjustments (Diff Ledger)
              </p>

              {activeScenario.diffs.map((diff, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-xl border text-xs space-y-1 transition-all ${
                    diff.type === "ADDED"
                      ? "bg-[var(--status-confirmed-bg)]/70 border-[var(--status-confirmed-border)]"
                      : diff.type === "CANCELLED"
                      ? "bg-[var(--status-cancelled-bg)]/70 border-[var(--status-cancelled-border)] opacity-85"
                      : "bg-[var(--status-shifted-bg)]/70 border-[var(--status-shifted-border)]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1 font-mono font-semibold text-[11px] ${
                        diff.type === "ADDED"
                          ? "text-[var(--status-confirmed-text)]"
                          : diff.type === "CANCELLED"
                          ? "text-[var(--status-cancelled-text)]"
                          : "text-[var(--status-shifted-text)]"
                      }`}
                    >
                      {diff.type === "ADDED" && <Plus className="w-3.5 h-3.5" />}
                      {diff.type === "CANCELLED" && <Minus className="w-3.5 h-3.5" />}
                      {diff.type === "SHIFTED" && <Clock className="w-3.5 h-3.5" />}
                      <span>{diff.type} ACTIVITY</span>
                    </span>
                    <span className="font-mono text-[11px] text-[var(--ink-tertiary)]">
                      {diff.time}
                    </span>
                  </div>
                  <p
                    className={`font-semibold text-sm ${
                      diff.type === "CANCELLED"
                        ? "line-through text-[var(--ink-tertiary)]"
                        : "text-[var(--ink-primary)]"
                    }`}
                  >
                    {diff.title}
                  </p>
                  <p className="text-[11px] text-[var(--ink-secondary)] leading-relaxed">
                    {diff.note}
                  </p>
                </div>
              ))}
            </div>

            {/* Simulated Human Approval Call-to-Action */}
            <div className="pt-4 border-t border-[var(--border-default)] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-[var(--ink-secondary)]">
                <ShieldCheck className="w-4 h-4 text-[var(--primary)] shrink-0" />
                <span>
                  Requires explicit human authorization before Version 2 activation.
                </span>
              </div>
              <Link href="/trips/demo-tokyo-1/disruptions">
                <Button variant="primary" size="sm" className="gap-2 shadow-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Launch Live Operations Diff &rarr;</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 4. THE TRIPARTITE OPERATIONAL ARCHITECTURE */}
      <section id="architecture" className="py-20 lg:py-28 border-b border-[var(--border-default)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--primary)] bg-[var(--surface-muted)] px-3 py-1 rounded-full border border-[var(--border-default)]">
              Engineering Architecture
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl font-semibold text-[var(--ink-primary)]">
              Built on precision telemetry and sovereign human approval.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Pillar 1 */}
            <div className="p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border-default)] space-y-4 shadow-xs hover:border-[var(--border-strong)] transition-colors">
              <span className="text-xs font-mono font-bold text-[var(--accent)] tracking-widest block">
                01 / TELEMETRY
              </span>
              <div className="w-12 h-12 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-default)] flex items-center justify-center text-[var(--primary)]">
                <Zap className="w-6 h-6 text-[var(--accent)]" />
              </div>
              <h3 className="font-serif text-xl font-semibold text-[var(--ink-primary)]">
                Real-Time Sensing
              </h3>
              <p className="text-xs sm:text-sm text-[var(--ink-secondary)] leading-relaxed">
                Connects directly to OpenStreetMap distance caches, aviation schedules, and local meteorological forecasts to catch delays long before you reach the gate.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border-default)] space-y-4 shadow-xs hover:border-[var(--border-strong)] transition-colors">
              <span className="text-xs font-mono font-bold text-[var(--primary)] tracking-widest block">
                02 / SYNTHESIS
              </span>
              <div className="w-12 h-12 rounded-xl bg-[var(--status-confirmed-bg)] border border-[var(--status-confirmed-border)] flex items-center justify-center text-[var(--status-confirmed-text)]">
                <RefreshCw className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl font-semibold text-[var(--ink-primary)]">
                LangGraph Multi-Option Diff
              </h3>
              <p className="text-xs sm:text-sm text-[var(--ink-secondary)] leading-relaxed">
                Our stateful agent graph analyzes 10+ permutations, resolving schedule conflicts into 2–3 distinct options with transparent trade-offs and financial cost deltas.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border-default)] space-y-4 shadow-xs hover:border-[var(--border-strong)] transition-colors">
              <span className="text-xs font-mono font-bold text-[var(--ink-tertiary)] tracking-widest block">
                03 / SOVEREIGNTY
              </span>
              <div className="w-12 h-12 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-default)] flex items-center justify-center text-[var(--primary)]">
                <ShieldCheck className="w-6 h-6 text-[var(--primary)]" />
              </div>
              <h3 className="font-serif text-xl font-semibold text-[var(--ink-primary)]">
                Human-in-the-Loop Governance
              </h3>
              <p className="text-xs sm:text-sm text-[var(--ink-secondary)] leading-relaxed">
                No secret schedule rewrites. Every itinerary version requires explicit traveler authorization, recorded to an immutable audit trail with instant 1-click rollback.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CURATED EXPEDITIONS SHOWCASE */}
      <section id="expeditions" className="py-20 lg:py-28 bg-[var(--surface)] border-b border-[var(--border-default)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--ink-tertiary)]">
                Portfolio of Curated Journeys
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-[var(--ink-primary)]">
                Handcrafted expeditions ready to explore.
              </h2>
            </div>
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="gap-2">
                <span>View All Journeys</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Tokyo */}
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--canvas)] overflow-hidden shadow-xs hover:shadow-md transition-all group flex flex-col justify-between">
              <div className="h-44 bg-gradient-to-br from-[#1E3F32] to-[#34604F] p-5 text-white flex flex-col justify-between relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <Badge variant="confirmed" size="sm">
                    ACTIVE EXPEDITION
                  </Badge>
                  <span className="text-xs font-mono text-white/80">6 NIGHTS</span>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-mono text-[#E0EFE6] uppercase tracking-wider">
                    Tokyo, Japan
                  </p>
                  <h4 className="font-serif text-xl font-semibold text-white">
                    Tokyo Autumn Odyssey
                  </h4>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-xs text-[var(--ink-secondary)] leading-relaxed">
                  Narita arrival, Aman Tokyo, historic Senso-ji temple walks, Ginza omakase, and Shibuya digital art immersion.
                </p>
                <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                  <span className="font-mono font-semibold text-[var(--ink-primary)]">
                    $2,800 USD
                  </span>
                  <Link href="/trips/demo-tokyo-1" className="text-[var(--primary)] font-semibold hover:underline">
                    Inspect Timeline &rarr;
                  </Link>
                </div>
              </div>
            </div>

            {/* Card 2: Kyoto */}
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--canvas)] overflow-hidden shadow-xs hover:shadow-md transition-all group flex flex-col justify-between">
              <div className="h-44 bg-gradient-to-br from-[#38261F] to-[#604235] p-5 text-white flex flex-col justify-between relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <Badge variant="planned" size="sm">
                    PLANNED
                  </Badge>
                  <span className="text-xs font-mono text-white/80">4 NIGHTS</span>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-mono text-[#F4D9CE] uppercase tracking-wider">
                    Kyoto, Japan
                  </p>
                  <h4 className="font-serif text-xl font-semibold text-white">
                    Kyoto Zen Heritage
                  </h4>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-xs text-[var(--ink-secondary)] leading-relaxed">
                  Arashiyama bamboo grove stroll, Fushimi Inari torii gates at sunrise, and private machiya tea tasting.
                </p>
                <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                  <span className="font-mono font-semibold text-[var(--ink-primary)]">
                    $1,950 USD
                  </span>
                  <Link href="/dashboard" className="text-[var(--primary)] font-semibold hover:underline">
                    View Manifest &rarr;
                  </Link>
                </div>
              </div>
            </div>

            {/* Card 3: Swiss Alps */}
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--canvas)] overflow-hidden shadow-xs hover:shadow-md transition-all group flex flex-col justify-between">
              <div className="h-44 bg-gradient-to-br from-[#1C2C38] to-[#344F63] p-5 text-white flex flex-col justify-between relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" size="sm" className="bg-white/10 text-white border-white/20">
                    DRAFT ITINERARY
                  </Badge>
                  <span className="text-xs font-mono text-white/80">7 NIGHTS</span>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-mono text-[#D2E4F2] uppercase tracking-wider">
                    Swiss Alps, Switzerland
                  </p>
                  <h4 className="font-serif text-xl font-semibold text-white">
                    Glacier Express Transit
                  </h4>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-xs text-[var(--ink-secondary)] leading-relaxed">
                  Panoramic alpine train carriages from Zermatt to St. Moritz with fondue dining and mountain pass views.
                </p>
                <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                  <span className="font-mono font-semibold text-[var(--ink-primary)]">
                    $3,400 USD
                  </span>
                  <Link href="/dashboard" className="text-[var(--primary)] font-semibold hover:underline">
                    View Manifest &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. EDITORIAL TRAVEL QUOTE */}
      <section className="py-20 bg-[var(--primary)] text-white text-center px-4 relative overflow-hidden">
        <div className="max-w-3xl mx-auto space-y-6 relative z-10">
          <blockquote className="font-serif text-2xl sm:text-4xl italic font-normal leading-snug">
            &ldquo;Travel is fatal to prejudice, bigotry, and narrow-mindedness, and many of our people need it sorely on these accounts.&rdquo;
          </blockquote>
          <cite className="block text-xs uppercase tracking-widest font-mono text-white/60 not-italic">
            — Mark Twain, Innocents Abroad
          </cite>
        </div>
      </section>

      {/* 7. REFINED EDITORIAL FOOTER */}
      <footer className="border-t border-[var(--border-default)] bg-[var(--canvas)] py-12 text-xs text-[var(--ink-secondary)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center text-white">
              <Compass className="w-4 h-4 text-[#E0EFE6]" />
            </div>
            <div>
              <span className="font-serif tracking-widest text-sm uppercase font-semibold text-[var(--ink-primary)] block">
                Trip Genie
              </span>
              <span className="text-[10px] font-mono text-[var(--ink-tertiary)]">
                Autonomous Travel Atelier
              </span>
            </div>
          </div>

          <p className="text-center sm:text-right text-[11px] text-[var(--ink-tertiary)]">
            © {new Date().getFullYear()} Trip Genie Atelier. Engineered with Next.js, Express, Prisma, and LangGraph.
          </p>
        </div>
      </footer>
    </div>
  );
}