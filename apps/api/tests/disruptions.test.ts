import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";

import app from "../src/app";
import { prisma } from "../src/db/prisma";
import { env } from "../src/config/env";

test("Trip Disruptions API - POST & GET /api/trips/:tripId/disruptions", async (t) => {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}/api/trips`;

    const ownerEmail = `disrupt-owner-${randomUUID()}@tripgenie.test`;
    const intruderEmail = `disrupt-intruder-${randomUUID()}@tripgenie.test`;

    let ownerId = "";
    let intruderId = "";
    let tripId = "";
    let ownerCookie = "";
    let intruderCookie = "";
    let recordedDisruptionId = "";

    try {
        const owner = await prisma.user.create({
            data: {
                email: ownerEmail,
                passwordHash: "dummy-hash",
                name: "Disruption Owner",
                status: "ACTIVE"
            }
        });
        ownerId = owner.id;

        const intruder = await prisma.user.create({
            data: {
                email: intruderEmail,
                passwordHash: "dummy-hash",
                name: "Disruption Intruder",
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
                title: "Alpine Explorer Trip",
                destination: "Zurich, Switzerland",
                startDate: new Date("2026-12-01T00:00:00.000Z"),
                endDate: new Date("2026-12-05T00:00:00.000Z"),
                budget: 2000.0,
                currency: "USD",
                travelerCount: 2
            }
        });
        tripId = trip.id;

        // Subtest 1: 401 when unauthenticated
        await t.test("rejects unauthenticated requests with 401", async () => {
            const res = await fetch(`${baseUrl}/${tripId}/disruptions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "FLIGHT_DELAY",
                    description: "Flight LX18 delayed by 180 minutes"
                })
            });
            assert.equal(res.status, 401);
        });

        // Subtest 2: 400 when invalid payload
        await t.test("rejects invalid disruption type with 400 Bad Request", async () => {
            const res = await fetch(`${baseUrl}/${tripId}/disruptions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Cookie: ownerCookie
                },
                body: JSON.stringify({
                    type: "INVALID_DISRUPTION_TYPE",
                    description: "Something happened"
                })
            });
            assert.equal(res.status, 400);
            const json = (await res.json()) as any;
            assert.equal(json.success, false);
        });

        // Subtest 3: 403 when user does not own the trip
        await t.test("rejects unauthorized user with 403 Forbidden", async () => {
            const res = await fetch(`${baseUrl}/${tripId}/disruptions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Cookie: intruderCookie
                },
                body: JSON.stringify({
                    type: "FLIGHT_DELAY",
                    description: "Flight delay reported by unauthorized user"
                })
            });
            assert.equal(res.status, 403);
            const json = (await res.json()) as any;
            assert.equal(json.success, false);
            assert.ok(json.error.message.includes("not authorized"));
        });

        // Subtest 4: 201 Created on valid disruption event report
        await t.test("creates DisruptionEvent and automatically queues DISRUPTION_RECOVERY job", async () => {
            const res = await fetch(`${baseUrl}/${tripId}/disruptions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Cookie: ownerCookie
                },
                body: JSON.stringify({
                    type: "FLIGHT_DELAY",
                    severity: "HIGH",
                    description: "Inbound flight Swiss LX18 delayed by 180 mins due to mechanical issues",
                    details: {
                        flight_number: "LX18",
                        delay_minutes: 180,
                        affected_date: "2026-12-01"
                    }
                })
            });

            assert.equal(res.status, 201);
            const json = (await res.json()) as any;
            assert.equal(json.success, true);

            const disruption = json.data.disruption;
            assert.ok(disruption.id);
            assert.equal(disruption.tripId, tripId);
            assert.equal(disruption.type, "FLIGHT_DELAY");
            assert.equal(disruption.severity, "HIGH");
            assert.equal(disruption.resolved, false);
            assert.equal(disruption.details.delay_minutes, 180);
            recordedDisruptionId = disruption.id;

            const job = json.data.generationJob;
            assert.ok(job.id);
            assert.equal(job.tripId, tripId);
            assert.equal(job.jobType, "DISRUPTION_RECOVERY");
            assert.equal(job.status, "PENDING");
            assert.equal(job.input.disruptionEventId, disruption.id);

            // Verify AuditLog was recorded
            const auditLogs = await prisma.auditLog.findMany({
                where: { tripId, action: "DISRUPTION_REPORTED" }
            });
            assert.ok(auditLogs.length >= 1);
            assert.equal(auditLogs[0].actorType, "USER");
            assert.equal((auditLogs[0].metadata as any).disruptionEventId, disruption.id);
        });

        // Subtest 5: GET /api/trips/:tripId/disruptions lists disruptions and proposals
        await t.test("GET /api/trips/:tripId/disruptions returns list of disruptions for owner", async () => {
            const res = await fetch(`${baseUrl}/${tripId}/disruptions`, {
                headers: { Cookie: ownerCookie }
            });

            assert.equal(res.status, 200);
            const json = (await res.json()) as any;
            assert.equal(json.success, true);
            assert.ok(Array.isArray(json.data.disruptions));
            assert.ok(json.data.disruptions.length >= 1);

            const found = json.data.disruptions.find((d: any) => d.id === recordedDisruptionId);
            assert.ok(found);
            assert.equal(found.type, "FLIGHT_DELAY");
            assert.ok(Array.isArray(found.proposals));
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
