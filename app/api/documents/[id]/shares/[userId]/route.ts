import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { isOwner } from "@/lib/access";
import { updateShareSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string; userId: string }> };

async function requireOwner(docId: string, userId: string) {
  const doc = await prisma.document.findUnique({ where: { id: docId } });
  if (!doc) return { error: NextResponse.json({ error: "Document not found." }, { status: 404 }) } as const;
  if (!isOwner(doc, userId)) {
    return {
      error: NextResponse.json({ error: "Only the owner can manage sharing." }, { status: 403 }),
    } as const;
  }
  return { doc } as const;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const callerId = await getSessionUserId();
  if (!callerId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id, userId: targetUserId } = await params;
  const check = await requireOwner(id, callerId);
  if ("error" in check) return check.error;

  const json = await request.json().catch(() => null);
  const parsed = updateShareSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid role (VIEW or EDIT) is required." }, { status: 400 });
  }

  try {
    const share = await prisma.share.update({
      where: { documentId_userId: { documentId: id, userId: targetUserId } },
      data: { role: parsed.data.role },
    });
    return NextResponse.json({ share: { userId: share.userId, role: share.role } });
  } catch {
    return NextResponse.json({ error: "That person doesn't have access to this document." }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const callerId = await getSessionUserId();
  if (!callerId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id, userId: targetUserId } = await params;
  const check = await requireOwner(id, callerId);
  if ("error" in check) return check.error;

  await prisma.share.deleteMany({ where: { documentId: id, userId: targetUserId } });
  return NextResponse.json({ ok: true });
}
