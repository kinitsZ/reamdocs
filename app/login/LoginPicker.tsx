"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface SeedUser {
  id: string;
  name: string;
  email: string;
  initials: string;
  hint: string;
}

export function LoginPicker({ users }: { users: SeedUser[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(userId: string) {
    setError(null);
    setPendingId(userId);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Couldn't sign in.");
      }
      router.push("/documents");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't sign in.");
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {users.map((u) => (
        <button
          key={u.id}
          type="button"
          disabled={pendingId !== null}
          onClick={() => signIn(u.id)}
          className="btn login-account flex items-center gap-3 rounded-[10px] border px-4 py-3.5 text-left disabled:cursor-wait disabled:opacity-60"
          style={{
            background: "var(--ream-surface)",
            borderColor: "var(--ream-border)",
          }}
        >
          <span
            className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full text-[13px] font-semibold"
            style={{ background: "var(--ream-accent-tint)", color: "var(--ream-accent-tint-ink)" }}
          >
            {u.initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{u.name}</span>
            <span className="block font-mono text-[11px]" style={{ color: "var(--ream-ink-faint)" }}>
              {u.email}
            </span>
          </span>
          <span className="text-xs" style={{ color: "var(--ream-ink-faint)" }}>
            {pendingId === u.id ? "Signing in…" : u.hint}
          </span>
        </button>
      ))}
      {error && (
        <p className="mt-1 text-[13px]" style={{ color: "var(--ream-error-ink)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
