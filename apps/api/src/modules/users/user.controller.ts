import type { Request, Response } from "express";
import {updateProfileSchema} from "./user.validation";
import {getUserById,updateUserProfile} from "./user.service";

export async function getMeController(req: Request,res: Response) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        });
    }

    const user = await getUserById(req.user.id);

    if (!user) {
        return res.status(404).json({
            success: false,
            error: { message: "User not found" }
        });
    }

    return res.status(200).json({
        success: true,
        data: { user }
    });
}

export async function updateProfileController(req: Request,res: Response) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: "Authentication required" }
        });
    }

    const validation = updateProfileSchema.safeParse(req.body);

    if (!validation.success) {
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid profile data",
                details: validation.error.issues
            }
        });
    }

    try {
        const user = await updateUserProfile(
            req.user.id,
            validation.data
        );

        return res.status(200).json({
            success: true,
            data: { user }
        });
    } catch {
        return res.status(500).json({
            success: false,
            error: { message: "Unable to update profile" }
        });
    }
}