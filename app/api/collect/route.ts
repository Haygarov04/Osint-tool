import { NextRequest, NextResponse } from "next/server";
import { getSource } from "@/lib/sources";
import { upsertMany } from "@/lib/storage/repository";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// POST /api/collect  { source, location, industry, limit }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const source = String(body.source ?? "osm");
    const location = String(body.location ?? "").trim();
    const industry = String(body.industry ?? "").trim();
    const limit = Math.min(Math.max(Number(body.limit ?? 60), 1), 200);

    if (!location || !industry) {
      return NextResponse.json(
        { error: "Задължителни са локация и индустрия." },
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

    const found = await src.search({ location, industry, limit });
    const result = await upsertMany(found);

    return NextResponse.json({
      collected: found.length,
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Неочаквана грешка." },
      { status: 500 }
    );
  }
}
