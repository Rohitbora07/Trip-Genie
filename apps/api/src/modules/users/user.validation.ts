import { z } from "zod";

export const updateProfileSchema = z.object({
    name: z.string().trim().min(2).max(100).optional(),
    avatarUrl: z.string().url().max(2048).nullable().optional(),
    phoneNumber: z.string().trim().min(7).max(20).nullable().optional()
}).strict().refine(
    (data) => Object.keys(data).length > 0,
    { message: "Provide at least one field to update" }
);

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(72)
}).strict().refine(
    (data) => data.currentPassword !== data.newPassword,
    { message: "New password must differ from current password" }
);

export const forgotPasswordSchema = z.object({
    email: z.string().email(),
    resetPasswordToken: z.string().min(6).max(6),
    newPassword: z.string().min(8).max(72)
})