import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { LoginPicker } from "./LoginPicker";

// Purely cosmetic — describes each seeded account's role across the demo documents
// so a reviewer knows which account to pick to see a given side of the sharing model.
const HINTS: Record<string, string> = {
  "maya@ream.app": "owner",
  "sam@ream.app": "editor",
  "priya@ream.app": "viewer",
};

export default async function LoginPage() {
  const existing = await getSessionUserId();
  if (existing) redirect("/documents");

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="ream-rise w-full max-w-[430px]">
        <div
          className="mb-2.5 font-mono text-[11px] uppercase"
          style={{ letterSpacing: "0.08em", color: "var(--ream-ink-faint)" }}
        >
          Demo sign-in
        </div>
        <h1
          className="mb-2 text-[34px] font-medium leading-[1.15]"
          style={{ fontFamily: "var(--font-doc)", letterSpacing: "-0.015em" }}
        >
          Pick a seeded account
        </h1>
        <p className="mb-6 max-w-[40ch] text-sm leading-relaxed" style={{ color: "var(--ream-ink-soft)" }}>
          No passwords in this build. Choosing an account sets a session cookie, so you can open the
          same document as owner and as an invited editor or viewer.
        </p>

        {users.length === 0 ? (
          <div
            className="rounded-[10px] border p-4 text-sm"
            style={{ borderColor: "var(--ream-error-border)", background: "var(--ream-error-bg)", color: "var(--ream-error-ink)" }}
          >
            No seeded users found. Run <code>npm run db:seed</code> (or the SQL fallback in
            <code> prisma/seed.sql</code>) against your database first.
          </div>
        ) : (
          <LoginPicker
            users={users.map((u) => ({
              id: u.id,
              name: u.name,
              email: u.email,
              initials: u.initials,
              hint: HINTS[u.email] ?? "",
            }))}
          />
        )}

        <div className="mt-5 font-mono text-[11px] leading-[1.7]" style={{ color: "var(--ream-ink-faint)" }}>
          seeded by prisma/seed.ts (or prisma/seed.sql) · session in an httpOnly cookie
        </div>
      </div>
    </div>
  );
}
