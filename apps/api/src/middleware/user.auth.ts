import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db/prisma";
import jwt from "jsonwebtoken";

const authCookieName = process.env.AUTH_COOKIE_NAME ?? "auth_token";

function getCookieValue(cookieHeader: string | undefined, name: string) {
    const cookie = cookieHeader
        ?.split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`));

    if (!cookie) {
        return undefined;
    }

    return decodeURIComponent(cookie.slice(name.length + 1));
}

export const userAuthMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const token = getCookieValue(req.headers.cookie, authCookieName);

    if (!token) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        return res.status(500).json({
            success: false,
            error: { message: "Authentication is not configured" }
        });
    }

    try {
        const payload = jwt.verify(token, secret);
        if (typeof payload === "string") {
            return res.status(401).json({
                success: false,
                error: { message: "Invalid authentication token" }
            });
        }

        const userId = typeof payload.sub === "string"
            ? payload.sub
            : typeof payload.userId === "string"
                ? payload.userId
                : undefined;

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: { message: "Invalid authentication token" }
            });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                status: true,
                createdAt: true
            }
        });

        if (!user || user.status !== "ACTIVE") {
            return res.status(401).json({
                success: false,
                error: { message: "User is not authorized" }
            });
        }

        req.user = user;
        return next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({
                success: false,
                error: { message: "Authentication token has expired" }
            });
        }

        return res.status(401).json({
            success: false,
            error: { message: "Invalid authentication token" }
        });
    }
};