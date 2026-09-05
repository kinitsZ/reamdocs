import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { canView, getAccessLevel } from "@/lib/access";
import { Editor } from "@/components/Editor";
import type { JSONContent } from "@tiptap/react";

export default async function DocumentPage({ params }: PageProps<"/documents/[id]">) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const { id } = await params;
  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      owner: true,
      shares: { include: { user: true } },
      accessRequests: { include: { user: true } },
    },
  });

  if (!doc) notFound();
  if (!canView(doc, userId)) notFound(); // don't reveal that a document exists to someone with no access

  const access = getAccessLevel(doc, userId)!;
  const isOwner = access === "OWNER";

  return (
    <Editor
      doc={{
        id: doc.id,
        title: doc.title,
        content: doc.content as JSONContent,
        ownerName: doc.owner.name,
      }}
      access={access}
      shares={doc.shares.map((s) => ({
        userId: s.userId,
        name: s.user.name,
        email: s.user.email,
        initials: s.user.initials,
        role: s.role,
      }))}
      accessRequests={
        isOwner
          ? doc.accessRequests.map((r) => ({
              userId: r.userId,
              name: r.user.name,
              email: r.user.email,
              initials: r.user.initials,
            }))
          : []
      }
      hasPendingRequest={!isOwner && doc.accessRequests.some((r) => r.userId === userId)}
    />
  );
}
