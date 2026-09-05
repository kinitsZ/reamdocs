import { prisma } from "./prisma";
import { extractPlainText } from "./excerpt";

export interface OwnedDocSummary {
  id: string;
  title: string;
  excerpt: string;
  updatedAt: Date;
  shareCount: number;
  pendingRequestCount: number;
}

export interface SharedDocSummary {
  id: string;
  title: string;
  excerpt: string;
  updatedAt: Date;
  ownerName: string;
  role: "VIEW" | "EDIT";
}

/** Shared by the /documents Server Component and GET /api/documents so both agree on shape. */
export async function listDocumentsForUser(
  userId: string
): Promise<{ owned: OwnedDocSummary[]; shared: SharedDocSummary[] }> {
  const [owned, sharedWithMe] = await Promise.all([
    prisma.document.findMany({
      where: { ownerId: userId },
      include: { shares: true, accessRequests: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.document.findMany({
      where: { shares: { some: { userId } } },
      include: { owner: true, shares: { where: { userId } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return {
    owned: owned.map((d) => ({
      id: d.id,
      title: d.title,
      excerpt: extractPlainText(d.content),
      updatedAt: d.updatedAt,
      shareCount: d.shares.length,
      pendingRequestCount: d.accessRequests.length,
    })),
    shared: sharedWithMe.map((d) => ({
      id: d.id,
      title: d.title,
      excerpt: extractPlainText(d.content),
      updatedAt: d.updatedAt,
      ownerName: d.owner.name,
      role: (d.shares[0]?.role ?? "VIEW") as "VIEW" | "EDIT",
    })),
  };
}
