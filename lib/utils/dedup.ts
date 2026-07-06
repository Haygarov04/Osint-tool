// Помощници за дедупликация: извличане на домейн, нормализиране на телефон и
// стабилен ключ по име+адрес.

export function extractDomain(website: string): string {
  if (!website) return "";
  try {
    const url = website.match(/^https?:\/\//)
      ? website
      : `https://${website}`;
    const host = new URL(url).hostname.toLowerCase();
    return host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function normalizePhone(phone: string): string {
  if (!phone) return "";
  // само цифри; водещата 0 при нац. формат я пазим както е
  return phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
}

export function nameAddrKey(name: string, address: string): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9а-я ]/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  const raw = `${norm(name)}|${norm(address)}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = (h << 5) - h + raw.charCodeAt(i);
    h |= 0;
  }
  return String(h >>> 0);
}
