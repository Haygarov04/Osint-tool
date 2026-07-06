import { NextRequest, NextResponse } from "next/server";
import { addLeadsToFolder, removeLeadsFromFolder } from "@/lib/storage/repository";

// POST /api/folders/membership { folder, leadIds: string[], action: "add" | "remove" }
export async function POST(req: NextRequest) {
  try {
    const { folder, leadIds, action } = await req.json();

    if (!folder || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: "folder and leadIds required" }, { status: 400 });
    }

    if (action === "add") {
      await addLeadsToFolder(folder, leadIds);
    } else if (action === "remove") {
      await removeLeadsFromFolder(folder, leadIds);
    } else {
      return NextResponse.json({ error: "invalid action" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
