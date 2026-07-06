import { NextRequest, NextResponse } from "next/server";
import { deleteByFilter } from "@/lib/storage/repository";
import { parseFilter } from "@/lib/filters/parse";

export const runtime = "nodejs";

// POST /api/leads/delete  { filters? }  -> изтрива всички съвпадащи с филтъра
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const filter = body.filters ? parseFilter(new URLSearchParams(body.filters)) : parseFilter(new URLSearchParams());

    // Защита: ако няма филтри, не трием всичко случайно
    if (Object.keys(filter).filter(k => filter[k as keyof typeof filter] != null).length === 0) {
      return NextResponse.json(
        { error: "Трябва да има поне един филтър за безопасно изтриване." },
        { status: 400 }
      );
    }

    const deleted = await deleteByFilter(filter);
    return NextResponse.json({ deleted });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Грешка при изтриване." },
      { status: 500 }
    );
  }
}
