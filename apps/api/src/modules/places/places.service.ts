import { prisma } from "../../db/prisma";
import { searchNominatimPlaces, PlaceSearchResult } from "../../integrations/places/nominatim.client";

type CreatePlaceInput = {
    name: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    category?: string;
    provider?: string;
    providerPlaceId?: string;
    metadata?: Record<string, any>;
};

export async function searchPlaces(query: string, limit = 10) {
    const results = await searchNominatimPlaces(query, limit);

    if (results.length === 0) {
        return [];
    }

    const providerIds = results.map((r) => r.providerPlaceId);
    const existingPlaces = await prisma.place.findMany({
        where: {
            provider: "OPEN_STREET_MAP",
            providerPlaceId: { in: providerIds }
        },
        select: {
            id: true,
            providerPlaceId: true
        }
    });

    const existingMap = new Map(existingPlaces.map((p: any) => [p.providerPlaceId, p.id]));

    return results.map((item) => ({
        ...item,
        id: existingMap.get(item.providerPlaceId) ?? null
    }));
}

export async function getPlaceById(placeId: string) {
    const place = await prisma.place.findUnique({
        where: { id: placeId }
    });

    if (!place) {
        const error = new Error("Place not found");
        error.name = "PlaceNotFoundError";
        throw error;
    }

    return place;
}

export async function findOrCreatePlace(data: CreatePlaceInput) {
    const provider = data.provider ?? "MANUAL";
    const providerPlaceId = data.providerPlaceId;

    if (providerPlaceId) {
        const existing = await prisma.place.findUnique({
            where: {
                provider_providerPlaceId: {
                    provider,
                    providerPlaceId
                }
            }
        });

        if (existing) {
            return { place: existing, isNew: false };
        }
    } else if (data.name) {
        const existing = await prisma.place.findFirst({
            where: {
                name: { equals: data.name, mode: "insensitive" },
                ...(data.address ? { address: { equals: data.address, mode: "insensitive" } } : {})
            }
        });

        if (existing) {
            return { place: existing, isNew: false };
        }
    }

    const newPlace = await prisma.place.create({
        data: {
            name: data.name,
            address: data.address,
            latitude: data.latitude,
            longitude: data.longitude,
            category: data.category,
            provider,
            providerPlaceId,
            metadata: data.metadata
        }
    });

    return { place: newPlace, isNew: true };
}
