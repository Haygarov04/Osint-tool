import { NextResponse } from "next/server";
import { getStats } from "@/lib/storage/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/stats -> броячи по източник/статус/сайт/имейл
export async function GET() {
  try {
    const stats = await getStats();
    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Неочаквана грешка." },
      { status: 500 }
    );
  }
}
