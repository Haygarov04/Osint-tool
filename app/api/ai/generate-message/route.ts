import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { generateOutreachMessage } from "@/lib/outreach/generateMessage";
import type { Lead } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

// POST /api/ai/generate-message
// body: { leadId: string, offer: string }   или   { lead: Lead, offer: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const offer = (body.offer || "").toString().trim();

    if (!offer) {
      return NextResponse.json(
        { error: "Моля, опиши офертата си (напр. 'Модерен уеб сайт за твоя бизнес')." },
        { status: 400 }
      );
    }

    let lead: Lead | null = body.lead ?? null;

    // Ако ни дадат само leadId — зареди от Redis
    if (!lead && body.leadId) {
      const redis = getRedis();
      lead = await redis.get<Lead>(`lead:${body.leadId}`);
    }

    if (!lead) {
      return NextResponse.json(
        { error: "Не е подаден валиден лийд или leadId." },
        { status: 400 }
      );
    }

    const result = await generateOutreachMessage({ lead, offer });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("xAI generate error:", err);
    return NextResponse.json(
      { error: err?.message || "Грешка при генериране с xAI." },
      { status: 500 }
    );
  }
}
