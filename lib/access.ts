// Pure, framework-free access-control logic. Kept separate from the Prisma layer so
// it's trivial to unit test (see lib/access.test.ts) and so the API routes and any
// future surface (e.g. a background job) share one definition of "who can do what."

export type ShareRole = "VIEW" | "EDIT";
export type AccessLevel = "OWNER" | ShareRole;

export interface AccessSubject {
  ownerId: string;
  shares: { userId: string; role: ShareRole }[];
}

/** Returns the caller's access level for a document, or null if they have none. */
export function getAccessLevel(doc: AccessSubject, userId: string): AccessLevel | null {
  if (doc.ownerId === userId) return "OWNER";
  const share = doc.shares.find((s) => s.userId === userId);
  return share ? share.role : null;
}

export function canView(doc: AccessSubject, userId: string): boolean {
  return getAccessLevel(doc, userId) !== null;
}

export function canEdit(doc: AccessSubject, userId: string): boolean {
  const level = getAccessLevel(doc, userId);
  return level === "OWNER" || level === "EDIT";
}

export function isOwner(doc: { ownerId: string }, userId: string): boolean {
  return doc.ownerId === userId;
}
