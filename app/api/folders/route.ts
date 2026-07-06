import { NextRequest, NextResponse } from "next/server";
import { listFolders, createFolder, addLeadsToFolder, removeLeadsFromFolder, deleteFolder } from "@/lib/storage/repository";

export const runtime = "nodejs";

// GET /api/folders → списък с папки
export async function GET() {
  const folders = await listFolders();
  return NextResponse.json({ folders });
}

// POST /api/folders { name }
export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  await createFolder(name);
  return NextResponse.json({ ok: true });
}

// DELETE /api/folders { name }
export async function DELETE(req: NextRequest) {
  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  await deleteFolder(name);
  return NextResponse.json({ ok: true });
}
