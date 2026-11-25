"use client";

import React, { useState, useEffect } from "react";
import { Plus, Compass, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityCard } from "@/features/itinerary/components/activity-card";
import { api } from "@/lib/api";
import type { Activity } from "@/types/api";

interface ActivityListProps {
  dayId: string;
  initialActivities: Activity[];
  onOpenPlaceLookup: () => void;
  onActivitiesChange?: (activities: Activity[]) => void;
}

export function ActivityList({
  dayId,
  initialActivities,
  onOpenPlaceLookup,
  onActivitiesChange,
}: ActivityListProps) {
  const [activities, setActivities] = useState<Activity[]>(initialActivities);

  useEffect(() => {
    // Sort activities by sortOrder initially
    const sorted = [...initialActivities].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    setActivities(sorted);
  }, [initialActivities]);

  const handleReorder = async (indexA: number, indexB: number) => {
    if (indexA < 0 || indexA >= activities.length || indexB < 0 || indexB >= activities.length) {
      return;
    }

    const newActivities = [...activities];
    const itemA = newActivities[indexA];
    newActivities[indexA] = newActivities[indexB];
    newActivities[indexB] = itemA;

    // Update sortOrder values
    const updated = newActivities.map((act, idx) => ({
      ...act,
      sortOrder: idx,
    }));

    // Optimistic UI update
    setActivities(updated);
    if (onActivitiesChange) onActivitiesChange(updated);

    try {
      const activityIds = updated.map((act) => act.id);
      await api.itineraries.reorderActivities(dayId, activityIds);
    } catch (err) {
      // Revert if API fails
      console.error("Failed to reorder activities:", err);
      setActivities(activities);
      if (onActivitiesChange) onActivitiesChange(activities);
    }
  };

  const handleDelete = async (activityId: string) => {
    const previous = activities;
    const updated = activities.filter((act) => act.id !== activityId);
    setActivities(updated);
    if (onActivitiesChange) onActivitiesChange(updated);

    try {
      await api.itineraries.deleteActivity(activityId);
    } catch (err) {
      console.error("Failed to delete activity:", err);
      setActivities(previous);
      if (onActivitiesChange) onActivitiesChange(previous);
    }
  };

  if (activities.length === 0) {
    return (
      <div className="py-16 text-center rounded-2xl bg-[var(--surface)] border border-dashed border-[var(--border-default)] space-y-4">
        <div className="w-12 h-12 mx-auto rounded-xl bg-[var(--surface-muted)] flex items-center justify-center text-[var(--ink-tertiary)]">
          <Compass className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h4 className="font-serif text-base font-semibold text-[var(--ink-primary)]">
            No activities scheduled for this day
          </h4>
          <p className="text-xs text-[var(--ink-secondary)] max-w-xs mx-auto">
            Search OpenStreetMap venues or use the AI generator to build your schedule for this day.
          </p>
        </div>
        <Button variant="accent" size="sm" onClick={onOpenPlaceLookup} className="gap-1.5">
          <Plus className="w-4 h-4" />
          <span>Add Venue from Lookup</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Continuous Timeline Rail Line behind cards */}
      <div className="absolute left-[31px] sm:left-[39px] top-6 bottom-6 w-[2px] bg-[var(--border-default)] -z-0" />

      {/* Activity Cards Stack */}
      <div className="space-y-6 relative z-10">
        {activities.map((activity, index) => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            isFirst={index === 0}
            isLast={index === activities.length - 1}
            onMoveUp={() => handleReorder(index, index - 1)}
            onMoveDown={() => handleReorder(index, index + 1)}
            onDelete={() => handleDelete(activity.id)}
          />
        ))}
      </div>

      {/* Append Activity Action */}
      <div className="pt-6 flex items-center justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenPlaceLookup}
          className="gap-2 border-dashed bg-[var(--surface)] hover:bg-[var(--surface-muted)] text-xs text-[var(--ink-secondary)]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Custom Venue to Timeline</span>
        </Button>
      </div>
    </div>
  );
}
