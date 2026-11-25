import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Place } from "@/types/api";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  AED: "د.إ",
  SGD: "S$",
  THB: "฿",
};

export function getCurrencySymbol(currency?: string | null): string {
  if (!currency) return "₹";
  return CURRENCY_SYMBOLS[currency.toUpperCase()] || `${currency.toUpperCase()} `;
}

export function formatCurrencyAmount(amount: number | string, currency?: string | null): string {
  const num = Number(amount);
  if (Number.isNaN(num)) return "";
  const code = (currency || "INR").toUpperCase();
  const locale = code === "INR" ? "en-IN" : "en-US";
  const symbol = getCurrencySymbol(code);
  return `${symbol}${num.toLocaleString(locale)}`;
}

export function formatPlaceDetails(place: Place): {
  primaryName: string;
  county: string | null;
  district: string | null;
  state: string | null;
  country: string | null;
  countryCode: string | null;
  regionLabel: string;
  selectedValue: string;
} {
  const addr = place.metadata?.addressDetails as Record<string, unknown> | undefined;
  const county =
    (typeof addr?.county === "string" ? addr.county : null) ||
    (typeof addr?.town === "string" ? addr.town : null) ||
    null;
  const district =
    typeof addr?.state_district === "string" ? addr.state_district : null;
  const state = place.state || (typeof addr?.state === "string" ? addr.state : null) || null;
  const country = place.country || (typeof addr?.country === "string" ? addr.country : null) || null;
  const countryCode =
    place.countryCode || (addr?.country_code ? String(addr.country_code).toUpperCase() : null);

  const regionParts: string[] = [];
  for (const part of [county, district, state, country]) {
    if (
      part &&
      part.toLowerCase() !== place.name.toLowerCase() &&
      !regionParts.some((p) => p.toLowerCase() === part.toLowerCase())
    ) {
      regionParts.push(part);
    }
  }

  let regionLabel = regionParts.join(", ");
  if (!regionLabel && place.address) {
    const parts = place.address
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && s.toLowerCase() !== place.name.toLowerCase());
    regionLabel = parts.slice(-3).join(", ");
  }

  const selectedParts = [place.name, ...regionParts];
  const selectedValue =
    selectedParts.length > 1
      ? selectedParts.join(", ")
      : place.address || place.name;

  return {
    primaryName: place.name,
    county,
    district,
    state,
    country,
    countryCode,
    regionLabel,
    selectedValue,
  };
}
