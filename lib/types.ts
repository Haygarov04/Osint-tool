// Стандартизиран модел на данните. Всеки източник попълва Lead, всеки филтър
// работи срещу FilterSpec. Полетата, които даден източник не дава, остават празни
// (напр. имейл/соц. мрежи се допълват във Фаза 3 — enrichment).

export type SourceName = "osm" | "google";

export type LeadStatus =
  | "new" // нов
  | "processed" // обработен
  | "contacted" // контактиран
  | "replied" // отговорил
  | "customer" // клиент
  | "unsubscribed"; // отписан

export type EmailStatus = "unknown" | "valid" | "invalid" | "unverified";

export interface Lead {
  id: string;
  source: SourceName;
  sourceId: string; // id в източника (OSM id / Google place_id)

  name: string;
  category: string; // суров тип от източника (напр. "restaurant")
  industry: string; // нормализиран ключ от industries.ts

  phone: string;
  email: string;
  emailVerified: EmailStatus;

  website: string;
  hasWebsite: boolean;
  domain: string; // извлечен от website (без www)

  facebook: string;
  instagram: string;
  linkedin: string;

  address: string;
  city: string;
  region: string;
  country: string;
  lat: number | null;
  lon: number | null;

  rating: number | null;
  reviewsCount: number | null;
  companySize: string;

  qualityScore: number; // 0..100
  tags: string[];
  status: LeadStatus;

  createdAt: number; // unix ms
  updatedAt: number; // unix ms
}

// Стойност за нов лийд преди дедуп/съхранение (без id/времена/score).
export type NewLead = Omit<
  Lead,
  "id" | "qualityScore" | "createdAt" | "updatedAt" | "domain"
> & { domain?: string };

// Комбинируеми филтри (секция 5 от спецификацията).
export interface FilterSpec {
  // гео
  country?: string;
  region?: string;
  city?: string;
  // радиус около точка (км) — изисква lat/lon
  centerLat?: number;
  centerLon?: number;
  radiusKm?: number;

  industry?: string;
  source?: SourceName;
  status?: LeadStatus;

  // уебсайт
  website?: "with" | "without"; // със / без сайт

  // контакти
  hasPhone?: boolean;
  hasEmail?: boolean;
  emailVerified?: boolean;
  hasSocial?: boolean;

  // качество
  ratingMin?: number;
  ratingMax?: number;
  reviewsMin?: number;
  qualityMin?: number;

  // изключване (черен списък се прилага винаги; тук — ръчни изключвания)
  excludeDomains?: string[];

  // разбивка на страници
  limit?: number;
  offset?: number;
}

export interface StatsResult {
  total: number;
  bySource: Record<string, number>;
  byStatus: Record<string, number>;
  withoutWebsite: number;
  withEmail: number;
}
