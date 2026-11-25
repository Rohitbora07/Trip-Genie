-- CreateEnum
CREATE TYPE "DisruptionType" AS ENUM ('FLIGHT_DELAY', 'FLIGHT_CANCELLATION', 'HOTEL_OVERBOOKING', 'ATTRACTION_CLOSURE', 'WEATHER_ALERT', 'TRANSIT_STRIKE', 'OTHER');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'APPLIED');

-- AlterTable
ALTER TABLE "Itinerary" ADD COLUMN     "parentItineraryId" UUID;

-- CreateTable
CREATE TABLE "DisruptionEvent" (
    "id" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "type" "DisruptionType" NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT NOT NULL,
    "details" JSONB,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisruptionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryProposal" (
    "id" UUID NOT NULL,
    "disruptionEventId" UUID NOT NULL,
    "generationJobId" UUID,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "estimatedCostDelta" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "tradeOffs" JSONB NOT NULL,
    "diffPayload" JSONB NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "actorType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeItineraryId" UUID,
    "afterItineraryId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DisruptionEvent_tripId_idx" ON "DisruptionEvent"("tripId");

-- CreateIndex
CREATE INDEX "DisruptionEvent_type_idx" ON "DisruptionEvent"("type");

-- CreateIndex
CREATE INDEX "DisruptionEvent_resolved_idx" ON "DisruptionEvent"("resolved");

-- CreateIndex
CREATE INDEX "RecoveryProposal_disruptionEventId_idx" ON "RecoveryProposal"("disruptionEventId");

-- CreateIndex
CREATE INDEX "RecoveryProposal_generationJobId_idx" ON "RecoveryProposal"("generationJobId");

-- CreateIndex
CREATE INDEX "RecoveryProposal_status_idx" ON "RecoveryProposal"("status");

-- CreateIndex
CREATE INDEX "AuditLog_tripId_idx" ON "AuditLog"("tripId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Itinerary_parentItineraryId_idx" ON "Itinerary"("parentItineraryId");

-- AddForeignKey
ALTER TABLE "Itinerary" ADD CONSTRAINT "Itinerary_parentItineraryId_fkey" FOREIGN KEY ("parentItineraryId") REFERENCES "Itinerary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisruptionEvent" ADD CONSTRAINT "DisruptionEvent_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryProposal" ADD CONSTRAINT "RecoveryProposal_disruptionEventId_fkey" FOREIGN KEY ("disruptionEventId") REFERENCES "DisruptionEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryProposal" ADD CONSTRAINT "RecoveryProposal_generationJobId_fkey" FOREIGN KEY ("generationJobId") REFERENCES "GenerationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
