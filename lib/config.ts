// Централизиран достъп до конфигурацията. API ключовете идват само от environment
// променливи — никога не се твърдо кодират и никога не се пращат към клиента.

export const config = {
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
  overpassUrl:
    process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter",
  nominatimUrl: "https://nominatim.openstreetmap.org/search",
  // Учтив User-Agent — Nominatim/Overpass изискват идентификация.
  userAgent: "OsintLeadTool/0.1 (+https://github.com/Haygarov04/Osint-tool)",
  xaiApiKey: process.env.XAI_API_KEY ?? "",
  sitePassword: process.env.SITE_PASSWORD ?? "",
};

// Vercel/Upstash интеграцията понякога дава UPSTASH_*, понякога KV_* имена —
// поддържаме и двете.
export function redisUrl(): string {
  return (
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? ""
  );
}

export function redisToken(): string {
  return (
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? ""
  );
}

export function hasUpstash(): boolean {
  return Boolean(redisUrl() && redisToken());
}

export function hasGoogle(): boolean {
  return Boolean(config.googleMapsApiKey);
}

export function hasXai(): boolean {
  return Boolean(config.xaiApiKey);
}

export function hasSitePassword(): boolean {
  return Boolean(config.sitePassword);
}

export function getSitePassword(): string {
  return config.sitePassword;
}
