import { z } from "zod";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024; // 5 MB, matches the design's stated cap
export const ACCEPTED_IMPORT_EXTENSIONS = ["txt", "md", "docx"] as const;
export type ImportExtension = (typeof ACCEPTED_IMPORT_EXTENSIONS)[number];

export function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx + 1).toLowerCase();
}

export type FileValidationResult =
  | { ok: true }
  | { ok: false; message: string };

/** Validated independently on client and server — server is the source of truth. */
export function validateImportFile(file: { name: string; size: number }): FileValidationResult {
  const ext = getExtension(file.name);
  if (!ACCEPTED_IMPORT_EXTENSIONS.includes(ext as ImportExtension)) {
    return {
      ok: false,
      message: `"${file.name}" can't be imported. Accepted: .txt, .md, .docx up to 5 MB.`,
    };
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return {
      ok: false,
      message: `"${file.name}" is larger than 5 MB.`,
    };
  }
  if (file.size === 0) {
    return { ok: false, message: `"${file.name}" is empty.` };
  }
  return { ok: true };
}

export const renameDocumentSchema = z.object({
  title: z.string().trim().min(1, "Title can't be empty").max(200),
});

export const saveContentSchema = z.object({
  content: z.unknown(),
});

export const updateDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.unknown().optional(),
});

export const shareRoleSchema = z.enum(["VIEW", "EDIT"]);

export const addShareSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  role: shareRoleSchema,
});

export const updateShareSchema = z.object({
  role: shareRoleSchema,
});
