import type { Lead } from "../types";
import { xaiChat } from "./client";

export interface LeadAnalysis {
  summary: string;
  whyGoodLead: string;
  opportunities: string;
  suggestedPitch: string;
  priority: "high" | "medium" | "low";
  nextStep: string;
}

export async function analyzeLeadWithGrok(lead: Lead): Promise<LeadAnalysis> {
  const context = `
Име: ${lead.name}
Индустрия: ${lead.industry} (${lead.category})
Град: ${lead.city || lead.region || "-"}
Сайт: ${lead.hasWebsite ? (lead.siteOutdated ? "има, но остарял" : "има") : "НЯМА сайт"}
Tech: ${lead.techStack?.join(", ") || "-"}
Рейтинг: ${lead.rating ?? "-"} (${lead.reviewsCount ?? 0} ревюта)
Телефон: ${lead.phone || "-"}
Имейл: ${lead.email || "-"}
Социални: FB:${lead.facebook ? "да" : "не"}, IG:${lead.instagram ? "да" : "no"}, LI:${lead.linkedin ? "да" : "no"}
Качество: ${lead.qualityScore}/100
  `.trim();

  const system = `Ти си опитен B2B sales консултант в България. Даваш кратък, точен, actionable анализ за лийд. Отговаряш само на български.`;

  const user = `Анализирай този лийд за продажба на услуги (уебсайтове, SEO, автоматизации и т.н.).

Данни:
${context}

Върни JSON с точно тези полета:
{
  "summary": "1-2 изречения обобщение",
  "whyGoodLead": "Защо е добър таргет (1-2 изречения)",
  "opportunities": "Конкретни възможности (стар сайт, липса на присъствие и т.н.)",
  "suggestedPitch": "Кратък препоръчителен ъгъл за подход",
  "priority": "high | medium | low",
  "nextStep": "Какво да направиш следващо (обади се, пиши във FB, изпрати имейл...)"
}`;

  const raw = await xaiChat(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { temperature: 0.4, maxTokens: 700 }
  );

  try {
    // Опитваме да извлечем JSON
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {}

  // Fallback
  return {
    summary: raw.slice(0, 200),
    whyGoodLead: "Добър таргет според наличните данни.",
    opportunities: "Провери сайта или социалните профили.",
    suggestedPitch: "Персонализирано предложение според нуждите.",
    priority: "medium",
    nextStep: "Генерирай съобщение и се свържи.",
  };
}
