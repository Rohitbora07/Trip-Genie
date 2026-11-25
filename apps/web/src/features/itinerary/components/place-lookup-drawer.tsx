"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Search,
  MapPin,
  Plus,
  Bookmark,
  Check,
  Compass,
  Globe2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { formatPlaceDetails } from "@/lib/utils";
import type { Place } from "@/types/api";

interface PlaceLookupDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPlaceToDay: (place: Place) => void;
  dayTitle?: string;
  destination?: string;
}

export function PlaceLookupDrawer({
  isOpen,
  onClose,
  onAddPlaceToDay,
  dayTitle,
  destination,
}: PlaceLookupDrawerProps) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [savedPlaceIds, setSavedPlaceIds] = useState<string[]>([]);
  const [addedPlaceIds, setAddedPlaceIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setPlaces([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        // Scope query to destination first if user didn't include a comma
        const scopedQuery =
          destination && !trimmed.includes(",")
            ? `${trimmed}, ${destination.split(",")[0].trim()}`
            : trimmed;
        let results = await api.places.search(scopedQuery, 10);
        if ((!results || results.length === 0) && scopedQuery !== trimmed) {
          results = await api.places.search(trimmed, 10);
        }
        setPlaces(Array.isArray(results) ? results : []);
        setHasSearched(true);
      } catch {
        setPlaces([]);
        setHasSearched(true);
      } finally {
        setIsSearching(false);
      }
    }, 320);

    return () => clearTimeout(timer);
  }, [query, destination, isOpen]);

  if (!isOpen) return null;

  const handleSavePlace = async (place: Place) => {
    try {
      await api.places.saveToFavorites({
        name: place.name,
        address: place.address || formatPlaceDetails(place).regionLabel || undefined,
        latitude:
          place.latitude !== null && place.latitude !== undefined
            ? Number(place.latitude)
            : undefined,
        longitude:
          place.longitude !== null && place.longitude !== undefined
            ? Number(place.longitude)
            : undefined,
        placeCategory: place.category || "OTHER",
        provider: place.provider || "NOMINATIM",
        providerPlaceId: place.providerPlaceId || place.id,
        category: "Must Visit",
      });
      setSavedPlaceIds((prev) => [...prev, place.id]);
    } catch {
      // ignore duplicate or temporary error
    }
  };

  const handleAdd = (place: Place) => {
    onAddPlaceToDay(place);
    setAddedPlaceIds((prev) => [...prev, place.id]);
    setTimeout(() => {
      setAddedPlaceIds((prev) => prev.filter((id) => id !== place.id));
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Frosted Backdrop */}
      <div
        className="fixed inset-0 bg-[#0F1A15]/40 backdrop-blur-xs transition-opacity animate-in fade-in-50"
        onClick={onClose}
      />

      {/* Slide-over Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-[var(--surface)] border-l border-[var(--border-default)] shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-5 border-b border-[var(--border-default)] flex items-center justify-between bg-[var(--surface-muted)]/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center shadow-xs">
              <Compass className="w-4 h-4 text-[#E0EFE6]" />
            </div>
            <div>
              <h3 className="font-serif text-base font-semibold text-[var(--ink-primary)]">
                Place &amp; Venue Lookup
              </h3>
              <p className="text-xs text-[var(--ink-secondary)] truncate max-w-[260px]">
                {dayTitle
                  ? `Add stops to ${dayTitle}`
                  : destination
                  ? `Explore real places near ${destination}`
                  : "Search OpenStreetMap venues"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Box */}
        <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--surface)]">
          <Input
            placeholder={
              destination
                ? `Search temples, cafes, waterfalls near ${destination.split(",")[0]}...`
                : "Search landmarks, temples, cafes, viewpoints..."
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
            autoFocus
          />
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {query.trim().length < 2 ? (
            <div className="py-12 px-4 text-center space-y-2 text-xs text-[var(--ink-secondary)]">
              <Globe2 className="w-8 h-8 mx-auto text-[var(--ink-tertiary)]" />
              <p className="font-medium text-[var(--ink-primary)]">
                Live OpenStreetMap Venue Search
              </p>
              <p className="leading-relaxed">
                Type at least 2 characters (e.g. a temple, waterfall, station, or town near{" "}
                <span className="font-semibold">{destination || "your destination"}</span>) to search real mapped places with GPS coordinates.
              </p>
            </div>
          ) : isSearching ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]/50 animate-pulse space-y-2"
                >
                  <div className="h-4 w-2/3 bg-[var(--border-default)] rounded" />
                  <div className="h-3 w-full bg-[var(--border-subtle)] rounded" />
                </div>
              ))}
            </div>
          ) : places.length === 0 && hasSearched ? (
            <div className="py-12 px-4 text-center space-y-2 text-xs text-[var(--ink-secondary)]">
              <p className="font-medium text-[var(--ink-primary)]">
                No matching places found for &ldquo;{query}&rdquo;
              </p>
              <p>Try searching a broader town name, district, or landmark.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-mono text-[var(--ink-tertiary)] px-1">
                <span>OpenStreetMap Results</span>
                <span>{places.length} found</span>
              </div>

              {places.map((place) => {
                const isSaved = savedPlaceIds.includes(place.id);
                const isAdded = addedPlaceIds.includes(place.id);
                const info = formatPlaceDetails(place);

                return (
                  <div
                    key={place.id}
                    className="p-4 rounded-xl border border-[var(--border-default)] hover:border-[var(--border-strong)] bg-[var(--surface)] transition-all space-y-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-semibold text-sm text-[var(--ink-primary)]">
                          {place.name}
                        </h4>
                        {info.countryCode && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--primary)] text-white shrink-0">
                            {info.countryCode}
                          </span>
                        )}
                      </div>

                      {info.regionLabel && (
                        <p className="text-[11px] font-medium text-[var(--primary)]">
                          {info.regionLabel}
                        </p>
                      )}

                      {place.address && (
                        <div className="flex items-start gap-1.5 text-xs text-[var(--ink-secondary)]">
                          <MapPin className="w-3 h-3 text-[var(--ink-tertiary)] shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{place.address}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-[var(--border-subtle)]">
                      <Button
                        type="button"
                        variant={isAdded ? "secondary" : "primary"}
                        size="sm"
                        className="flex-1 gap-1.5 text-xs"
                        onClick={() => handleAdd(place)}
                      >
                        {isAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[var(--status-confirmed-text)]" />
                            <span>Added to Timeline</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add to Day</span>
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        disabled={isSaved}
                        onClick={() => handleSavePlace(place)}
                      >
                        <Bookmark
                          className={`w-3.5 h-3.5 ${
                            isSaved ? "fill-current text-[var(--primary)]" : ""
                          }`}
                        />
                        <span>{isSaved ? "Saved" : "Save"}</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
