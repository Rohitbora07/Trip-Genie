import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";

import app from "../src/app";
import { prisma } from "../src/db/prisma";
import { env } from "../src/config/env";

test("Recovery Proposals API - POST /api/recovery-proposals/:id/approve & reject", async (t) => {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}/api/recovery-proposals`;

    const ownerEmail = `approval-owner-${randomUUID()}@tripgenie.test`;
    const intruderEmail = `approval-intruder-${randomUUID()}@tripgenie.test`;

    let ownerId = "";
    let intruderId = "";
    let tripId = "";
    let v1ItineraryId = "";
    let disruptionEventId = "";
    let proposal1Id = "";
    let proposal2Id = "";
    let ownerCookie = "";
    let intruderCookie = "";

    try {
        const owner = await prisma.user.create({
            data: {
                email: ownerEmail,
                passwordHash: "dummy-hash",
                name: "Approval Owner",
                status: "ACTIVE"
            }
        });
        ownerId = owner.id;

        const intruder = await prisma.user.create({
            data: {
                email: intruderEmail,
                passwordHash: "dummy-hash",
                name: "Approval Intruder",
                status: "ACTIVE"
            }
        });
        intruderId = intruder.id;

        const cookieName = process.env.AUTH_COOKIE_NAME ?? "auth_token";
        ownerCookie = `${cookieName}=${jwt.sign({ sub: ownerId }, env.JWT_SECRET)}`;
        intruderCookie = `${cookieName}=${jwt.sign({ sub: intruderId }, env.JWT_SECRET)}`;

        const trip = await prisma.trip.create({
            data: {
                userId: ownerId,
                title: "Swiss Winter Getaway",
                destination: "Lucerne, Switzerland",
                startDate: new Date("2026-12-10T00:00:00.000Z"),
                endDate: new Date("2026-12-12T00:00:00.000Z"),
                budget: 1500.0,
                currency: "USD",
                travelerCount: 2
            }
        });
        tripId = trip.id;

        // Base Itinerary v1
        const v1Itinerary = await prisma.itinerary.create({
            data: {
                tripId,
                version: 1,
                title: "Lucerne Winter v1",
                status: "DRAFT",
                isCurrent: true,
                days: {
                    create: [
                        {
                            dayNumber: 1,
                            date: new Date("2026-12-10T00:00:00.000Z"),
                            title: "Day 1 - Arrival & Chapel Bridge",
                            activities: {
                                create: [
                                    {
                                        title: "Morning Old Town Walk",
                                        description: "Walk across Chapel Bridge",
                                        startTime: new Date("2026-12-10T09:00:00.000Z"),
                                        endTime: new Date("2026-12-10T11:00:00.000Z"),
                                        durationMinutes: 120,
                                        sortOrder: 0,
                                        estimatedCost: 0.0,
                                        currency: "USD"
                                    },
                                    {
                                        title: "Fondue Lunch at Stadtkeller",
                                        description: "Prepaid cheese fondue lunch",
                                        startTime: new Date("2026-12-10T12:00:00.000Z"),
                                        endTime: new Date("2026-12-10T13:30:00.000Z"),
                                        durationMinutes: 90,
                                        sortOrder: 1,
                                        estimatedCost: 75.0,
                                        currency: "USD"
                                    },
                                    {
                                        title: "Lake Lucerne Afternoon Cruise",
                                        description: "Scenic boat tour",
                                        startTime: new Date("2026-12-10T14:30:00.000Z"),
                                        endTime: new Date("2026-12-10T16:30:00.000Z"),
                                        durationMinutes: 120,
                                        sortOrder: 2,
                                        estimatedCost: 40.0,
                                        currency: "USD"
                                    }
                                ]
                            }
                        }
                    ]
                }
            }
        });
        v1ItineraryId = v1Itinerary.id;

        // Disruption Event
        const disruption = await prisma.disruptionEvent.create({
            data: {
                tripId,
                type: "FLIGHT_DELAY",
                severity: "HIGH",
                description: "Flight delayed by 2 hours",
                details: { delay_minutes: 120 }
            }
        });
        disruptionEventId = disruption.id;

        // Proposal 1: PACE_RELAXED (Drops Lake Lucerne Afternoon Cruise to relieve schedule)
        const proposal1 = await prisma.recoveryProposal.create({
            data: {
                disruptionEventId,
                title: "Option B: Protect Relaxation",
                summary: "Bypasses Lake Lucerne Cruise to protect fondue lunch and arrival pacing",
                strategy: "PACE_RELAXED",
                estimatedCostDelta: -40.0,
                tradeOffs: ["Drops Lake Lucerne Cruise", "Maintains relaxed lunch"],
                diffPayload: {
                    added: [],
                    removed: ["Lake Lucerne Afternoon Cruise"],
                    modified: [
                        {
                            title: "Morning Old Town Walk",
                            new_start_time: "11:00",
                            new_end_time: "12:30"
                        }
                    ]
                },
                status: "PENDING_APPROVAL"
            }
        });
        proposal1Id = proposal1.id;

        // Proposal 2: For rejection test
        const proposal2 = await prisma.recoveryProposal.create({
            data: {
                disruptionEventId,
                title: "Option C: Alternate Proposal",
                summary: "Another recovery option",
                strategy: "BUDGET_FOCUSED",
                estimatedCostDelta: 0.0,
                tradeOffs: ["Alternative"],
                diffPayload: {},
                status: "PENDING_APPROVAL"
            }
        });
        proposal2Id = proposal2.id;

        // Subtest 1: 401 when unauthenticated
        await t.test("rejects unauthenticated requests with 401", async () => {
            const res = await fetch(`${baseUrl}/${proposal1Id}/approve`, {
                method: "POST"
            });
            assert.equal(res.status, 401);
        });

        // Subtest 2: 403 when unauthorized user
        await t.test("rejects unauthorized user with 403 Forbidden", async () => {
            const res = await fetch(`${baseUrl}/${proposal1Id}/approve`, {
                method: "POST",
                headers: { Cookie: intruderCookie }
            });
            assert.equal(res.status, 403);
        });

        // Subtest 3: 200 OK on approve - Clones to v2, applies diff, links parentItineraryId
        await t.test("approve atomically creates v2 with parentItineraryId, applies diff, and marks APPLIED", async () => {
            const res = await fetch(`${baseUrl}/${proposal1Id}/approve`, {
                method: "POST",
                headers: { Cookie: ownerCookie }
            });

            assert.equal(res.status, 200);
            const json = (await res.json()) as any;
            assert.equal(json.success, true);
            assert.equal(json.data.proposal.status, "APPLIED");

            const v2 = json.data.itinerary;
            assert.ok(v2.id);
            assert.notEqual(v2.id, v1ItineraryId);
            assert.equal(v2.version, 2);
            assert.equal(v2.parentItineraryId, v1ItineraryId);
            assert.equal(v2.isCurrent, true);
            assert.equal(v2.status, "PUBLISHED");

            // Verify database records
            const v1Db = await prisma.itinerary.findUnique({ where: { id: v1ItineraryId } });
            assert.ok(v1Db);
            assert.equal(v1Db.isCurrent, false); // Old version is no longer current!

            const disruptionDb = await prisma.disruptionEvent.findUnique({ where: { id: disruptionEventId } });
            assert.ok(disruptionDb);
            assert.equal(disruptionDb.resolved, true); // Marked resolved!

            // Verify v2 activities: Lake Lucerne Cruise was removed, Morning Old Town Walk remains
            const v2Db = await prisma.itinerary.findUnique({
                where: { id: v2.id },
                include: { days: { include: { activities: true } } }
            });
            assert.ok(v2Db);
            const day1Activities = v2Db.days[0].activities;
            assert.equal(day1Activities.length, 2); // 3 original minus 1 removed = 2!
            assert.ok(!day1Activities.some((a) => a.title === "Lake Lucerne Afternoon Cruise"));
            assert.ok(day1Activities.some((a) => a.title === "Morning Old Town Walk"));
            assert.ok(day1Activities.some((a) => a.title === "Fondue Lunch at Stadtkeller"));

            // Verify AuditLog entry recorded
            const auditLogs = await prisma.auditLog.findMany({
                where: { tripId, action: "PROPOSAL_APPROVED" }
            });
            assert.ok(auditLogs.length >= 1);
            assert.equal(auditLogs[0].beforeItineraryId, v1ItineraryId);
            assert.equal(auditLogs[0].afterItineraryId, v2.id);
        });

        // Subtest 4: 400 when attempting to approve already applied proposal
        await t.test("rejects re-approval of already applied proposal with 400 Bad Request", async () => {
            const res = await fetch(`${baseUrl}/${proposal1Id}/approve`, {
                method: "POST",
                headers: { Cookie: ownerCookie }
            });
            assert.equal(res.status, 400);
            const json = (await res.json()) as any;
            assert.ok(json.error.message.includes("already been applied"));
        });

        // Subtest 5: Reject endpoint marks proposal REJECTED
        await t.test("reject marks proposal REJECTED and leaves itinerary untouched", async () => {
            const res = await fetch(`${baseUrl}/${proposal2Id}/reject`, {
                method: "POST",
                headers: { Cookie: ownerCookie }
            });

            assert.equal(res.status, 200);
            const json = (await res.json()) as any;
            assert.equal(json.data.proposal.status, "REJECTED");

            const proposal2Db = await prisma.recoveryProposal.findUnique({ where: { id: proposal2Id } });
            assert.equal(proposal2Db?.status, "REJECTED");
        });
    } finally {
        server.close();

        if (ownerId) {
            await prisma.user.delete({ where: { id: ownerId } }).catch(() => {});
        }
        if (intruderId) {
            await prisma.user.delete({ where: { id: intruderId } }).catch(() => {});
        }

        await prisma.$disconnect().catch(() => {});
    }
});
