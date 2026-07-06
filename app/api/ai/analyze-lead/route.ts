import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { analyzeLeadWithGrok } from "@/lib/xai/analyzeLead";
import { updateLeadFields } from "@/lib/storage/repository";
import type { Lead } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

// POST /api/ai/analyze-lead { leadId }
export async function POST(req: NextRequest) {
  try {
    const { leadId } = await req.json();
    if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

    const redis = getRedis();
    const lead = await redis.get<Lead>(`lead:${leadId}`);
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const analysis = await analyzeLeadWithGrok(lead);

    // Кешираме анализа
    const formatted = `**Анализ (Grok)**\n\n**Обобщение:** ${analysis.summary}\n\n**Защо е добър:** ${analysis.whyGoodLead}\n\n**Възможности:** ${analysis.opportunities}\n\n**Препоръчителен подход:** ${analysis.suggestedPitch}\n\n**Приоритет:** ${analysis.priority}\n**Следваща стъпка:** ${analysis.nextStep}`;

    await updateLeadFields(leadId, { aiInsights: formatted });

    return NextResponse.json({ analysis: formatted, lead: { ...lead, aiInsights: formatted } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Analysis failed" }, { status: 500 });
  }
}
