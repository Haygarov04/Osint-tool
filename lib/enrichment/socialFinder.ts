import type { Lead } from "../types";
import { xaiChat } from "../xai/client";

/**
 * Опитва се да намери социални профили за бизнес без сайт,
 * използвайки име + град + категория + xAI.
 */
export async function findSocialProfiles(lead: Lead): Promise<Partial<Lead>> {
  if (!lead.name) return {};

  const prompt = `Ти си OSINT специалист. Намери вероятни публични Facebook, Instagram или LinkedIn страници за този бизнес.

Бизнес:
- Име: ${lead.name}
- Град: ${lead.city || lead.region || "България"}
- Категория: ${lead.category || lead.industry}
- Адрес (ако има): ${lead.address || ""}

Върни само ако си доста сигурен. Формат:
FACEBOOK: https://facebook.com/...
INSTAGRAM: https://instagram.com/...
LINKEDIN: https://linkedin.com/...

Ако нямаш добра хипотеза, върни празно.`;

  try {
    const raw = await xaiChat(
      [
        { role: "system", content: "Ти си точен OSINT асистент. Не измисляй линкове." },
        { role: "user", content: prompt },
      ],
      { temperature: 0.3, maxTokens: 300 }
    );

    const patch: Partial<Lead> = {};

    const fb = raw.match(/FACEBOOK:\s*(https?:\/\/[^\s]+)/i);
    if (fb) patch.facebook = fb[1].trim();

    const ig = raw.match(/INSTAGRAM:\s*(https?:\/\/[^\s]+)/i);
    if (ig) patch.instagram = ig[1].trim();

    const li = raw.match(/LINKEDIN:\s*(https?:\/\/[^\s]+)/i);
    if (li) patch.linkedin = li[1].trim();

    return patch;
  } catch {
    return {};
  }
}
