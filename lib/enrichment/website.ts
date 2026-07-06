import { extractDomain } from "../utils/dedup";
import { fetchText } from "../utils/http";

export interface WebsiteData {
  emails: string[];
  facebook: string;
  instagram: string;
  linkedin: string;
}

const EMAIL_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;

// Боклук/плейсхолдъри, които да не броим за имейл.
const JUNK = [
  "example.com",
  "domain.com",
  "yourdomain",
  "sentry.io",
  "wixpress.com",
  "email@",
  "name@",
  "user@",
  "@2x",
  "@3x",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
];

function cleanEmails(html: string, siteDomain: string): string[] {
  const found = new Set<string>();
  const matches = html.match(EMAIL_RE) ?? [];
  for (const raw of matches) {
    const email = raw.toLowerCase().replace(/\.$/, "");
    if (JUNK.some((j) => email.includes(j))) continue;
    if (email.length > 100) continue;
    found.add(email);
  }
  // приоритет: имейли на същия домейн като сайта
  return [...found].sort((a, b) => {
    const aOwn = siteDomain && a.endsWith("@" + siteDomain) ? 0 : 1;
    const bOwn = siteDomain && b.endsWith("@" + siteDomain) ? 0 : 1;
    return aOwn - bOwn;
  });
}

function firstMatch(html: string, re: RegExp): string {
  const m = html.match(re);
  if (!m) return "";
  return m[0].replace(/["'\\<>].*$/, "").replace(/\/$/, "");
}

function extractSocials(html: string) {
  return {
    facebook: firstMatch(
      html,
      /https?:\/\/(?:www\.)?facebook\.com\/(?!sharer|plugins|tr\?)[A-Za-z0-9._%\-\/?=&]+/i
    ),
    instagram: firstMatch(
      html,
      /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._\-\/?=&]+/i
    ),
    linkedin: firstMatch(
      html,
      /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9._\-\/?=&]+/i
    ),
  };
}

// Скролва homepage-а (и по нужда контактна страница) за имейл и соц. профили.
export async function scrapeWebsite(website: string): Promise<WebsiteData> {
  const base = website.match(/^https?:\/\//) ? website : `https://${website}`;
  const siteDomain = extractDomain(website);
  const result: WebsiteData = {
    emails: [],
    facebook: "",
    instagram: "",
    linkedin: "",
  };

  let origin = "";
  try {
    origin = new URL(base).origin;
  } catch {
    return result;
  }

  // homepage + до 2 вероятни контактни страници (спираме щом намерим имейл)
  const paths = ["", "/contact", "/kontakti", "/contacts", "/za-kontakti"];
  for (const path of paths) {
    let html = "";
    try {
      html = await fetchText(origin + path, { timeoutMs: 9000 });
    } catch {
      continue;
    }

    if (!result.facebook || !result.instagram || !result.linkedin) {
      const s = extractSocials(html);
      result.facebook ||= s.facebook;
      result.instagram ||= s.instagram;
      result.linkedin ||= s.linkedin;
    }

    const emails = cleanEmails(html, siteDomain);
    if (emails.length) {
      result.emails = emails;
      break; // намерихме имейл — стига толкова заявки
    }
  }

  return result;
}
