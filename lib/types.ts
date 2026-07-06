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

  // сигнали за състоянието на сайта (попълват се при обогатяване)
  hasSsl: boolean; // сайтът се обслужва по https
  mobileFriendly: boolean; // има <meta viewport>
  siteOutdated: boolean; // евристика: без SSL / немобилен / стари технологии
  techStack: string[]; // засечени технологии (WordPress, Wix, jQuery…)
  description: string; // meta description / og:description (бизнес профил)

  facebook: string;
  instagram: string;
  linkedin: string;
  youtube: string;
  tiktok: string;

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
  notes: string; // CRM бележки

  enrichedAt: number | null; // кога е правен опит за обогатяване (имейл/соц.)
  createdAt: number; // unix ms
  updatedAt: number; // unix ms
}

// Стойност за нов лийд преди дедуп/съхранение (без id/времена/score).
export type NewLead = Omit<
  Lead,
  | "id"
  | "qualityScore"
  | "createdAt"
  | "updatedAt"
  | "domain"
  | "enrichedAt"
  | "hasSsl"
  | "mobileFriendly"
  | "siteOutdated"
  | "techStack"
  | "description"
  | "youtube"
  | "tiktok"
  | "notes"
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

  // състояние на сайта
  siteOutdated?: boolean; // стар сайт (таргет за редизайн)
  noSsl?: boolean; // без https
  notMobile?: boolean; // немобилен
  tech?: string; // засечена технология (напр. "WordPress")

  // възраст на записа (за чистене на стари неща)
  olderThanDays?: number;

  // изключване (черен списък се прилага винаги; тук — ръчни изключвания)
  excludeDomains?: string[];

  // сортиране
  sortBy?: "quality" | "rating" | "reviews" | "created" | "name";
  sortDir?: "asc" | "desc";

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
  enrichable: number; // има сайт, няма имейл (кандидати за обогатяване)
}
