import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { isOwner } from "@/lib/access";

type RouteContext = { params: Promise<{ id: string; userId: string }> };

async function requireOwner(docId: string, callerId: string) {
  const doc = await prisma.document.findUnique({ where: { id: docId } });
  if (!doc) return { error: NextResponse.json({ error: "Document not found." }, { status: 404 }) } as const;
  if (!isOwner(doc, callerId)) {
    return { error: NextResponse.json({ error: "Only the owner can manage access requests." }, { status: 403 }) } as const;
  }
  return { doc } as const;
}

// Approve: grant the requester EDIT access and clear the request.
export async function POST(_request: Request, { params }: RouteContext) {
  const callerId = await getSessionUserId();
  if (!callerId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id, userId: requesterId } = await params;
  const check = await requireOwner(id, callerId);
  if ("error" in check) return check.error;

  const [share] = await prisma.$transaction([
    prisma.share.upsert({
      where: { documentId_userId: { documentId: id, userId: requesterId } },
      update: { role: "EDIT" },
      create: { documentId: id, userId: requesterId, role: "EDIT" },
    }),
    prisma.accessRequest.deleteMany({ where: { documentId: id, userId: requesterId } }),
  ]);

  const user = await prisma.user.findUnique({ where: { id: requesterId } });
  return NextResponse.json({
    share: { userId: share.userId, role: share.role, name: user?.name, email: user?.email, initials: user?.initials },
  });
}

// Dismiss: remove the request without granting anything.
export async function DELETE(_request: Request, { params }: RouteContext) {
  const callerId = await getSessionUserId();
  if (!callerId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id, userId: requesterId } = await params;
  const check = await requireOwner(id, callerId);
  if ("error" in check) return check.error;

  await prisma.accessRequest.deleteMany({ where: { documentId: id, userId: requesterId } });
  return NextResponse.json({ ok: true });
}
