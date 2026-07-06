import type { Lead } from "./types";

// Ред от колони — същите като Lead модела (обратна съвместимост с CSV експорта).
const COLUMNS: (keyof Lead)[] = [
  "id",
  "source",
  "sourceId",
  "name",
  "category",
  "industry",
  "phone",
  "email",
  "emailVerified",
  "website",
  "hasWebsite",
  "domain",
  "facebook",
  "instagram",
  "linkedin",
  "address",
  "city",
  "region",
  "country",
  "lat",
  "lon",
  "rating",
  "reviewsCount",
  "companySize",
  "qualityScore",
  "tags",
  "status",
  "createdAt",
  "updatedAt",
];

function escape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = Array.isArray(value) ? value.join(";") : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(leads: Lead[]): string {
  const header = COLUMNS.join(",");
  const rows = leads.map((l) => COLUMNS.map((c) => escape(l[c])).join(","));
  // BOM за коректни кирилица/Excel
  return "﻿" + [header, ...rows].join("\r\n");
}
