import crypto from "crypto";
import bcrypt from "bcrypt";
import {prisma} from "../../db/prisma"
import {sendEmail} from "../../integrations/email/email.service"
import {verificationOtpTemplate} from "../../integrations/email/templates/verify-email"
import {emailVerifiedTemplate} from "../../integrations/email/templates/email-verified"
import {passwordResetTemplate} from "../../integrations/email/templates/password-reset"
import {passwordChangedTemplate} from "../../integrations/email/templates/password-changed"

type RegisterInput = {
    name: string;
    email: string;
    password: string;
}

type LoginInput = {
    email: string;
    password: string;
}

type ResetPasswordInput = {
    token: string;
    newPassword: string;
}

export async function registerUser( input: RegisterInput ){
    const existingUser = await prisma.user.findUnique({
        where: {email: input.email}
    })
    if( existingUser ){
        const error = new Error("Email is already registered")
        error.name = "DuplicateEmailError"
        throw error
    }
    const passHash = await bcrypt.hash(input.password, 12)
    
    return prisma.user.create({
        data:{
            name: input.name,
            email: input.email,
            passwordHash: passHash
        },
        select: {
            id: true,
            name: true,
            email: true,
            createdAt: true
        }
    })
}
export async function loginUser( input: LoginInput ){
    const existingUser = await prisma.user.findUnique({
        where: {email: input.email}
    })
    if( !existingUser ){
        const error = new Error("User not found")
        error.name = "UserNotFoundError"
        throw error
    }
    const isPassValid = await bcrypt.compare(input.password, existingUser.passwordHash)
    if( !isPassValid ){
        const error = new Error("Invalid password")
        error.name = "InvalidPasswordError"
        throw error
    }

    return prisma.user.findUnique({
        where: {email: input.email},
        select: {
            id: true,
            name: true,
            email: true,
            createdAt: true
        }
    })
}

export async function getUserById( userId: string ){
    return prisma.user.findUnique({
        where: {id: userId},
        select: {
            id: true,
            name: true,
            email: true,
            createdAt: true
        }
    })
}

export async function sendVerificationToken( identifier: string ){
    const where = identifier.includes("@")
        ? { email: identifier.trim().toLowerCase() }
        : { id: identifier.trim() };

    const user = await prisma.user.findUnique({
        where,
        select: {
            id: true,
            email: true,
            name: true,
            isEmailVerified: true
        }
    })

    if( !user ){
        const error = new Error("User not found")
        error.name = "UserNotFoundError"
        throw error
    }

    if( user.isEmailVerified ){
        const error = new Error("Email is already verified")
        error.name = "EmailAlreadyVerifiedError"
        throw error
    }

    // Generate a secure 6-digit numeric verification token
    let token = crypto.randomInt(100000, 1000000).toString()
    let existingTokenUser = await prisma.user.findUnique({
        where: { verificationToken: token }
    })
    while( existingTokenUser ){
        token = crypto.randomInt(100000, 1000000).toString()
        existingTokenUser = await prisma.user.findUnique({
            where: { verificationToken: token }
        })
    }

    // Valid for 10 minutes (matches the email template text)
    const verificationTokenExpiry = new Date(Date.now() + 10 * 60 * 1000)
    await prisma.user.update({
        where: {id: user.id},
        data: {
            verificationToken: token,
            verificationTokenExpiry
        }
    })
    const emailContent = verificationOtpTemplate(user.name ?? "Traveler", token)
    return sendEmail({
        to: user.email,
        ...emailContent
    })
}

export async function verifyEmail( token: string ){
    const user = await prisma.user.findUnique({
        where: { verificationToken: token },
        select: {
            id: true,
            email: true,
            name: true,
            isEmailVerified: true,
            verificationTokenExpiry: true
        }
    })

    if( !user ){
        const error = new Error("Invalid verification token")
        error.name = "InvalidTokenError"
        throw error
    }

    if( user.verificationTokenExpiry && user.verificationTokenExpiry < new Date() ){
        const error = new Error("Verification token has expired")
        error.name = "TokenExpiredError"
        throw error
    }

    const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
            isEmailVerified: true,
            emailVerifiedAt: new Date(),
            verificationToken: null,
            verificationTokenExpiry: null,
            status: "ACTIVE"
        },
        select: {
            id: true,
            name: true,
            email: true,
            isEmailVerified: true,
            status: true
        }
    })

    const emailContent = emailVerifiedTemplate(user.name ?? "Traveler")
    await sendEmail({
        to: user.email,
        ...emailContent
    })

    return updatedUser
}

export async function sendPasswordResetToken( email: string ){
    const normalizedEmail = email.toLowerCase().trim()
    const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: {
            id: true,
            email: true,
            name: true
        }
    })

    if( !user ){
        const error = new Error("User not found")
        error.name = "UserNotFoundError"
        throw error
    }

    // Generate a secure 6-digit numeric reset token
    let token = crypto.randomInt(100000, 1000000).toString()
    let existingTokenUser = await prisma.user.findUnique({
        where: { resetPasswordToken: token }
    })
    while( existingTokenUser ){
        token = crypto.randomInt(100000, 1000000).toString()
        existingTokenUser = await prisma.user.findUnique({
            where: { resetPasswordToken: token }
        })
    }

    // Valid for 10 minutes
    const resetPasswordTokenExpiry = new Date(Date.now() + 10 * 60 * 1000)
    await prisma.user.update({
        where: { id: user.id },
        data: {
            resetPasswordToken: token,
            resetPasswordTokenExpiry
        }
    })

    const emailContent = passwordResetTemplate(user.name ?? "Traveler", token)
    return sendEmail({
        to: user.email,
        ...emailContent
    })
}

export async function resetPassword( input: ResetPasswordInput ){
    const token = input.token.trim()

    const user = await prisma.user.findUnique({
        where: { resetPasswordToken: token },
        select: {
            id: true,
            email: true,
            name: true,
            resetPasswordTokenExpiry: true
        }
    })

    if( !user ){
        const error = new Error("Invalid password reset token")
        error.name = "InvalidTokenError"
        throw error
    }

    if( user.resetPasswordTokenExpiry && user.resetPasswordTokenExpiry < new Date() ){
        const error = new Error("Password reset token has expired")
        error.name = "TokenExpiredError"
        throw error
    }

    const passHash = await bcrypt.hash(input.newPassword, 12)

    await prisma.user.update({
        where: { id: user.id },
        data: {
            passwordHash: passHash,
            resetPasswordToken: null,
            resetPasswordTokenExpiry: null
        }
    })

    const emailContent = passwordChangedTemplate(user.name ?? "Traveler")
    await sendEmail({
        to: user.email,
        ...emailContent
    })

    return { success: true }
}
