import { config, hasGoogle } from "../config";
import { getIndustry } from "../industries";
import type { NewLead } from "../types";
import { fetchJson } from "../utils/http";
import type { SearchQuery, Source } from "./base";

interface TextSearchResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  geometry?: { location?: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  business_status?: string;
}

interface TextSearchResponse {
  status: string;
  error_message?: string;
  results: TextSearchResult[];
}

interface DetailsResponse {
  status: string;
  result?: { formatted_phone_number?: string; website?: string };
}

async function placeDetails(
  placeId: string
): Promise<{ phone: string; website: string }> {
  const url =
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
      placeId
    )}&fields=formatted_phone_number,website&key=${config.googleMapsApiKey}`;
  try {
    const data = await fetchJson<DetailsResponse>(url, {
      cacheTtl: 7 * 24 * 3600,
      timeoutMs: 20000,
    });
    return {
      phone: data.result?.formatted_phone_number ?? "",
      website: data.result?.website ?? "",
    };
  } catch {
    return { phone: "", website: "" };
  }
}

export const googlePlacesSource: Source = {
  name: "google",
  available() {
    return hasGoogle();
  },
  async search({ location, industry, limit }: SearchQuery): Promise<NewLead[]> {
    if (!hasGoogle()) {
      throw new Error(
        "Няма GOOGLE_MAPS_API_KEY — Google Places източникът е недостъпен."
      );
    }
    const ind = getIndustry(industry);
    if (!ind) throw new Error(`Непозната индустрия: ${industry}`);

    const keyword = (ind.google[0] ?? industry).replace(/_/g, " ");
    const query = `${keyword} in ${location}`;
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      query
    )}&key=${config.googleMapsApiKey}`;

    const data = await fetchJson<TextSearchResponse>(url, {
      cacheTtl: 3600,
      timeoutMs: 30000,
    });

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      throw new Error(
        `Google Places грешка: ${data.status}${
          data.error_message ? ` — ${data.error_message}` : ""
        }`
      );
    }

    const results = data.results.slice(0, limit);
    const city = location.split(",")[0].trim();

    const leads = await Promise.all(
      results.map(async (r): Promise<NewLead> => {
        const details = await placeDetails(r.place_id);
        return {
          source: "google",
          sourceId: r.place_id,
          name: r.name,
          category: r.types?.[0] ?? industry,
          industry,
          phone: details.phone,
          email: "",
          emailVerified: "unknown",
          website: details.website,
          hasWebsite: Boolean(details.website),
          facebook: "",
          instagram: "",
          linkedin: "",
          address: r.formatted_address ?? "",
          city,
          region: "",
          country: "",
          lat: r.geometry?.location?.lat ?? null,
          lon: r.geometry?.location?.lng ?? null,
          rating: r.rating ?? null,
          reviewsCount: r.user_ratings_total ?? null,
          companySize: "",
          tags: [],
          status: "new",
        };
      })
    );

    return leads;
  },
};
