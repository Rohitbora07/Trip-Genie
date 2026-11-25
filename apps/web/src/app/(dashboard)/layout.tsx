import React from "react";
import { Navbar } from "@/components/layout/navbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--canvas)] text-[var(--ink-primary)]">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {children}
      </main>
      <footer className="border-t border-[var(--border-subtle)] bg-[var(--surface-muted)]/50 py-6 text-center text-xs text-[var(--ink-tertiary)]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} Trip Genie Atelier — Autonomous Travel Operations</p>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Human-in-the-Loop Recovery</span>
            <span>•</span>
            <span>Groq &amp; LangGraph</span>
            <span>•</span>
            <span>Next.js 16</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
