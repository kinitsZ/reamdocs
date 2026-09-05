import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { getAccessLevel } from "@/lib/access";

type RouteContext = { params: Promise<{ id: string }> };

// A view-only user asks the owner to upgrade them to edit access. Only makes sense
// for someone who currently has VIEW (not OWNER, not already EDIT, not no-access —
// the last case shouldn't be able to see this document at all).
export async function POST(_request: Request, { params }: RouteContext) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id }, include: { shares: true } });
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  const level = getAccessLevel(doc, userId);
  if (level !== "VIEW") {
    return NextResponse.json(
      { error: "Only a view-only collaborator can request edit access." },
      { status: 400 }
    );
  }

  await prisma.accessRequest.upsert({
    where: { documentId_userId: { documentId: id, userId } },
    update: {}, // already pending — treat a repeat click as a no-op, not a new request
    create: { documentId: id, userId },
  });

  return NextResponse.json({ ok: true });
}
