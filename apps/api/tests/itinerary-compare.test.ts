import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";

import app from "../src/app";
import { prisma } from "../src/db/prisma";
import { env } from "../src/config/env";

test("Itinerary Compare API - GET /api/itineraries/compare", async (t) => {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}/api/itineraries/compare`;

    const user1Email = `compare-owner-${randomUUID()}@tripgenie.test`;
    const user2Email = `compare-intruder-${randomUUID()}@tripgenie.test`;

    let user1Id = "";
    let user2Id = "";
    let tripId = "";
    let baseItineraryId = "";
    let targetItineraryId = "";
    let user1Cookie = "";
    let user2Cookie = "";

    try {
        // 1. Create Users
        const user1 = await prisma.user.create({
            data: {
                email: user1Email,
                passwordHash: "dummy-hash",
                name: "Comparison Owner",
                status: "ACTIVE"
            }
        });
        user1Id = user1.id;

        const user2 = await prisma.user.create({
            data: {
                email: user2Email,
                passwordHash: "dummy-hash",
                name: "Comparison Intruder",
                status: "ACTIVE"
            }
        });
        user2Id = user2.id;

        const token1 = jwt.sign({ sub: user1Id }, env.JWT_SECRET);
        const token2 = jwt.sign({ sub: user2Id }, env.JWT_SECRET);
        const cookieName = process.env.AUTH_COOKIE_NAME ?? "auth_token";
        user1Cookie = `${cookieName}=${token1}`;
        user2Cookie = `${cookieName}=${token2}`;

        // 2. Create Trip for user1
        const trip = await prisma.trip.create({
            data: {
                userId: user1Id,
                title: "Tokyo Comparison Trip",
                destination: "Tokyo, Japan",
                origin: "San Francisco, USA",
                startDate: new Date("2026-07-01T00:00:00.000Z"),
                endDate: new Date("2026-07-03T00:00:00.000Z"),
                budget: 1500.0,
                currency: "USD",
                travelerCount: 2
            }
        });
        tripId = trip.id;

        // 3. Create Base Itinerary (v1): 3 activities
        // - Activity 1: "Senso-ji Visit" ($0, 09:00 - 10:30)
        // - Activity 2: "Ramen Lunch" ($20, 12:00 - 13:00)
        // - Activity 3: "Tokyo Tower Observation" ($35, 14:00 - 16:00)
        // Total Base Cost = $55
        const baseItinerary = await prisma.itinerary.create({
            data: {
                tripId,
                version: 1,
                title: "Tokyo Original Plan",
                status: "DRAFT",
                days: {
                    create: [
                        {
                            dayNumber: 1,
                            date: new Date("2026-07-01T00:00:00.000Z"),
                            title: "Day 1 - Classic Tokyo",
                            activities: {
                                create: [
                                    {
                                        title: "Senso-ji Visit",
                                        description: "Explore historical shrine",
                                        startTime: new Date("2026-07-01T09:00:00.000Z"),
                                        endTime: new Date("2026-07-01T10:30:00.000Z"),
                                        durationMinutes: 90,
                                        sortOrder: 0,
                                        estimatedCost: 0.0,
                                        currency: "USD"
                                    },
                                    {
                                        title: "Ramen Lunch",
                                        description: "Local noodles in Asakusa",
                                        startTime: new Date("2026-07-01T12:00:00.000Z"),
                                        endTime: new Date("2026-07-01T13:00:00.000Z"),
                                        durationMinutes: 60,
                                        sortOrder: 1,
                                        estimatedCost: 20.0,
                                        currency: "USD"
                                    },
                                    {
                                        title: "Tokyo Tower Observation",
                                        description: "Observation deck views",
                                        startTime: new Date("2026-07-01T14:00:00.000Z"),
                                        endTime: new Date("2026-07-01T16:00:00.000Z"),
                                        durationMinutes: 120,
                                        sortOrder: 2,
                                        estimatedCost: 35.0,
                                        currency: "USD"
                                    }
                                ]
                            }
                        }
                    ]
                }
            }
        });
        baseItineraryId = baseItinerary.id;

        // 4. Create Target Itinerary (v2):
        // - Activity 1: "Senso-ji Visit" ($0, 09:30 - 11:00) -> Shifted timing
        // - Activity 2: "Ramen Lunch" ($35, 12:00 - 13:00) -> Modified cost (+15)
        // - Activity 3: "Tokyo Tower Observation" -> REMOVED
        // - Activity 4: "Shibuya Sky Sunset" ($40, 17:00 - 19:00) -> ADDED
        // Total Target Cost = $75. Cost Delta = +$20
        const targetItinerary = await prisma.itinerary.create({
            data: {
                tripId,
                version: 2,
                title: "Tokyo Optimized Plan",
                status: "DRAFT",
                days: {
                    create: [
                        {
                            dayNumber: 1,
                            date: new Date("2026-07-01T00:00:00.000Z"),
                            title: "Day 1 - Optimized Tokyo",
                            activities: {
                                create: [
                                    {
                                        title: "Senso-ji Visit",
                                        description: "Explore historical shrine",
                                        startTime: new Date("2026-07-01T09:30:00.000Z"),
                                        endTime: new Date("2026-07-01T11:00:00.000Z"),
                                        durationMinutes: 90,
                                        sortOrder: 0,
                                        estimatedCost: 0.0,
                                        currency: "USD"
                                    },
                                    {
                                        title: "Ramen Lunch",
                                        description: "Premium ramen experience",
                                        startTime: new Date("2026-07-01T12:00:00.000Z"),
                                        endTime: new Date("2026-07-01T13:00:00.000Z"),
                                        durationMinutes: 60,
                                        sortOrder: 1,
                                        estimatedCost: 35.0,
                                        currency: "USD"
                                    },
                                    {
                                        title: "Shibuya Sky Sunset",
                                        description: "Rooftop observation deck",
                                        startTime: new Date("2026-07-01T17:00:00.000Z"),
                                        endTime: new Date("2026-07-01T19:00:00.000Z"),
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
        targetItineraryId = targetItinerary.id;

        // Subtest 1: 401 when no auth cookie
        await t.test("rejects unauthenticated requests with 401", async () => {
            const res = await fetch(`${baseUrl}?baseId=${baseItineraryId}&targetId=${targetItineraryId}`);
            assert.equal(res.status, 401);
            const body = await res.json() as any;
            assert.equal(body.success, false);
            assert.equal(body.error.message, "Authentication required");
        });

        // Subtest 2: 400 when query parameters are invalid UUIDs
        await t.test("rejects invalid UUID query params with 400", async () => {
            const res = await fetch(`${baseUrl}?baseId=invalid-uuid&targetId=123`, {
                headers: { Cookie: user1Cookie }
            });
            assert.equal(res.status, 400);
            const body = await res.json() as any;
            assert.equal(body.success, false);
            assert.ok(body.error.message.includes("Invalid query parameters"));
        });

        // Subtest 3: 403 when user does not own the itineraries
        await t.test("rejects unauthorized user with 403 Forbidden", async () => {
            const res = await fetch(`${baseUrl}?baseId=${baseItineraryId}&targetId=${targetItineraryId}`, {
                headers: { Cookie: user2Cookie }
            });
            assert.equal(res.status, 403);
            const body = await res.json() as any;
            assert.equal(body.success, false);
            assert.ok(body.error.message.includes("not authorized"));
        });

        // Subtest 4: 404 when one or both itineraries do not exist
        await t.test("returns 404 when itinerary is not found", async () => {
            const nonExistentId = randomUUID();
            const res = await fetch(`${baseUrl}?baseId=${baseItineraryId}&targetId=${nonExistentId}`, {
                headers: { Cookie: user1Cookie }
            });
            assert.equal(res.status, 404);
            const body = await res.json() as any;
            assert.equal(body.success, false);
            assert.ok(body.error.message.includes("not found"));
        });

        // Subtest 5: 200 OK with machine-readable delta calculation
        await t.test("computes accurate machine-readable delta between base and target", async () => {
            const res = await fetch(`${baseUrl}?baseId=${baseItineraryId}&targetId=${targetItineraryId}`, {
                headers: { Cookie: user1Cookie }
            });
            assert.equal(res.status, 200);
            const json = await res.json() as any;

            assert.equal(json.success, true);
            const data = json.data;

            assert.equal(data.tripId, tripId);
            assert.equal(data.base.id, baseItineraryId);
            assert.equal(data.base.totalCost, 55.0);
            assert.equal(data.base.activitiesCount, 3);

            assert.equal(data.target.id, targetItineraryId);
            assert.equal(data.target.totalCost, 75.0);
            assert.equal(data.target.activitiesCount, 3);

            // Cost delta: 75 - 55 = +20.0
            assert.equal(data.costDelta, 20.0);

            // Added: "Shibuya Sky Sunset"
            assert.equal(data.scheduleChanges.added.length, 1);
            assert.equal(data.scheduleChanges.added[0].title, "Shibuya Sky Sunset");
            assert.equal(data.scheduleChanges.added[0].estimatedCost, 40.0);

            // Removed: "Tokyo Tower Observation"
            assert.equal(data.scheduleChanges.removed.length, 1);
            assert.equal(data.scheduleChanges.removed[0].title, "Tokyo Tower Observation");
            assert.equal(data.scheduleChanges.removed[0].estimatedCost, 35.0);

            // Modified: 2 items
            // 1) "Senso-ji Visit" timing shifted
            // 2) "Ramen Lunch" cost changed from 20 to 35
            assert.equal(data.scheduleChanges.modified.length, 2);
            assert.equal(data.scheduleChanges.shiftedTimingsCount, 1);

            const modifiedSensoji = data.scheduleChanges.modified.find((m: any) => m.title === "Senso-ji Visit");
            assert.ok(modifiedSensoji);
            assert.ok(modifiedSensoji.changes.previousStartTime);
            assert.ok(modifiedSensoji.changes.newStartTime);
            assert.equal(modifiedSensoji.changes.previousCost, undefined);

            const modifiedRamen = data.scheduleChanges.modified.find((m: any) => m.title === "Ramen Lunch");
            assert.ok(modifiedRamen);
            assert.equal(modifiedRamen.changes.previousCost, 20.0);
            assert.equal(modifiedRamen.changes.newCost, 35.0);

            // Summary messages
            assert.ok(data.scheduleChanges.summary.length >= 4);
            assert.ok(data.scheduleChanges.summary.some((s: string) => s.includes("Total cost delta: +20.00")));
            assert.ok(data.scheduleChanges.summary.some((s: string) => s.includes("Added 'Shibuya Sky Sunset'")));
            assert.ok(data.scheduleChanges.summary.some((s: string) => s.includes("Removed 'Tokyo Tower Observation'")));
            assert.ok(data.scheduleChanges.summary.some((s: string) => s.includes("Shifted schedule timing for 'Senso-ji Visit'")));
        });
    } finally {
        server.close();

        // Cleanup test users and cascading records
        if (user1Id) {
            await prisma.user.delete({ where: { id: user1Id } }).catch(() => {});
        }
        if (user2Id) {
            await prisma.user.delete({ where: { id: user2Id } }).catch(() => {});
        }
        await prisma.$disconnect().catch(() => {});
    }
});
