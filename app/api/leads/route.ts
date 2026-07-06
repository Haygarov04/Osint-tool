import { NextRequest, NextResponse } from "next/server";
import { queryLeads } from "@/lib/storage/repository";
import { parseFilter } from "@/lib/filters/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/leads?<филтри>
export async function GET(req: NextRequest) {
  try {
    const filter = parseFilter(req.nextUrl.searchParams);
    if (filter.limit == null) filter.limit = 100;
    const { leads, total } = await queryLeads(filter);
    return NextResponse.json({ leads, total });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Неочаквана грешка." },
      { status: 500 }
    );
  }
}
