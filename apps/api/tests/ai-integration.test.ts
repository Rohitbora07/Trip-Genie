import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";

import {
    mapAiItineraryToPersistenceData,
    mapTripToGenerateItineraryRequest
} from "../src/integrations/ai/ai.mapper";
import { AiServiceError, generateItineraryFromAi } from "../src/integrations/ai/ai.client";
import type { GenerateItineraryResponse } from "../src/integrations/ai/ai.types";

test("mapTripToGenerateItineraryRequest converts camelCase/Date/Decimal to FastAPI snake_case", () => {
    const request = mapTripToGenerateItineraryRequest({
        requestId: "req-123",
        generationJobId: "job-456",
        trip: {
            id: "trip-789",
            title: "Tokyo Adventure",
            origin: "San Francisco",
            destination: "Tokyo",
            startDate: new Date("2026-06-01T00:00:00.000Z"),
            endDate: new Date("2026-06-03T00:00:00.000Z"),
            budget: { toNumber: () => 2500.5 },
            currency: "usd",
            travelerCount: 2,
            preferences: {
                pace: "moderate",
                interests: ["food", "temples"],
                accommodationStyle: "boutique",
                transportPreference: "rail",
                constraints: {
                    dietary: ["vegetarian"]
                }
            }
        },
        jobInput: {
            additionalInstructions: "Avoid crowded tourist traps",
            constraints: {
                accessibility: ["step-free"]
            },
            options: {
                temperature: 0.3,
                maxTokens: 2048
            }
        }
    });

    assert.equal(request.request_id, "req-123");
    assert.equal(request.trip_id, "trip-789");
    assert.equal(request.generation_job_id, "job-456");
    assert.deepEqual(request.trip, {
        destination: "Tokyo",
        origin: "San Francisco",
        start_date: "2026-06-01",
        end_date: "2026-06-03",
        traveler_count: 2,
        budget: 2500.5,
        currency: "USD",
        preferences: {
            pace: "moderate",
            interests: ["food", "temples"],
            accommodation_style: "boutique",
            transport_preference: "rail"
        },
        constraints: {
            dietary: ["vegetarian"],
            accessibility: ["step-free"]
        },
        additional_instructions: "Avoid crowded tourist traps"
    });
    assert.deepEqual(request.options, {
        temperature: 0.3,
        max_tokens: 2048
    });
});

test("mapAiItineraryToPersistenceData resolves day dates and converts HH:MM to UTC DateTime", () => {
    const mapped = mapAiItineraryToPersistenceData({
        tripStartDate: new Date("2026-06-01T00:00:00.000Z"),
        itinerary: {
            title: "3 Days in Tokyo",
            summary: "Culture and food tour",
            currency: "USD",
            total_estimated_cost: 120,
            highlights: ["Senso-ji"],
            days: [
                {
                    day_number: 1,
                    date: null,
                    title: "Asakusa Morning",
                    summary: "Historic temples",
                    daily_cost_total: 40,
                    activities: [
                        {
                            title: "Visit Senso-ji",
                            description: "Explore Tokyo's oldest temple",
                            timing: {
                                start_time: "09:30",
                                end_time: "11:15",
                                duration_minutes: 105
                            },
                            place: {
                                name: "Senso-ji Temple",
                                address: "2-3-1 Asakusa, Taito-ku",
                                category: "ATTRACTION",
                                latitude: 35.7148,
                                longitude: 139.7967
                            },
                            estimated_cost: 40,
                            currency: "usd",
                            notes: "Go early"
                        }
                    ]
                },
                {
                    day_number: 2,
                    date: "2026-06-02",
                    title: "Shibuya",
                    summary: null,
                    daily_cost_total: 80,
                    activities: [
                        {
                            title: "Meiji Shrine",
                            description: "Morning walk",
                            timing: {
                                start_time: "10:00",
                                end_time: "12:00",
                                duration_minutes: 120
                            },
                            place: {
                                name: "Meiji Jingu",
                                address: null,
                                category: "ATTRACTION",
                                latitude: null,
                                longitude: null
                            },
                            estimated_cost: 80,
                            currency: "USD",
                            notes: null
                        }
                    ]
                }
            ]
        }
    });

    assert.equal(mapped.days.length, 2);
    assert.equal(mapped.days[0].date.toISOString(), "2026-06-01T00:00:00.000Z");
    assert.equal(
        mapped.days[0].activities[0].startTime?.toISOString(),
        "2026-06-01T09:30:00.000Z"
    );
    assert.equal(
        mapped.days[0].activities[0].endTime?.toISOString(),
        "2026-06-01T11:15:00.000Z"
    );
    assert.equal(mapped.days[0].activities[0].sortOrder, 1);
    assert.deepEqual(mapped.days[0].activities[0].metadata, {
        notes: "Go early",
        aiGenerated: true
    });
    assert.equal(mapped.days[1].date.toISOString(), "2026-06-02T00:00:00.000Z");
});

test("generateItineraryFromAi sends X-Service-Key and parses success and ErrorEnvelope responses", async () => {
    let seenServiceKey: string | string[] | undefined;
    let mode: "success" | "error" | "slow" = "success";

    const server = http.createServer((req, res) => {
        seenServiceKey = req.headers["x-service-key"];
        if (mode === "slow") {
            setTimeout(() => {
                if (!res.writableEnded) {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end("{}");
                }
            }, 300);
            return;
        }

        if (mode === "error") {
            res.writeHead(429, { "Content-Type": "application/json" });
            res.end(
                JSON.stringify({
                    success: false,
                    request_id: "req-err-1",
                    error: {
                        code: "LLM_RATE_LIMIT",
                        message: "Rate limit exceeded",
                        retryable: true,
                        details: null
                    }
                })
            );
            return;
        }

        const responsePayload: GenerateItineraryResponse = {
            success: true,
            request_id: "req-ok-1",
            data: {
                trip_id: "trip-1",
                generation_job_id: "job-1",
                itinerary: {
                    title: "Tokyo",
                    summary: "Summary",
                    currency: "USD",
                    total_estimated_cost: 50,
                    highlights: [],
                    days: [
                        {
                            day_number: 1,
                            date: "2026-06-01",
                            title: "Day 1",
                            summary: null,
                            daily_cost_total: 50,
                            activities: [
                                {
                                    title: "Activity",
                                    description: "Desc",
                                    timing: {
                                        start_time: "09:00",
                                        end_time: "10:00",
                                        duration_minutes: 60
                                    },
                                    place: {
                                        name: "Place",
                                        address: null,
                                        category: "ATTRACTION",
                                        latitude: null,
                                        longitude: null
                                    },
                                    estimated_cost: 50,
                                    currency: "USD",
                                    notes: null
                                }
                            ]
                        }
                    ]
                },
                metadata: {
                    model: "llama-3.3-70b-versatile",
                    latency_ms: 120.5,
                    usage: { input_tokens: 100, output_tokens: 200, total_tokens: 300 }
                }
            }
        };

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(responsePayload));
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const { port } = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${port}`;

    const samplePayload = mapTripToGenerateItineraryRequest({
        requestId: "req-1",
        generationJobId: "job-1",
        trip: {
            id: "trip-1",
            title: "Tokyo",
            destination: "Tokyo",
            startDate: new Date("2026-06-01T00:00:00.000Z"),
            endDate: new Date("2026-06-01T00:00:00.000Z"),
            currency: "USD",
            travelerCount: 1
        },
        jobInput: {}
    });

    try {
        // 1. Success case
        mode = "success";
        const okRes = await generateItineraryFromAi(samplePayload, {
            baseUrl,
            apiKey: "secret-key",
            timeoutMs: 2000
        });
        assert.equal(seenServiceKey, "secret-key");
        assert.equal(okRes.data.itinerary.title, "Tokyo");

        // 2. FastAPI ErrorEnvelope case
        mode = "error";
        await assert.rejects(
            () =>
                generateItineraryFromAi(samplePayload, {
                    baseUrl,
                    apiKey: "secret-key",
                    timeoutMs: 2000
                }),
            (err: unknown) => {
                assert.ok(err instanceof AiServiceError);
                assert.equal(err.code, "LLM_RATE_LIMIT");
                assert.equal(err.retryable, true);
                assert.equal(err.httpStatus, 429);
                return true;
            }
        );

        // 3. AbortController timeout case
        mode = "slow";
        await assert.rejects(
            () =>
                generateItineraryFromAi(samplePayload, {
                    baseUrl,
                    apiKey: "secret-key",
                    timeoutMs: 50
                }),
            (err: unknown) => {
                assert.ok(err instanceof AiServiceError);
                assert.equal(err.code, "AI_SERVICE_TIMEOUT");
                assert.equal(err.retryable, true);
                return true;
            }
        );

        // 4. External cancellation signal case
        mode = "slow";
        const cancelController = new AbortController();
        setTimeout(() => cancelController.abort(), 30);
        await assert.rejects(
            () =>
                generateItineraryFromAi(samplePayload, {
                    baseUrl,
                    apiKey: "secret-key",
                    timeoutMs: 2000,
                    signal: cancelController.signal
                }),
            (err: unknown) => {
                assert.ok(err instanceof AiServiceError);
                assert.equal(err.code, "JOB_CANCELLED");
                assert.equal(err.retryable, false);
                return true;
            }
        );
    } finally {
        server.close();
    }
});
