import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { isOwner } from "@/lib/access";
import { addShareSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = addShareSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  if (!isOwner(doc, userId)) {
    return NextResponse.json({ error: "Only the owner can share this document." }, { status: 403 });
  }

  const target = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!target) {
    return NextResponse.json(
      {
        error:
          "No account for that email. This build only shares with seeded users: maya@ream.app, sam@ream.app or priya@ream.app.",
      },
      { status: 404 }
    );
  }
  if (target.id === doc.ownerId) {
    return NextResponse.json({ error: "That person already owns this document." }, { status: 400 });
  }

  const share = await prisma.share.upsert({
    where: { documentId_userId: { documentId: id, userId: target.id } },
    update: { role: parsed.data.role },
    create: { documentId: id, userId: target.id, role: parsed.data.role },
  });

  return NextResponse.json({
    share: { userId: target.id, name: target.name, email: target.email, initials: target.initials, role: share.role },
  });
}
