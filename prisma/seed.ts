import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Matches the seeded accounts named in the design (Ream Docs.dc.html) and its
// copy ("This build only shares with seeded users. Try maya@ream.app, sam@ream.app
// or priya@ream.app."). No passwords — see lib/auth.ts for the mocked session.
const USERS = [
  { email: "maya@ream.app", name: "Maya Okafor", initials: "MO" },
  { email: "sam@ream.app", name: "Sam Rhee", initials: "SR" },
  { email: "priya@ream.app", name: "Priya Nair", initials: "PN" },
] as const;

function paragraph(text: string) {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

function heading(level: number, text: string) {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text }] };
}

async function main() {
  const users = new Map<string, { id: string }>();
  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, initials: u.initials },
      create: u,
    });
    users.set(u.email, user);
  }

  const maya = users.get("maya@ream.app")!;
  const sam = users.get("sam@ream.app")!;
  const priya = users.get("priya@ream.app")!;

  // Clear previously seeded demo documents so re-running `prisma db seed` is idempotent.
  await prisma.document.deleteMany({ where: { ownerId: { in: [maya.id, sam.id, priya.id] } } });

  const q3 = await prisma.document.create({
    data: {
      title: "Q3 Product Review",
      ownerId: maya.id,
      content: {
        type: "doc",
        content: [
          heading(1, "Q3 Product Review"),
          paragraph(
            "We shipped three of the five planned surfaces this quarter. The two we cut were deliberate: both depended on the ingestion rewrite, and pulling them forward would have meant shallow coverage everywhere instead of depth where customers actually feel it."
          ),
          heading(2, "What moved"),
          {
            type: "bulletList",
            content: [
              { type: "listItem", content: [paragraph("Import pipeline now accepts .docx without a round trip through the converter.")] },
              { type: "listItem", content: [paragraph("Share invitations resolve by email against seeded accounts.")] },
              { type: "listItem", content: [paragraph("Autosave dropped from 2.4s to 340ms at the 95th percentile.")] },
            ],
          },
          heading(2, "Next quarter, in order"),
          {
            type: "orderedList",
            content: [
              { type: "listItem", content: [paragraph("Presence and cursors on the shared editor.")] },
              { type: "listItem", content: [paragraph("Version history with named restore points.")] },
              { type: "listItem", content: [paragraph("Comment threads anchored to ranges.")] },
            ],
          },
          {
            type: "blockquote",
            content: [paragraph("Depth in a few important areas beats shallow coverage everywhere.")],
          },
        ],
      },
    },
  });

  await prisma.share.upsert({
    where: { documentId_userId: { documentId: q3.id, userId: sam.id } },
    update: { role: "EDIT" },
    create: { documentId: q3.id, userId: sam.id, role: "EDIT" },
  });
  await prisma.share.upsert({
    where: { documentId_userId: { documentId: q3.id, userId: priya.id } },
    update: { role: "VIEW" },
    create: { documentId: q3.id, userId: priya.id, role: "VIEW" },
  });

  await prisma.document.create({
    data: {
      title: "Ingestion rewrite RFC",
      ownerId: maya.id,
      content: { type: "doc", content: [heading(1, "Ingestion rewrite RFC"), paragraph("Replacing the converter round trip with a direct pipeline.")] },
    },
  });

  const pricing = await prisma.document.create({
    data: {
      title: "Pricing experiments — H2",
      ownerId: sam.id,
      content: { type: "doc", content: [heading(1, "Pricing experiments — H2"), paragraph("Draft notes on the next round of pricing tests.")] },
    },
  });
  await prisma.share.upsert({
    where: { documentId_userId: { documentId: pricing.id, userId: maya.id } },
    update: { role: "EDIT" },
    create: { documentId: pricing.id, userId: maya.id, role: "EDIT" },
  });

  const runbook = await prisma.document.create({
    data: {
      title: "Support escalation runbook",
      ownerId: priya.id,
      content: { type: "doc", content: [heading(1, "Support escalation runbook"), paragraph("Steps for triaging a P1 escalation.")] },
    },
  });
  await prisma.share.upsert({
    where: { documentId_userId: { documentId: runbook.id, userId: maya.id } },
    update: { role: "VIEW" },
    create: { documentId: runbook.id, userId: maya.id, role: "VIEW" },
  });

  console.log("Seeded users:", USERS.map((u) => u.email).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
