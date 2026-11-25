"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Compass,
  Calendar,
  Users,
  MapPin,
  Sparkles,
  AlertCircle,
  Search,
  Globe2,
  Wallet,
  CheckCircle2,
  Clock,
  Navigation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import {
  formatCurrencyAmount,
  formatPlaceDetails,
  getCurrencySymbol,
} from "@/lib/utils";
import type { Place, TripPreferences } from "@/types/api";

const CURRENCY_OPTIONS = [
  { code: "INR", label: "INR — Indian Rupee (₹)", placeholder: "45000" },
  { code: "USD", label: "USD — US Dollar ($)", placeholder: "2500" },
  { code: "EUR", label: "EUR — Euro (€)", placeholder: "2200" },
  { code: "GBP", label: "GBP — British Pound (£)", placeholder: "1800" },
  { code: "JPY", label: "JPY — Japanese Yen (¥)", placeholder: "300000" },
  { code: "AED", label: "AED — UAE Dirham (د.إ)", placeholder: "8500" },
  { code: "SGD", label: "SGD — Singapore Dollar (S$)", placeholder: "3200" },
  { code: "THB", label: "THB — Thai Baht (฿)", placeholder: "65000" },
];

const DIETARY_OPTIONS = [
  "Vegetarian",
  "Vegan",
  "Jain",
  "Eggless",
  "Halal",
  "Gluten-Free",
  "Kosher",
  "Pescatarian",
];

const ACCESSIBILITY_OPTIONS = [
  "Step-Free",
  "Elevator Access",
  "Wheelchair Accessible",
  "Senior-Friendly Pace",
  "Audio Guide",
];

const PACE_OPTIONS = [
  {
    id: "RELAXED" as const,
    title: "Relaxed",
    icon: "🌿",
    desc: "1–2 unhurried highlights daily. Leisurely mornings & open evenings.",
  },
  {
    id: "MODERATE" as const,
    title: "Moderate",
    icon: "⚖️",
    desc: "Balanced exploration. Essential landmarks paired with cultural pauses.",
  },
  {
    id: "PACKED" as const,
    title: "Packed",
    icon: "⚡",
    desc: "Full-day momentum from sunrise temples to late-night culinary alleys.",
  },
];

export default function NewTripPage() {
  const router = useRouter();

  // Form state — strictly empty defaults (nothing prefilled!)
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [origin, setOrigin] = useState("");

  // Destination search & selection
  const [destination, setDestination] = useState("");
  const [destinationSearch, setDestinationSearch] = useState("");
  const [selectedPlaceMeta, setSelectedPlaceMeta] = useState<{
    state: string | null;
    country: string | null;
    countryCode: string | null;
    fullAddress?: string | null;
  } | null>(null);
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [hasSearchedPlaces, setHasSearchedPlaces] = useState(false);

  // Schedule & Group
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [travelerCount, setTravelerCount] = useState(1);

  // Budget & Currency (INR default for Indian primary users)
  const [currency, setCurrency] = useState("INR");
  const [budget, setBudget] = useState("");

  // Preferences
  const [pace, setPace] = useState<"RELAXED" | "MODERATE" | "PACKED">("MODERATE");
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [selectedAccessibility, setSelectedAccessibility] = useState<string[]>([]);

  // Submit state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const suggestionBoxRef = useRef<HTMLDivElement>(null);

  // Close destination dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestionBoxRef.current && !suggestionBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced live Nominatim / OSM destination lookup
  useEffect(() => {
    const q = destinationSearch.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setHasSearchedPlaces(false);
      return;
    }

    // Do not immediately re-query if text already equals confirmed selected destination
    if (selectedPlaceMeta && destination === destinationSearch) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingPlaces(true);
      try {
        const results = await api.places.search(q, 8);
        setSuggestions(Array.isArray(results) ? results : []);
        setHasSearchedPlaces(true);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
        setHasSearchedPlaces(true);
      } finally {
        setIsSearchingPlaces(false);
      }
    }, 320);

    return () => clearTimeout(timer);
  }, [destinationSearch, destination, selectedPlaceMeta]);

  const toggleTag = (list: string[], setList: (val: string[]) => void, item: string) => {
    if (list.includes(item)) {
      setList(list.filter((i) => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  // Compute nights preview when both dates are selected
  let nightsCount: number | null = null;
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
      nightsCount = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    }
  }

  const activeCurrencyOption =
    CURRENCY_OPTIONS.find((c) => c.code === currency) || CURRENCY_OPTIONS[0];
  const currencySymbol = getCurrencySymbol(currency);

  const handleSelectPlace = (place: Place) => {
    const details = formatPlaceDetails(place);
    setDestination(details.selectedValue);
    setDestinationSearch(details.selectedValue);
    setSelectedPlaceMeta({
      state: details.state,
      country: details.country,
      countryCode: details.countryCode,
      fullAddress: place.address,
    });
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const finalDestination = (destination || destinationSearch).trim();
    if (!title.trim()) {
      setErrorMessage("Please enter a title for your journey.");
      return;
    }
    if (!finalDestination) {
      setErrorMessage("Please search and specify a destination.");
      return;
    }
    if (!startDate || !endDate) {
      setErrorMessage("Please select both departure and return dates.");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setErrorMessage("Return date must be on or after the departure date.");
      return;
    }

    setIsLoading(true);

    const preferences: TripPreferences = {
      pace,
      dietary: selectedDietary,
      accessibility: selectedAccessibility,
    };

    try {
      const newTrip = await api.trips.create({
        title: title.trim(),
        description: description.trim() || undefined,
        origin: origin.trim() || undefined,
        destination: finalDestination,
        startDate,
        endDate,
        budget: budget ? Number(budget) : undefined,
        currency,
        travelerCount,
        preferences,
      });

      router.push(`/trips/${newTrip.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Failed to create journey. Please verify your inputs and backend connection.");
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* 1. Top Back Navigation & Breadcrumb */}
      <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-default)] hover:border-[var(--border-strong)] text-xs font-medium text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] transition-all shadow-2xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Expeditions</span>
        </Link>

        <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--ink-tertiary)] hidden sm:inline">
          Expeditions / Plan New Journey
        </span>
      </div>

      {/* 2. Editorial Page Header */}
      <div className="space-y-2.5 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-muted)] text-[var(--primary)] border border-[var(--border-default)] text-[11px] font-semibold tracking-wide uppercase font-mono">
          <Compass className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>New Expedition Brief</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-5xl font-semibold tracking-tight text-[var(--ink-primary)]">
          Plan a New Journey
        </h1>
        <p className="text-sm text-[var(--ink-secondary)] leading-relaxed">
          Set your destination, dates, currency, and travel rhythm. Trip Genie uses these constraints to craft bespoke itineraries and automatically resolve disruptions.
        </p>
      </div>

      {/* 3. Main Spacious Two-Column Layout */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT 8 COLUMNS: Structured Form Sections with Generous Breathing Space */}
        <div className="lg:col-span-8 space-y-6">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-[var(--status-cancelled-bg)] border border-[var(--status-cancelled-border)] flex items-start gap-3 text-xs text-[var(--status-cancelled-text)] shadow-2xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">Unable to Create Journey</p>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Section 1: Destination & Identity */}
          <section className="p-6 sm:p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border-default)] shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--accent)]">
                  01 / Identity &amp; Geography
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-semibold text-[var(--ink-primary)] mt-0.5">
                  Where are you heading?
                </h2>
              </div>
              <Globe2 className="w-5 h-5 text-[var(--ink-tertiary)]" />
            </div>

            <div className="space-y-5">
              {/* Journey Title */}
              <Input
                label="Journey Title"
                placeholder="e.g. Royal Rajasthan Winter Circuit or Monsoon Escape"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              {/* Destination Autocomplete + Origin City */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Destination Search with Country/State Breakdown */}
                <div className="relative space-y-1.5" ref={suggestionBoxRef}>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-secondary)]">
                    Destination
                  </label>
                  <div className="relative flex items-center">
                    <MapPin className="absolute left-3.5 w-4 h-4 text-[var(--accent)] pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search city, state, or region (e.g. Bihar, Jaipur)"
                      value={destinationSearch}
                      onChange={(e) => {
                        setDestinationSearch(e.target.value);
                        setDestination(e.target.value);
                        setSelectedPlaceMeta(null);
                      }}
                      onFocus={() => {
                        if (suggestions.length > 0) setShowSuggestions(true);
                      }}
                      className="w-full h-11 pl-10 pr-10 bg-[var(--surface-card)] text-[var(--ink-primary)] text-sm rounded-lg border border-[var(--border-default)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] placeholder:text-[var(--ink-tertiary)]"
                      required
                    />
                    {isSearchingPlaces && (
                      <Search className="absolute right-3.5 w-4 h-4 animate-spin text-[var(--primary)]" />
                    )}
                  </div>

                  {/* Verified geographic pill when selected from autocomplete */}
                  {selectedPlaceMeta && (selectedPlaceMeta.state || selectedPlaceMeta.country) && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--status-confirmed-bg)] border border-[var(--status-confirmed-border)] text-[11px] font-mono text-[var(--status-confirmed-text)] mt-1">
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      <span>
                        {[selectedPlaceMeta.state, selectedPlaceMeta.country]
                          .filter(Boolean)
                          .join(" • ")}
                        {selectedPlaceMeta.countryCode ? ` (${selectedPlaceMeta.countryCode})` : ""}
                      </span>
                    </div>
                  )}

                  {/* Rich Autocomplete Dropdown showing State, Country, & Full Address */}
                  {showSuggestions && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-[var(--surface-card)] border border-[var(--border-default)] rounded-xl shadow-xl z-30 py-1.5 max-h-72 overflow-y-auto">
                      {suggestions.length > 0 ? (
                        suggestions.map((place) => {
                          const details = formatPlaceDetails(place);
                          return (
                            <button
                              key={place.id}
                              type="button"
                              onClick={() => handleSelectPlace(place)}
                              className="w-full px-4 py-2.5 text-left hover:bg-[var(--surface-hover)] border-b last:border-b-0 border-[var(--border-subtle)] transition-colors space-y-1"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-sm text-[var(--ink-primary)]">
                                  {details.primaryName}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {details.countryCode && (
                                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--primary)] text-white">
                                      {details.countryCode}
                                    </span>
                                  )}
                                  {place.category && (
                                    <span className="text-[10px] uppercase font-mono text-[var(--ink-secondary)] bg-[var(--surface-muted)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)]">
                                      {place.category.replace(/_/g, " ")}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* State & Country Line */}
                              {(details.state || details.country || details.regionLabel) && (
                                <p className="text-xs font-medium text-[var(--primary)] flex items-center gap-1.5">
                                  <Globe2 className="w-3 h-3 shrink-0" />
                                  <span>
                                    {[details.state, details.country].filter(Boolean).join(", ") ||
                                      details.regionLabel}
                                  </span>
                                </p>
                              )}

                              {/* Full geographic hierarchy */}
                              {place.address && (
                                <p className="text-[11px] text-[var(--ink-tertiary)] line-clamp-1">
                                  {place.address}
                                </p>
                              )}
                            </button>
                          );
                        })
                      ) : hasSearchedPlaces && !isSearchingPlaces ? (
                        <div className="px-4 py-3 text-xs text-[var(--ink-secondary)]">
                          No exact geographic match found for &ldquo;{destinationSearch}&rdquo;. You can still continue with your typed destination.
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* Origin City (Optional) */}
                <Input
                  label="Departure City (Optional)"
                  placeholder="e.g. New Delhi, India"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  leftIcon={<Navigation className="w-4 h-4" />}
                />
              </div>

              {/* Optional Trip Description / Vision */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-secondary)]">
                  Trip Notes &amp; Priorities (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Any specific heritage sites, local food spots, morning rituals, or transit preferences..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3.5 bg-[var(--surface-card)] text-[var(--ink-primary)] text-sm rounded-lg border border-[var(--border-default)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] placeholder:text-[var(--ink-tertiary)] resize-none"
                />
              </div>
            </div>
          </section>

          {/* Section 2: Schedule, Travelers & Budget */}
          <section className="p-6 sm:p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border-default)] shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--accent)]">
                  02 / Dates &amp; Budget Allocation
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-semibold text-[var(--ink-primary)] mt-0.5">
                  When &amp; how much?
                </h2>
              </div>
              <Wallet className="w-5 h-5 text-[var(--ink-tertiary)]" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <Input
                label="Departure Date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate && e.target.value && new Date(endDate) < new Date(e.target.value)) {
                    setEndDate("");
                  }
                }}
                leftIcon={<Calendar className="w-4 h-4" />}
                required
              />
              <Input
                label="Return Date"
                type="date"
                min={startDate || undefined}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                leftIcon={<Calendar className="w-4 h-4" />}
                required
              />

              {/* Traveler Stepper */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-secondary)]">
                  Travelers
                </label>
                <div className="h-11 px-3 bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setTravelerCount(Math.max(1, travelerCount - 1))}
                    className="w-7 h-7 rounded-md bg-[var(--surface-muted)] hover:bg-[var(--surface-hover)] text-[var(--ink-primary)] font-bold text-sm flex items-center justify-center transition-colors select-none"
                  >
                    -
                  </button>
                  <div className="flex items-center gap-1.5 text-xs font-semibold font-mono text-[var(--ink-primary)]">
                    <Users className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <span>
                      {travelerCount} {travelerCount === 1 ? "Traveler" : "Travelers"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTravelerCount(travelerCount + 1)}
                    className="w-7 h-7 rounded-md bg-[var(--surface-muted)] hover:bg-[var(--surface-hover)] text-[var(--ink-primary)] font-bold text-sm flex items-center justify-center transition-colors select-none"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Currency Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-secondary)]">
                  Preferred Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full h-11 px-3.5 bg-[var(--surface-card)] text-[var(--ink-primary)] text-sm rounded-lg border border-[var(--border-default)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Estimated Budget with Dynamic Currency Symbol */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-secondary)]">
                  Estimated Budget (Optional)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 font-mono text-sm font-semibold text-[var(--primary)] pointer-events-none">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={currency === "INR" ? 500 : 50}
                    placeholder={activeCurrencyOption.placeholder}
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full h-11 pl-10 pr-14 bg-[var(--surface-card)] text-[var(--ink-primary)] text-sm rounded-lg border border-[var(--border-default)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] placeholder:text-[var(--ink-tertiary)] font-mono"
                  />
                  <span className="absolute right-3.5 text-xs font-mono text-[var(--ink-tertiary)] pointer-events-none">
                    {currency}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Travel Rhythm, Dietary & Accessibility */}
          <section className="p-6 sm:p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border-default)] shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--accent)]">
                  03 / Rhythm &amp; Personalization
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-semibold text-[var(--ink-primary)] mt-0.5">
                  How do you prefer to travel?
                </h2>
              </div>
              <Sparkles className="w-5 h-5 text-[var(--accent)]" />
            </div>

            {/* Pace Selector Cards */}
            <div className="space-y-2.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-secondary)]">
                Travel Pace &amp; Intensity
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {PACE_OPTIONS.map((p) => {
                  const isSelected = pace === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPace(p.id)}
                      className={`p-4 rounded-xl border text-left transition-all duration-150 select-none ${
                        isSelected
                          ? "bg-[var(--surface-tinted)] border-[var(--primary)] shadow-xs ring-1 ring-[var(--primary)]"
                          : "bg-[var(--surface-card)] border-[var(--border-default)] hover:border-[var(--border-strong)]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xl">{p.icon}</span>
                        <span
                          className={`text-xs font-semibold ${
                            isSelected ? "text-[var(--primary)]" : "text-[var(--ink-primary)]"
                          }`}
                        >
                          {p.title}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--ink-secondary)] leading-relaxed">{p.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dietary Tags */}
            <div className="space-y-2.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-secondary)]">
                Culinary Preferences &amp; Dietary Care
              </label>
              <div className="flex flex-wrap gap-2">
                {DIETARY_OPTIONS.map((tag) => {
                  const isSelected = selectedDietary.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(selectedDietary, setSelectedDietary, tag)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all select-none ${
                        isSelected
                          ? "bg-[var(--primary)] text-white shadow-2xs"
                          : "bg-[var(--surface-muted)] text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-default)]"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Accessibility Tags */}
            <div className="space-y-2.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-secondary)]">
                Mobility &amp; Comfort Requirements
              </label>
              <div className="flex flex-wrap gap-2">
                {ACCESSIBILITY_OPTIONS.map((tag) => {
                  const isSelected = selectedAccessibility.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(selectedAccessibility, setSelectedAccessibility, tag)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all select-none ${
                        isSelected
                          ? "bg-[var(--accent)] text-white shadow-2xs"
                          : "bg-[var(--surface-muted)] text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-default)]"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Form Submission Bar */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
            <Link href="/dashboard">
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={isLoading}
                className="w-full sm:w-auto gap-2 bg-[var(--surface)]"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Cancel &amp; Return</span>
              </Button>
            </Link>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="gap-2.5 shadow-md"
              isLoading={isLoading}
            >
              <Sparkles className="w-4 h-4 text-[#B85D38]" />
              <span>Create Expedition Manifest</span>
            </Button>
          </div>
        </div>

        {/* RIGHT 4 COLUMNS: Live Boarding Pass / Journey Dossier Preview */}
        <aside className="lg:col-span-4 lg:sticky lg:top-24 space-y-5">
          <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-md overflow-hidden">
            {/* Header Banner */}
            <div className="p-6 bg-gradient-to-br from-[#17382B] via-[#214A3A] to-[#10261D] text-white space-y-3 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />
              <div className="relative z-10 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-white/75">
                <span>Live Dossier Preview</span>
                <span>{currency}</span>
              </div>
              <div className="relative z-10 space-y-1">
                <h3 className="font-serif text-2xl font-semibold leading-snug">
                  {title.trim() || "Untitled Expedition"}
                </h3>
                <p className="text-xs font-mono text-[#A8D5B8] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {origin.trim() ? `${origin.trim()} → ` : ""}
                    {(destination || destinationSearch).trim() || "Destination not set"}
                  </span>
                </p>
              </div>
            </div>

            {/* Perforated Line */}
            <div className="h-3 bg-[var(--surface-muted)] perforated-border-b" />

            {/* Live Summary Grid */}
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[var(--border-subtle)]">
                <div>
                  <span className="text-[10px] font-mono uppercase text-[var(--ink-tertiary)] block">
                    Schedule
                  </span>
                  <span className="font-mono font-semibold text-[var(--ink-primary)] flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-[var(--primary)]" />
                    {nightsCount !== null
                      ? `${nightsCount} ${nightsCount === 1 ? "Night" : "Nights"}`
                      : "Select dates"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-[var(--ink-tertiary)] block">
                    Party Size
                  </span>
                  <span className="font-mono font-semibold text-[var(--ink-primary)] mt-0.5 block">
                    {travelerCount} {travelerCount === 1 ? "Traveler" : "Travelers"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-[var(--ink-tertiary)] block">
                    Pace
                  </span>
                  <span className="font-medium text-[var(--ink-primary)] mt-0.5 block capitalize">
                    {pace.toLowerCase()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-[var(--ink-tertiary)] block">
                    Allocation
                  </span>
                  <span className="font-mono font-semibold text-[var(--primary)] mt-0.5 block">
                    {budget ? formatCurrencyAmount(budget, currency) : "Flexible"}
                  </span>
                </div>
              </div>

              {/* Selected Tags Summary */}
              {(selectedDietary.length > 0 || selectedAccessibility.length > 0) && (
                <div className="space-y-2 pb-2">
                  <span className="text-[10px] font-mono uppercase text-[var(--ink-tertiary)] block">
                    Active Care Filters
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[...selectedDietary, ...selectedAccessibility].map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-[10px] font-medium text-[var(--ink-secondary)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[11px] text-[var(--ink-secondary)] leading-relaxed">
                Once created, you can generate an AI schedule with LangGraph, explore the route map, or run live disruption simulations.
              </p>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}
