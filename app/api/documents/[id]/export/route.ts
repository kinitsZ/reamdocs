import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { canView } from "@/lib/access";
import { tiptapToMarkdown, toFileStem } from "@/lib/markdown";

type RouteContext = { params: Promise<{ id: string }> };

// @react-pdf/renderer needs Node APIs, so this route can't run on the edge.
export const runtime = "nodejs";

export async function GET(request: Request, { params }: RouteContext) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const format = new URL(request.url).searchParams.get("format") ?? "md";
  if (format !== "md" && format !== "pdf") {
    return NextResponse.json({ error: "Supported formats are 'md' and 'pdf'." }, { status: 400 });
  }

  const { id } = await params;
  const doc = await prisma.document.findUnique({
    where: { id },
    include: { owner: true, shares: true },
  });
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  // Anyone who can read the document can export it — including view-only users.
  if (!canView(doc, userId)) {
    return NextResponse.json({ error: "You don't have access to this document." }, { status: 403 });
  }

  const stem = toFileStem(doc.title);

  if (format === "md") {
    return new NextResponse(tiptapToMarkdown(doc.content), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${stem}.md"`,
      },
    });
  }

  // Imported lazily so the PDF renderer isn't pulled in for Markdown exports.
  const { renderDocumentPdf } = await import("@/lib/pdf");
  try {
    const pdf = await renderDocumentPdf({
      title: doc.title,
      ownerName: doc.owner.name,
      content: doc.content,
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${stem}.pdf"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Couldn't generate the PDF." }, { status: 500 });
  }
}
