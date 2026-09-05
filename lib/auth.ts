import { cookies } from "next/headers";
import { prisma } from "./prisma";

// Mocked auth: no passwords. Signing in as a seeded user just drops that user's id
// into an httpOnly cookie. There is nothing secret in the cookie value (it's a
// public-ish id, not a credential), so no signing/JWT is needed for this build —
// see the architecture note for the tradeoff.
export const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || "ream_session";

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function getCurrentUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}

/** Server Component / layout guard. Use in Route Handlers via getSessionUserId + 401 instead. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) return null;
  return user;
}
