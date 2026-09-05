"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** The ⋯ actions menu on an owned document's card/row in the document list. */
export function DocumentMenu({ docId }: { docId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmDelete(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function handleDelete() {
    setBusy(true);
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } finally {
      setBusy(false);
      setOpen(false);
      setConfirmDelete(false);
    }
  }

  return (
    // Stops the click from bubbling up to the card/row's own onClick (which navigates).
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn btn-ghost flex h-7 w-7 items-center justify-center rounded-md text-base leading-none"
        style={{ color: "var(--ream-ink-faint)" }}
        aria-label="Document actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        ⋯
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-[8px] border py-1"
          style={{ borderColor: "var(--ream-border)", background: "var(--ream-surface-solid)", boxShadow: "0 8px 24px oklch(0.2 0.02 265 / 0.15)" }}
        >
          {!confirmDelete ? (
            <>
              <Link
                href={`/documents/${docId}`}
                role="menuitem"
                className="btn btn-ghost block px-3 py-2 text-left text-[13px] no-underline"
                style={{ color: "var(--ream-ink)" }}
              >
                Open
              </Link>
              <Link
                href={`/documents/${docId}?share=1`}
                role="menuitem"
                className="btn btn-ghost block px-3 py-2 text-left text-[13px] no-underline"
                style={{ color: "var(--ream-ink)" }}
              >
                Share…
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => setConfirmDelete(true)}
                className="btn btn-ghost block w-full px-3 py-2 text-left text-[13px]"
                style={{ color: "var(--ream-error-ink)" }}
              >
                Delete…
              </button>
            </>
          ) : (
            <div className="px-3 py-2">
              <div className="mb-2 text-xs" style={{ color: "var(--ream-ink-soft)" }}>
                Delete this document?
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmDelete(false)}
                  className="btn btn-outline flex-1 rounded-md px-2 py-1 text-xs disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleDelete}
                  className="btn flex-1 rounded-md px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
                  style={{ background: "var(--ream-error-ink)" }}
                >
                  {busy ? "…" : "Delete"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
