-- Fallback seed for when your local network blocks outbound Postgres ports (5432/6543)
-- and `npm run db:seed` can't reach the database directly. Paste this into the
-- Supabase dashboard's SQL Editor (Project -> SQL Editor -> New query) and run it —
-- that path only needs HTTPS, which your network already allows.
--
-- Run prisma/init.sql (schema) FIRST, then this file. Both are safe to re-run.

INSERT INTO "User" (id, name, email, initials)
VALUES
  (gen_random_uuid()::text, 'Maya Okafor', 'maya@ream.app', 'MO'),
  (gen_random_uuid()::text, 'Sam Rhee', 'sam@ream.app', 'SR'),
  (gen_random_uuid()::text, 'Priya Nair', 'priya@ream.app', 'PN')
ON CONFLICT (email) DO NOTHING;

WITH ids AS (
  SELECT
    (SELECT id FROM "User" WHERE email = 'maya@ream.app')  AS maya,
    (SELECT id FROM "User" WHERE email = 'sam@ream.app')   AS sam,
    (SELECT id FROM "User" WHERE email = 'priya@ream.app') AS priya
),
q3 AS (
  INSERT INTO "Document" (id, title, content, "ownerId", "updatedAt")
  SELECT
    gen_random_uuid()::text,
    'Q3 Product Review',
    $json${
      "type": "doc",
      "content": [
        { "type": "heading", "attrs": { "level": 1 }, "content": [{ "type": "text", "text": "Q3 Product Review" }] },
        { "type": "paragraph", "content": [{ "type": "text", "text": "We shipped three of the five planned surfaces this quarter. The two we cut were deliberate: both depended on the ingestion rewrite, and pulling them forward would have meant shallow coverage everywhere instead of depth where customers actually feel it." }] },
        { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "What moved" }] },
        { "type": "bulletList", "content": [
          { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Import pipeline now accepts .docx without a round trip through the converter." }] }] },
          { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Share invitations resolve by email against seeded accounts." }] }] },
          { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Autosave dropped from 2.4s to 340ms at the 95th percentile." }] }] }
        ]},
        { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Next quarter, in order" }] },
        { "type": "orderedList", "content": [
          { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Presence and cursors on the shared editor." }] }] },
          { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Version history with named restore points." }] }] },
          { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Comment threads anchored to ranges." }] }] }
        ]},
        { "type": "blockquote", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Depth in a few important areas beats shallow coverage everywhere." }] }] }
      ]
    }$json$::jsonb,
    ids.maya,
    now()
  FROM ids
  RETURNING id, "ownerId"
),
rfc AS (
  INSERT INTO "Document" (id, title, content, "ownerId", "updatedAt")
  SELECT
    gen_random_uuid()::text,
    'Ingestion rewrite RFC',
    $json${"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Ingestion rewrite RFC"}]},{"type":"paragraph","content":[{"type":"text","text":"Replacing the converter round trip with a direct pipeline."}]}]}$json$::jsonb,
    ids.maya,
    now()
  FROM ids
  RETURNING id
),
pricing AS (
  INSERT INTO "Document" (id, title, content, "ownerId", "updatedAt")
  SELECT
    gen_random_uuid()::text,
    'Pricing experiments — H2',
    $json${"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Pricing experiments — H2"}]},{"type":"paragraph","content":[{"type":"text","text":"Draft notes on the next round of pricing tests."}]}]}$json$::jsonb,
    ids.sam,
    now()
  FROM ids
  RETURNING id
),
runbook AS (
  INSERT INTO "Document" (id, title, content, "ownerId", "updatedAt")
  SELECT
    gen_random_uuid()::text,
    'Support escalation runbook',
    $json${"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Support escalation runbook"}]},{"type":"paragraph","content":[{"type":"text","text":"Steps for triaging a P1 escalation."}]}]}$json$::jsonb,
    ids.priya,
    now()
  FROM ids
  RETURNING id
)
INSERT INTO "Share" (id, "documentId", "userId", role)
SELECT gen_random_uuid()::text, q3.id, ids.sam, 'EDIT'::"Role" FROM q3, ids
UNION ALL
SELECT gen_random_uuid()::text, q3.id, ids.priya, 'VIEW'::"Role" FROM q3, ids
UNION ALL
SELECT gen_random_uuid()::text, pricing.id, ids.maya, 'EDIT'::"Role" FROM pricing, ids
UNION ALL
SELECT gen_random_uuid()::text, runbook.id, ids.maya, 'VIEW'::"Role" FROM runbook, ids
ON CONFLICT ("documentId", "userId") DO NOTHING;
