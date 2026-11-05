export type PlaceSearchResult = {
    provider: string;
    providerPlaceId: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    category?: string;
    metadata?: Record<string, any>;
};

export async function searchNominatimPlaces(query: string, limit = 10): Promise<PlaceSearchResult[]> {
    const safeLimit = Math.min(Math.max(1, limit), 30);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=${safeLimit}`;

    const response = await fetch(url, {
        headers: {
            "User-Agent": "Trip-Genie/1.0 (contact: support@tripgenie.com)",
            "Accept-Language": "en"
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to search places provider: ${response.statusText}`);
    }

    const data = await response.json() as any[];

    return data.map((item) => {
        const name = item.name || item.display_name?.split(",")[0]?.trim() || "Unknown Location";
        const category = (item.type || item.class || "POINT_OF_INTEREST").toUpperCase();

        return {
            provider: "OPEN_STREET_MAP",
            providerPlaceId: String(item.place_id),
            name,
            address: item.display_name,
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
            category,
            metadata: {
                osmType: item.osm_type,
                osmId: item.osm_id,
                placeRank: item.place_rank,
                addressDetails: item.address,
                boundingBox: item.boundingbox
            }
        };
    });
}
