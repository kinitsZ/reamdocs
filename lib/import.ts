import mammoth from "mammoth";
import { marked } from "marked";
import { generateJSON } from "@tiptap/html/server";
import { tiptapExtensions } from "./tiptap-extensions";
import { getExtension } from "./validation";

async function htmlToTiptapJSON(html: string) {
  return generateJSON(html, tiptapExtensions);
}

function plainTextToTiptapJSON(text: string) {
  const blocks = text
    .split(/\r?\n\r?\n+/)
    .map((block) => block.trim())
    .filter(Boolean);

  return {
    type: "doc",
    content: blocks.length
      ? blocks.map((block) => ({
          type: "paragraph",
          content: [{ type: "text", text: block.replace(/\r?\n/g, " ") }],
        }))
      : [{ type: "paragraph" }],
  };
}

/**
 * Converts an uploaded .txt/.md/.docx file into a Tiptap/ProseMirror JSON document.
 * Caller is expected to have already run validateImportFile() from lib/validation.ts.
 */
export async function convertFileToTiptapJSON(fileName: string, buffer: Buffer): Promise<unknown> {
  const ext = getExtension(fileName);

  if (ext === "docx") {
    const { value: html } = await mammoth.convertToHtml({ buffer });
    return htmlToTiptapJSON(html);
  }

  if (ext === "md") {
    const html = await marked.parse(buffer.toString("utf-8"));
    return htmlToTiptapJSON(html);
  }

  // .txt (and anything else that slipped through — treated as plain text)
  return plainTextToTiptapJSON(buffer.toString("utf-8"));
}

export function titleFromFileName(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^./]+$/, "").trim();
  return withoutExt || "Untitled import";
}
