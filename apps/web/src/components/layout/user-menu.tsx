"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  User as UserIcon,
  LogOut,
  Bookmark,
  Compass,
  ChevronDown,
  ShieldCheck,
  LogIn,
  Cpu,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";

export function UserMenu() {
  const { user, isLoading, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-[var(--surface-muted)] animate-pulse">
        <div className="w-8 h-8 rounded-full bg-[var(--border-default)]" />
        <div className="hidden sm:block w-20 h-3 rounded bg-[var(--border-default)]" />
      </div>
    );
  }

  if (!user) {
    return (
      <Link href="/login">
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <LogIn className="w-3.5 h-3.5" />
          <span>Sign In</span>
        </Button>
      </Link>
    );
  }

  const initial = user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1 rounded-full border border-[var(--border-default)] hover:border-[var(--border-strong)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-all select-none"
      >
        <div className="w-7 h-7 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-xs font-serif font-semibold shadow-2xs">
          {initial}
        </div>
        <div className="hidden sm:flex flex-col text-left">
          <span className="text-xs font-semibold text-[var(--ink-primary)] line-clamp-1">
            {user.name || user.email.split("@")[0]}
          </span>
          <span className="text-[10px] text-[var(--ink-tertiary)] font-mono leading-none">
            {user.email}
          </span>
        </div>
        <ChevronDown className="w-3 h-3 text-[var(--ink-tertiary)] hidden sm:block" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[var(--surface)] border border-[var(--border-default)] shadow-xl z-50 py-1.5 animate-in fade-in-50 zoom-in-95 duration-100">
          {/* User Header */}
          <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] space-y-0.5">
            <p className="text-xs font-semibold text-[var(--ink-primary)]">{user.name || "Traveler"}</p>
            <p className="text-[11px] text-[var(--ink-tertiary)] font-mono truncate">{user.email}</p>
            <div className="flex items-center gap-1.5 pt-1 text-[10px] text-[var(--primary)] font-medium">
              <ShieldCheck className="w-3 h-3" />
              <span>JWT Session Active</span>
            </div>
          </div>

          {/* Links */}
          <div className="py-1">
            <Link
              href="/dashboard"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-xs text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Compass className="w-3.5 h-3.5 text-[var(--primary)]" />
              <span>My Expeditions</span>
            </Link>
            <Link
              href="/saved-places"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-xs text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Bookmark className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Saved Places</span>
            </Link>
            <Link
              href="/activity"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-xs text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Cpu className="w-3.5 h-3.5 text-[var(--primary)]" />
              <span>AI Jobs Monitor</span>
            </Link>
            <Link
              href="/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-xs text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <UserIcon className="w-3.5 h-3.5 text-[var(--ink-secondary)]" />
              <span>Profile &amp; Account</span>
            </Link>
          </div>

          {/* Sign Out */}
          <div className="pt-1 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-[var(--status-cancelled-text)] hover:bg-[var(--status-cancelled-bg)] transition-colors text-left"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
