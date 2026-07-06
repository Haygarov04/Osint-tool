import { NextRequest, NextResponse } from "next/server";
import { leadsToEnrich, saveEnriched } from "@/lib/storage/repository";
import { enrichLead } from "@/lib/enrichment/enrichLead";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Обработва списък с ограничена концурентност.
async function pool<T>(
  items: T[],
  size: number,
  fn: (t: T) => Promise<void>
): Promise<void> {
  let i = 0;
  const workers = Array.from(
    { length: Math.min(size, items.length) },
    async () => {
      while (i < items.length) {
        const idx = i++;
        await fn(items[idx]);
      }
    }
  );
  await Promise.all(workers);
}

// POST /api/enrich { limit? } -> обогатява партида лийдове (имейл + соц. + верификация)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body.limit ?? 15), 1), 40);

    const { batch, remaining } = await leadsToEnrich(limit);

    let enriched = 0;
    await pool(batch, 5, async (lead) => {
      try {
        const patch = await enrichLead(lead);
        const saved = await saveEnriched(lead, patch);
        if (!lead.email && saved.email) enriched++;
      } catch {
        // маркирай като опитан дори при грешка, за да не се върти вечно
        await saveEnriched(lead, {});
      }
    });

    return NextResponse.json({
      processed: batch.length,
      enriched,
      remaining: Math.max(0, remaining - batch.length),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Неочаквана грешка." },
      { status: 500 }
    );
  }
}
