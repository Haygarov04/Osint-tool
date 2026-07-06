import { NextRequest, NextResponse } from "next/server";
import { queryLeads, saveEnriched } from "@/lib/storage/repository";
import { findSocialProfiles } from "@/lib/enrichment/socialFinder";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/enrich-social { limit? } — търси социални профили за лийдове без добри контакти
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body.limit ?? 20), 1), 50);

    const filter = { hasSocial: false, limit };
    const { leads } = await queryLeads(filter);

    let enriched = 0;
    for (const lead of leads) {
      try {
        const patch = await findSocialProfiles(lead);
        if (patch.facebook || patch.instagram || patch.linkedin) {
          await saveEnriched(lead, patch);
          enriched++;
        }
      } catch {}
    }

    return NextResponse.json({
      processed: leads.length,
      enriched,
      remaining: Math.max(0, (await queryLeads({ hasSocial: false })).total - leads.length),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Грешка" }, { status: 500 });
  }
}
