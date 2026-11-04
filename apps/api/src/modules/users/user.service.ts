import { prisma } from "../../db/prisma";

type UpdateProfileInput = {
    name?: string;
    avatarUrl?: string | null;
    phoneNumber?: string | null;
};

export async function getUserById(userId: string) {
    return prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            phoneNumber: true,
            isEmailVerified: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            lastLoginAt: true
        }
    });
}



export async function updateUserProfile(
    userId: string,
    input: UpdateProfileInput
) {
    return prisma.user.update({
        where: { id: userId },
        data: input,
        select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            phoneNumber: true,
            isEmailVerified: true,
            createdAt: true,
            updatedAt: true
        }
    });
}