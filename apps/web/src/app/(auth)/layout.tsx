import React from "react";
import Link from "next/link";
import { Compass, ShieldCheck, Sparkles, RefreshCw } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[var(--canvas)] text-[var(--ink-primary)]">
      {/* LEFT COLUMN: The Atelier Showcase (Desktop 50%) */}
      <aside className="relative hidden lg:flex lg:w-1/2 flex-col justify-between p-12 lg:p-16 bg-gradient-to-br from-[#17382B] via-[#132F24] to-[#0D1F18] text-white overflow-hidden">
        {/* Subtle decorative background rings */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full border border-white/5 pointer-events-none" />
        <div className="absolute top-1/2 -right-48 w-[500px] h-[500px] rounded-full border border-white/5 pointer-events-none" />
        <div className="absolute -bottom-24 left-1/4 w-80 h-80 rounded-full border border-white/5 pointer-events-none" />

        {/* Top: Monogram & Brand Wordmark */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center text-white shadow-sm">
            <Compass className="w-5 h-5 text-[#E0EFE6]" />
          </div>
          <div>
            <h1 className="font-serif tracking-widest text-base uppercase font-semibold text-white">
              Trip Genie
            </h1>
            <p className="text-[11px] tracking-widest uppercase text-white/60 font-sans">
              Autonomous Travel Atelier
            </p>
          </div>
        </div>

        {/* Middle: Editorial Value Proposition & Quote */}
        <div className="relative z-10 my-auto py-12 max-w-lg space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-xs font-medium text-[#E0EFE6]">
              <Sparkles className="w-3.5 h-3.5 text-[#B85D38]" />
              <span>Travel-Ops Recovery Engine</span>
            </div>
            <h2 className="font-serif text-3xl xl:text-4xl leading-tight font-normal text-white">
              Effortless journeys, even when plans change in an instant.
            </h2>
            <p className="text-sm xl:text-base text-white/70 font-sans leading-relaxed">
              Trip Genie monitors flight schedules, weather forecasts, and venue closures in real-time, autonomously drafting multi-option recovery schedules with human approval.
            </p>
          </div>

          {/* Editorial quote */}
          <div className="border-l-2 border-[#B85D38] pl-4 py-1 space-y-1">
            <blockquote className="font-serif italic text-sm text-white/85">
              &ldquo;To travel is to discover that everyone is wrong about other countries.&rdquo;
            </blockquote>
            <cite className="block text-xs uppercase tracking-wider text-white/50 not-italic font-sans">
              — Aldous Huxley
            </cite>
          </div>

          {/* Three Trust Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-lg bg-white/5 border border-white/10 backdrop-blur-xs flex items-start gap-3">
              <RefreshCw className="w-4 h-4 text-[#B85D38] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-white">Instant Recovery Loop</p>
                <p className="text-[11px] text-white/60">Domino schedule resolution in 30 seconds</p>
              </div>
            </div>
            <div className="p-3.5 rounded-lg bg-white/5 border border-white/10 backdrop-blur-xs flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-[#A8D5B8] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-white">Human Approval</p>
                <p className="text-[11px] text-white/60">No surprise automated changes without consent</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: Guarantee & Status */}
        <div className="relative z-10 flex items-center justify-between text-xs text-white/50 border-t border-white/10 pt-6">
          <span>Bank-Grade JWT Security</span>
          <span>Tokyo • Kyoto • Global</span>
        </div>
      </aside>

      {/* RIGHT COLUMN: Interactive Form Canvas */}
      <main className="flex-1 flex flex-col justify-between p-6 sm:p-10 lg:p-16 overflow-y-auto">
        {/* Mobile Header Branding (visible only on small screens) */}
        <div className="lg:hidden flex items-center justify-between pb-6 border-b border-[var(--border-subtle)]">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center text-white">
              <Compass className="w-4 h-4" />
            </div>
            <span className="font-serif tracking-widest text-sm uppercase font-semibold text-[var(--ink-primary)]">
              Trip Genie
            </span>
          </Link>
          <span className="text-xs text-[var(--ink-secondary)]">Travel Atelier</span>
        </div>

        {/* Centered Form Body */}
        <div className="w-full max-w-md mx-auto my-auto py-8">
          {children}
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-[var(--ink-tertiary)] pt-6">
          <p>© {new Date().getFullYear()} Trip Genie Atelier. All rights reserved.</p>
        </div>
      </main>
    </div>
  );
}
