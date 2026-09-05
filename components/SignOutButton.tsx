"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className="btn btn-text text-xs disabled:opacity-60"
      style={{ color: "var(--ream-ink-faint)" }}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
