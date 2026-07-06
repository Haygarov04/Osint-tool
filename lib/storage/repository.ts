import { randomUUID } from "crypto";
import { getRedis } from "../redis";
import type { FilterSpec, Lead, NewLead, StatsResult } from "../types";
import { extractDomain, nameAddrKey, normalizePhone } from "../utils/dedup";
import { computeQualityScore } from "../utils/quality";
import { applyFilters } from "../filters/apply";

const ALL = "leads:all";
const STATUSES = [
  "new",
  "processed",
  "contacted",
  "replied",
  "customer",
  "unsubscribed",
];

const leadKey = (id: string) => `lead:${id}`;
const cityKey = (city: string) => city.trim().toLowerCase();

// Равенствените индекси, към които принадлежи даден лийд.
function leadIndexKeys(lead: Lead): string[] {
  const keys = [
    `idx:source:${lead.source}`,
    `idx:industry:${lead.industry}`,
    `idx:status:${lead.status}`,
    `idx:has_website:${lead.hasWebsite ? 1 : 0}`,
    `idx:has_phone:${lead.phone ? 1 : 0}`,
    `idx:has_email:${lead.email ? 1 : 0}`,
  ];
  if (lead.city) keys.push(`idx:city:${cityKey(lead.city)}`);
  if (lead.country) keys.push(`idx:country:${lead.country.toUpperCase()}`);
  return keys;
}

// Търси съществуващ лийд по домейн -> телефон -> име+адрес.
async function findDuplicateId(
  domain: string,
  phone: string,
  naKey: string
): Promise<string | null> {
  const redis = getRedis();
  if (domain) {
    const id = await redis.get<string>(`dedup:domain:${domain}`);
    if (id) return id;
  }
  if (phone) {
    const id = await redis.get<string>(`dedup:phone:${phone}`);
    if (id) return id;
  }
  const id = await redis.get<string>(`dedup:nameaddr:${naKey}`);
  return id ?? null;
}

// Слива нов лийд върху стар: попълва празни полета, без да губи статус/история.
function mergeLead(old: Lead, incoming: NewLead, domain: string): Lead {
  const prefer = (a: string, b: string) => a || b;
  const merged: Lead = {
    ...old,
    name: prefer(incoming.name, old.name),
    category: prefer(incoming.category, old.category),
    industry: prefer(incoming.industry, old.industry),
    phone: prefer(incoming.phone, old.phone),
    email: prefer(incoming.email, old.email),
    website: prefer(incoming.website, old.website),
    hasWebsite: old.hasWebsite || incoming.hasWebsite,
    domain: prefer(domain, old.domain),
    facebook: prefer(incoming.facebook, old.facebook),
    instagram: prefer(incoming.instagram, old.instagram),
    linkedin: prefer(incoming.linkedin, old.linkedin),
    address: prefer(incoming.address, old.address),
    city: prefer(incoming.city, old.city),
    region: prefer(incoming.region, old.region),
    country: prefer(incoming.country, old.country),
    lat: incoming.lat ?? old.lat,
    lon: incoming.lon ?? old.lon,
    rating: incoming.rating ?? old.rating,
    reviewsCount: incoming.reviewsCount ?? old.reviewsCount,
    updatedAt: Date.now(),
  };
  merged.qualityScore = computeQualityScore(merged);
  return merged;
}

export interface UpsertResult {
  added: number;
  updated: number;
  total: number;
}

// Записва списък лийдове с дедупликация и обновяване на индексите.
export async function upsertMany(items: NewLead[]): Promise<UpsertResult> {
  const redis = getRedis();
  let added = 0;
  let updated = 0;

  for (const item of items) {
    const domain = item.domain || extractDomain(item.website);
    const phone = normalizePhone(item.phone);
    const naKey = nameAddrKey(item.name, item.address);
    const dupId = await findDuplicateId(domain, phone, naKey);

    let lead: Lead;
    if (dupId) {
      const old = await redis.get<Lead>(leadKey(dupId));
      if (old) {
        // премахни стария от индексите, после добави обновения
        const rp = redis.pipeline();
        for (const k of leadIndexKeys(old)) rp.srem(k, dupId);
        await rp.exec();
        lead = mergeLead(old, item, domain);
        updated++;
      } else {
        // dedup ключ сочи към изтрит лийд — третираме като нов
        lead = newLeadRecord(item, domain);
        added++;
      }
    } else {
      lead = newLeadRecord(item, domain);
      added++;
    }

    const p = redis.pipeline();
    p.set(leadKey(lead.id), lead);
    p.sadd(ALL, lead.id);
    for (const k of leadIndexKeys(lead)) p.sadd(k, lead.id);
    if (domain) p.set(`dedup:domain:${domain}`, lead.id);
    if (phone) p.set(`dedup:phone:${phone}`, lead.id);
    p.set(`dedup:nameaddr:${naKey}`, lead.id);
    await p.exec();
  }

  const total = await redis.scard(ALL);
  return { added, updated, total };
}

function newLeadRecord(item: NewLead, domain: string): Lead {
  const now = Date.now();
  const lead: Lead = {
    ...item,
    id: randomUUID(),
    domain,
    hasSsl: false,
    mobileFriendly: false,
    siteOutdated: false,
    techStack: [],
    description: "",
    youtube: "",
    tiktok: "",
    notes: "",
    qualityScore: 0,
    enrichedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  lead.qualityScore = computeQualityScore(lead);
  return lead;
}

// Лийдове, които имат сайт, но нямат имейл и още не са обогатявани.
export async function leadsToEnrich(
  limit: number
): Promise<{ batch: Lead[]; remaining: number }> {
  const redis = getRedis();
  const ids = await redis.sinter("idx:has_website:1", "idx:has_email:0");
  if (ids.length === 0) return { batch: [], remaining: 0 };
  const leads = await mgetLeads(ids);
  const pending = leads.filter((l) => !l.enrichedAt);
  return { batch: pending.slice(0, limit), remaining: pending.length };
}

// Записва обогатен лийд: маха стария от индексите, слива patch-а, преиндексира.
export async function saveEnriched(
  old: Lead,
  patch: Partial<Lead>
): Promise<Lead> {
  const redis = getRedis();
  const rp = redis.pipeline();
  for (const k of leadIndexKeys(old)) rp.srem(k, old.id);
  await rp.exec();

  const merged: Lead = {
    ...old,
    ...patch,
    enrichedAt: Date.now(),
    updatedAt: Date.now(),
  };
  merged.qualityScore = computeQualityScore(merged);

  const p = redis.pipeline();
  p.set(leadKey(merged.id), merged);
  p.sadd(ALL, merged.id);
  for (const k of leadIndexKeys(merged)) p.sadd(k, merged.id);
  await p.exec();
  return merged;
}

// Обновява CRM полета на един лийд (статус/бележки/тагове) и преиндексира статуса.
export async function updateLeadFields(
  id: string,
  patch: Partial<Pick<Lead, "status" | "notes" | "tags">>
): Promise<Lead | null> {
  const redis = getRedis();
  const old = await redis.get<Lead>(leadKey(id));
  if (!old) return null;

  const statusChanged = Boolean(patch.status && patch.status !== old.status);
  const merged: Lead = { ...old, ...patch, updatedAt: Date.now() };

  const p = redis.pipeline();
  if (statusChanged) {
    p.srem(`idx:status:${old.status}`, id);
    p.sadd(`idx:status:${merged.status}`, id);
  }
  p.set(leadKey(id), merged);
  await p.exec();
  return merged;
}

// Изтрива всички лийдове, съвпадащи с филтъра (за чистене на стари/ненужни записи).
export async function deleteByFilter(f: FilterSpec): Promise<number> {
  const redis = getRedis();
  const { leads } = await queryLeads({ ...f, limit: 1000000, offset: 0 });
  if (leads.length === 0) return 0;

  const p = redis.pipeline();
  for (const l of leads) {
    for (const k of leadIndexKeys(l)) p.srem(k, l.id);
    p.srem(ALL, l.id);
    p.del(leadKey(l.id));
    if (l.domain) p.del(`dedup:domain:${l.domain}`);
    const phone = normalizePhone(l.phone);
    if (phone) p.del(`dedup:phone:${phone}`);
    p.del(`dedup:nameaddr:${nameAddrKey(l.name, l.address)}`);
  }
  await p.exec();
  return leads.length;
}

// Кои равенствени индекси да пресечем спрямо филтъра.
function equalityKeys(f: FilterSpec): string[] {
  const keys: string[] = [];
  if (f.source) keys.push(`idx:source:${f.source}`);
  if (f.industry) keys.push(`idx:industry:${f.industry}`);
  if (f.status) keys.push(`idx:status:${f.status}`);
  // Град се филтрира по частичен текст в applyFilters (по-удобно от точно съвпадение).
  if (f.country) keys.push(`idx:country:${f.country.toUpperCase()}`);
  if (f.website === "with") keys.push("idx:has_website:1");
  if (f.website === "without") keys.push("idx:has_website:0");
  if (f.hasPhone) keys.push("idx:has_phone:1");
  if (f.hasEmail) keys.push("idx:has_email:1");
  return keys;
}

async function mgetLeads(ids: string[]): Promise<Lead[]> {
  if (ids.length === 0) return [];
  const redis = getRedis();
  const out: Lead[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200).map(leadKey);
    const vals = (await redis.mget<Lead[]>(...chunk)) as (Lead | null)[];
    for (const v of vals) if (v) out.push(v);
  }
  return out;
}

export interface QueryResult {
  leads: Lead[];
  total: number;
}

export async function queryLeads(f: FilterSpec): Promise<QueryResult> {
  const redis = getRedis();
  const keys = equalityKeys(f);

  let ids: string[];
  if (keys.length === 1) ids = await redis.smembers(keys[0]);
  else if (keys.length > 1) ids = await redis.sinter(keys[0], ...keys.slice(1));
  else ids = await redis.smembers(ALL);

  if (ids.length === 0) return { leads: [], total: 0 };

  let leads = await mgetLeads(ids);

  // черен списък (домейни/имейли) — прилага се винаги
  const [blDomains, blEmails] = await Promise.all([
    redis.smembers("blacklist:domain"),
    redis.smembers("blacklist:email"),
  ]);
  const blD = new Set(blDomains);
  const blE = new Set(blEmails);
  leads = leads.filter(
    (l) => !(l.domain && blD.has(l.domain)) && !(l.email && blE.has(l.email))
  );

  // остатъчни филтри (диапазони, радиус, соц., сайт, възраст, ръчни изключвания)
  leads = applyFilters(leads, f);

  // сортиране
  const dir = f.sortDir === "asc" ? 1 : -1;
  const val = (l: Lead): number | string => {
    switch (f.sortBy) {
      case "rating":
        return l.rating ?? 0;
      case "reviews":
        return l.reviewsCount ?? 0;
      case "quality":
        return l.qualityScore;
      case "name":
        return l.name.toLowerCase();
      default:
        return l.createdAt;
    }
  };
  leads.sort((a, b) => {
    const av = val(a);
    const bv = val(b);
    if (typeof av === "string" || typeof bv === "string") {
      return String(av).localeCompare(String(bv)) * dir;
    }
    return (av - bv) * dir;
  });

  const total = leads.length;
  const offset = f.offset ?? 0;
  const limit = f.limit ?? 100;
  return { leads: leads.slice(offset, offset + limit), total };
}

export async function getStats(): Promise<StatsResult> {
  const redis = getRedis();
  const total = await redis.scard(ALL);

  const bySource: Record<string, number> = {
    osm: await redis.scard("idx:source:osm"),
    google: await redis.scard("idx:source:google"),
  };

  const byStatus: Record<string, number> = {};
  for (const s of STATUSES) {
    byStatus[s] = await redis.scard(`idx:status:${s}`);
  }

  const enrichIds = await redis.sinter("idx:has_website:1", "idx:has_email:0");

  return {
    total,
    bySource,
    byStatus,
    withoutWebsite: await redis.scard("idx:has_website:0"),
    withEmail: await redis.scard("idx:has_email:1"),
    enrichable: enrichIds.length,
  };
}
