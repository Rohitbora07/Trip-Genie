"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Plus, Activity, Layers, Bookmark, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";

export function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { label: "My Journeys", href: "/dashboard", icon: Layers },
    { label: "Saved Places", href: "/saved-places", icon: Bookmark },
    { label: "AI Jobs", href: "/activity", icon: Cpu },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--border-default)] bg-[var(--canvas)]/90 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand & Navigation */}
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-[var(--primary)] flex items-center justify-center text-white shadow-xs group-hover:bg-[var(--primary-hover)] transition-colors">
              <Compass className="w-5 h-5 text-[#E0EFE6]" />
            </div>
            <div>
              <span className="font-serif tracking-widest text-base uppercase font-semibold text-[var(--ink-primary)]">
                Trip Genie
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] tracking-widest uppercase font-mono px-1.5 py-0.5 rounded-sm bg-[var(--surface-muted)] text-[var(--ink-secondary)] border border-[var(--border-subtle)]">
                Atelier
              </span>
            </div>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-[var(--surface)] text-[var(--primary)] border border-[var(--border-default)] shadow-xs"
                      : "text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Operational Status, Action & Profile */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Real-time system pulse indicator */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--status-confirmed-bg)] border border-[var(--status-confirmed-border)] text-[11px] font-medium text-[var(--status-confirmed-text)]">
            <Activity className="w-3 h-3 animate-pulse" />
            <span>Travel-Ops Engine: Active</span>
          </div>

          {/* New Journey Page Link */}
          <Link href="/trips/new">
            <Button
              variant="accent"
              size="sm"
              className="gap-1.5 font-medium shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Plan Journey</span>
              <span className="sm:hidden">Plan</span>
            </Button>
          </Link>

          {/* User Menu */}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
