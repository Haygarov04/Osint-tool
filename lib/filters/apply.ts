import type { FilterSpec, Lead } from "../types";

// Разстояние по haversine (км) между две точки.
function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Прилага филтрите, които не се покриват от равенствените Redis индекси:
// диапазони, радиус, соц. мрежи, верифициран имейл, ръчни изключвания.
export function applyFilters(leads: Lead[], f: FilterSpec): Lead[] {
  const exclude = new Set((f.excludeDomains ?? []).map((d) => d.toLowerCase()));
  const cityQuery = f.city?.trim().toLowerCase() ?? "";

  return leads.filter((l) => {
    // Град: частично съвпадение (напр. "plov" -> "Plovdiv")
    if (cityQuery && !l.city.toLowerCase().includes(cityQuery)) return false;

    if (f.ratingMin != null && (l.rating ?? 0) < f.ratingMin) return false;
    if (f.ratingMax != null && (l.rating ?? 0) > f.ratingMax) return false;
    if (f.reviewsMin != null && (l.reviewsCount ?? 0) < f.reviewsMin)
      return false;
    if (f.qualityMin != null && l.qualityScore < f.qualityMin) return false;

    if (f.emailVerified && l.emailVerified !== "valid") return false;

    if (f.hasSocial && !(l.facebook || l.instagram || l.linkedin)) return false;

    if (f.region && l.region.toLowerCase() !== f.region.toLowerCase())
      return false;

    if (exclude.size && l.domain && exclude.has(l.domain.toLowerCase()))
      return false;

    if (
      f.radiusKm != null &&
      f.centerLat != null &&
      f.centerLon != null &&
      l.lat != null &&
      l.lon != null
    ) {
      if (haversineKm(f.centerLat, f.centerLon, l.lat, l.lon) > f.radiusKm)
        return false;
    }

    return true;
  });
}
