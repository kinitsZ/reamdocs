"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import { tiptapExtensions } from "@/lib/tiptap-extensions";
import { relativeTime } from "@/lib/relative-time";
import { createSaveQueue, type SaveState } from "@/lib/save-queue";
import { ShareModal, type ShareEntry, type AccessRequestEntry } from "./ShareModal";
import { ImportModal } from "./ImportModal";

type Access = "OWNER" | "EDIT" | "VIEW";

const HEADING_OPTIONS = [
  { label: "Normal text", level: 0 },
  { label: "Heading 1", level: 1 },
  { label: "Heading 2", level: 2 },
  { label: "Heading 3", level: 3 },
];

export function Editor({
  doc,
  access,
  shares: initialShares,
  accessRequests: initialAccessRequests,
  hasPendingRequest,
}: {
  doc: { id: string; title: string; content: JSONContent; ownerName: string };
  access: Access;
  shares: ShareEntry[];
  accessRequests: AccessRequestEntry[];
  hasPendingRequest: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canEdit = access === "OWNER" || access === "EDIT";
  const isOwner = access === "OWNER";

  const [title, setTitle] = useState(doc.title);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(() => searchParams.get("share") === "1");
  const [importOpen, setImportOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [requestSent, setRequestSent] = useState(hasPendingRequest);
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [, forceTick] = useState(0);

  // Owned here (not by ShareModal) so the Share button's badge counts update the
  // instant something resolves inside the modal, not just after a page reload.
  const [shares, setShares] = useState<ShareEntry[]>(initialShares);
  const [accessRequests, setAccessRequests] = useState<AccessRequestEntry[]>(initialAccessRequests);

  // Support deep-linking straight into "Share" (used by the document list's ⋯ menu)
  // via ?share=1, then drop the param so a refresh doesn't reopen the modal.
  useEffect(() => {
    if (searchParams.get("share") === "1") {
      router.replace(`/documents/${doc.id}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render periodically so the "Saved Ns ago" label stays fresh without a live clock component.
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  // Debounce/single-flight behaviour lives in lib/save-queue.ts so the tricky
  // "edited while a save was in flight" path can be unit tested.
  const queue = useMemo(
    () =>
      createSaveQueue<JSONContent>({
        delay: 800,
        onStateChange: setSaveState,
        onSaved: setLastSavedAt,
        save: async (content) => {
          const res = await fetch(`/api/documents/${doc.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
          });
          if (!res.ok) throw new Error("Save rejected");
        },
      }),
    [doc.id]
  );

  const editor = useEditor({
    extensions: useMemo(
      () => [...tiptapExtensions, Placeholder.configure({ placeholder: "Start writing…" })],
      []
    ),
    content: doc.content,
    editable: canEdit,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "ream-prose" },
    },
    onUpdate: ({ editor }) => {
      if (!canEdit) return;
      queue.schedule(editor.getJSON());
    },
  });

  // People hit Cmd/Ctrl+S reflexively in an editor. There's no Save button by
  // design (autosave + a status label is the honest model), but intercepting the
  // shortcut to flush immediately beats the browser's "Save page as" dialog.
  useEffect(() => {
    if (!canEdit) return;
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void queue.flushNow();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canEdit, queue]);

  useEffect(() => {
    const docId = doc.id;
    return () => {
      queue.cancelScheduled();
      // Navigating away inside the debounce window would otherwise drop the last
      // edits. `keepalive` lets the request outlive the unmount/page transition.
      const unsaved = queue.pendingValue;
      if (unsaved !== null) {
        fetch(`/api/documents/${docId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: unsaved }),
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, [doc.id, queue]);

  // Tracks the last title the server accepted, so "rename away and back again"
  // still saves, and a failed rename can roll the input back.
  const savedTitle = useRef(doc.title);

  async function saveTitle(next: string) {
    const trimmed = next.trim();
    if (!trimmed) {
      setTitle(savedTitle.current); // empty titles aren't allowed — revert the input
      return;
    }
    if (trimmed === savedTitle.current) {
      setTitle(trimmed);
      return;
    }

    setTitle(trimmed);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) throw new Error();
      savedTitle.current = trimmed;
    } catch {
      setTitle(savedTitle.current);
      setNotice("Couldn't rename the document — try again.");
    }
  }

  function retrySave() {
    void queue.flushNow();
  }

  async function requestAccess() {
    setRequestingAccess(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}/access-requests`, { method: "POST" });
      if (!res.ok) throw new Error();
      setRequestSent(true);
    } catch {
      setNotice("Couldn't send the request — try again.");
    } finally {
      setRequestingAccess(false);
    }
  }

  async function deleteDocument() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/documents");
      router.refresh();
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
      setNotice("Couldn't delete the document — try again.");
    }
  }

  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "error"
      ? "Couldn't save"
      : lastSavedAt
      ? `Saved ${relativeTime(lastSavedAt)}`
      : "";

  const currentHeadingLevel = editor?.isActive("heading", { level: 1 })
    ? 1
    : editor?.isActive("heading", { level: 2 })
    ? 2
    : editor?.isActive("heading", { level: 3 })
    ? 3
    : 0;

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b px-5 pt-3" style={{ background: "var(--ream-surface)", borderColor: "var(--ream-border)" }}>
        <div className="mx-auto max-w-[1080px]">
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={title}
              disabled={!canEdit}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={(e) => saveTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="-ml-2 min-w-0 flex-none rounded-md px-2 py-0.5 disabled:cursor-default"
              style={{
                fontFamily: "var(--font-doc)",
                fontSize: 21,
                fontWeight: 500,
                letterSpacing: "-0.01em",
                width: `${Math.max(title.length, 4) + 1}ch`,
                background: "transparent",
              }}
            />
            {saveLabel && (
              <button
                type="button"
                onClick={saveState === "error" ? retrySave : undefined}
                className={`btn font-mono text-[11px] ${saveState === "error" ? "btn-text" : ""}`}
                style={{ color: saveState === "error" ? "var(--ream-error-ink)" : "var(--ream-ink-faint)", cursor: saveState === "error" ? "pointer" : "default" }}
              >
                {saveLabel}
                {saveState === "error" ? " — retry" : ""}
              </button>
            )}
            <div className="flex-1" />

            <ExportMenu docId={doc.id} />

            {isOwner && confirmDelete ? (
              <div className="flex items-center gap-2 rounded-[8px] border px-2.5 py-1.5" style={{ borderColor: "var(--ream-error-border)", background: "var(--ream-error-bg)" }}>
                <span className="text-xs" style={{ color: "var(--ream-error-ink)" }}>Delete this document?</span>
                <button type="button" disabled={deleting} onClick={() => setConfirmDelete(false)} className="btn btn-text text-xs font-medium disabled:opacity-60">
                  Cancel
                </button>
                <button type="button" disabled={deleting} onClick={deleteDocument} className="btn btn-text text-xs font-medium disabled:opacity-60" style={{ color: "var(--ream-error-ink)" }}>
                  {deleting ? "Deleting…" : "Yes, delete"}
                </button>
              </div>
            ) : isOwner ? (
              <button type="button" onClick={() => setConfirmDelete(true)} className="btn btn-text text-xs" style={{ color: "var(--ream-ink-faint)" }}>
                Delete
              </button>
            ) : null}

            {isOwner ? (
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="btn btn-primary relative rounded-[8px] px-4 py-2 text-[13px] font-medium"
              >
                Share{shares.length > 0 ? ` · ${shares.length}` : ""}
                {accessRequests.length > 0 && (
                  <span
                    className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white"
                    style={{ background: "var(--ream-amber)" }}
                  >
                    {accessRequests.length}
                  </span>
                )}
              </button>
            ) : (
              <span className="text-xs" style={{ color: "var(--ream-ink-faint)" }}>
                {access === "VIEW" ? "View only" : "Can edit"} · owned by {doc.ownerName}
              </span>
            )}
          </div>

          {canEdit && editor && (
            <div className="flex flex-wrap items-center gap-0.5 py-2">
              <ToolbarButton label="B" bold onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} />
              <ToolbarButton label="I" italic onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} />
              <ToolbarButton label="U" underline onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} />
              <ToolbarButton label="S" strike onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} />
              <Divider />
              <select
                value={currentHeadingLevel}
                onChange={(e) => {
                  const level = Number(e.target.value);
                  if (level === 0) editor.chain().focus().setParagraph().run();
                  else editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run();
                }}
                className="h-[30px] cursor-pointer rounded-md border-0 px-2 text-[13px]"
                style={{ background: "transparent" }}
              >
                {HEADING_OPTIONS.map((h) => (
                  <option key={h.level} value={h.level}>
                    {h.label}
                  </option>
                ))}
              </select>
              <Divider />
              <ToolbarButton label="•" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} />
              <ToolbarButton label="1." onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} />
              <ToolbarButton label="❝" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} />
              <Divider />
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="btn btn-ghost flex h-[30px] items-center rounded-md px-2.5 text-[13px]"
                style={{ color: "var(--ream-ink-soft)" }}
              >
                Insert file
              </button>
              <div className="flex-1" />
              <div className="font-mono text-[10.5px]" style={{ color: "var(--ream-ink-faint)" }}>
                Tiptap · ProseMirror JSON
              </div>
            </div>
          )}
        </div>
      </div>

      {!canEdit && (
        <div className="mx-auto mt-4 w-full max-w-[760px] px-5">
          <div className="flex items-center gap-3 rounded-[10px] border px-4 py-3.5" style={{ background: "var(--ream-surface)", borderColor: "var(--ream-border)" }}>
            <div className="h-6 w-[6px] flex-none rounded-[3px]" style={{ background: "oklch(0.75 0.01 85)" }} />
            <div className="flex-1">
              <div className="text-sm font-medium">Read-only</div>
              <div className="mt-0.5 text-[13px]" style={{ color: "var(--ream-ink-soft)" }}>
                {doc.ownerName} shared this with view access. Ask them for edit access to make changes.
              </div>
            </div>
            {requestSent ? (
              <span className="flex-none text-xs" style={{ color: "var(--ream-ink-faint)" }}>
                Request sent ✓
              </span>
            ) : (
              <button
                type="button"
                disabled={requestingAccess}
                onClick={requestAccess}
                className="btn btn-text flex-none text-xs disabled:opacity-60"
                style={{ color: "var(--ream-accent)" }}
              >
                {requestingAccess ? "Sending…" : "Request access"}
              </button>
            )}
          </div>
        </div>
      )}

      {notice && (
        <div className="mx-auto mt-4 w-full max-w-[760px] px-5">
          <div className="flex items-center gap-3 rounded-[10px] border px-4 py-3" style={{ background: "var(--ream-warn-bg)", borderColor: "var(--ream-warn-border)" }}>
            <div className="h-5 w-[6px] flex-none rounded-[3px]" style={{ background: "var(--ream-warn-dot)" }} />
            <div className="flex-1 text-[13px]">{notice}</div>
            <button type="button" onClick={() => setNotice(null)} className="btn btn-text text-xs font-medium" style={{ color: "var(--ream-ink-soft)" }}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 justify-center px-5 pb-24 pt-7">
        <div className="w-full max-w-[760px]">
          <div
            className="rounded-[4px] border px-7 py-[60px] sm:px-[74px]"
            style={{ background: "var(--ream-surface-solid)", borderColor: "var(--ream-border)", boxShadow: "0 1px 2px oklch(0.5 0.01 265 / 0.05), 0 10px 28px oklch(0.5 0.01 265 / 0.05)" }}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {shareOpen && (
        <ShareModal
          docId={doc.id}
          docTitle={title}
          shares={shares}
          onSharesChange={setShares}
          accessRequests={accessRequests}
          onAccessRequestsChange={setAccessRequests}
          onClose={() => setShareOpen(false)}
        />
      )}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
    </div>
  );
}

function Divider() {
  return <div className="mx-2 h-5 w-px" style={{ background: "var(--ream-border)" }} />;
}

/** Export is available to anyone who can open the document, viewers included. */
function ExportMenu({ docId }: { docId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn btn-outline rounded-[8px] px-3 py-1.5 text-xs font-medium"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Export
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-[8px] border py-1"
          style={{
            borderColor: "var(--ream-border)",
            background: "var(--ream-surface-solid)",
            boxShadow: "0 8px 24px oklch(0.2 0.02 265 / 0.15)",
          }}
        >
          <a
            href={`/api/documents/${docId}/export?format=md`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="btn btn-ghost block px-3 py-2 text-left text-[13px] no-underline"
            style={{ color: "var(--ream-ink)" }}
          >
            Markdown (.md)
          </a>
          <a
            href={`/api/documents/${docId}/export?format=pdf`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="btn btn-ghost block px-3 py-2 text-left text-[13px] no-underline"
            style={{ color: "var(--ream-ink)" }}
          >
            PDF (.pdf)
          </a>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  active,
  bold,
  italic,
  underline,
  strike,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn flex h-[30px] w-[30px] items-center justify-center rounded-md text-sm ${active ? "btn-ghost-accent" : "btn-ghost"}`}
      style={{
        background: active ? "var(--ream-accent-tint)" : "transparent",
        color: active ? "var(--ream-accent-tint-ink)" : "var(--ream-ink)",
        fontWeight: bold ? 700 : undefined,
        fontStyle: italic ? "italic" : undefined,
        fontFamily: italic ? "var(--font-doc)" : undefined,
        textDecoration: underline ? "underline" : strike ? "line-through" : undefined,
      }}
    >
      {label}
    </button>
  );
}
