interface TiptapNode {
  text?: string;
  content?: TiptapNode[];
}

/** Flattens a Tiptap/ProseMirror JSON document into a short plain-text preview. */
export function extractPlainText(doc: unknown, maxLen = 140): string {
  const parts: string[] = [];

  function walk(node: TiptapNode | undefined) {
    if (!node) return;
    if (node.text) parts.push(node.text);
    if (node.content) {
      for (const child of node.content) {
        walk(child);
        if (parts.join(" ").length > maxLen) return;
      }
    }
  }

  walk(doc as TiptapNode);
  const text = parts.join(" ").replace(/\s+/g, " ").trim();
  return text.length > maxLen ? `${text.slice(0, maxLen).trimEnd()}…` : text;
}
