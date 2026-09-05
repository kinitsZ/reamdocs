import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { canEdit, canView, getAccessLevel, isOwner } from "@/lib/access";
import { updateDocumentSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const doc = await prisma.document.findUnique({
    where: { id },
    include: { owner: true, shares: { include: { user: true } } },
  });
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  if (!canView(doc, userId)) {
    return NextResponse.json({ error: "You don't have access to this document." }, { status: 403 });
  }

  return NextResponse.json({
    document: {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      updatedAt: doc.updatedAt,
      ownerId: doc.ownerId,
      ownerName: doc.owner.name,
    },
    access: getAccessLevel(doc, userId),
    shares: doc.shares.map((s) => ({
      userId: s.userId,
      name: s.user.name,
      email: s.user.email,
      initials: s.user.initials,
      role: s.role,
    })),
  });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = updateDocumentSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  if (parsed.data.title === undefined && parsed.data.content === undefined) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const doc = await prisma.document.findUnique({ where: { id }, include: { shares: true } });
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  if (!canEdit(doc, userId)) {
    return NextResponse.json(
      { error: "Read-only: you don't have edit access to this document." },
      { status: 403 }
    );
  }

  const updated = await prisma.document.update({
    where: { id },
    data: {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.content !== undefined ? { content: parsed.data.content as object } : {}),
    },
  });

  return NextResponse.json({ document: { id: updated.id, title: updated.title, updatedAt: updated.updatedAt } });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  // Only the owner can delete — an editor could otherwise destroy a document they
  // don't own, which is a much bigger privilege than "can edit content."
  if (!isOwner(doc, userId)) {
    return NextResponse.json({ error: "Only the owner can delete this document." }, { status: 403 });
  }

  await prisma.document.delete({ where: { id } }); // cascades to its Share rows
  return NextResponse.json({ ok: true });
}
