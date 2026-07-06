import type { Lead } from "../types";
import { scrapeWebsite } from "./website";
import { verifyEmailDomain } from "./emailVerify";

// Обогатява един лийд от сайта му: имейл, телефон, соц. профили, описание и
// сигнали за състоянието на сайта (SSL/мобилен/стар/технологии). MX верификация
// на имейла. Връща само промените — не презаписва вече попълнени контакти.
export async function enrichLead(lead: Lead): Promise<Partial<Lead>> {
  const patch: Partial<Lead> = {};
  if (!lead.website) return patch;

  const d = await scrapeWebsite(lead.website);

  // контакти (само ако липсват)
  if (!lead.email && d.emails.length) {
    patch.email = d.emails[0];
    patch.emailVerified = await verifyEmailDomain(d.emails[0]);
  }
  if (!lead.phone && d.phones.length) patch.phone = d.phones[0];
  if (!lead.facebook && d.facebook) patch.facebook = d.facebook;
  if (!lead.instagram && d.instagram) patch.instagram = d.instagram;
  if (!lead.linkedin && d.linkedin) patch.linkedin = d.linkedin;
  if (!lead.youtube && d.youtube) patch.youtube = d.youtube;
  if (!lead.tiktok && d.tiktok) patch.tiktok = d.tiktok;

  // сигнали за сайта (описват сайта — обновяват се винаги при достъпен сайт)
  if (d.reachable) {
    patch.hasSsl = d.hasSsl;
    patch.mobileFriendly = d.mobileFriendly;
    patch.techStack = d.techStack;
    if (d.description) patch.description = d.description;
  }
  patch.siteOutdated = d.outdated;

  return patch;
}
