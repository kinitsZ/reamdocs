import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Link,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

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

// Helvetica/Courier are built in, so no font files are fetched at render time —
// important on serverless, where a network round trip per export would be a
// needless failure mode.
const styles = StyleSheet.create({
  page: { paddingVertical: 56, paddingHorizontal: 64, fontFamily: "Helvetica", color: "#1f2328" },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  byline: { fontSize: 9, color: "#6b7280", marginBottom: 24 },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold", marginTop: 16, marginBottom: 8 },
  h2: { fontSize: 15, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 6 },
  h3: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 5 },
  paragraph: { fontSize: 11, lineHeight: 1.6, marginBottom: 9 },
  listRow: { flexDirection: "row", marginBottom: 4 },
  bullet: { fontSize: 11, lineHeight: 1.6, width: 18 },
  listContent: { flex: 1 },
  blockquote: {
    borderLeftWidth: 2,
    borderLeftColor: "#3b6fd4",
    paddingLeft: 12,
    marginVertical: 10,
  },
  quoteText: { fontSize: 11, lineHeight: 1.6, fontFamily: "Helvetica-Oblique", color: "#414750" },
  codeBlock: { backgroundColor: "#f4f4f5", padding: 10, marginBottom: 10 },
  code: { fontFamily: "Courier", fontSize: 10, lineHeight: 1.5 },
  rule: { borderBottomWidth: 1, borderBottomColor: "#d8d8dc", marginVertical: 14 },
  link: { color: "#2f5fbe", textDecoration: "underline" },
});

/** Picks the built-in Helvetica variant matching the active marks. */
function fontFor(marks: Mark[]): string {
  const bold = marks.some((m) => m.type === "bold");
  const italic = marks.some((m) => m.type === "italic");
  if (bold && italic) return "Helvetica-BoldOblique";
  if (bold) return "Helvetica-Bold";
  if (italic) return "Helvetica-Oblique";
  return "Helvetica";
}

function inline(nodes: Node[] = [], keyPrefix = ""): React.ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${keyPrefix}-${i}`;
    if (node.type === "hardBreak") return <Text key={key}>{"\n"}</Text>;
    if (typeof node.text !== "string") {
      return node.content ? <Text key={key}>{inline(node.content, key)}</Text> : null;
    }

    const marks = node.marks ?? [];
    const isCode = marks.some((m) => m.type === "code");
    const underline = marks.some((m) => m.type === "underline");
    const strike = marks.some((m) => m.type === "strike");
    const decoration = [underline ? "underline" : "", strike ? "line-through" : ""]
      .filter(Boolean)
      .join(" ");

    const style = {
      fontFamily: isCode ? "Courier" : fontFor(marks),
      ...(decoration ? { textDecoration: decoration as "underline" | "line-through" } : {}),
    };

    const link = marks.find((m) => m.type === "link");
    const href = typeof link?.attrs?.href === "string" ? link.attrs.href : null;
    if (href) {
      return (
        <Link key={key} src={href} style={[style, styles.link]}>
          {node.text}
        </Link>
      );
    }
    return (
      <Text key={key} style={style}>
        {node.text}
      </Text>
    );
  });
}

function list(node: Node, ordered: boolean, depth: number, key: string): React.ReactNode {
  const start = typeof node.attrs?.start === "number" ? node.attrs.start : 1;
  return (
    <View key={key} style={{ marginLeft: depth * 14, marginBottom: 6 }}>
      {(node.content ?? []).map((item, i) => (
        <View key={`${key}-${i}`} style={styles.listRow} wrap={false}>
          <Text style={styles.bullet}>{ordered ? `${start + i}.` : "•"}</Text>
          <View style={styles.listContent}>
            {(item.content ?? []).map((child, j) => block(child, depth + 1, `${key}-${i}-${j}`))}
          </View>
        </View>
      ))}
    </View>
  );
}

function block(node: Node, depth = 0, key = "b"): React.ReactNode {
  switch (node.type) {
    case "heading": {
      const level = typeof node.attrs?.level === "number" ? node.attrs.level : 1;
      const style = level === 1 ? styles.h1 : level === 2 ? styles.h2 : styles.h3;
      return (
        <Text key={key} style={style}>
          {inline(node.content, key)}
        </Text>
      );
    }
    case "paragraph":
      return (
        <Text key={key} style={styles.paragraph}>
          {inline(node.content, key)}
        </Text>
      );
    case "bulletList":
      return list(node, false, depth, key);
    case "orderedList":
      return list(node, true, depth, key);
    case "blockquote":
      return (
        <View key={key} style={styles.blockquote}>
          {(node.content ?? []).map((child, i) => (
            <Text key={`${key}-${i}`} style={styles.quoteText}>
              {inline(child.content, `${key}-${i}`)}
            </Text>
          ))}
        </View>
      );
    case "codeBlock":
      return (
        <View key={key} style={styles.codeBlock}>
          <Text style={styles.code}>{(node.content ?? []).map((c) => c.text ?? "").join("")}</Text>
        </View>
      );
    case "horizontalRule":
      return <View key={key} style={styles.rule} />;
    default:
      return node.content ? (
        <Text key={key} style={styles.paragraph}>
          {inline(node.content, key)}
        </Text>
      ) : null;
  }
}

/** Renders a Tiptap document to a real PDF (selectable text, not a rasterised image). */
export async function renderDocumentPdf(input: {
  title: string;
  ownerName: string;
  content: unknown;
}): Promise<Buffer> {
  const root = input.content as Node;
  const blocks = (root?.content ?? []).map((node, i) => block(node, 0, `b${i}`));

  return renderToBuffer(
    <Document title={input.title} author={input.ownerName}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{input.title}</Text>
        <Text style={styles.byline}>Owned by {input.ownerName} · exported from Ream</Text>
        {blocks}
      </Page>
    </Document>
  );
}
