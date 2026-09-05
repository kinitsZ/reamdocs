interface Mark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface Node {
  type?: string;
  text?: string;
  marks?: Mark[];
  attrs?: Record<string, unknown>;
  content?: Node[];
}

/** Characters that would otherwise be read as Markdown syntax. */
function escapeText(text: string): string {
  return text.replace(/([\\`*_[\]#])/g, "\\$1");
}

function applyMarks(text: string, marks: Mark[] = []): string {
  // `code` wins and suppresses the others — you can't bold the inside of a code
  // span in Markdown, and escaping doesn't apply within one either.
  if (marks.some((m) => m.type === "code")) return `\`${text}\``;

  let out = escapeText(text);
  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        out = `**${out}**`;
        break;
      case "italic":
        out = `*${out}*`;
        break;
      case "strike":
        out = `~~${out}~~`;
        break;
      case "underline":
        // Markdown has no underline; inline HTML is the standard escape hatch.
        out = `<u>${out}</u>`;
        break;
      case "link": {
        const href = typeof mark.attrs?.href === "string" ? mark.attrs.href : "";
        out = href ? `[${out}](${href})` : out;
        break;
      }
    }
  }
  return out;
}

/** Serializes a run of inline nodes (text, hard breaks) to Markdown. */
function inline(nodes: Node[] = []): string {
  return nodes
    .map((node) => {
      if (node.type === "hardBreak") return "  \n";
      if (typeof node.text === "string") return applyMarks(node.text, node.marks);
      // Unknown inline node — fall back to whatever text it contains.
      return node.content ? inline(node.content) : "";
    })
    .join("");
}

function listItems(node: Node, ordered: boolean): string[] {
  const start = typeof node.attrs?.start === "number" ? node.attrs.start : 1;

  return (node.content ?? []).map((item, i) => {
    const bullet = ordered ? `${start + i}. ` : "- ";
    // A list item holds block content (usually a paragraph, sometimes a nested
    // list). Children render unindented — indentation is applied here, once, as
    // the tree unwinds, so nesting doesn't compound it.
    const blocks = (item.content ?? []).map((child) => block(child)).filter(Boolean);
    const [first = "", ...rest] = blocks;

    const firstLine = `${bullet}${first}`;
    const restLines = rest.map((b) =>
      b
        .split("\n")
        .map((line) => (line ? `  ${line}` : line))
        .join("\n")
    );
    return [firstLine, ...restLines].join("\n");
  });
}

function block(node: Node): string {
  switch (node.type) {
    case "heading": {
      const level = typeof node.attrs?.level === "number" ? node.attrs.level : 1;
      return `${"#".repeat(Math.min(Math.max(level, 1), 6))} ${inline(node.content)}`;
    }
    case "paragraph":
      return inline(node.content);
    case "bulletList":
      return listItems(node, false).join("\n");
    case "orderedList":
      return listItems(node, true).join("\n");
    case "blockquote":
      return (node.content ?? [])
        .map((child) => block(child))
        .join("\n\n")
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n");
    case "codeBlock": {
      const lang = typeof node.attrs?.language === "string" ? node.attrs.language : "";
      const code = (node.content ?? []).map((c) => c.text ?? "").join("");
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }
    case "horizontalRule":
      return "---";
    default:
      // Unknown block — keep its text rather than dropping content silently.
      return node.content ? inline(node.content) : "";
  }
}

/**
 * Converts a Tiptap/ProseMirror document to Markdown, covering the node and mark
 * set this editor can actually produce (see lib/tiptap-extensions.ts).
 */
export function tiptapToMarkdown(doc: unknown): string {
  const root = doc as Node;
  const blocks = (root?.content ?? [])
    .map((node) => block(node))
    .filter((text) => text.trim() !== "");
  return `${blocks.join("\n\n")}\n`;
}

/** Turns a document title into a safe download filename stem. */
export function toFileStem(title: string): string {
  const stem = title
    .trim()
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 80);
  return stem || "document";
}
