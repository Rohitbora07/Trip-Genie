import React from "react";
import { TripTimelineView } from "@/features/itinerary/components/trip-timeline-view";

interface TripPageProps {
  params: Promise<{
    tripId: string;
  }>;
}

export default async function TripPage({ params }: TripPageProps) {
  // In Next.js 16, params is a Promise that must be awaited
  const { tripId } = await params;

  return <TripTimelineView tripId={tripId} />;
}
