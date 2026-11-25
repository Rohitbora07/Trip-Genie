"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MapPin,
  Layers,
  LocateFixed,
  Navigation,
  Loader2,
  Globe,
  Clock,
  Route,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Activity, ItineraryDay } from "@/types/api";
import "leaflet/dist/leaflet.css";

interface ItineraryRouteMapProps {
  day: ItineraryDay;
  destination?: string;
  selectedActivityId: string | null;
  onSelectActivity?: (activityId: string) => void;
}

interface ResolvedStop {
  activity: Activity;
  index: number;
  lat: number;
  lon: number;
  title: string;
  address: string;
  category: string;
}

interface RoadRouteInfo {
  coordinates: [number, number][];
  distanceKm: number;
  durationMinutes: number;
  isRoadSnapped: boolean;
}

type MapStyle = "street" | "terrain" | "satellite";

function toValidCoord(val: number | string | null | undefined): number | null {
  if (val === null || val === undefined || val === "") return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatShortTime(iso?: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return "";
  }
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `~${Math.max(1, Math.round(minutes))} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `~${hrs}h ${mins}m` : `~${hrs}h`;
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function truncateLabel(text: string, max = 16): string {
  const clean = text.trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function ItineraryRouteMap({
  day,
  destination,
  selectedActivityId,
  onSelectActivity,
}: ItineraryRouteMapProps) {
  const activities = useMemo(() => day.activities || [], [day.activities]);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const tileLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const markersLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const routeLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const markerByIdRef = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const geocodeCacheRef = useRef<Map<string, { lat: number; lon: number } | null>>(new Map());
  const leafletRef = useRef<typeof import("leaflet") | null>(null);

  const [mapStyle, setMapStyle] = useState<MapStyle>("street");
  const [isResolvingCoords, setIsResolvingCoords] = useState(false);
  const [resolvedStops, setResolvedStops] = useState<ResolvedStop[]>([]);
  const [destinationCenter, setDestinationCenter] = useState<{ lat: number; lon: number } | null>(
    null
  );
  const [roadRoute, setRoadRoute] = useState<RoadRouteInfo | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Resolve real coordinates from persisted Place entities or live geocoding fallback
  useEffect(() => {
    let cancelled = false;

    async function geocodeCached(query: string): Promise<{ lat: number; lon: number } | null> {
      const key = query.trim().toLowerCase();
      if (!key) return null;
      if (geocodeCacheRef.current.has(key)) {
        return geocodeCacheRef.current.get(key) ?? null;
      }
      try {
        const results = await api.places.search(query, 1);
        const first = results[0];
        const lat = toValidCoord(first?.latitude);
        const lon = toValidCoord(first?.longitude);
        const coords = lat !== null && lon !== null ? { lat, lon } : null;
        geocodeCacheRef.current.set(key, coords);
        return coords;
      } catch {
        geocodeCacheRef.current.set(key, null);
        return null;
      }
    }

    async function resolveAll() {
      const initialStops: ResolvedStop[] = [];
      const missingActivities: { activity: Activity; index: number }[] = [];

      activities.forEach((act, idx) => {
        const lat = toValidCoord(act.place?.latitude);
        const lon = toValidCoord(act.place?.longitude);
        const title = act.place?.name || act.title;
        const address = act.place?.address || act.description || destination || "";
        const category = act.place?.category || "ACTIVITY";

        if (lat !== null && lon !== null) {
          initialStops.push({
            activity: act,
            index: idx + 1,
            lat,
            lon,
            title,
            address,
            category,
          });
        } else {
          missingActivities.push({ activity: act, index: idx + 1 });
        }
      });

      if (!cancelled) {
        setResolvedStops(initialStops);
      }

      if (missingActivities.length > 0 || (initialStops.length === 0 && destination)) {
        if (!cancelled) setIsResolvingCoords(true);

        if (destination) {
          let destCoords = await geocodeCached(destination);
          if (!destCoords && destination.includes(",")) {
            destCoords = await geocodeCached(destination.split(",")[0].trim());
          }
          if (!cancelled && destCoords) {
            setDestinationCenter(destCoords);
          }
        }

        const extraStops: ResolvedStop[] = [];
        for (const item of missingActivities.slice(0, 8)) {
          if (cancelled) break;
          const placeName = item.activity.place?.name || item.activity.title;
          const destShort = destination ? destination.split(",")[0].trim() : "";
          const query =
            destShort && !placeName.toLowerCase().includes(destShort.toLowerCase())
              ? `${placeName}, ${destShort}`
              : placeName;

          const coords = await geocodeCached(query);
          if (coords) {
            extraStops.push({
              activity: item.activity,
              index: item.index,
              lat: coords.lat,
              lon: coords.lon,
              title: placeName,
              address: item.activity.place?.address || item.activity.description || "",
              category: item.activity.place?.category || "ACTIVITY",
            });
          }
        }

        if (!cancelled) {
          const merged = [...initialStops, ...extraStops].sort((a, b) => a.index - b.index);
          setResolvedStops(merged);
          setIsResolvingCoords(false);
        }
      } else {
        if (!cancelled) setIsResolvingCoords(false);
      }
    }

    void resolveAll();

    return () => {
      cancelled = true;
    };
  }, [activities, destination]);

  // Fetch real road-snapped route geometry & distance/duration from free OSRM
  useEffect(() => {
    let cancelled = false;

    async function fetchRoadRoute() {
      // Deduplicate consecutive stops with near-identical coordinates so OSRM routes cleanly
      const waypoints: ResolvedStop[] = [];
      for (const stop of resolvedStops) {
        const prev = waypoints[waypoints.length - 1];
        if (
          !prev ||
          Math.abs(prev.lat - stop.lat) > 0.0005 ||
          Math.abs(prev.lon - stop.lon) > 0.0005
        ) {
          waypoints.push(stop);
        }
      }

      if (waypoints.length < 2) {
        if (!cancelled) setRoadRoute(null);
        return;
      }

      const coordParam = waypoints.map((w) => `${w.lon},${w.lat}`).join(";");
      try {
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${coordParam}?overview=full&geometries=geojson`
        );
        if (res.ok) {
          const data = (await res.json()) as {
            code?: string;
            routes?: Array<{
              distance: number;
              duration: number;
              geometry?: { coordinates?: [number, number][] };
            }>;
          };
          const primary = data.routes?.[0];
          const rawCoords = primary?.geometry?.coordinates;
          if (data.code === "Ok" && primary && rawCoords && rawCoords.length >= 2) {
            if (!cancelled) {
              setRoadRoute({
                coordinates: rawCoords.map(([lon, lat]) => [lat, lon]),
                distanceKm: primary.distance / 1000,
                durationMinutes: primary.duration / 60,
                isRoadSnapped: true,
              });
            }
            return;
          }
        }
      } catch {
        // Fall back smoothly to straight-line estimation below
      }

      // Straight-line fallback distance calculation
      const pts: [number, number][] = waypoints.map((w) => [w.lat, w.lon]);
      let totalKm = 0;
      for (let i = 1; i < pts.length; i++) {
        totalKm += haversineKm(pts[i - 1], pts[i]);
      }
      if (!cancelled) {
        setRoadRoute({
          coordinates: pts,
          distanceKm: totalKm,
          durationMinutes: (totalKm / 30) * 60,
          isRoadSnapped: false,
        });
      }
    }

    void fetchRoadRoute();

    return () => {
      cancelled = true;
    };
  }, [resolvedStops]);

  // Initialize Leaflet map instance on mount (client-side only)
  useEffect(() => {
    let mounted = true;

    async function initMap() {
      if (!mapContainerRef.current || mapInstanceRef.current) return;
      const L = (await import("leaflet")).default;
      if (!mounted || !mapContainerRef.current) return;

      leafletRef.current = L;

      const defaultCenter: [number, number] = destinationCenter
        ? [destinationCenter.lat, destinationCenter.lon]
        : [20.5937, 78.9629];

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: destinationCenter ? 11 : 4,
        zoomControl: false,
        scrollWheelZoom: true,
        attributionControl: false,
      });

      L.control.attribution({ position: "bottomright", prefix: false }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);

      const routeLayer = L.layerGroup().addTo(map);
      const markersLayer = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      routeLayerRef.current = routeLayer;
      markersLayerRef.current = markersLayer;
      setMapReady(true);
    }

    void initMap();

    return () => {
      mounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      tileLayerRef.current = null;
      routeLayerRef.current = null;
      markersLayerRef.current = null;
      markerByIdRef.current.clear();
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap tile layer & apply warm minimal styling to Street view
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    if (!map || !L || !mapReady) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const tileConfig: Record<
      MapStyle,
      { url: string; attribution: string; maxZoom: number; filter: string }
    > = {
      street: {
        url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
        // Warm desaturated architectural map finish matching Trip-Genie's parchment UI
        filter: "saturate(0.32) sepia(0.14) brightness(1.04) contrast(0.95)",
      },
      terrain: {
        url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
        attribution: "&copy; OpenTopoMap (OSM)",
        maxZoom: 17,
        filter: "saturate(0.82) contrast(0.98)",
      },
      satellite: {
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution: "Imagery &copy; Esri",
        maxZoom: 18,
        filter: "none",
      },
    };

    const cfg = tileConfig[mapStyle];
    const layer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
    });
    layer.addTo(map);
    tileLayerRef.current = layer;

    const tilePane = map.getPane("tilePane");
    if (tilePane) {
      tilePane.style.filter = cfg.filter;
    }
  }, [mapStyle, mapReady]);

  // Draw road polyline separately so toggling selection or stops updates cleanly
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    const routeLayer = routeLayerRef.current;
    if (!map || !L || !routeLayer || !mapReady) return;

    routeLayer.clearLayers();

    if (roadRoute && roadRoute.coordinates.length >= 2) {
      // Soft halo under the dark route line so it stands out on busy roads
      L.polyline(roadRoute.coordinates, {
        color: "#FFFFFF",
        weight: 6.5,
        opacity: 0.75,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(routeLayer);

      // Sleek charcoal road-snapped polyline
      L.polyline(roadRoute.coordinates, {
        color: "#1C1917",
        weight: 3.25,
        opacity: 0.92,
        lineCap: "round",
        lineJoin: "round",
        dashArray: roadRoute.isRoadSnapped ? undefined : "6 6",
      }).addTo(routeLayer);
    }
  }, [roadRoute, mapReady]);

  // Compute slightly separated display positions when multiple stops share coordinates
  const positionedStops = useMemo(() => {
    const coordBuckets = new Map<string, number>();
    return resolvedStops.map((stop) => {
      const key = `${stop.lat.toFixed(4)},${stop.lon.toFixed(4)}`;
      const count = coordBuckets.get(key) || 0;
      coordBuckets.set(key, count + 1);
      if (count === 0) {
        return { ...stop, displayLat: stop.lat, displayLon: stop.lon };
      }
      const angle = (count * 2 * Math.PI) / 6;
      const offset = 0.0005 * (1 + Math.floor(count / 6) * 0.65);
      return {
        ...stop,
        displayLat: stop.lat + offset * Math.cos(angle),
        displayLon: stop.lon + offset * Math.sin(angle),
      };
    });
  }, [resolvedStops]);

  // Render floating pill markers + ring anchors & auto-fit bounds
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !L || !markersLayer || !mapReady) return;

    markersLayer.clearLayers();
    markerByIdRef.current.clear();

    if (positionedStops.length > 0) {
      const total = positionedStops.length;

      positionedStops.forEach((stop, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === total - 1 && total > 1;
        const isSelected = stop.activity.id === selectedActivityId;

        const pillBg = isSelected
          ? "#B85D38"
          : isLast
          ? "#EF4444"
          : isFirst
          ? "#18181B"
          : "#214E3E";

        const dotColor = isFirst ? "#4ADE80" : isLast ? "#FCA5A5" : "#FDE68A";
        const shortName = escapeHtml(truncateLabel(stop.title, 15));

        const icon = L.divIcon({
          className: "trip-genie-pill-marker",
          html: `
            <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);pointer-events:auto;">
              <div style="
                display:inline-flex;
                align-items:center;
                gap:6px;
                padding:4px 10px;
                border-radius:9999px;
                background:${pillBg};
                color:#FFFFFF;
                font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;
                font-size:10px;
                font-weight:700;
                letter-spacing:0.04em;
                white-space:nowrap;
                box-shadow:0 4px 14px rgba(0,0,0,0.22);
                border:1.5px solid rgba(255,255,255,0.22);
                margin-bottom:5px;
              ">
                <span style="width:6px;height:6px;border-radius:9999px;background:${dotColor};flex-shrink:0;"></span>
                <span>${stop.index} &middot; ${shortName}</span>
              </div>
              <div style="
                width:12px;
                height:12px;
                border-radius:9999px;
                background:#FFFFFF;
                border:3px solid ${pillBg};
                box-shadow:0 2px 6px rgba(0,0,0,0.3);
              "></div>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 6],
        });

        const marker = L.marker([stop.displayLat, stop.displayLon], { icon }).addTo(markersLayer);
        const startTime = formatShortTime(stop.activity.startTime);

        marker.bindPopup(
          `<div style="min-width:185px;font-family:system-ui,-apple-system,sans-serif;">
            <div style="font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#B85D38;margin-bottom:2px;">
              Stop ${stop.index}${startTime ? ` • ${escapeHtml(startTime)}` : ""} • ${escapeHtml(stop.category)}
            </div>
            <div style="font-size:13px;font-weight:600;color:#1C1917;line-height:1.3;">
              ${escapeHtml(stop.title)}
            </div>
            ${
              stop.address
                ? `<div style="font-size:11px;color:#57534E;margin-top:4px;line-height:1.35;">${escapeHtml(
                    stop.address
                  )}</div>`
                : ""
            }
          </div>`,
          { closeButton: false, offset: [0, -34] }
        );

        marker.on("click", () => {
          onSelectActivity?.(stop.activity.id);
        });

        markerByIdRef.current.set(stop.activity.id, marker);
      });

      const fitPoints: [number, number][] =
        roadRoute && roadRoute.coordinates.length >= 2
          ? roadRoute.coordinates
          : positionedStops.map((s) => [s.displayLat, s.displayLon]);

      if (fitPoints.length === 1) {
        map.setView(fitPoints[0], 13, { animate: true });
      } else {
        const bounds = L.latLngBounds(fitPoints);
        map.fitBounds(bounds, { padding: [56, 56], maxZoom: 14, animate: true });
      }
    } else if (destinationCenter) {
      const destIcon = L.divIcon({
        className: "trip-genie-dest-pill",
        html: `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
            <div style="
              display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:9999px;
              background:#18181B;color:#FFFFFF;font-family:ui-sans-serif,system-ui,sans-serif;
              font-size:10px;font-weight:700;letter-spacing:0.05em;white-space:nowrap;
              box-shadow:0 4px 14px rgba(0,0,0,0.22);margin-bottom:5px;
            ">
              <span style="width:6px;height:6px;border-radius:9999px;background:#4ADE80;"></span>
              <span>DESTINATION</span>
            </div>
            <div style="width:12px;height:12px;border-radius:9999px;background:#FFFFFF;border:3px solid #18181B;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 6],
      });

      const marker = L.marker([destinationCenter.lat, destinationCenter.lon], {
        icon: destIcon,
      }).addTo(markersLayer);

      if (destination) {
        marker.bindPopup(
          `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:600;color:#1C1917;">${escapeHtml(
            destination
          )}</div>`
        );
      }
      map.setView([destinationCenter.lat, destinationCenter.lon], 12, { animate: true });
    }
  }, [positionedStops, roadRoute, destinationCenter, destination, selectedActivityId, mapReady, onSelectActivity]);

  // Smoothly pan to marker when an activity is selected from outside
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedActivityId) return;
    const stop = positionedStops.find((s) => s.activity.id === selectedActivityId);
    const marker = markerByIdRef.current.get(selectedActivityId);
    if (stop && marker) {
      map.flyTo([stop.displayLat, stop.displayLon], Math.max(map.getZoom(), 13), { duration: 0.5 });
      marker.openPopup();
    }
  }, [selectedActivityId, positionedStops]);

  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    const pts: [number, number][] =
      roadRoute && roadRoute.coordinates.length >= 2
        ? roadRoute.coordinates
        : positionedStops.map((s) => [s.displayLat, s.displayLon]);

    if (pts.length >= 2) {
      map.fitBounds(L.latLngBounds(pts), { padding: [56, 56], maxZoom: 14, animate: true });
    } else if (pts.length === 1) {
      map.flyTo(pts[0], 13, { duration: 0.4 });
    } else if (destinationCenter) {
      map.flyTo([destinationCenter.lat, destinationCenter.lon], 12, { duration: 0.4 });
    }
  };

  return (
    <div className="relative rounded-2xl border border-[var(--border-default)] bg-[var(--surface)] overflow-hidden shadow-sm">
      {/* Interactive Full-Bleed Map Canvas with Floating HUD Controls */}
      <div className="relative h-[330px] sm:h-[380px] w-full bg-[#F4F1EA]">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Top-Left Floating Context Pill */}
        <div className="pointer-events-none absolute top-3.5 left-3.5 right-3.5 z-[400] flex flex-wrap items-start justify-between gap-2">
          <div className="pointer-events-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/95 backdrop-blur-md border border-black/10 shadow-md max-w-full">
            <MapPin className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
            <span className="text-xs font-semibold text-[#18181B] truncate">
              Day {day.dayNumber}
              {destination ? ` • ${destination}` : ""}
            </span>
            {isResolvingCoords && (
              <Loader2 className="w-3 h-3 animate-spin text-[var(--primary)] shrink-0 ml-1" />
            )}
          </div>

          {/* Top-Right Floating Controls */}
          <div className="pointer-events-auto flex items-center gap-1.5">
            <div className="inline-flex items-center rounded-full border border-black/10 bg-white/95 backdrop-blur-md p-1 shadow-md text-[11px] font-medium">
              <button
                type="button"
                onClick={() => setMapStyle("street")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full transition-colors ${
                  mapStyle === "street"
                    ? "bg-[#18181B] text-white"
                    : "text-[#52525B] hover:text-[#18181B]"
                }`}
              >
                <Navigation className="w-3 h-3" />
                <span>Minimal</span>
              </button>
              <button
                type="button"
                onClick={() => setMapStyle("terrain")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full transition-colors ${
                  mapStyle === "terrain"
                    ? "bg-[#18181B] text-white"
                    : "text-[#52525B] hover:text-[#18181B]"
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>Terrain</span>
              </button>
              <button
                type="button"
                onClick={() => setMapStyle("satellite")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full transition-colors ${
                  mapStyle === "satellite"
                    ? "bg-[#18181B] text-white"
                    : "text-[#52525B] hover:text-[#18181B]"
                }`}
              >
                <Globe className="w-3 h-3" />
                <span>Satellite</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleRecenter}
              title="Fit entire route in view"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-full border border-black/10 bg-white/95 backdrop-blur-md text-[11px] font-semibold text-[#18181B] hover:bg-white shadow-md transition-colors"
            >
              <LocateFixed className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Fit</span>
            </button>
          </div>
        </div>

        {/* Bottom-Left Floating Distance & Travel Time Pill (OSRM Road Telemetry) */}
        {roadRoute && (
          <div className="pointer-events-none absolute bottom-5 left-3.5 z-[400]">
            <div className="pointer-events-auto inline-flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-white/95 backdrop-blur-md border border-black/10 shadow-md text-xs text-[#18181B]">
              <Route className="w-3.5 h-3.5 text-[#18181B] shrink-0" />
              <span className="font-bold font-mono">{roadRoute.distanceKm.toFixed(1)} km</span>
              <span className="text-[#A1A1AA]">•</span>
              <span className="inline-flex items-center gap-1 text-[#52525B] font-medium">
                <Clock className="w-3 h-3" />
                <span>{formatDuration(roadRoute.durationMinutes)}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Overlapping Crisp White Route Card Sheet */}
      {positionedStops.length > 0 && (
        <div className="relative z-[410] -mt-3 rounded-t-2xl bg-white border-t border-black/5 px-4 py-3.5">
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            {positionedStops.map((stop, idx) => {
              const isSelected = stop.activity.id === selectedActivityId;
              const isFirst = idx === 0;
              const isLast = idx === positionedStops.length - 1 && positionedStops.length > 1;
              const dotClass = isSelected
                ? "bg-[#B85D38]"
                : isLast
                ? "bg-[#EF4444]"
                : isFirst
                ? "bg-[#22C55E]"
                : "bg-[#214E3E]";

              return (
                <button
                  key={stop.activity.id}
                  type="button"
                  onClick={() => onSelectActivity?.(stop.activity.id)}
                  className={`group flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left shrink-0 transition-all ${
                    isSelected
                      ? "bg-[#18181B] text-white border-[#18181B] shadow-sm"
                      : "bg-[#FAFAF9] text-[#18181B] border-[#E7E5E4] hover:border-[#A8A29E] hover:bg-white"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
                  <div className="min-w-0 max-w-[175px]">
                    <div
                      className={`text-[9px] font-mono uppercase tracking-wider ${
                        isSelected ? "text-white/70" : "text-[#78716C]"
                      }`}
                    >
                      Stop {stop.index}
                      {formatShortTime(stop.activity.startTime)
                        ? ` • ${formatShortTime(stop.activity.startTime)}`
                        : ""}
                    </div>
                    <div className="text-xs font-semibold truncate">{stop.title}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
