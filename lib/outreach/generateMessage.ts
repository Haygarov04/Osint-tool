import type { Lead } from "../types";
import { xaiChat } from "../xai/client";

export interface GeneratedMessage {
  subject: string;
  body: string;
}

export interface GenerateMessageInput {
  lead: Lead;
  offer: string; // описанието на услугата, напр. "Модерен уеб сайт + SEO"
}

/**
 * Генерира персонализирано cold outreach съобщение с Grok (xAI).
 * Използва контекста от лийда (индустрия, сайт, град, рейтинг и т.н.).
 */
export async function generateOutreachMessage({
  lead,
  offer,
}: GenerateMessageInput): Promise<GeneratedMessage> {
  const context = buildLeadContext(lead);

  const system = `Ти си опитен B2B sales специалист в България. Пишеш кратки, човешки, професионални студени имейли/съобщения на български език.

Правила:
- Съобщението трябва да е максимум 120-150 думи.
- Започва директно, без "Уважаеми".
- Референция към конкретен детайл от бизнеса (локация, липса/стар сайт, индустрия).
- Предлагай стойност, не само "ние правим сайтове".
- Завършва с лек call-to-action (кратък въпрос).
- Звучи естествено и топло, не като спам.
- Използвай "Вие" с главна буква (български бизнес стил).`;

  const user = `Услуга/оферта: ${offer}

Информация за клиента:
${context}

Напиши:
1. Кратък, привлекателен subject (максимум 50 символа)
2. Тялото на съобщението

Формат на отговора (точно така):
SUBJECT: [subject тук]
---
[тялото на съобщението тук]`;

  const raw = await xaiChat(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { temperature: 0.8, maxTokens: 600 }
  );

  return parseGeneratedMessage(raw);
}

function buildLeadContext(lead: Lead): string {
  const parts: string[] = [];

  parts.push(`Име: ${lead.name}`);
  parts.push(`Индустрия: ${lead.industry} (${lead.category})`);
  if (lead.city) parts.push(`Град: ${lead.city}`);
  if (lead.address) parts.push(`Адрес: ${lead.address}`);

  const websiteStatus = lead.hasWebsite
    ? lead.siteOutdated
      ? "има сайт, но изглежда остарял"
      : "има сайт"
    : "НЯМА сайт";

  parts.push(`Уебсайт: ${websiteStatus}`);
  if (lead.website) parts.push(`URL: ${lead.website}`);

  if (lead.techStack?.length) {
    parts.push(`Технологии на сайта: ${lead.techStack.join(", ")}`);
  }

  if (lead.rating != null) {
    parts.push(`Рейтинг: ${lead.rating} (${lead.reviewsCount ?? 0} ревюта)`);
  }

  if (lead.phone) parts.push(`Телефон: ${lead.phone}`);
  if (lead.email) parts.push(`Имейл: ${lead.email}`);

  return parts.join("\n");
}

function parseGeneratedMessage(raw: string): GeneratedMessage {
  const subjectMatch = raw.match(/SUBJECT:\s*(.+?)(?:\n|---|$)/i);
  const subject = subjectMatch ? subjectMatch[1].trim() : "Съобщение за " + raw.slice(0, 30);

  let body = raw
    .replace(/SUBJECT:.*?(?:\n|---)/i, "")
    .trim();

  // fallback ако парсването се провали
  if (!body || body.length < 30) {
    body = raw.trim();
  }

  return { subject, body };
}
