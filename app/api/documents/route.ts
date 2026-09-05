import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { listDocumentsForUser } from "@/lib/documents";

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  return NextResponse.json(await listDocumentsForUser(userId));
}

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const doc = await prisma.document.create({
    data: { title: "Untitled document", content: EMPTY_DOC, ownerId: userId },
  });

  return NextResponse.json({ document: { id: doc.id, title: doc.title } }, { status: 201 });
}
