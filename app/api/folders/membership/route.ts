import { NextRequest, NextResponse } from "next/server";
import { addLeadsToFolder, removeLeadsFromFolder, moveLeadsToFolder } from "@/lib/storage/repository";

// POST /api/folders/membership 
// body:
// { folder, leadIds, action: "add" | "remove" }
// or for move: { leadIds, toFolder, fromFolder? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.toFolder && Array.isArray(body.leadIds)) {
      // Move action
      await moveLeadsToFolder(body.leadIds, body.toFolder, body.fromFolder);
      return NextResponse.json({ ok: true });
    }

    const { folder, leadIds, action } = body;

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
