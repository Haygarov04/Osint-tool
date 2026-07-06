import { extractDomain } from "../utils/dedup";
import { fetchPage } from "../utils/http";

export interface WebsiteData {
  reachable: boolean;
  hasSsl: boolean;
  mobileFriendly: boolean;
  outdated: boolean;
  techStack: string[];
  description: string;
  emails: string[];
  phones: string[];
  facebook: string;
  instagram: string;
  linkedin: string;
  youtube: string;
  tiktok: string;
}

const EMAIL_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;

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

// Засичане на технологии по сигнатури в HTML.
const TECH_SIGNATURES: [string, RegExp][] = [
  ["WordPress", /wp-content|wp-includes|content=["']WordPress/i],
  ["Wix", /wix\.com|static\.wixstatic/i],
  ["Squarespace", /squarespace/i],
  ["Shopify", /cdn\.shopify|shopify\.com/i],
  ["Joomla", /joomla/i],
  ["Drupal", /drupal/i],
  ["Webflow", /webflow/i],
  ["jQuery", /jquery/i],
  ["Bootstrap", /bootstrap(\.min)?\.css/i],
  ["React", /data-reactroot|__next|_next\//i],
  ["Flash", /\.swf|application\/x-shockwave-flash/i],
];

function cleanEmails(html: string, siteDomain: string): string[] {
  const found = new Set<string>();
  for (const raw of html.match(EMAIL_RE) ?? []) {
    const email = raw.toLowerCase().replace(/\.$/, "");
    if (JUNK.some((j) => email.includes(j))) continue;
    if (email.length > 100) continue;
    found.add(email);
  }
  return [...found].sort((a, b) => {
    const aOwn = siteDomain && a.endsWith("@" + siteDomain) ? 0 : 1;
    const bOwn = siteDomain && b.endsWith("@" + siteDomain) ? 0 : 1;
    return aOwn - bOwn;
  });
}

function extractPhones(html: string): string[] {
  const found = new Set<string>();
  // най-надеждно: tel: връзки
  for (const m of html.matchAll(/href=["']tel:([^"']+)["']/gi)) {
    const p = m[1].trim();
    if (p) found.add(p);
  }
  // резервно: правдоподобни номера (8-15 цифри)
  for (const m of html.matchAll(/(\+?\d[\d\s().\-]{7,}\d)/g)) {
    const digits = m[1].replace(/[^\d]/g, "");
    if (digits.length >= 8 && digits.length <= 15) found.add(m[1].trim());
  }
  return [...found].slice(0, 3);
}

function firstMatch(html: string, re: RegExp): string {
  const m = html.match(re);
  if (!m) return "";
  return m[0].replace(/["'\\<>].*$/, "").replace(/\/$/, "");
}

function extractDescription(html: string): string {
  const re =
    /<meta[^>]+(?:name=["']description["']|property=["']og:description["'])[^>]*content=["']([^"']+)["']/i;
  const m = html.match(re);
  return m ? m[1].trim().slice(0, 300) : "";
}

// Скролва сайта: пробва https, после http; чете homepage + вероятни контактни страници.
export async function scrapeWebsite(website: string): Promise<WebsiteData> {
  const domain = extractDomain(website);
  const result: WebsiteData = {
    reachable: false,
    hasSsl: false,
    mobileFriendly: false,
    outdated: false,
    techStack: [],
    description: "",
    emails: [],
    phones: [],
    facebook: "",
    instagram: "",
    linkedin: "",
    youtube: "",
    tiktok: "",
  };
  if (!domain) return result;

  // първо https, после http — дава ни и SSL сигнала
  let page = await fetchPage(`https://${domain}`, { timeoutMs: 9000 });
  if (page && page.finalUrl.startsWith("https://")) {
    result.hasSsl = true;
  } else {
    page = await fetchPage(`http://${domain}`, { timeoutMs: 9000 });
    result.hasSsl = false;
  }
  if (!page) {
    result.outdated = true; // недостъпен/счупен сайт също е сигнал
    return result;
  }
  result.reachable = true;

  const origin = (() => {
    try {
      return new URL(page.finalUrl).origin;
    } catch {
      return `https://${domain}`;
    }
  })();

  // анализ на homepage-а
  const home = page.html;
  result.mobileFriendly = /<meta[^>]+name=["']viewport["']/i.test(home);
  result.description = extractDescription(home);
  result.techStack = TECH_SIGNATURES.filter(([, re]) => re.test(home)).map(
    ([name]) => name
  );

  const socials = {
    facebook: firstMatch(
      home,
      /https?:\/\/(?:www\.)?facebook\.com\/(?!sharer|plugins|tr\?)[A-Za-z0-9._%\-\/?=&]+/i
    ),
    instagram: firstMatch(
      home,
      /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._\-\/?=&]+/i
    ),
    linkedin: firstMatch(
      home,
      /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9._\-\/?=&]+/i
    ),
    youtube: firstMatch(
      home,
      /https?:\/\/(?:www\.)?youtube\.com\/(?:c\/|channel\/|@)[A-Za-z0-9._\-\/?=&]+/i
    ),
    tiktok: firstMatch(
      home,
      /https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9._\-\/?=&]+/i
    ),
  };
  Object.assign(result, socials);

  // имейл/телефон: homepage + до няколко контактни страници
  const paths = ["", "/contact", "/kontakti", "/contacts", "/za-kontakti"];
  for (const path of paths) {
    const html = path === "" ? home : (await fetchPage(origin + path, { timeoutMs: 8000 }))?.html;
    if (!html) continue;
    if (!result.emails.length) result.emails = cleanEmails(html, domain);
    if (!result.phones.length) result.phones = extractPhones(html);
    if (result.emails.length && result.phones.length) break;
  }

  // евристика за „стар сайт"
  const oldTags = /<font\b|<marquee\b|<center\b/i.test(home);
  const hasFlash = result.techStack.includes("Flash");
  result.outdated =
    !result.hasSsl || !result.mobileFriendly || hasFlash || oldTags;

  return result;
}
