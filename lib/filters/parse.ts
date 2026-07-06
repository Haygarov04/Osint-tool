import type { FilterSpec, LeadStatus, SourceName } from "../types";

// Превръща URL query параметри във FilterSpec (ползва се от /api/leads и /api/export).
export function parseFilter(sp: URLSearchParams): FilterSpec {
  const num = (k: string) => {
    const v = sp.get(k);
    return v != null && v !== "" ? Number(v) : undefined;
  };
  const bool = (k: string) => sp.get(k) === "true" || sp.get(k) === "1";

  const website = sp.get("website");
  const excludeDomains = sp.get("excludeDomains");

  return {
    country: sp.get("country") || undefined,
    region: sp.get("region") || undefined,
    city: sp.get("city") || undefined,
    industry: sp.get("industry") || undefined,
    source: (sp.get("source") as SourceName) || undefined,
    status: (sp.get("status") as LeadStatus) || undefined,
    website: website === "with" || website === "without" ? website : undefined,
    hasPhone: bool("hasPhone") || undefined,
    hasEmail: bool("hasEmail") || undefined,
    emailVerified: bool("emailVerified") || undefined,
    hasSocial: bool("hasSocial") || undefined,
    ratingMin: num("ratingMin"),
    ratingMax: num("ratingMax"),
    reviewsMin: num("reviewsMin"),
    qualityMin: num("qualityMin"),
    centerLat: num("centerLat"),
    centerLon: num("centerLon"),
    radiusKm: num("radiusKm"),
    excludeDomains: excludeDomains
      ? excludeDomains.split(",").map((d) => d.trim()).filter(Boolean)
      : undefined,
    limit: num("limit"),
    offset: num("offset"),
  };
}
