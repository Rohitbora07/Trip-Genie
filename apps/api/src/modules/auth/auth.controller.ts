import type { Request, Response } from "express"
import jwt from "jsonwebtoken"
import {
    registerSchema, 
    loginSchema, 
    sendVerificationTokenSchema, 
    verifyEmailSchema,
    sendPasswordResetTokenSchema,
    resetPasswordSchema
} from "./auth.validation"
import {
    registerUser, 
    loginUser, 
    getUserById, 
    sendVerificationToken, 
    verifyEmail,
    sendPasswordResetToken,
    resetPassword
} from "./auth.service"
import {sendEmail} from "../../integrations/email/email.service"
import {welcomeEmail} from "../../integrations/email/templates/welcome"

const authCookieName = process.env.AUTH_COOKIE_NAME ?? "auth_token"
type UserIdParams = { userId: string }

export async function registerController( req: Request, res: Response ){
    const validation = registerSchema.safeParse(req.body)

    if( !validation.success ){
        return res.status(400).json({
            success: false,
            error:{
                message: "Invalid registration data",
                details: validation.error.issues
            }
        })
    }
    const emailContent = welcomeEmail(validation.data.name)
    try {
        const user = await registerUser(validation.data)
        
        const secret = process.env.JWT_SECRET

        if (!secret) {
            return res.status(500).json({
                success: false,
                error: { message: "Authentication is not configured" }
            })
        }

        const token = jwt.sign({sub: user.id}, secret, {expiresIn: "7d"})
        res.cookie(authCookieName, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        })

        await sendEmail({
            to: validation.data.email,
            ...emailContent
        })

        return res.status(201).json({
            success: true,
            data: {user}
        })
    } catch (error) {
        console.log(error)
        if( error instanceof Error && error.name === "DuplicateEmailError" ){
            return res.status(409).json({
            success: false,
            error: { message: error.message }
        })
        }
        return res.status(500).json({ 
            success: false,
            error: { message: "Internal server error" }
        });
    }
}


export async function loginUserController( req: Request, res: Response ){
    const validation = loginSchema.safeParse(req.body)

    if( !validation.success ){
        return res.status(400).json({
            success: false,
            error:{
                message: "Invalid login data",
                details: validation.error.issues
            }
        })
    }
    try {
        const user = await loginUser(validation.data)
        const secret = process.env.JWT_SECRET

        if (!secret) {
            return res.status(500).json({
                success: false,
                error: { message: "Authentication is not configured" }
            })
        }

        const token = jwt.sign({sub: user.id}, secret, {expiresIn: "7d"})
        res.cookie(authCookieName, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        })

        return res.status(201).json({
            success: true,
            data: {user}
        })
    } catch (error) {
        if( error instanceof Error && error.name === "InvalidPasswordError" ){
            return res.status(401).json({
            success: false,
            error: { message: error.message }
        })
        }else if( error instanceof Error && error.name === "UserNotFoundError" ){
            return res.status(401).json({
            success: false,
            error: { message: error.message }
        })
        }
        return res.status(500).json({ 
            success: false,
            error: { message: "Internal server error" }
        });
    }
}

export async function getUserByIdController( req: Request<UserIdParams>, res: Response ){
    const userId = req.params.userId
    try {
        const user = await getUserById(userId)

        if (!user) {
            return res.status(404).json({
                success: false,
                error: { message: "User not found" }
            })
        }

        return res.status(200).json({
            success: true,
            data: { user }
        })
    } catch (error) {
        return res.status(500).json({ 
            success: false,
            error: { message: "Internal server error" }
        });
    }
}

export async function sendVerificationTokenController( req: Request, res: Response ){
    const validation = sendVerificationTokenSchema.safeParse(req.body)

    if( !validation.success ){
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid verification token request",
                details: validation.error.issues
            }
        })
    }

    try {
        await sendVerificationToken(validation.data.identifier)

        return res.status(200).json({
            success: true,
            data: { message: "Verification token sent successfully" }
        })
    } catch (error) {
        console.log(error)
        if( error instanceof Error && error.name === "UserNotFoundError" ){
            return res.status(404).json({
                success: false,
                error: { message: error.message }
            })
        } else if( error instanceof Error && error.name === "EmailAlreadyVerifiedError" ){
            return res.status(400).json({
                success: false,
                error: { message: error.message }
            })
        }

        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" }
        })
    }
}

export async function verifyEmailController( req: Request, res: Response ){
    const validation = verifyEmailSchema.safeParse(req.body)

    if( !validation.success ){
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid verification data",
                details: validation.error.issues
            }
        })
    }

    try {
        const user = await verifyEmail(validation.data.token)

        return res.status(200).json({
            success: true,
            data: {
                message: "Email verified successfully",
                user
            }
        })
    } catch (error) {
        console.log(error)
        if( error instanceof Error && (error.name === "InvalidTokenError" || error.name === "TokenExpiredError") ){
            return res.status(400).json({
                success: false,
                error: { message: error.message }
            })
        }

        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" }
        })
    }
}

export async function sendPasswordResetTokenController( req: Request, res: Response ){
    const validation = sendPasswordResetTokenSchema.safeParse(req.body)

    if( !validation.success ){
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid password reset request",
                details: validation.error.issues
            }
        })
    }

    try {
        await sendPasswordResetToken(validation.data.email)

        return res.status(200).json({
            success: true,
            data: { message: "Password reset code sent successfully" }
        })
    } catch (error) {
        console.log(error)
        if( error instanceof Error && error.name === "UserNotFoundError" ){
            return res.status(404).json({
                success: false,
                error: { message: error.message }
            })
        }

        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" }
        })
    }
}

export async function resetPasswordController( req: Request, res: Response ){
    const validation = resetPasswordSchema.safeParse(req.body)

    if( !validation.success ){
        return res.status(400).json({
            success: false,
            error: {
                message: "Invalid password reset data",
                details: validation.error.issues
            }
        })
    }

    try {
        await resetPassword(validation.data)

        return res.status(200).json({
            success: true,
            data: { message: "Password updated successfully" }
        })
    } catch (error) {
        console.log(error)
        if( error instanceof Error && (error.name === "InvalidTokenError" || error.name === "TokenExpiredError") ){
            return res.status(400).json({
                success: false,
                error: { message: error.message }
            })
        }

        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" }
        })
    }
}

export async function logoutUserController( _req: Request, res: Response ){
    res.clearCookie(authCookieName, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax"
    })

    return res.status(200).json({
        success: true,
        data: { message: "Logged out successfully" }
    })
}
