import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";

import { prisma } from "../src/db/prisma";
import {
    processGenerationJob,
    recoverStaleGenerationJobs,
    enqueueGenerationJob
} from "../src/modules/generation-jobs/generation-job.worker";
import { env } from "../src/config/env";

test("Generation Job Worker - PostgreSQL End-to-End Persistence Pipeline", async (t) => {
    // 1. Setup Mock FastAPI AI Service
    let mockMode: "success" | "error" = "success";
    let receivedServiceKey = "";
    let receivedRequestId = "";
    let receivedPayload: any = null;

    const mockAiServer = http.createServer((req, res) => {
        receivedServiceKey = req.headers["x-service-key"] as string;
        receivedRequestId = req.headers["x-request-id"] as string;

        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
            if (body) {
                receivedPayload = JSON.parse(body);
            }

            if (mockMode === "error") {
                res.writeHead(502, { "Content-Type": "application/json" });
                res.end(
                    JSON.stringify({
                        success: false,
                        request_id: receivedRequestId,
                        error: {
                            code: "LLM_MODEL_ERROR",
                            message: "Upstream LLM error during generation",
                            retryable: true
                        }
                    })
                );
                return;
            }

            const responsePayload = {
                success: true,
                request_id: receivedRequestId,
                data: {
                    trip_id: receivedPayload?.trip_id,
                    generation_job_id: receivedPayload?.generation_job_id,
                    itinerary: {
                        title: "3 Days in Kyoto Cultural Exploration",
                        summary: "Rich cultural itinerary across Kyoto's top shrines and markets",
                        currency: "USD",
                        total_estimated_cost: 165.0,
                        highlights: [
                            "Fushimi Inari Shrine",
                            "Gion District & Noodles",
                            "Kinkaku-ji Golden Pavilion"
                        ],
                        days: [
                            {
                                day_number: 1,
                                date: "2026-06-01",
                                title: "Southern Kyoto & Historical Shrines",
                                summary: "Explore Fushimi Inari and Gion",
                                daily_cost_total: 65.0,
                                activities: [
                                    {
                                        title: "Hike Fushimi Inari Torii Gates",
                                        description: "Walk the thousands of vermilion torii gates",
                                        timing: {
                                            start_time: "09:00",
                                            end_time: "11:30",
                                            duration_minutes: 150
                                        },
                                        place: {
                                            name: "Fushimi Inari Taisha",
                                            address: "68 Fukakusa Yabunouchicho, Fushimi Ward, Kyoto",
                                            category: "ATTRACTION",
                                            latitude: 34.9671,
                                            longitude: 135.7727
                                        },
                                        estimated_cost: 0.0,
                                        currency: "USD",
                                        notes: "Wear comfortable walking shoes"
                                    },
                                    {
                                        title: "Lunch at Gion Duck Noodles",
                                        description: "Traditional ramen in historic Gion",
                                        timing: {
                                            start_time: "12:00",
                                            end_time: "13:30",
                                            duration_minutes: 90
                                        },
                                        place: {
                                            name: "Gion Duck Noodles",
                                            address: "Gionmachi Kitagawa, Higashiyama Ward, Kyoto",
                                            category: "RESTAURANT",
                                            latitude: 35.0037,
                                            longitude: 135.7770
                                        },
                                        estimated_cost: 65.0,
                                        currency: "USD",
                                        notes: "Cash or IC card accepted"
                                    }
                                ]
                            },
                            {
                                day_number: 2,
                                date: "2026-06-02",
                                title: "Northern Kyoto & Golden Pavilion",
                                summary: "Zen gardens and historic architecture",
                                daily_cost_total: 100.0,
                                activities: [
                                    {
                                        title: "Visit Kinkaku-ji",
                                        description: "Zen Buddhist temple covered in gold leaf",
                                        timing: {
                                            start_time: "09:30",
                                            end_time: "11:30",
                                            duration_minutes: 120
                                        },
                                        place: {
                                            name: "Kinkaku-ji",
                                            address: "1 Kinkakujicho, Kita Ward, Kyoto",
                                            category: "ATTRACTION",
                                            latitude: 35.0394,
                                            longitude: 135.7292
                                        },
                                        estimated_cost: 20.0,
                                        currency: "USD",
                                        notes: "Morning visit recommended"
                                    },
                                    {
                                        title: "Kaiseki Dinner in Pontocho",
                                        description: "Multi-course seasonal dining along the river",
                                        timing: {
                                            start_time: "18:00",
                                            end_time: "20:00",
                                            duration_minutes: 120
                                        },
                                        place: {
                                            name: "Pontocho Alley Dining",
                                            address: "Pontocho, Nakagyo Ward, Kyoto",
                                            category: "RESTAURANT",
                                            latitude: 35.0058,
                                            longitude: 135.7712
                                        },
                                        estimated_cost: 80.0,
                                        currency: "USD",
                                        notes: "Reservations required"
                                    }
                                ]
                            }
                        ]
                    },
                    metadata: {
                        model: "llama-3.3-70b-versatile",
                        latency_ms: 1850.5,
                        usage: { input_tokens: 650, output_tokens: 1200, total_tokens: 1850 }
                    }
                }
            };

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(responsePayload));
        });
    });

    await new Promise<void>((resolve) => mockAiServer.listen(0, "127.0.0.1", () => resolve()));
    const { port } = mockAiServer.address() as AddressInfo;
    const originalAiUrl = env.AI_SERVICE_URL;

    // Temporarily point Express AI client to our mock server
    (env as any).AI_SERVICE_URL = `http://127.0.0.1:${port}`;

    // 2. Create test user and trip in PostgreSQL
    const testEmail = `test-day7-${randomUUID()}@tripgenie.test`;
    let testUserId = "";
    let testTripId = "";
    let createdPlaceIds: string[] = [];

    try {
        const user = await prisma.user.create({
            data: {
                email: testEmail,
                passwordHash: "dummy-hash",
                name: "Day 7 Tester",
                status: "ACTIVE"
            }
        });
        testUserId = user.id;

        const trip = await prisma.trip.create({
            data: {
                userId: testUserId,
                title: "Kyoto Summer Vacation",
                destination: "Kyoto, Japan",
                origin: "Tokyo, Japan",
                startDate: new Date("2026-06-01T00:00:00.000Z"),
                endDate: new Date("2026-06-03T00:00:00.000Z"),
                budget: 1000.0,
                currency: "USD",
                travelerCount: 2,
                preferences: {
                    pace: "moderate",
                    interests: ["temples", "ramen"]
                }
            }
        });
        testTripId = trip.id;

        // Subtest 1: Execute single generation job and verify relational persistence
        await t.test("processGenerationJob successfully persists Itinerary, Days, Places, and Activities", async () => {
            const job = await prisma.generationJob.create({
                data: {
                    userId: testUserId,
                    tripId: testTripId,
                    jobType: "ITINERARY_GENERATION",
                    status: "PENDING",
                    input: {
                        options: { temperature: 0.2 }
                    }
                }
            });

            // Run worker pipeline
            await processGenerationJob(job.id);

            // Verify GenerationJob updated in PostgreSQL
            const updatedJob = await prisma.generationJob.findUnique({
                where: { id: job.id }
            });
            assert.ok(updatedJob);
            assert.equal(updatedJob.status, "COMPLETED");
            assert.ok(updatedJob.startedAt);
            assert.ok(updatedJob.completedAt);
            assert.equal(updatedJob.errorDetails, null);

            const jobResult = updatedJob.result as any;
            assert.ok(jobResult.itineraryId);
            assert.equal(jobResult.daysCount, 2);
            assert.equal(jobResult.activitiesCount, 4);
            assert.equal(jobResult.currency, "USD");
            assert.equal(jobResult.totalEstimatedCost, 165.0);

            // Verify Itinerary row in PostgreSQL
            const persistedItinerary = await prisma.itinerary.findUnique({
                where: { id: jobResult.itineraryId },
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

            assert.ok(persistedItinerary);
            assert.equal(persistedItinerary.tripId, testTripId);
            assert.equal(persistedItinerary.version, 1);
            assert.equal(persistedItinerary.isCurrent, true);
            assert.equal(persistedItinerary.status, "DRAFT");
            assert.equal(persistedItinerary.title, "3 Days in Kyoto Cultural Exploration");

            // Verify Days
            assert.equal(persistedItinerary.days.length, 2);
            const day1 = persistedItinerary.days[0];
            const day2 = persistedItinerary.days[1];

            assert.equal(day1.dayNumber, 1);
            assert.equal(day1.title, "Southern Kyoto & Historical Shrines");
            assert.equal(day2.dayNumber, 2);
            assert.equal(day2.title, "Northern Kyoto & Golden Pavilion");

            // Verify Activities and Places
            assert.equal(day1.activities.length, 2);
            assert.equal(day2.activities.length, 2);

            const act1 = day1.activities[0];
            assert.equal(act1.title, "Hike Fushimi Inari Torii Gates");
            assert.equal(act1.status, "PLANNED");
            assert.equal(act1.durationMinutes, 150);
            assert.ok(act1.place);
            assert.equal(act1.place.name, "Fushimi Inari Taisha");
            assert.equal(Number(act1.place.latitude), 34.9671);
            assert.equal(Number(act1.place.longitude), 135.7727);
            assert.equal(act1.place.category, "ATTRACTION");
            assert.equal(act1.place.provider, "AI_GENERATED");

            const act2 = day1.activities[1];
            assert.equal(act2.title, "Lunch at Gion Duck Noodles");
            assert.ok(act2.place);
            assert.equal(act2.place.name, "Gion Duck Noodles");
            assert.equal(act2.place.category, "RESTAURANT");

            // Track places for cleanup
            for (const d of persistedItinerary.days) {
                for (const a of d.activities) {
                    if (a.placeId) {
                        createdPlaceIds.push(a.placeId);
                    }
                }
            }
        });

        // Subtest 2: Versioning & Idempotency test (Generating version 2)
        await t.test("Second generation job increments version and sets previous to isCurrent=false", async () => {
            const job2 = await prisma.generationJob.create({
                data: {
                    userId: testUserId,
                    tripId: testTripId,
                    jobType: "ITINERARY_GENERATION",
                    status: "PENDING",
                    input: {}
                }
            });

            await processGenerationJob(job2.id);

            const allItineraries = await prisma.itinerary.findMany({
                where: { tripId: testTripId },
                orderBy: { version: "asc" }
            });

            assert.equal(allItineraries.length, 2);
            const [v1, v2] = allItineraries;

            assert.equal(v1.version, 1);
            assert.equal(v1.isCurrent, false); // Previous deactivated

            assert.equal(v2.version, 2);
            assert.equal(v2.isCurrent, true); // New is active
        });

        // Subtest 3: Failure handling test
        await t.test("processGenerationJob marks job as FAILED when AI service throws", async () => {
            mockMode = "error";

            const failingJob = await prisma.generationJob.create({
                data: {
                    userId: testUserId,
                    tripId: testTripId,
                    jobType: "ITINERARY_GENERATION",
                    status: "PENDING",
                    input: {}
                }
            });

            await processGenerationJob(failingJob.id);

            const updatedFailingJob = await prisma.generationJob.findUnique({
                where: { id: failingJob.id }
            });

            assert.ok(updatedFailingJob);
            assert.equal(updatedFailingJob.status, "FAILED");
            assert.ok(updatedFailingJob.completedAt);
            const err = updatedFailingJob.errorDetails as any;
            assert.equal(err.code, "LLM_MODEL_ERROR");
            assert.equal(err.retryable, true);
        });

        // Subtest 4: Stale job recovery test
        await t.test("recoverStaleGenerationJobs marks PROCESSING jobs as FAILED and requeues PENDING", async () => {
            const stuckJob = await prisma.generationJob.create({
                data: {
                    userId: testUserId,
                    tripId: testTripId,
                    jobType: "ITINERARY_GENERATION",
                    status: "PROCESSING",
                    startedAt: new Date(Date.now() - 60000),
                    input: {}
                }
            });

            const recoveryStats = await recoverStaleGenerationJobs();
            assert.ok(recoveryStats.failedStaleProcessing >= 1);

            const recoveredJob = await prisma.generationJob.findUnique({
                where: { id: stuckJob.id }
            });
            assert.ok(recoveredJob);
            assert.equal(recoveredJob.status, "FAILED");
            assert.equal((recoveredJob.errorDetails as any)?.code, "WORKER_INTERRUPTED");
        });
    } finally {
        // Cleanup test data from PostgreSQL
        mockAiServer.close();
        (env as any).AI_SERVICE_URL = originalAiUrl;

        if (testUserId) {
            await prisma.user.delete({
                where: { id: testUserId }
            }).catch(() => {});
        }

        if (createdPlaceIds.length > 0) {
            await prisma.place.deleteMany({
                where: { id: { in: createdPlaceIds } }
            }).catch(() => {});
        }
    }
});
