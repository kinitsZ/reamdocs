"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OwnedDocSummary, SharedDocSummary } from "@/lib/documents";
import { relativeTime } from "@/lib/relative-time";
import { ImportModal } from "./ImportModal";
import { DocumentMenu } from "./DocumentMenu";

/** Clickable card/row that also hosts a nested ⋯ menu — a real <button> can't
 * legally contain other interactive elements (links, buttons), so this is a div
 * with button semantics instead, with click-to-navigate and full keyboard support. */
function ClickableRow({
  onOpen,
  className,
  style,
  children,
}: {
  onOpen: () => void;
  className: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={className}
      style={style}
    >
      {children}
    </div>
  );
}

type View = "grid" | "table";

export function DocumentList({ owned, shared }: { owned: OwnedDocSummary[]; shared: SharedDocSummary[] }) {
  const router = useRouter();
  const [view, setView] = useState<View>("grid");
  const [importOpen, setImportOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  async function createDocument() {
    setCreating(true);
    try {
      const res = await fetch("/api/documents", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't create document.");
      router.push(`/documents/${body.document.id}`);
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  const totalCount = owned.length + shared.length;
  const countLine = `${owned.length} owned · ${shared.length} shared with you`;

  return (
    <div className="flex-1 px-5 pb-20 pt-9">
      <div className="mx-auto max-w-[980px]">
        <div className="mb-6 flex flex-wrap items-end gap-4">
          <div className="min-w-[220px] flex-1">
            <h1 className="mb-1 text-[32px] font-medium" style={{ fontFamily: "var(--font-doc)", letterSpacing: "-0.015em" }}>
              Documents
            </h1>
            <div className="text-[13px]" style={{ color: "var(--ream-ink-soft)" }}>{countLine}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 rounded-[8px] p-[3px]" style={{ background: "oklch(0.93 0.008 85)" }}>
              <button
                type="button"
                onClick={() => setView("grid")}
                className={`btn rounded-[6px] px-3 py-1.5 text-xs font-medium ${view === "grid" ? "" : "btn-ghost"}`}
                style={view === "grid" ? { background: "var(--ream-surface)", color: "var(--ream-ink)" } : { color: "var(--ream-ink-soft)" }}
              >
                Grid
              </button>
              <button
                type="button"
                onClick={() => setView("table")}
                className={`btn rounded-[6px] px-3 py-1.5 text-xs font-medium ${view === "table" ? "" : "btn-ghost"}`}
                style={view === "table" ? { background: "var(--ream-surface)", color: "var(--ream-ink)" } : { color: "var(--ream-ink-soft)" }}
              >
                Table
              </button>
            </div>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="btn btn-outline rounded-[8px] px-3.5 py-2 text-[13px] font-medium"
            >
              Import file
            </button>
            <button
              type="button"
              disabled={creating}
              onClick={createDocument}
              className="btn btn-primary rounded-[8px] px-4 py-2 text-[13px] font-medium disabled:opacity-60"
            >
              {creating ? "Creating…" : "New document"}
            </button>
          </div>
        </div>

        {totalCount === 0 ? (
          <EmptyDocuments onNew={createDocument} onImport={() => setImportOpen(true)} creating={creating} />
        ) : (
          <>
            <SectionLabel color="var(--ream-ink-faint)">Owned by you</SectionLabel>
            {owned.length === 0 ? (
              <MiniPrompt onNew={createDocument} onImport={() => setImportOpen(true)} creating={creating} />
            ) : view === "grid" ? (
              <GridView docs={owned} />
            ) : (
              <TableView docs={owned} />
            )}

            <div className="mt-8">
              <SectionLabel color="var(--ream-amber)">Shared with you</SectionLabel>
              {shared.length === 0 ? <NoSharedDocs /> : <SharedTable docs={shared} />}
            </div>
          </>
        )}

        <div className="mt-6 font-mono text-[11px] leading-[1.8]" style={{ color: "var(--ream-ink-faint)" }}>
          Imports: .txt · .md · .docx — 5 MB max
        </div>
      </div>

      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
    </div>
  );
}

function SectionLabel({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div className="pb-3 font-mono text-[11px] uppercase" style={{ letterSpacing: "0.08em", color }}>
      {children}
    </div>
  );
}

function RequestBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
      style={{ background: "var(--ream-amber)" }}
    >
      {count} request{count > 1 ? "s" : ""}
    </span>
  );
}

function GridView({ docs }: { docs: OwnedDocSummary[] }) {
  const router = useRouter();
  return (
    <div className="mb-8 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
      {docs.map((d) => (
        <ClickableRow
          key={d.id}
          onOpen={() => router.push(`/documents/${d.id}`)}
          className="btn card-hover relative overflow-hidden rounded-[10px] border text-left"
          style={{ borderColor: "var(--ream-border)", background: "var(--ream-surface)" }}
        >
          <div className="absolute right-1.5 top-1.5 z-10">
            <DocumentMenu docId={d.id} />
          </div>
          <div
            className="h-[132px] overflow-hidden border-b px-4 pt-4"
            style={{ background: "var(--ream-surface-solid)", borderColor: "var(--ream-border-soft)" }}
          >
            <div className="mb-1.5 truncate pr-7 text-xs font-semibold" style={{ fontFamily: "var(--font-doc)", color: "oklch(0.3 0.015 265)" }}>
              {d.title}
            </div>
            <div className="line-clamp-5 text-[10px] leading-[1.6]" style={{ color: "var(--ream-ink-faint)" }}>
              {d.excerpt || "Empty document."}
            </div>
          </div>
          <div className="px-3.5 py-2.5">
            <div className="truncate text-[13px] font-medium">{d.title}</div>
            <div className="mt-0.5 flex items-center justify-between gap-2 text-[11.5px]" style={{ color: "var(--ream-ink-faint)" }}>
              <span>{relativeTime(d.updatedAt)}</span>
              <span className="flex items-center gap-1.5">
                <RequestBadge count={d.pendingRequestCount} />
                {d.shareCount > 0 ? `Shared · ${d.shareCount}` : "Private"}
              </span>
            </div>
          </div>
        </ClickableRow>
      ))}
    </div>
  );
}

function TableView({ docs }: { docs: OwnedDocSummary[] }) {
  const router = useRouter();
  const columns = "minmax(0,1fr) 130px 140px 32px";
  return (
    <div className="mb-8 overflow-hidden rounded-xl border" style={{ borderColor: "var(--ream-border)", background: "var(--ream-surface)" }}>
      <div
        className="grid gap-4 px-[18px] py-2.5 font-mono text-[10.5px] uppercase"
        style={{ gridTemplateColumns: columns, letterSpacing: "0.07em", color: "var(--ream-ink-faint)", background: "oklch(0.975 0.006 85)" }}
      >
        <div>Name</div>
        <div>Last edited</div>
        <div className="text-right">Access</div>
        <div />
      </div>
      {docs.map((d) => (
        <ClickableRow
          key={d.id}
          onOpen={() => router.push(`/documents/${d.id}`)}
          className="btn row-hover grid w-full items-center gap-4 border-t px-[18px] py-3 text-left"
          style={{ gridTemplateColumns: columns, borderColor: "var(--ream-border-soft)" }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-[30px] w-6 flex-none rounded-[3px] border" style={{ background: "var(--ream-accent-tint)", borderColor: "oklch(0.86 0.03 250)" }} />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{d.title}</div>
              <div className="truncate text-xs" style={{ color: "var(--ream-ink-faint)" }}>{d.excerpt || "Empty document."}</div>
            </div>
          </div>
          <div className="text-xs" style={{ color: "var(--ream-ink-soft)" }}>{relativeTime(d.updatedAt)}</div>
          <div className="flex items-center justify-end gap-1.5 text-right text-xs" style={{ color: "var(--ream-ink-soft)" }}>
            <RequestBadge count={d.pendingRequestCount} />
            {d.shareCount > 0 ? `Shared · ${d.shareCount}` : "Private"}
          </div>
          <div className="flex justify-end">
            <DocumentMenu docId={d.id} />
          </div>
        </ClickableRow>
      ))}
    </div>
  );
}

function SharedTable({ docs }: { docs: SharedDocSummary[] }) {
  const router = useRouter();
  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--ream-amber-border)", background: "var(--ream-surface)" }}>
      {docs.map((d, i) => (
        <button
          key={d.id}
          type="button"
          onClick={() => router.push(`/documents/${d.id}`)}
          className="btn row-hover-amber grid w-full items-center gap-4 px-[18px] py-3 text-left"
          style={{
            gridTemplateColumns: "minmax(0,1fr) 130px 120px",
            borderTop: i === 0 ? undefined : "1px solid oklch(0.955 0.012 60)",
          }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-[30px] w-6 flex-none rounded-[3px] border" style={{ background: "var(--ream-amber-tint)", borderColor: "oklch(0.87 0.06 60)" }} />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{d.title}</div>
              <div className="truncate text-xs" style={{ color: "var(--ream-ink-faint)" }}>{d.ownerName}</div>
            </div>
          </div>
          <div className="text-xs" style={{ color: "var(--ream-ink-soft)" }}>{relativeTime(d.updatedAt)}</div>
          <div className="text-right">
            <span
              className="inline-block rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{ background: "var(--ream-amber-tint)", color: "var(--ream-amber-tint-ink)" }}
            >
              {d.role === "EDIT" ? "Can edit" : "View only"}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

function EmptyDocuments({ onNew, onImport, creating }: { onNew: () => void; onImport: () => void; creating: boolean }) {
  return (
    <div className="rounded-xl border px-8 py-[54px] text-center" style={{ borderColor: "var(--ream-border)", background: "var(--ream-surface)" }}>
      <div className="mx-auto mb-[18px] h-[54px] w-11 rounded-[4px] border border-dashed" style={{ background: "var(--ream-border-soft)", borderColor: "oklch(0.8 0.01 85)" }} />
      <div className="mb-1.5 text-xl font-medium" style={{ fontFamily: "var(--font-doc)" }}>Nothing here yet</div>
      <div className="mx-auto mb-5 max-w-[42ch] text-sm leading-relaxed" style={{ color: "var(--ream-ink-soft)" }}>
        Start a blank document, or bring one you already wrote — .txt, .md and .docx come in as editable content, not attachments.
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" disabled={creating} onClick={onNew} className="btn btn-primary rounded-[8px] px-4 py-2 text-[13px] font-medium disabled:opacity-60">
          New document
        </button>
        <button type="button" onClick={onImport} className="btn btn-outline rounded-[8px] px-4 py-2 text-[13px] font-medium">
          Import a file
        </button>
      </div>
    </div>
  );
}

function MiniPrompt({ onNew, onImport, creating }: { onNew: () => void; onImport: () => void; creating: boolean }) {
  return (
    <div className="mb-8 flex flex-wrap items-center gap-3 rounded-xl border px-5 py-4" style={{ borderColor: "var(--ream-border)", background: "var(--ream-surface)" }}>
      <div className="flex-1 text-sm" style={{ color: "var(--ream-ink-soft)" }}>You don&apos;t own any documents yet.</div>
      <button type="button" disabled={creating} onClick={onNew} className="btn btn-primary rounded-[8px] px-3.5 py-1.5 text-[13px] font-medium disabled:opacity-60">
        New document
      </button>
      <button type="button" onClick={onImport} className="btn btn-outline rounded-[8px] px-3.5 py-1.5 text-[13px] font-medium">
        Import a file
      </button>
    </div>
  );
}

function NoSharedDocs() {
  return (
    <div
      className="flex flex-wrap items-center gap-[18px] rounded-xl border border-dashed px-[30px] py-[30px]"
      style={{ borderColor: "var(--ream-amber-border)", background: "var(--ream-surface)" }}
    >
      <div className="min-w-[240px] flex-1">
        <div className="mb-1 text-[15px] font-medium">No one has shared a document with you</div>
        <div className="text-[13.5px] leading-relaxed" style={{ color: "var(--ream-ink-soft)" }}>
          Ask an owner to share a document with your account to see the flow from the other side —
          try signing in as Maya and sharing <em>Q3 Product Review</em>.
        </div>
      </div>
    </div>
  );
}
