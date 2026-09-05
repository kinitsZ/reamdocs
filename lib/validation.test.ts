import { describe, expect, it } from "vitest";
import {
  MAX_IMPORT_BYTES,
  addShareSchema,
  getExtension,
  updateDocumentSchema,
  validateImportFile,
} from "./validation";

describe("getExtension", () => {
  it("lowercases and strips the leading dot", () => {
    expect(getExtension("Notes.DOCX")).toBe("docx");
  });

  it("returns an empty string for a file with no extension", () => {
    expect(getExtension("README")).toBe("");
  });
});

describe("validateImportFile", () => {
  it("accepts a .docx under the size cap", () => {
    expect(validateImportFile({ name: "roadmap-notes.docx", size: 1024 })).toEqual({ ok: true });
  });

  it("accepts .txt and .md too", () => {
    expect(validateImportFile({ name: "a.txt", size: 10 }).ok).toBe(true);
    expect(validateImportFile({ name: "a.md", size: 10 }).ok).toBe(true);
  });

  it("rejects an unsupported extension, matching the design's stated copy", () => {
    const result = validateImportFile({ name: "notes.pages", size: 10 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("can't be imported");
  });

  it("rejects a file over the 5 MB cap", () => {
    const result = validateImportFile({ name: "big.txt", size: MAX_IMPORT_BYTES + 1 });
    expect(result.ok).toBe(false);
  });

  it("rejects an empty file", () => {
    const result = validateImportFile({ name: "empty.txt", size: 0 });
    expect(result.ok).toBe(false);
  });
});

describe("updateDocumentSchema", () => {
  it("rejects a blank title — a whitespace-only rename must not wipe the title", () => {
    expect(updateDocumentSchema.safeParse({ title: "   " }).success).toBe(false);
  });

  it("trims whitespace from a valid title", () => {
    const result = updateDocumentSchema.safeParse({ title: "  Q3 Review  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe("Q3 Review");
  });

  it("allows a content-only update (autosave sends no title)", () => {
    const result = updateDocumentSchema.safeParse({ content: { type: "doc", content: [] } });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBeUndefined();
  });

  it("rejects a title longer than the 200-char cap", () => {
    expect(updateDocumentSchema.safeParse({ title: "x".repeat(201) }).success).toBe(false);
  });
});

describe("addShareSchema", () => {
  it("lowercases the email so lookups are case-insensitive", () => {
    const result = addShareSchema.safeParse({ email: "Maya@Ream.app", role: "EDIT" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("maya@ream.app");
  });

  it("rejects a malformed email", () => {
    expect(addShareSchema.safeParse({ email: "not-an-email", role: "VIEW" }).success).toBe(false);
  });

  it("rejects a role outside VIEW/EDIT", () => {
    expect(addShareSchema.safeParse({ email: "sam@ream.app", role: "ADMIN" }).success).toBe(false);
  });
});
