"use client";

import { useState } from "react";

export interface ShareEntry {
  userId: string;
  name: string;
  email: string;
  initials: string;
  role: "VIEW" | "EDIT";
}

export interface AccessRequestEntry {
  userId: string;
  name: string;
  email: string;
  initials: string;
}

export function ShareModal({
  docId,
  docTitle,
  shares,
  onSharesChange,
  accessRequests: requests,
  onAccessRequestsChange: setRequests,
  onClose,
}: {
  docId: string;
  docTitle: string;
  shares: ShareEntry[];
  onSharesChange: (updater: (prev: ShareEntry[]) => ShareEntry[]) => void;
  accessRequests: AccessRequestEntry[];
  onAccessRequestsChange: (updater: (prev: AccessRequestEntry[]) => AccessRequestEntry[]) => void;
  onClose: () => void;
}) {
  // Controlled by the parent (Editor) rather than owning its own copy — the Share
  // button's badge counts read the same state, so a grant/dismiss/add/remove here
  // needs to be visible the moment the modal closes, not just after a reload.
  const setShares = onSharesChange;
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"VIEW" | "EDIT">("EDIT");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  async function addShare() {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${docId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't share this document.");
      setShares((prev) => [...prev.filter((s) => s.userId !== body.share.userId), body.share]);
      setEmail("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't share this document.");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(userId: string, nextRole: "VIEW" | "EDIT") {
    setShares((prev) => prev.map((s) => (s.userId === userId ? { ...s, role: nextRole } : s)));
    await fetch(`/api/documents/${docId}/shares/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: nextRole }),
    });
  }

  async function removeShare(userId: string) {
    setShares((prev) => prev.filter((s) => s.userId !== userId));
    await fetch(`/api/documents/${docId}/shares/${userId}`, { method: "DELETE" });
  }

  async function approveRequest(request: AccessRequestEntry) {
    setResolvingId(request.userId);
    try {
      const res = await fetch(`/api/documents/${docId}/access-requests/${request.userId}`, { method: "POST" });
      if (!res.ok) throw new Error();
      setRequests((prev) => prev.filter((r) => r.userId !== request.userId));
      setShares((prev) => [...prev.filter((s) => s.userId !== request.userId), { ...request, role: "EDIT" as const }]);
    } catch {
      setError("Couldn't approve that request — try again.");
    } finally {
      setResolvingId(null);
    }
  }

  async function dismissRequest(userId: string) {
    setResolvingId(userId);
    setRequests((prev) => prev.filter((r) => r.userId !== userId));
    await fetch(`/api/documents/${docId}/access-requests/${userId}`, { method: "DELETE" });
    setResolvingId(null);
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "oklch(0.25 0.015 265 / 0.4)" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="ream-rise w-full max-w-[460px] overflow-hidden rounded-[14px]"
        style={{ background: "var(--ream-surface-solid)", boxShadow: "0 20px 60px oklch(0.2 0.02 265 / 0.25)" }}
      >
        <div className="px-[22px] pb-4 pt-5">
          <div className="text-xl font-medium" style={{ fontFamily: "var(--font-doc)", letterSpacing: "-0.01em" }}>
            Share &ldquo;{docTitle}&rdquo;
          </div>
          <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--ream-ink-faint)" }}>
            Invitations resolve against seeded accounts only.
          </div>
        </div>

        <div className="flex gap-2 px-[22px] pb-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addShare()}
            placeholder="Add by email…"
            className="flex-1 rounded-[8px] border px-3 py-2.5 text-[13px] outline-none"
            style={{ borderColor: "var(--ream-border)", background: "var(--ream-surface-solid)" }}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "VIEW" | "EDIT")}
            className="rounded-[8px] border px-3 py-2.5 text-[13px]"
            style={{ borderColor: "var(--ream-border)", background: "var(--ream-surface-solid)" }}
          >
            <option value="EDIT">Can edit</option>
            <option value="VIEW">Can view</option>
          </select>
          <button
            type="button"
            disabled={busy || !email.trim()}
            onClick={addShare}
            className="btn btn-primary rounded-[8px] px-3 py-2 text-[13px] font-medium disabled:opacity-50"
          >
            Add
          </button>
        </div>

        {error && (
          <div className="mx-[22px] mb-3 rounded-[8px] border px-3.5 py-2.5 text-[13px]" style={{ background: "var(--ream-error-bg)", borderColor: "var(--ream-error-border)", color: "var(--ream-error-ink)" }}>
            {error}
          </div>
        )}

        {requests.length > 0 && (
          <div className="px-[22px] pb-3">
            <div className="mb-1.5 font-mono text-[10.5px] uppercase" style={{ letterSpacing: "0.07em", color: "var(--ream-amber)" }}>
              Requesting edit access
            </div>
            <div className="flex flex-col gap-1.5">
              {requests.map((r) => (
                <div
                  key={r.userId}
                  className="flex items-center gap-[11px] rounded-[8px] border px-2.5 py-2"
                  style={{ borderColor: "var(--ream-amber-border)", background: "var(--ream-amber-tint)" }}
                >
                  <div
                    className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[11px] font-semibold"
                    style={{ background: "var(--ream-surface-solid)", color: "var(--ream-amber-tint-ink)" }}
                  >
                    {r.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{r.name}</div>
                  </div>
                  <button
                    type="button"
                    disabled={resolvingId === r.userId}
                    onClick={() => dismissRequest(r.userId)}
                    className="btn btn-text text-xs disabled:opacity-60"
                    style={{ color: "var(--ream-ink-soft)" }}
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    disabled={resolvingId === r.userId}
                    onClick={() => approveRequest(r)}
                    className="btn rounded-[6px] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
                    style={{ background: "var(--ream-amber-tint-ink)" }}
                  >
                    {resolvingId === r.userId ? "…" : "Grant edit"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="px-[22px] pb-2 font-mono text-[10.5px] uppercase" style={{ letterSpacing: "0.07em", color: "var(--ream-ink-faint)" }}>
          People with access
        </div>
        <div className="max-h-[240px] overflow-y-auto px-[22px] pb-1.5">
          {shares.length === 0 && (
            <div className="py-3 text-[13px]" style={{ color: "var(--ream-ink-faint)" }}>
              Not shared with anyone yet.
            </div>
          )}
          {shares.map((s) => (
            <div key={s.userId} className="flex items-center gap-[11px] border-b py-2.5" style={{ borderColor: "oklch(0.95 0.006 85)" }}>
              <div
                className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-[11.5px] font-semibold"
                style={{ background: "var(--ream-accent-tint)", color: "var(--ream-accent-tint-ink)" }}
              >
                {s.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium">{s.name}</div>
                <div className="truncate font-mono text-[11px]" style={{ color: "var(--ream-ink-faint)" }}>{s.email}</div>
              </div>
              <select
                value={s.role}
                onChange={(e) => changeRole(s.userId, e.target.value as "VIEW" | "EDIT")}
                className="text-[12.5px]"
                style={{ color: "var(--ream-ink-soft)" }}
              >
                <option value="EDIT">Can edit</option>
                <option value="VIEW">Can view</option>
              </select>
              <button
                type="button"
                onClick={() => removeShare(s.userId)}
                className="btn btn-text text-xs"
                style={{ color: "var(--ream-error-ink-soft)" }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2.5 border-t px-[22px] py-3.5" style={{ background: "var(--ream-bg)", borderColor: "var(--ream-border-soft)" }}>
          <div className="flex-1 font-mono text-[11px]" style={{ color: "var(--ream-ink-soft)" }}>No link sharing in this build</div>
          <button type="button" onClick={onClose} className="btn btn-primary rounded-[8px] px-4 py-2 text-[13px] font-medium">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
