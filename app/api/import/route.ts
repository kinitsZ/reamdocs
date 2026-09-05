import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { validateImportFile } from "@/lib/validation";
import { convertFileToTiptapJSON, titleFromFileName } from "@/lib/import";

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
  }

  const validation = validateImportFile({ name: file.name, size: file.size });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }

  let content: unknown;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    content = await convertFileToTiptapJSON(file.name, buffer);
  } catch {
    return NextResponse.json(
      { error: `Couldn't read "${file.name}" — it may be corrupted or in an unexpected format.` },
      { status: 422 }
    );
  }

  const doc = await prisma.document.create({
    data: { title: titleFromFileName(file.name), content: content as object, ownerId: userId },
  });

  return NextResponse.json({ document: { id: doc.id, title: doc.title } }, { status: 201 });
}
