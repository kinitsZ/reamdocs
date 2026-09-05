# Architecture note

## What this is

A single Next.js app (App Router) doing double duty as frontend and backend — no
separate server. Postgres (via Supabase) holds three tables: `User` (seeded),
`Document` (title + Tiptap/ProseMirror JSON content + owner), and `Share`
(document × user × role). That's the entire data model. Sharing is deliberately
flat: an owner and zero-or-more (user, role) grants, no groups, no link sharing,
no nested permissions.

## Why these choices

**Prisma JSON column for document content, not HTML.** Tiptap's native
representation is ProseMirror JSON. Storing HTML instead would mean re-parsing it
back into a ProseMirror doc on every load and risking lossy round-trips (attrs,
marks, node identity). Storing the JSON directly means what comes out of the
editor is exactly what goes back in.

**Tricky logic gets pulled out of components so it can be tested.**
`lib/save-queue.ts` holds the editor's debounced, single-flight autosave. It
started as inline `useRef` bookkeeping inside `Editor.tsx` and had a genuine
data-loss bug: an edit typed while a save was in flight got wiped when that save
completed, and was never sent. Extracting it made the failure case expressible as
a test (`lib/save-queue.test.ts`) instead of something you'd only catch by typing
fast at the right moment.

**No Save button, on purpose.** Autosave plus a status label ("Saving…" /
"Saved 12s ago" / "Couldn't save — retry") is the honest model for a Docs-style
editor. Adding a Save button would imply that unsaved work is lost if you don't
click it, which is a worse promise than the one the app actually keeps.
Cmd/Ctrl+S is intercepted to flush immediately, because people press it
reflexively and the browser's "Save page as" dialog is not what they meant.

**Export renders on the server, without a headless browser.** Markdown goes
through a small serializer (`lib/markdown.ts`, unit tested against the exact node
and mark set this editor can produce). PDF uses `@react-pdf/renderer`, which
produces real vector text rather than a rasterised screenshot, and needs no
Chromium binary — which matters on serverless, where bundling Chromium means a
~50MB function and multi-second cold starts. Both are exposed on one
access-checked route so a view-only collaborator can export, but a stranger gets
a 403.

**Access control as a pure function (`lib/access.ts`), not scattered `if`s.**
`getAccessLevel(doc, userId)` → `"OWNER" | "VIEW" | "EDIT" | null` is the single
source of truth. Every API route and the editor's read-only mode call into it.
It's also the highest-value thing to unit test in this app (`lib/access.test.ts`)
— a bug here either leaks a document or locks out someone who should have
access, and it's the kind of bug that's invisible until someone hits it.

**Server Components read the DB directly; API routes handle mutations.**
`/documents` and `/documents/[id]` query Prisma directly in the page (idiomatic
App Router — no reason to have a Server Component fetch its own API over HTTP).
The API routes under `app/api/**` exist for the actual write operations
(create, rename, autosave, share, import) and are what a client component or an
external caller would hit. `lib/documents.ts` holds the one shared query so the
page and the `GET /api/documents` route don't drift.

**Validation is enforced server-side, always, even where the UI already prevents
the bad path.** A viewer can't see edit controls in the UI, but `PATCH
/api/documents/:id` independently checks `canEdit()` and returns 403 regardless.
File type/size is checked in `lib/validation.ts` and called from both the import
route and (for instant feedback) the client — but the server check is what
actually matters.

**Mocked auth is a cookie holding a user id, nothing more.** No JWT, no signing.
There's no secret being protected — anyone can already see which user ids exist
by picking them off the login screen. Signing the cookie would be security
theater for this build; the actual risk (someone forging another user's session)
was traded off deliberately given the assignment says mocked auth is fine as
long as sharing genuinely works, which it does — the API routes check the real
session on every request, not a client-supplied user id.

**One import path, not two.** The original design mocked up both "upload a file
as a new document" and "attach a file to an existing document, then insert its
converted content into the draft." Building both roughly doubles the file-
handling surface for a single graded requirement. I kept one flow — import
always creates a new document, reachable from both the document list and the
editor toolbar — and cut the second. See README's "deliberately out of scope."

**Pinned Prisma to 6.19.3, not the resolved 7.x/8.0-rc.** `npm install` in this
environment defaulted to Prisma 8.0.0-rc for the CLI (a release candidate) while
`@prisma/client` landed on 6.x — an actual version mismatch, and Prisma 7
introduces mandatory driver adapters, ESM-only output, and a new
`prisma.config.ts`. None of that is worth absorbing mid-build for a scoped
exercise; 6.19.3 is the last release behaving the way Prisma has for the last
couple of years, and both packages are now pinned to the same version.

## What I'd build next (2–4 more hours)

In priority order:
1. **Version history** — the schema already isolates `content` as a single JSON
   blob per document; the natural next step is a `DocumentVersion` table with a
   named-snapshot button, not full CRDT history.
2. **A real "insert file into current document" flow** — the cut half of the
   import feature described above.
3. **Optimistic UI for sharing** (currently correct but not instant — the share
   list re-renders from the server response) and a toast system instead of the
   single inline `notice` banner in the editor.
4. **Playwright e2e coverage** for the three end-to-end flows (create → edit →
   reload; import → verify content; share → sign in as the other user → verify
   access), on top of the current unit tests.
5. **Real-time presence/co-editing** via Yjs, if genuinely warranted — explicitly
   stretch, not attempted here.
