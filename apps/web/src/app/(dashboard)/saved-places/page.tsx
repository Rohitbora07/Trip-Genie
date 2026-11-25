"use client";

import React, { useEffect, useState } from "react";
import {
  Bookmark,
  MapPin,
  Search,
  Trash2,
  Plus,
  Loader2,
  Check,
  Tag,
  StickyNote,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, ApiError } from "@/lib/api";
import { formatPlaceDetails } from "@/lib/utils";
import type { Place, SavedPlaceItem } from "@/types/api";

const COLLECTION_TAGS = ["ALL", "Must Visit", "Stays", "Dining", "Cafes", "Nature"];

export default function SavedPlacesPage() {
  const [savedPlaces, setSavedPlaces] = useState<SavedPlaceItem[]>([]);
  const [activeTag, setActiveTag] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Add new place search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Inline note editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editTag, setEditTag] = useState("Must Visit");

  const loadSaved = async (tag?: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const items = await api.places.getSavedFavorites(tag && tag !== "ALL" ? tag : undefined);
      setSavedPlaces(items);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to load saved places.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSaved(activeTag);
  }, [activeTag]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await api.places.search(searchQuery.trim(), 6);
      setSearchResults(res);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSavePlace = async (place: Place) => {
    setSavingId(place.id);
    setErrorMsg(null);
    try {
      await api.places.saveToFavorites({
        name: place.name,
        address: place.address || formatPlaceDetails(place).regionLabel || undefined,
        latitude: place.latitude !== null && place.latitude !== undefined ? Number(place.latitude) : undefined,
        longitude: place.longitude !== null && place.longitude !== undefined ? Number(place.longitude) : undefined,
        placeCategory: place.category || "OTHER",
        provider: place.provider || "NOMINATIM",
        providerPlaceId: place.providerPlaceId || place.id,
        category: activeTag !== "ALL" ? activeTag : "Must Visit",
      });
      setSearchResults((prev) => prev.filter((p) => p.id !== place.id));
      await loadSaved(activeTag);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Could not save place.");
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveEdit = async (itemId: string) => {
    try {
      await api.places.updateSavedFavorite(itemId, {
        notes: editNotes,
        category: editTag,
      });
      setEditingId(null);
      await loadSaved(activeTag);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to update saved place.");
    }
  };

  const handleDelete = async (itemId: string) => {
    const prev = savedPlaces;
    setSavedPlaces(savedPlaces.filter((s) => s.id !== itemId));
    try {
      await api.places.removeSavedFavorite(itemId);
    } catch {
      setSavedPlaces(prev);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink-primary)]">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[var(--border-default)] pb-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[var(--primary)] font-semibold">
              <Bookmark className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>PERSONAL CURATION VAULT</span>
            </div>
            <h1 className="font-serif text-3xl sm:text-5xl font-semibold tracking-tight">
              Saved Places &amp; Inspiration
            </h1>
            <p className="text-xs sm:text-sm text-[var(--ink-secondary)] max-w-2xl">
              Bookmark landmarks, stays, cafes, and mountain viewpoints via OpenStreetMap to reuse across upcoming expeditions.
            </p>
          </div>
          <Badge variant="outline" size="md">
            {savedPlaces.length} Saved {savedPlaces.length === 1 ? "Place" : "Places"}
          </Badge>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-[var(--status-disrupted-bg)] border border-[var(--status-disrupted-border)] text-xs text-[var(--status-disrupted-text)]">
            {errorMsg}
          </div>
        )}

        {/* Quick Search & Bookmark Card */}
        <div className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border-default)] shadow-xs space-y-4">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[var(--ink-tertiary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search OpenStreetMap for any temple, cafe, trailhead, or hotel to bookmark..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)]/50 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>
            <Button type="submit" variant="primary" size="md" disabled={isSearching} className="gap-2">
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>Find Places</span>
            </Button>
          </form>

          {searchResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {searchResults.map((place) => (
                <div
                  key={place.id}
                  className="p-3.5 rounded-xl border border-[var(--border-default)] bg-[var(--surface-muted)]/40 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{place.name}</p>
                    <p className="text-[11px] text-[var(--ink-tertiary)] truncate">
                      {formatPlaceDetails(place).regionLabel || place.address || "OpenStreetMap Venue"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={savingId === place.id}
                    onClick={() => void handleSavePlace(place)}
                    className="gap-1 shrink-0 text-xs"
                  >
                    {savingId === place.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    <span>Save</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Collection Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {COLLECTION_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                activeTag === tag
                  ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                  : "bg-[var(--surface)] text-[var(--ink-secondary)] border-[var(--border-default)] hover:border-[var(--border-strong)]"
              }`}
            >
              {tag === "ALL" ? "All Bookmarks" : tag}
            </button>
          ))}
        </div>

        {/* Saved Places Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-44 rounded-2xl bg-[var(--surface)] border border-[var(--border-default)] animate-pulse p-5"
              />
            ))}
          </div>
        ) : savedPlaces.length === 0 ? (
          <div className="py-16 px-6 text-center rounded-2xl bg-[var(--surface)] border border-dashed border-[var(--border-default)] space-y-2">
            <Bookmark className="w-7 h-7 text-[var(--accent)] mx-auto" />
            <h3 className="font-serif text-xl font-semibold">No saved places in this collection</h3>
            <p className="text-xs text-[var(--ink-secondary)] max-w-md mx-auto">
              Search above or use the Place Lookup drawer inside any itinerary to bookmark stops for later.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {savedPlaces.map((item) => {
              const isEditing = editingId === item.id;
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface)] p-5 shadow-2xs flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="outline" size="sm" className="gap-1">
                        <Tag className="w-3 h-3 text-[var(--accent)]" />
                        <span>{item.category || "Must Visit"}</span>
                      </Badge>
                      <button
                        type="button"
                        onClick={() => void handleDelete(item.id)}
                        title="Remove bookmark"
                        className="p-1.5 rounded-lg text-[var(--ink-tertiary)] hover:text-[var(--status-cancelled-text)] hover:bg-[var(--status-cancelled-bg)] transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h3 className="font-serif text-lg font-semibold text-[var(--ink-primary)]">
                      {item.place.name}
                    </h3>
                    <p className="text-xs text-[var(--ink-secondary)] flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[var(--primary)] shrink-0 mt-0.5" />
                      <span>{item.place.address || "Address pending"}</span>
                    </p>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
                      <select
                        value={editTag}
                        onChange={(e) => setEditTag(e.target.value)}
                        className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-muted)] px-2.5 py-1.5 text-xs"
                      >
                        {COLLECTION_TAGS.filter((t) => t !== "ALL").map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <textarea
                        rows={2}
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Add personal travel notes..."
                        className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-muted)] px-2.5 py-1.5 text-xs"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="primary"
                          onClick={() => void handleSaveEdit(item.id)}
                          className="gap-1"
                        >
                          <Check className="w-3 h-3" />
                          <span>Save</span>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                      <p className="text-[11px] text-[var(--ink-tertiary)] flex items-center gap-1 truncate">
                        <StickyNote className="w-3 h-3 shrink-0" />
                        <span className="truncate">{item.notes || "No personal notes added"}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(item.id);
                          setEditNotes(item.notes || "");
                          setEditTag(item.category || "Must Visit");
                        }}
                        className="text-[11px] font-medium text-[var(--primary)] hover:underline shrink-0"
                      >
                        Edit Note
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
