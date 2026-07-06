// Централизиран достъп до конфигурацията. API ключовете идват само от environment
// променливи — никога не се твърдо кодират и никога не се пращат към клиента.

export const config = {
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
  overpassUrl:
    process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter",
  nominatimUrl: "https://nominatim.openstreetmap.org/search",
  // Учтив User-Agent — Nominatim/Overpass изискват идентификация.
  userAgent: "OsintLeadTool/0.1 (+https://github.com/Haygarov04/Osint-tool)",
};

export function hasUpstash(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

export function hasGoogle(): boolean {
  return Boolean(config.googleMapsApiKey);
}
