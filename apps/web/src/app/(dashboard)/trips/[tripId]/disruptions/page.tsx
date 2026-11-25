import React from "react";
import { DisruptionConsoleView } from "@/features/disruptions/components/disruption-console-view";

interface DisruptionPageProps {
  params: Promise<{
    tripId: string;
  }>;
}

export default async function DisruptionPage({ params }: DisruptionPageProps) {
  // In Next.js 16, params is a Promise that must be awaited
  const { tripId } = await params;

  return <DisruptionConsoleView tripId={tripId} />;
}
