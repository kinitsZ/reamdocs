import { describe, expect, it } from "vitest";
import { tiptapToMarkdown, toFileStem } from "./markdown";

const text = (value: string, marks?: { type: string; attrs?: Record<string, unknown> }[]) => ({
  type: "text",
  text: value,
  ...(marks ? { marks } : {}),
});
const para = (...content: unknown[]) => ({ type: "paragraph", content });
const doc = (...content: unknown[]) => ({ type: "doc", content });

describe("tiptapToMarkdown", () => {
  it("writes headings at the right level", () => {
    const out = tiptapToMarkdown(
      doc(
        { type: "heading", attrs: { level: 1 }, content: [text("Title")] },
        { type: "heading", attrs: { level: 3 }, content: [text("Sub")] }
      )
    );
    expect(out).toBe("# Title\n\n### Sub\n");
  });

  it("renders inline marks", () => {
    const out = tiptapToMarkdown(
      doc(
        para(
          text("plain "),
          text("bold", [{ type: "bold" }]),
          text(" "),
          text("italic", [{ type: "italic" }]),
          text(" "),
          text("struck", [{ type: "strike" }])
        )
      )
    );
    expect(out).toBe("plain **bold** *italic* ~~struck~~\n");
  });

  it("falls back to inline HTML for underline, which Markdown has no syntax for", () => {
    const out = tiptapToMarkdown(doc(para(text("note", [{ type: "underline" }]))));
    expect(out).toBe("<u>note</u>\n");
  });

  it("renders links", () => {
    const out = tiptapToMarkdown(
      doc(para(text("Ream", [{ type: "link", attrs: { href: "https://ream.app" } }])))
    );
    expect(out).toBe("[Ream](https://ream.app)\n");
  });

  it("escapes characters that would otherwise be read as Markdown", () => {
    const out = tiptapToMarkdown(doc(para(text("a * b _ c [d] #e"))));
    expect(out).toBe("a \\* b \\_ c \\[d\\] \\#e\n");
  });

  it("does not escape inside a code span", () => {
    const out = tiptapToMarkdown(doc(para(text("a*b", [{ type: "code" }]))));
    expect(out).toBe("`a*b`\n");
  });

  it("renders bullet lists", () => {
    const out = tiptapToMarkdown(
      doc({
        type: "bulletList",
        content: [
          { type: "listItem", content: [para(text("one"))] },
          { type: "listItem", content: [para(text("two"))] },
        ],
      })
    );
    expect(out).toBe("- one\n- two\n");
  });

  it("numbers ordered lists, honouring a custom start", () => {
    const out = tiptapToMarkdown(
      doc({
        type: "orderedList",
        attrs: { start: 3 },
        content: [
          { type: "listItem", content: [para(text("third"))] },
          { type: "listItem", content: [para(text("fourth"))] },
        ],
      })
    );
    expect(out).toBe("3. third\n4. fourth\n");
  });

  it("indents nested lists", () => {
    const out = tiptapToMarkdown(
      doc({
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              para(text("outer")),
              { type: "bulletList", content: [{ type: "listItem", content: [para(text("inner"))] }] },
            ],
          },
        ],
      })
    );
    expect(out).toBe("- outer\n  - inner\n");
  });

  // Indentation used to compound (4 spaces per level) because both the recursive
  // call and the parent's line-prefixing applied it.
  it("indents three levels by exactly two spaces each", () => {
    const out = tiptapToMarkdown(
      doc({
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              para(text("L1")),
              {
                type: "bulletList",
                content: [
                  {
                    type: "listItem",
                    content: [
                      para(text("L2")),
                      {
                        type: "bulletList",
                        content: [{ type: "listItem", content: [para(text("L3"))] }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      })
    );
    expect(out).toBe("- L1\n  - L2\n    - L3\n");
  });

  it("prefixes every line of a blockquote", () => {
    const out = tiptapToMarkdown(
      doc({ type: "blockquote", content: [para(text("first")), para(text("second"))] })
    );
    expect(out).toBe("> first\n>\n> second\n");
  });

  it("fences code blocks with their language", () => {
    const out = tiptapToMarkdown(
      doc({ type: "codeBlock", attrs: { language: "ts" }, content: [text("const a = 1")] })
    );
    expect(out).toBe("```ts\nconst a = 1\n```\n");
  });

  it("renders hard breaks and horizontal rules", () => {
    const out = tiptapToMarkdown(
      doc(para(text("a"), { type: "hardBreak" }, text("b")), { type: "horizontalRule" })
    );
    expect(out).toBe("a  \nb\n\n---\n");
  });

  it("handles an empty document without throwing", () => {
    expect(tiptapToMarkdown(doc(para()))).toBe("\n");
    expect(tiptapToMarkdown({ type: "doc" })).toBe("\n");
  });
});

describe("toFileStem", () => {
  it("slugifies a title for use as a filename", () => {
    expect(toFileStem("Q3 Product Review")).toBe("Q3-Product-Review");
  });

  it("strips characters that are unsafe in a filename", () => {
    expect(toFileStem("Pricing / H2: notes?")).toBe("Pricing-H2-notes");
  });

  it("falls back when a title has nothing usable left", () => {
    expect(toFileStem("///")).toBe("document");
    expect(toFileStem("   ")).toBe("document");
  });
});
