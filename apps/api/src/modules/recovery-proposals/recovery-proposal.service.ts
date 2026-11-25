import { prisma } from "../../db/prisma";

export class ProposalNotFoundError extends Error {
    constructor(message = "Recovery proposal not found") {
        super(message);
        this.name = "ProposalNotFoundError";
    }
}

export class ForbiddenError extends Error {
    constructor(message = "You are not authorized to perform this action") {
        super(message);
        this.name = "ForbiddenError";
    }
}

export class InvalidProposalStateError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvalidProposalStateError";
    }
}

export async function approveRecoveryProposal(proposalId: string, userId: string) {
    const proposal = await prisma.recoveryProposal.findUnique({
        where: { id: proposalId },
        include: {
            disruptionEvent: {
                include: { trip: true }
            }
        }
    });

    if (!proposal) {
        throw new ProposalNotFoundError("Recovery proposal not found");
    }

    const trip = proposal.disruptionEvent.trip;
    if (trip.userId !== userId) {
        throw new ForbiddenError("You are not authorized to approve proposals for this trip");
    }

    if (proposal.status === "APPLIED") {
        throw new InvalidProposalStateError("This recovery proposal has already been applied");
    }

    if (proposal.status === "REJECTED") {
        throw new InvalidProposalStateError("Cannot approve a proposal that has been rejected");
    }

    // Find current active itinerary
    const currentItinerary = await prisma.itinerary.findFirst({
        where: {
            tripId: trip.id,
            isCurrent: true
        },
        include: {
            days: {
                orderBy: { dayNumber: "asc" },
                include: {
                    activities: {
                        orderBy: { sortOrder: "asc" },
                        include: { place: true }
                    }
                }
            }
        }
    }) ?? await prisma.itinerary.findFirst({
        where: { tripId: trip.id },
        orderBy: { version: "desc" },
        include: {
            days: {
                orderBy: { dayNumber: "asc" },
                include: {
                    activities: {
                        orderBy: { sortOrder: "asc" },
                        include: { place: true }
                    }
                }
            }
        }
    });

    if (!currentItinerary) {
        throw new InvalidProposalStateError("No active itinerary found to apply this proposal to");
    }

    // Atomic Apply via Prisma transaction
    const result = await prisma.$transaction(async (tx: any) => {
        // 1. Mark existing active itinerary as not current
        await tx.itinerary.update({
            where: { id: currentItinerary.id },
            data: { isCurrent: false }
        });

        // 2. Create new cloned itinerary with incremented version & lineage
        const newVersion = currentItinerary.version + 1;
        const newItinerary = await tx.itinerary.create({
            data: {
                tripId: trip.id,
                version: newVersion,
                parentItineraryId: currentItinerary.id,
                isCurrent: true,
                status: "PUBLISHED",
                title: `${currentItinerary.title} (Recovered: ${proposal.strategy})`,
                description: proposal.summary
            }
        });

        // 3. Parse diff payload
        const diff = (proposal.diffPayload ?? {}) as {
            added?: Array<any>;
            removed?: Array<string>;
            modified?: Array<any>;
        };
        const removedTitles = new Set(
            (diff.removed ?? []).map((t: any) => (typeof t === "string" ? t.trim().toLowerCase() : String(t.title ?? "").trim().toLowerCase()))
        );
        const modifiedMap = new Map<string, any>();
        for (const mod of diff.modified ?? []) {
            const key = String(mod.title ?? "").trim().toLowerCase();
            if (key) {
                modifiedMap.set(key, mod);
            }
        }

        // 4. Clone days and activities
        for (const oldDay of currentItinerary.days) {
            const newDay = await tx.itineraryDay.create({
                data: {
                    itineraryId: newItinerary.id,
                    dayNumber: oldDay.dayNumber,
                    date: oldDay.date,
                    title: oldDay.title,
                    description: oldDay.description
                }
            });

            let currentSortOrder = 0;
            for (const oldAct of oldDay.activities) {
                const normTitle = oldAct.title.trim().toLowerCase();

                // Skip removed activities
                if (removedTitles.has(normTitle)) {
                    continue;
                }

                // Check for timing/cost modifications
                const mod = modifiedMap.get(normTitle);
                let startTime = oldAct.startTime;
                let endTime = oldAct.endTime;

                if (mod && mod.new_start_time && oldDay.date) {
                    const [h, m] = mod.new_start_time.split(":").map(Number);
                    const d = new Date(oldDay.date);
                    d.setUTCHours(h, m, 0, 0);
                    startTime = d;
                }
                if (mod && mod.new_end_time && oldDay.date) {
                    const [h, m] = mod.new_end_time.split(":").map(Number);
                    const d = new Date(oldDay.date);
                    d.setUTCHours(h, m, 0, 0);
                    endTime = d;
                }

                await tx.activity.create({
                    data: {
                        itineraryDayId: newDay.id,
                        placeId: oldAct.placeId,
                        title: oldAct.title,
                        description: oldAct.description,
                        startTime,
                        endTime,
                        durationMinutes: oldAct.durationMinutes,
                        sortOrder: currentSortOrder++,
                        estimatedCost: oldAct.estimatedCost,
                        currency: oldAct.currency,
                        status: oldAct.status
                    }
                });
            }

            // Handle added activities for day 1 (or affected day)
            if (oldDay.dayNumber === 1 && Array.isArray(diff.added)) {
                for (const addedItem of diff.added) {
                    const addedTitle = typeof addedItem === "string" ? addedItem : String(addedItem.title ?? "Alternative Experience");
                    await tx.activity.create({
                        data: {
                            itineraryDayId: newDay.id,
                            title: addedTitle,
                            description: "AI-suggested alternative activity to absorb disruption",
                            sortOrder: currentSortOrder++,
                            estimatedCost: 0.0,
                            currency: trip.currency,
                            status: "PLANNED"
                        }
                    });
                }
            }
        }

        // 5. Update proposal status to APPLIED
        const updatedProposal = await tx.recoveryProposal.update({
            where: { id: proposalId },
            data: { status: "APPLIED" }
        });

        // 6. Mark disruption event as resolved
        await tx.disruptionEvent.update({
            where: { id: proposal.disruptionEventId },
            data: { resolved: true }
        });

        // 7. Record AuditLog entry
        await tx.auditLog.create({
            data: {
                tripId: trip.id,
                actorType: "USER",
                action: "PROPOSAL_APPROVED",
                beforeItineraryId: currentItinerary.id,
                afterItineraryId: newItinerary.id,
                metadata: {
                    proposalId: proposal.id,
                    strategy: proposal.strategy,
                    costDelta: Number(proposal.estimatedCostDelta)
                }
            }
        });

        return {
            newItinerary,
            proposal: updatedProposal
        };
    });

    return result;
}

export async function rejectRecoveryProposal(proposalId: string, userId: string) {
    const proposal = await prisma.recoveryProposal.findUnique({
        where: { id: proposalId },
        include: {
            disruptionEvent: {
                include: { trip: true }
            }
        }
    });

    if (!proposal) {
        throw new ProposalNotFoundError("Recovery proposal not found");
    }

    const trip = proposal.disruptionEvent.trip;
    if (trip.userId !== userId) {
        throw new ForbiddenError("You are not authorized to reject proposals for this trip");
    }

    if (proposal.status === "APPLIED") {
        throw new InvalidProposalStateError("Cannot reject a proposal that has already been applied");
    }

    const updatedProposal = await prisma.recoveryProposal.update({
        where: { id: proposalId },
        data: { status: "REJECTED" }
    });

    await prisma.auditLog.create({
        data: {
            tripId: trip.id,
            actorType: "USER",
            action: "PROPOSAL_REJECTED",
            metadata: {
                proposalId: proposal.id,
                strategy: proposal.strategy
            }
        }
    }).catch(() => {});

    return updatedProposal;
}
