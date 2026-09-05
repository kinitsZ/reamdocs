# Ream — a lightweight collaborative document editor

A small Google-Docs-inspired editor: create/rename/edit rich-text documents, import
`.txt`/`.md`/`.docx` files as new documents, and share documents with other seeded
users at View or Edit access. Built on Next.js App Router (API routes for the
backend), Prisma + Postgres (via Supabase), and Tiptap for the editor.

**Live app:** https://reamdocs.vercel.app
**Seeded test accounts** (pick one from the sign-in screen, no password):
| Email | Suggested role to test |
|---|---|
| `maya@ream.app` | Owner of the demo documents — try sharing one from here |
| `sam@ream.app` | Has **Edit** access to Maya's "Q3 Product Review" |
| `priya@ream.app` | Has **View only** access to the same document — see the read-only editor |

## Features

- **Documents**: create, rename (click the title in the editor), edit, autosave (debounced, ~800ms after you stop typing), reopen after refresh, delete (owner-only, with an inline confirm rather than a silent one-way action).
- **Rich text** (Tiptap): bold, italic, underline, strikethrough, headings (H1–H3), bullet/numbered lists, blockquote.
- **Import**: upload a `.txt`, `.md`, or `.docx` file (5 MB max) and it becomes a new document you own, converted into the same node/mark set the editor renders (`.docx` via `mammoth` → HTML → Tiptap JSON; `.md` via `marked` → HTML → Tiptap JSON; `.txt` mapped to paragraphs directly). Unsupported types and oversized files are rejected with a clear message, both client- and server-side.
- **Sharing**: the owner can grant another seeded user View or Edit access by email, change or revoke it later. Owned and shared-with-you documents are visually distinct (shared items carry an amber accent) everywhere in the list.
- **Access control**: View-access users get a read-only editor with a banner explaining why, rather than a disabled-but-editable one. All of this is enforced server-side in the API routes, not just hidden in the UI.
- **Request access**: a view-only user can ask the owner to upgrade them to edit access. It's an on-site request, not an email/push notification — the owner sees a badge on the document in their list and a "Requesting edit access" section in the Share dialog, with one-click Grant/Dismiss.
- **Quick actions (⋯ menu)**: each owned document in the list has Open / Share / Export / Delete without needing to open it first.
- **Export** (stretch): any document you can open can be exported as **Markdown** or **PDF**. Both are generated server-side at `GET /api/documents/[id]/export?format=md|pdf` and access-checked like everything else. The PDF is real vector text (selectable/searchable), not a screenshot — rendered with `@react-pdf/renderer`, no headless browser required.
- **Cmd/Ctrl+S** forces an immediate save. There's deliberately no Save button — see the architecture note.
- **Auth**: mocked — pick one of 3 seeded users, no password. Sets an httpOnly session cookie. See "Why mocked auth" below.

## Tech stack

- **Next.js 16** (App Router, Turbopack, API routes) — see "A note on bleeding-edge versions" below.
- **Prisma 6.19.3** + **Postgres via Supabase**
- **Tiptap 3** (`@tiptap/react` + `starter-kit`, which in v3 already bundles bold/italic/underline/strike/headings/lists/blockquote/link)
- **Zod 4** for request validation
- **Vitest** for tests
- Deployed on **Vercel**

## Local setup

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Database**: create a free [Supabase](https://supabase.com) project. From
   **Project Settings → Database → Connection Pooling**, copy the **Transaction
   pooler** string (port 6543) and the **Session pooler** string (port 5432).
3. Copy `.env.example` to `.env.local` and fill in:
   ```
   DATABASE_URL="<transaction pooler string>?pgbouncer=true"
   DIRECT_URL="<session pooler string>"
   ```
   > **If your network blocks outbound Postgres ports** (some routers/ISPs do — see
   > `prisma/init.sql` below for a sign), `prisma db push`/`db seed` won't be able to
   > reach the database at all, even though the app's own DB calls at runtime would
   > have the same problem locally. Two fallbacks:
   > - Run `prisma/init.sql` then `prisma/seed.sql` directly in the Supabase
   >   dashboard's **SQL Editor** (that only needs HTTPS).
   > - Test the app against a network that doesn't block those ports, or via the
   >   deployed Vercel URL, which runs on a different network entirely.
4. **Push the schema and seed data** (if your network allows direct Postgres connections):
   ```bash
   npm run db:push
   npm run db:seed
   ```
5. **Run it**:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 and pick a seeded account.

## Testing

```bash
npm test
```
29 unit tests across the three places where a silent bug would be worst:

- `lib/access.ts` — the owner/editor/viewer rules that both the API routes and the
  editor's read-only mode depend on. Wrong access control leaks or blocks data.
- `lib/validation.ts` — import extension/size checks and the PATCH body schema.
- `lib/save-queue.ts` — the editor's debounced autosave. Includes a regression test
  for a real data-loss bug: an edit made *while a save was in flight* used to be
  wiped by that save's completion and then never persisted. (Verified the test
  fails if the fix is reverted — a regression test that passes either way is worse
  than none.)

## Deployment (Vercel)

1. Push this repo to GitHub.
2. In Vercel: **Add New → Project**, import the repo (auto-detects Next.js).
3. Add `DATABASE_URL` and `DIRECT_URL` as Environment Variables (same values as `.env.local`).
4. Deploy. `npm install` runs `prisma generate` via `postinstall`, so the client is
   always in sync with `prisma/schema.prisma` at build time.

## What's deliberately out of scope

This was scoped for a timeboxed build, not a Google Docs clone. Cut on purpose:

- **Real-time collaboration** (live cursors, simultaneous editing). Presence avatars
  in the original design mockup implied this; I removed them rather than fake
  live presence with no backing implementation. Would use Yjs + Tiptap's
  collaboration extension next.
- **Attachments separate from import.** The design mocked both "import a file as a
  new document" and "attach a file to an existing document, then insert its content
  into the draft." Building both doubles file-handling surface area for one
  requirement; I kept one import flow (available from both the document list and
  the editor toolbar) and cut the second.
- **Version history**, **comments**, **link sharing**, **real password auth** — all
  explicitly out of scope for this exercise per the brief, or listed as stretch.
- **Request access is on-site only**, not email/push. The owner sees it next time
  they're in the app (a badge in the document list, a panel in Share) — there's no
  notification system to alert them the moment it happens.

See `ARCHITECTURE.md` for the reasoning behind what stayed in scope, and
`AI_WORKFLOW.md` for how AI tools were used while building this.

## A note on bleeding-edge versions

This environment resolved `npm install` to versions well ahead of typical
production usage — Next.js 16.3 (its bundled docs literally open with "this is NOT
the Next.js you know" and needed reading before writing any App Router code),
Prisma 8.0.0-**release-candidate** as the default `prisma` CLI version, and Zod 4.
I pinned Prisma to **6.19.3** (both `prisma` and `@prisma/client`) deliberately —
Prisma 7 requires ESM-only, mandatory driver adapters, and a new `prisma.config.ts`
file, and 8 is an unreleased RC. Adopting either mid-build for a 4-6 hour scoped
exercise would have meant learning a brand-new config surface under time pressure
instead of shipping. Next.js 16 and Zod 4 breaking changes were checked against
their actual docs/changelogs before use (async `cookies()`/`params`, Zod's
`z.email()` top-level validators, etc.) rather than assumed from training data.
