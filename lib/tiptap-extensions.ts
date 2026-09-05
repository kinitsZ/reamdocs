import StarterKit from "@tiptap/starter-kit";

// Shared between the client editor (components/Editor.tsx) and the server-side
// file importer (lib/import.ts) so a .docx/.md import round-trips through the same
// node/mark set the editor actually renders.
//
// Tiptap 3's StarterKit already bundles bold/italic/underline/strike, headings,
// bullet + ordered lists, blockquote, link and undo/redo — no extra extensions
// needed for this app's toolbar.
export const tiptapExtensions = [
  StarterKit.configure({
    link: { openOnClick: false },
  }),
];
