# Submission

_Fill in the blanks below before zipping/uploading to Drive._

## Links

- **Live app**: https://reamdocs.vercel.app
- **Repo**: https://github.com/kinitsZ/reamdocs
- **Walkthrough video** (3–5 min, unlisted): `https://youtu.be/_hAKD-seh4k` — also saved as
  a plain text file per the assignment's deliverable list.

## Test accounts (no password — pick from the sign-in screen)

| Email | Role in the demo data |
|---|---|
| `maya@ream.app` | Owner of "Q3 Product Review", "Ingestion rewrite RFC"; has Edit access to Sam's "Pricing experiments — H2" and View access to Priya's "Support escalation runbook" |
| `sam@ream.app` | Has Edit access to Maya's "Q3 Product Review"; owns "Pricing experiments — H2" |
| `priya@ream.app` | Has View-only access to Maya's "Q3 Product Review" (see the read-only editor here); owns "Support escalation runbook" |

## What's included in this folder

- `/` — full source code (this repo)
- `README.md` — setup and run instructions
- `ARCHITECTURE.md` — architecture note (what was prioritized and why)
- `AI_WORKFLOW.md` — AI usage note
- `SUBMISSION.md` — this file
- `<walkthrough-video-url>.txt` — the video link, as its own text file
- `<screenshots or demo.gif>` — _add if local setup needs extra steps beyond `npm install && npm run dev`_

## Status

### Working end to end
- Sign in as any seeded user (mocked, cookie-based, no password)
- Create / rename / edit / delete a document with Tiptap (bold, italic, underline,
  strikethrough, H1–H3, bullet/numbered lists, blockquote); autosave; survives refresh
  (delete is owner-only, server-enforced, with an inline confirm)
- Import `.txt` / `.md` / `.docx` as a new document (5 MB cap, validated
  client + server side, clear error copy on rejection)
- Share a document with another seeded user by email at View or Edit access;
  change or revoke access later; owned vs. shared documents are visually
  distinct throughout
- Server-side enforcement of access (a viewer's `PATCH` request is rejected
  even if they bypass the UI)
- Read-only editor experience for view-only access, with an explicit banner
- Request access: a view-only user can request edit access; the owner sees it as
  an on-site badge on the document + a Grant/Dismiss panel in Share — a real,
  working flow, not the inert placeholder from the original design mockup
- Quick actions (⋯) menu per document in the list: Open / Share / Export / Delete
- Export to Markdown and PDF (stretch goal), server-rendered and access-checked;
  the PDF contains real selectable text, not a screenshot
- Cmd/Ctrl+S forces an immediate save (no Save button by design — see ARCHITECTURE.md)
- Real empty states (no documents yet / nothing shared with you) and real
  error states (bad file type, oversized file, unknown share email, failed
  autosave with retry)

### Incomplete / cut for scope
- No real-time collaboration or live presence (see ARCHITECTURE.md)
- No version history, comments, or link sharing (out of scope per the brief)
- No "insert file into an existing draft" — import always creates a new document
- Request access is on-site only (no email/push notification if the owner isn't
  currently looking at the app)
- Unit tests only (Vitest: access control, validation, autosave queue) — no e2e
  coverage yet

### What I'd build next with 2–4 more hours
See the end of `ARCHITECTURE.md`.
