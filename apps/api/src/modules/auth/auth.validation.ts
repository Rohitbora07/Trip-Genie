import {z} from "zod"

export const registerSchema = z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().transform((value) => value.toLowerCase()),
    password: z.string().min(8).max(72)
})

export const loginSchema = z.object({
    email: z.string().trim().email().transform((value) => value.toLowerCase()),
    password: z.string().min(8).max(72)
})

export const sendVerificationTokenSchema = z.object({
    identifier: z.string().trim().min(1).optional(),
    email: z.string().trim().email().transform((value) => value.toLowerCase()).optional(),
    userId: z.string().trim().min(1).optional()
}).transform((data) => ({
    identifier: (data.identifier || data.email || data.userId || "").trim()
})).refine((data) => data.identifier.length > 0, {
    message: "Identifier (email or userId) is required"
})

export const verifyEmailSchema = z.object({
    token: z.string().trim().min(1, "Verification token is required")
})

export const sendPasswordResetTokenSchema = z.object({
    email: z.string().trim().email().transform((value) => value.toLowerCase())
})

export const resetPasswordSchema = z.object({
    token: z.string().trim().min(6).max(6),
    newPassword: z.string().min(8).max(72)
})
