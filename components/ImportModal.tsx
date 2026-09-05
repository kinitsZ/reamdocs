"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { validateImportFile } from "@/lib/validation";

export function ImportModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Same check the API route runs — this one is only for instant feedback, the
  // server's is the one that actually decides.
  function pick(f: File | null) {
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    const validation = validateImportFile({ name: f.name, size: f.size });
    if (!validation.ok) {
      setFile(null);
      setError(validation.message);
      return;
    }
    setFile(f);
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/import", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Import failed.");
      router.push(`/documents/${body.document.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "oklch(0.25 0.015 265 / 0.4)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ream-rise w-full max-w-[470px] overflow-hidden rounded-[14px]"
        style={{ background: "var(--ream-surface-solid)", boxShadow: "0 20px 60px oklch(0.2 0.02 265 / 0.25)" }}
      >
        <div className="px-[22px] pb-3.5 pt-5">
          <div className="text-xl font-medium" style={{ fontFamily: "var(--font-doc)", letterSpacing: "-0.01em" }}>
            Import a file
          </div>
          <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--ream-ink-faint)" }}>
            Becomes a new document you own. Formatting is mapped to Tiptap nodes.
          </div>
        </div>

        <div className="px-[22px] pb-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pick(e.dataTransfer.files?.[0] ?? null);
            }}
            className="btn import-drop w-full rounded-[10px] border border-dashed px-5 py-[34px] text-center"
            style={{
              borderColor: dragging ? "var(--ream-accent)" : "var(--ream-border)",
              background: dragging ? "oklch(0.98 0.012 250)" : "var(--ream-surface)",
            }}
          >
            <div
              className="mx-auto mb-3.5 h-[42px] w-[34px] rounded-[3px] border"
              style={{ background: "var(--ream-border-soft)", borderColor: "var(--ream-border)" }}
            />
            <div className="mb-0.5 text-sm font-medium">
              {file ? file.name : "Drop a file, or browse"}
            </div>
            <div className="font-mono text-[11px]" style={{ color: "var(--ream-ink-faint)" }}>
              .txt · .md · .docx — 5 MB max
            </div>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".txt,.md,.docx"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
        </div>

        {error && (
          <div className="mx-[22px] mb-3 rounded-[8px] border px-3.5 py-2.5 text-[13px]" style={{ background: "var(--ream-error-bg)", borderColor: "var(--ream-error-border)", color: "var(--ream-error-ink)" }}>
            {error}
          </div>
        )}

        <div
          className="mt-3.5 flex items-center gap-2.5 border-t px-[22px] py-4"
          style={{ background: "var(--ream-bg)", borderColor: "var(--ream-border-soft)" }}
        >
          <div className="flex-1 font-mono text-[11px]" style={{ color: "var(--ream-ink-faint)" }}>
            mammoth → HTML → Tiptap
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-outline rounded-[8px] px-3.5 py-2 text-[13px]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!file || busy}
            onClick={submit}
            className="btn btn-primary rounded-[8px] px-4 py-2 text-[13px] font-medium disabled:opacity-50"
          >
            {busy ? "Importing…" : "Create document"}
          </button>
        </div>
      </div>
    </div>
  );
}
