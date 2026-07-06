import { NextRequest, NextResponse } from "next/server";
import { getSource } from "@/lib/sources";
import { upsertMany, addLeadsToFolder } from "@/lib/storage/repository";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_COMBOS = 25; // таван на комбинациите (локация × индустрия) за едно извикване
const CONCURRENCY = 4;   // колко заявки към OSM/Overpass паралелно (публичният Overpass не обича повече)

// POST /api/collect  { source, location, industries[] (или industry), limit }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const source = String(body.source ?? "osm");
    const limit = Math.min(Math.max(Number(body.limit ?? 60), 1), 200);

    // няколко локации, разделени със запетая
    const locations = String(body.location ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // няколко индустрии (или единична за обратна съвместимост)
    let industries: string[] = Array.isArray(body.industries)
      ? body.industries.map(String)
      : [];
    if (industries.length === 0 && body.industry) {
      industries = [String(body.industry)];
    }

    if (locations.length === 0 || industries.length === 0) {
      return NextResponse.json(
        { error: "Задължителни са поне една локация и поне една индустрия." },
        { status: 400 }
      );
    }

    const src = getSource(source);
    if (!src.available()) {
      return NextResponse.json(
        {
          error:
            "Източникът не е наличен (най-вероятно липсва API ключ). Виж .env.",
        },
        { status: 400 }
      );
    }

    // всички комбинации локация × индустрия
    const combos: { location: string; industry: string }[] = [];
    for (const loc of locations)
      for (const ind of industries) combos.push({ location: loc, industry: ind });

    if (combos.length > MAX_COMBOS) {
      return NextResponse.json(
        {
          error: `Твърде много комбинации (${combos.length}). Максимум ${MAX_COMBOS} наведнъж — намали градовете или индустриите.`,
        },
        { status: 400 }
      );
    }

    let collected = 0;
    let added = 0;
    let updated = 0;
    let total = 0;
    const touchedIds: string[] = [];
    const errors: string[] = [];

    // Limited concurrency to avoid killing public Overpass / rate limits
    async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
      const queue = [...items];
      const workers: Promise<void>[] = [];
      const active = new Set<Promise<void>>();

      while (queue.length > 0 || active.size > 0) {
        while (active.size < limit && queue.length > 0) {
          const item = queue.shift()!;
          const p = worker(item).finally(() => active.delete(p));
          active.add(p);
          workers.push(p);
        }
        if (active.size > 0) {
          await Promise.race(active);
        }
      }
    }

    await runWithConcurrency(combos, CONCURRENCY, async (c) => {
      try {
        const found = await src.search({
          location: c.location,
          industry: c.industry,
          limit,
        });
        const r = await upsertMany(found);
        collected += found.length;
        added += r.added;
        updated += r.updated;
        total = Math.max(total, r.total || 0);
        if (r.ids) touchedIds.push(...r.ids);
      } catch (e) {
        errors.push(
          `${c.location} / ${c.industry}: ${
            e instanceof Error ? e.message : "грешка"
          }`
        );
      }
    });

    // Автоматично запазване в "Inbox" при събиране
    if (touchedIds.length > 0) {
      try {
        await addLeadsToFolder("Inbox", touchedIds);
      } catch {}
    }

    return NextResponse.json({
      combos: combos.length,
      collected,
      added,
      updated,
      total,
      errors,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Неочаквана грешка." },
      { status: 500 }
    );
  }
}
