import { config } from "../config";
import { getIndustry } from "../industries";
import type { NewLead } from "../types";
import { fetchJson } from "../utils/http";
import type { SearchQuery, Source } from "./base";

interface NominatimResult {
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string]; // [south, north, west, east]
  display_name: string;
  address?: { country_code?: string; state?: string };
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

// Геокодиране на локация -> bounding box (кеш 7 дни).
async function geocode(location: string): Promise<NominatimResult | null> {
  const url = `${config.nominatimUrl}?q=${encodeURIComponent(
    location
  )}&format=json&limit=1&addressdetails=1`;
  const res = await fetchJson<NominatimResult[]>(url, {
    cacheTtl: 7 * 24 * 3600,
    timeoutMs: 20000,
  });
  return res[0] ?? null;
}

function tagFilter([tag, value]: [string, string]): string {
  return value === "*" ? `["${tag}"]` : `["${tag}"="${value}"]`;
}

function buildQuery(bbox: string, osmTags: [string, string][]): string {
  const parts: string[] = [];
  for (const t of osmTags) {
    const f = tagFilter(t);
    parts.push(`  node${f}(${bbox});`);
    parts.push(`  way${f}(${bbox});`);
  }
  return `[out:json][timeout:25];\n(\n${parts.join("\n")}\n);\nout center tags;`;
}

function pick(tags: Record<string, string>, keys: string[]): string {
  for (const k of keys) if (tags[k]) return tags[k];
  return "";
}

function toLead(
  el: OverpassElement,
  industry: string,
  fallbackCountry: string
): NewLead | null {
  const tags = el.tags ?? {};
  const name = tags.name || tags["name:en"] || "";
  if (!name) return null;

  const website = pick(tags, [
    "website",
    "contact:website",
    "url",
    "contact:url",
  ]);
  const phone = pick(tags, ["phone", "contact:phone"]);
  const email = pick(tags, ["email", "contact:email"]);

  const street = pick(tags, ["addr:street"]);
  const houseNo = pick(tags, ["addr:housenumber"]);
  const address = [street, houseNo].filter(Boolean).join(" ");
  const category =
    pick(tags, [
      "amenity",
      "shop",
      "tourism",
      "office",
      "craft",
      "leisure",
      "healthcare",
    ]) || industry;

  const lat = el.lat ?? el.center?.lat ?? null;
  const lon = el.lon ?? el.center?.lon ?? null;

  return {
    source: "osm",
    sourceId: `${el.type}/${el.id}`,
    name,
    category,
    industry,
    phone,
    email,
    emailVerified: "unknown",
    website,
    hasWebsite: Boolean(website),
    facebook: pick(tags, ["contact:facebook", "facebook"]),
    instagram: pick(tags, ["contact:instagram", "instagram"]),
    linkedin: pick(tags, ["contact:linkedin", "linkedin"]),
    address,
    city: pick(tags, ["addr:city"]),
    region: pick(tags, ["addr:state", "addr:province"]),
    country: pick(tags, ["addr:country"]) || fallbackCountry,
    lat,
    lon,
    rating: null,
    reviewsCount: null,
    companySize: "",
    tags: [],
    status: "new",
  };
}

export const osmSource: Source = {
  name: "osm",
  available() {
    return true; // винаги наличен, безплатен
  },
  async search({ location, industry, limit }: SearchQuery): Promise<NewLead[]> {
    const ind = getIndustry(industry);
    if (!ind) throw new Error(`Непозната индустрия: ${industry}`);

    const geo = await geocode(location);
    if (!geo) throw new Error(`Не намерих локацията: ${location}`);

    const [south, north, west, east] = geo.boundingbox;
    const bbox = `${south},${west},${north},${east}`;
    const country = (geo.address?.country_code ?? "").toUpperCase();

    const query = buildQuery(bbox, ind.osm);
    const data = await fetchJson<OverpassResponse>(config.overpassUrl, {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      cacheTtl: 3600, // 1 час — да не дърпаме едно и също двойно
      timeoutMs: 60000,
    });

    const leads: NewLead[] = [];
    for (const el of data.elements) {
      const lead = toLead(el, industry, country);
      if (lead) leads.push(lead);
      if (leads.length >= limit) break;
    }
    return leads;
  },
};
