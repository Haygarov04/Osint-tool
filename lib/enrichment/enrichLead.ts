import type { Lead } from "../types";
import { scrapeWebsite } from "./website";
import { verifyEmailDomain } from "./emailVerify";

// Обогатява един лийд: вади имейл + соц. профили от сайта и верифицира имейла.
// Връща само промените (patch) — не пипа полета, които вече са попълнени.
export async function enrichLead(lead: Lead): Promise<Partial<Lead>> {
  const patch: Partial<Lead> = {};
  if (!lead.website) return patch;

  const data = await scrapeWebsite(lead.website);

  if (!lead.email && data.emails.length) {
    patch.email = data.emails[0];
    patch.emailVerified = await verifyEmailDomain(data.emails[0]);
  }
  if (!lead.facebook && data.facebook) patch.facebook = data.facebook;
  if (!lead.instagram && data.instagram) patch.instagram = data.instagram;
  if (!lead.linkedin && data.linkedin) patch.linkedin = data.linkedin;

  return patch;
}
