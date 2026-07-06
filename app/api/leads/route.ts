import { NextRequest, NextResponse } from "next/server";
import { queryLeads, updateLeadFields, deleteLead } from "@/lib/storage/repository";
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

// PATCH /api/leads  { id, status?, notes?, tags? }
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const id = String(body.id || "");
    if (!id) {
      return NextResponse.json({ error: "id е задължително." }, { status: 400 });
    }
    const patch: any = {};
    if (body.status) patch.status = body.status;
    if (typeof body.notes === "string") patch.notes = body.notes;
    if (Array.isArray(body.tags)) patch.tags = body.tags;

    const updated = await updateLeadFields(id, patch);
    if (!updated) {
      return NextResponse.json({ error: "Лийдът не е намерен." }, { status: 404 });
    }
    return NextResponse.json({ lead: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Неочаквана грешка." },
      { status: 500 }
    );
  }
}

// DELETE /api/leads?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id е задължително." }, { status: 400 });
    }
    await deleteLead(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Неочаквана грешка." },
      { status: 500 }
    );
  }
}
