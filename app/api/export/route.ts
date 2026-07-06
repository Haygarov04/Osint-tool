import { NextRequest } from "next/server";
import { queryLeads } from "@/lib/storage/repository";
import { parseFilter } from "@/lib/filters/parse";
import { toCsv } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/export?<филтри>  -> сваля CSV с всички съвпадащи лийдове
export async function GET(req: NextRequest) {
  try {
    const filter = parseFilter(req.nextUrl.searchParams);
    filter.limit = 100000; // без разбивка — целият сегмент
    filter.offset = 0;
    const { leads } = await queryLeads(filter);
    const csv = toCsv(leads);
    const date = new Date().toISOString().slice(0, 10);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads-${date}.csv"`,
      },
    });
  } catch (err) {
    return new Response(
      err instanceof Error ? err.message : "Неочаквана грешка.",
      { status: 500 }
    );
  }
}
