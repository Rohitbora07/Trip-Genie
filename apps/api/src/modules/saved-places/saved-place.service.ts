import { prisma } from "../../db/prisma";
import { findOrCreatePlace } from "../places/places.service";

type SavePlaceInput = {
    placeId?: string;
    place?: {
        name: string;
        address?: string;
        latitude?: number;
        longitude?: number;
        category?: string;
        provider?: string;
        providerPlaceId?: string;
        metadata?: Record<string, any>;
    };
    name?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    placeCategory?: string;
    provider?: string;
    providerPlaceId?: string;
    metadata?: Record<string, any>;
    notes?: string;
    category?: string;
};

type UpdateSavedPlaceInput = {
    notes?: string | null;
    category?: string | null;
};

export async function saveUserPlace(userId: string, input: SavePlaceInput) {
    let resolvedPlaceId = input.placeId;

    if (!resolvedPlaceId) {
        const placeData = input.place ?? {
            name: input.name!,
            address: input.address,
            latitude: input.latitude,
            longitude: input.longitude,
            category: input.placeCategory,
            provider: input.provider,
            providerPlaceId: input.providerPlaceId,
            metadata: input.metadata
        };

        const { place } = await findOrCreatePlace(placeData);
        resolvedPlaceId = place.id;
    } else {
        const existingPlace = await prisma.place.findUnique({
            where: { id: resolvedPlaceId }
        });

        if (!existingPlace) {
            const error = new Error("Place not found");
            error.name = "PlaceNotFoundError";
            throw error;
        }
    }

    const existingSaved = await prisma.savedPlace.findUnique({
        where: {
            userId_placeId: {
                userId,
                placeId: resolvedPlaceId
            }
        }
    });

    if (existingSaved) {
        const error = new Error("Place is already saved");
        error.name = "DuplicateSavedPlaceError";
        throw error;
    }

    const savedPlace = await prisma.savedPlace.create({
        data: {
            userId,
            placeId: resolvedPlaceId,
            notes: input.notes,
            category: input.category
        },
        include: {
            place: true
        }
    });

    return savedPlace;
}

export async function getUserSavedPlaces(userId: string, category?: string) {
    const savedPlaces = await prisma.savedPlace.findMany({
        where: {
            userId,
            ...(category ? { category: { equals: category, mode: "insensitive" } } : {})
        },
        include: {
            place: true
        },
        orderBy: {
            createdAt: "desc"
        }
    });

    return savedPlaces;
}

export async function updateSavedPlace(
    savedPlaceId: string,
    userId: string,
    data: UpdateSavedPlaceInput
) {
    const savedPlace = await prisma.savedPlace.findUnique({
        where: { id: savedPlaceId }
    });

    if (!savedPlace) {
        const error = new Error("Saved place not found");
        error.name = "SavedPlaceNotFoundError";
        throw error;
    }

    if (savedPlace.userId !== userId) {
        const error = new Error("Forbidden: You do not own this saved place");
        error.name = "SavedPlaceForbiddenError";
        throw error;
    }

    const updated = await prisma.savedPlace.update({
        where: { id: savedPlaceId },
        data: {
            ...(data.notes !== undefined && { notes: data.notes }),
            ...(data.category !== undefined && { category: data.category })
        },
        include: {
            place: true
        }
    });

    return updated;
}

export async function deleteSavedPlace(savedPlaceId: string, userId: string) {
    const savedPlace = await prisma.savedPlace.findUnique({
        where: { id: savedPlaceId }
    });

    if (!savedPlace) {
        const error = new Error("Saved place not found");
        error.name = "SavedPlaceNotFoundError";
        throw error;
    }

    if (savedPlace.userId !== userId) {
        const error = new Error("Forbidden: You do not own this saved place");
        error.name = "SavedPlaceForbiddenError";
        throw error;
    }

    await prisma.savedPlace.delete({
        where: { id: savedPlaceId }
    });
}
