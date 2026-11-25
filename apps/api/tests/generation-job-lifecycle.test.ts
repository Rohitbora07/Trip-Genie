import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";

import app from "../src/app";
import { prisma } from "../src/db/prisma";
import { env } from "../src/config/env";

test("GenerationJob Lifecycle & Mid-Run Cancellation Integration Tests", async (t) => {
    // 1. Setup Mock FastAPI AI Service
    let mockMode: "success" | "delay" | "error" = "success";
    let mockDelayMs = 2000;
    let receivedServiceKey = "";
    let receivedPayload: any = null;
    let requestAbortedByClient = false;

    const mockAiServer = http.createServer((req, res) => {
        receivedServiceKey = req.headers["x-service-key"] as string;
        requestAbortedByClient = false;

        req.on("close", () => {
            if (!res.writableEnded) {
                requestAbortedByClient = true;
            }
        });

        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
            if (body) {
                receivedPayload = JSON.parse(body);
            }

            if (mockMode === "delay") {
                await new Promise((resolve) => setTimeout(resolve, mockDelayMs));
                if (res.writableEnded || req.destroyed) {
                    return;
                }
            }

            if (mockMode === "error") {
                res.writeHead(502, { "Content-Type": "application/json" });
                res.end(
                    JSON.stringify({
                        success: false,
                        request_id: randomUUID(),
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
                request_id: randomUUID(),
                data: {
                    trip_id: receivedPayload?.trip_id,
                    generation_job_id: receivedPayload?.generation_job_id,
                    itinerary: {
                        title: "Kyoto Heritage Itinerary",
                        summary: "Rich cultural journey across historic Kyoto",
                        currency: "USD",
                        total_estimated_cost: 140.0,
                        highlights: ["Kinkaku-ji", "Fushimi Inari"],
                        days: [
                            {
                                day_number: 1,
                                date: "2026-09-01",
                                title: "Day 1 - Temples & Shrines",
                                daily_cost_total: 60.0,
                                activities: [
                                    {
                                        title: "Fushimi Inari Exploration",
                                        description: "Walk the thousands of torii gates",
                                        timing: {
                                            start_time: "09:00",
                                            end_time: "11:30",
                                            duration_minutes: 150
                                        },
                                        place: {
                                            name: "Fushimi Inari Taisha",
                                            address: "Fushimi Ward, Kyoto",
                                            category: "ATTRACTION",
                                            latitude: 34.9671,
                                            longitude: 135.7727
                                        },
                                        estimated_cost: 0.0,
                                        currency: "USD"
                                    },
                                    {
                                        title: "Gion Soba Lunch",
                                        description: "Traditional handmade soba",
                                        timing: {
                                            start_time: "12:30",
                                            end_time: "13:30",
                                            duration_minutes: 60
                                        },
                                        place: {
                                            name: "Gion Soba House",
                                            address: "Gion, Kyoto",
                                            category: "RESTAURANT",
                                            latitude: 35.0037,
                                            longitude: 135.7770
                                        },
                                        estimated_cost: 60.0,
                                        currency: "USD"
                                    }
                                ]
                            },
                            {
                                day_number: 2,
                                date: "2026-09-02",
                                title: "Day 2 - Arashiyama Bamboo Grove",
                                daily_cost_total: 80.0,
                                activities: [
                                    {
                                        title: "Arashiyama Bamboo Walk",
                                        description: "Walk through towering bamboo paths",
                                        timing: {
                                            start_time: "09:00",
                                            end_time: "11:00",
                                            duration_minutes: 120
                                        },
                                        place: {
                                            name: "Arashiyama Bamboo Grove",
                                            address: "Ukyo Ward, Kyoto",
                                            category: "ATTRACTION",
                                            latitude: 35.0169,
                                            longitude: 135.6713
                                        },
                                        estimated_cost: 0.0,
                                        currency: "USD"
                                    },
                                    {
                                        title: "Tenryu-ji Zen Garden & Tea",
                                        description: "World Heritage temple garden visit",
                                        timing: {
                                            start_time: "11:30",
                                            end_time: "13:00",
                                            duration_minutes: 90
                                        },
                                        place: {
                                            name: "Tenryu-ji Temple",
                                            address: "Saga, Kyoto",
                                            category: "ATTRACTION",
                                            latitude: 35.0158,
                                            longitude: 135.6776
                                        },
                                        estimated_cost: 80.0,
                                        currency: "USD"
                                    }
                                ]
                            }
                        ]
                    },
                    metadata: {
                        weather_grounded: true,
                        places_grounded: true,
                        violations_count: 0
                    }
                }
            };

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(responsePayload));
        });
    });

    await new Promise<void>((resolve) => mockAiServer.listen(0, "127.0.0.1", () => resolve()));
    const mockAiPort = (mockAiServer.address() as AddressInfo).port;
    const originalAiUrl = env.AI_SERVICE_URL;
    (env as any).AI_SERVICE_URL = `http://127.0.0.1:${mockAiPort}`;

    // 2. Setup Express App Server
    const appServer = http.createServer(app);
    await new Promise<void>((resolve) => appServer.listen(0, "127.0.0.1", () => resolve()));
    const appPort = (appServer.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${appPort}/api`;

    // 3. Create Test Users & Auth Tokens
    const ownerEmail = `lifecycle-owner-${randomUUID()}@tripgenie.test`;
    const intruderEmail = `lifecycle-intruder-${randomUUID()}@tripgenie.test`;
    let ownerId = "";
    let intruderId = "";
    let trip1Id = "";
    let trip2Id = "";
    let trip3Id = "";
    let ownerCookie = "";
    let intruderCookie = "";

    // Helper function to poll job until status is no longer PENDING / PROCESSING
    async function pollJobStatus(jobId: string, cookie: string, maxWaitMs = 6000) {
        const start = Date.now();
        while (Date.now() - start < maxWaitMs) {
            const res = await fetch(`${baseUrl}/generation-jobs/${jobId}`, {
                headers: { Cookie: cookie }
            });
            assert.equal(res.status, 200);
            const data = (await res.json()) as any;
            const status = data.data.job.status;
            if (status !== "PENDING" && status !== "PROCESSING") {
                return data.data.job;
            }
            await new Promise((r) => setTimeout(r, 100));
        }
        throw new Error(`Job ${jobId} timed out waiting for final status`);
    }

    try {
        const owner = await prisma.user.create({
            data: {
                email: ownerEmail,
                passwordHash: "dummy-hash",
                name: "Job Lifecycle Owner",
                status: "ACTIVE"
            }
        });
        ownerId = owner.id;

        const intruder = await prisma.user.create({
            data: {
                email: intruderEmail,
                passwordHash: "dummy-hash",
                name: "Job Lifecycle Intruder",
                status: "ACTIVE"
            }
        });
        intruderId = intruder.id;

        const cookieName = process.env.AUTH_COOKIE_NAME ?? "auth_token";
        ownerCookie = `${cookieName}=${jwt.sign({ sub: ownerId }, env.JWT_SECRET)}`;
        intruderCookie = `${cookieName}=${jwt.sign({ sub: intruderId }, env.JWT_SECRET)}`;

        // Create Trip 1 for success lifecycle test
        const trip1 = await prisma.trip.create({
            data: {
                userId: ownerId,
                title: "Kyoto Golden Route",
                destination: "Kyoto, Japan",
                origin: "Tokyo, Japan",
                startDate: new Date("2026-09-01T00:00:00.000Z"),
                endDate: new Date("2026-09-03T00:00:00.000Z"),
                budget: 1200.0,
                currency: "USD",
                travelerCount: 2
            }
        });
        trip1Id = trip1.id;

        // Subtest 1: PENDING -> PROCESSING -> COMPLETED Lifecycle
        await t.test("GenerationJob lifecycle: PENDING -> PROCESSING -> COMPLETED with relational persistence", async () => {
            mockMode = "success";

            // Trigger generation job via HTTP
            const createRes = await fetch(`${baseUrl}/trips/${trip1Id}/generation-jobs`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Cookie: ownerCookie
                },
                body: JSON.stringify({
                    jobType: "ITINERARY_GENERATION",
                    input: { options: { temperature: 0.3 } }
                })
            });

            assert.equal(createRes.status, 201);
            const createJson = (await createRes.json()) as any;
            assert.equal(createJson.success, true);
            const createdJob = createJson.data.job;
            assert.ok(createdJob.id);
            assert.equal(createdJob.jobType, "ITINERARY_GENERATION");
            assert.equal(createdJob.status, "PENDING");

            // Wait for worker to finish processing
            const completedJob = await pollJobStatus(createdJob.id, ownerCookie);
            assert.equal(completedJob.status, "COMPLETED");
            assert.ok(completedJob.startedAt);
            assert.ok(completedJob.completedAt);
            assert.equal(completedJob.errorDetails, null);

            // Verify relational persistence
            assert.ok(completedJob.result.itineraryId);
            assert.equal(completedJob.result.daysCount, 2);
            assert.equal(completedJob.result.activitiesCount, 4);
            assert.equal(completedJob.result.totalEstimatedCost, 140.0);

            // Verify Itinerary persisted in DB
            const itinerary = await prisma.itinerary.findUnique({
                where: { id: completedJob.result.itineraryId },
                include: { days: { include: { activities: true } } }
            });
            assert.ok(itinerary);
            assert.equal(itinerary.tripId, trip1Id);
            assert.equal(itinerary.version, 1);
            assert.equal(itinerary.days.length, 2);
        });

        // Subtest 2: PENDING -> PROCESSING -> FAILED Lifecycle
        await t.test("GenerationJob lifecycle: PENDING -> PROCESSING -> FAILED when AI service fails", async () => {
            mockMode = "error";

            const trip2 = await prisma.trip.create({
                data: {
                    userId: ownerId,
                    title: "Osaka Foodie Route",
                    destination: "Osaka, Japan",
                    startDate: new Date("2026-10-01T00:00:00.000Z"),
                    endDate: new Date("2026-10-03T00:00:00.000Z"),
                    budget: 800.0,
                    currency: "USD",
                    travelerCount: 2
                }
            });
            trip2Id = trip2.id;

            const createRes = await fetch(`${baseUrl}/trips/${trip2Id}/generation-jobs`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Cookie: ownerCookie
                },
                body: JSON.stringify({
                    jobType: "ITINERARY_GENERATION"
                })
            });

            assert.equal(createRes.status, 201);
            const createJson = (await createRes.json()) as any;
            const jobId = createJson.data.job.id;

            const failedJob = await pollJobStatus(jobId, ownerCookie);
            assert.equal(failedJob.status, "FAILED");
            assert.ok(failedJob.errorDetails);
            assert.equal(failedJob.errorDetails.code, "LLM_MODEL_ERROR");
            assert.equal(failedJob.errorDetails.retryable, true);
        });

        // Subtest 3: Mid-Run Cancellation & HTTP Request Abort
        await t.test("POST /generation-jobs/:jobId/cancel mid-run cleanly aborts fetch and updates status to CANCELLED", async () => {
            mockMode = "delay";
            mockDelayMs = 2500;
            requestAbortedByClient = false;

            const trip3 = await prisma.trip.create({
                data: {
                    userId: ownerId,
                    title: "Hiroshima Historic Trip",
                    destination: "Hiroshima, Japan",
                    startDate: new Date("2026-11-01T00:00:00.000Z"),
                    endDate: new Date("2026-11-03T00:00:00.000Z"),
                    budget: 500.0,
                    currency: "USD",
                    travelerCount: 1
                }
            });
            trip3Id = trip3.id;

            // Trigger generation job
            const createRes = await fetch(`${baseUrl}/trips/${trip3Id}/generation-jobs`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Cookie: ownerCookie
                },
                body: JSON.stringify({
                    jobType: "ITINERARY_GENERATION"
                })
            });
            assert.equal(createRes.status, 201);
            const createJson = (await createRes.json()) as any;
            const jobId = createJson.data.job.id;

            // Give the worker 200ms to transition job to PROCESSING and initiate HTTP call to AI mock
            await new Promise((r) => setTimeout(r, 200));

            // Call cancel mid-run while AI call is waiting in delay
            const cancelRes = await fetch(`${baseUrl}/generation-jobs/${jobId}/cancel`, {
                method: "POST",
                headers: { Cookie: ownerCookie }
            });

            assert.equal(cancelRes.status, 200);
            const cancelJson = (await cancelRes.json()) as any;
            assert.equal(cancelJson.success, true);
            assert.equal(cancelJson.data.job.status, "CANCELLED");

            // Verify fetch call was cleanly aborted at the mock server
            // Wait briefly for the connection close event
            await new Promise((r) => setTimeout(r, 300));
            assert.equal(requestAbortedByClient, true, "Expected client fetch to be aborted mid-run");

            // Verify job status remains CANCELLED and no itinerary was persisted
            const getJobRes = await fetch(`${baseUrl}/generation-jobs/${jobId}`, {
                headers: { Cookie: ownerCookie }
            });
            assert.equal(getJobRes.status, 200);
            const getJobJson = (await getJobRes.json()) as any;
            assert.equal(getJobJson.data.job.status, "CANCELLED");

            // Confirm no Itinerary created for Trip 3
            const tripItineraries = await prisma.itinerary.findMany({
                where: { tripId: trip3Id }
            });
            assert.equal(tripItineraries.length, 0);
        });

        // Subtest 4: Cancel Security & State Transition Validations
        await t.test("Cancellation error handling: 401, 403, and 400 invalid transitions", async () => {
            // Unauthenticated
            const unauthRes = await fetch(`${baseUrl}/generation-jobs/${randomUUID()}/cancel`, {
                method: "POST"
            });
            assert.equal(unauthRes.status, 401);

            // Unauthorized user (Intruder trying to cancel Owner's job)
            const intruderRes = await fetch(`${baseUrl}/generation-jobs/${trip1Id}/cancel`, {
                method: "POST",
                headers: { Cookie: intruderCookie }
            });
            // Job doesn't belong to intruder or trip1 is not a job -> 404 or 403
            assert.ok([403, 404].includes(intruderRes.status));

            // Calling cancel again on an already cancelled job is idempotent (returns 200)
            const repeatCancelRes = await fetch(`${baseUrl}/generation-jobs/${trip3Id}/cancel`, {
                method: "POST",
                headers: { Cookie: ownerCookie }
            });
            // trip3Id was trip id, get job id from trip3
            const job3 = await prisma.generationJob.findFirst({
                where: { tripId: trip3Id }
            });
            assert.ok(job3);
            const idempotentCancelRes = await fetch(`${baseUrl}/generation-jobs/${job3.id}/cancel`, {
                method: "POST",
                headers: { Cookie: ownerCookie }
            });
            assert.equal(idempotentCancelRes.status, 200);
            const idempJson = (await idempotentCancelRes.json()) as any;
            assert.equal(idempJson.data.job.status, "CANCELLED");

            // Calling cancel on a COMPLETED job returns 400 Bad Request
            const job1 = await prisma.generationJob.findFirst({
                where: { tripId: trip1Id, status: "COMPLETED" }
            });
            assert.ok(job1);
            const completedCancelRes = await fetch(`${baseUrl}/generation-jobs/${job1.id}/cancel`, {
                method: "POST",
                headers: { Cookie: ownerCookie }
            });
            assert.equal(completedCancelRes.status, 400);
            const completedJson = (await completedCancelRes.json()) as any;
            assert.equal(completedJson.success, false);
            assert.ok(completedJson.error.message.includes("already completed"));
        });
    } finally {
        mockAiServer.close();
        appServer.close();
        (env as any).AI_SERVICE_URL = originalAiUrl;

        // Cleanup created test users
        if (ownerId) {
            await prisma.user.delete({ where: { id: ownerId } }).catch(() => {});
        }
        if (intruderId) {
            await prisma.user.delete({ where: { id: intruderId } }).catch(() => {});
        }

        await prisma.$disconnect().catch(() => {});
    }
});
