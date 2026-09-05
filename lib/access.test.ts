import { describe, expect, it } from "vitest";
import { canEdit, canView, getAccessLevel, isOwner } from "./access";

const doc = {
  ownerId: "maya",
  shares: [
    { userId: "sam", role: "EDIT" as const },
    { userId: "priya", role: "VIEW" as const },
  ],
};

describe("getAccessLevel", () => {
  it("returns OWNER for the document's owner", () => {
    expect(getAccessLevel(doc, "maya")).toBe("OWNER");
  });

  it("returns the granted role for a shared user", () => {
    expect(getAccessLevel(doc, "sam")).toBe("EDIT");
    expect(getAccessLevel(doc, "priya")).toBe("VIEW");
  });

  it("returns null for a user with no relationship to the document", () => {
    expect(getAccessLevel(doc, "stranger")).toBeNull();
  });
});

describe("canView / canEdit", () => {
  it("owner can view and edit", () => {
    expect(canView(doc, "maya")).toBe(true);
    expect(canEdit(doc, "maya")).toBe(true);
  });

  it("an editor can view and edit", () => {
    expect(canView(doc, "sam")).toBe(true);
    expect(canEdit(doc, "sam")).toBe(true);
  });

  it("a viewer can view but not edit — this is the core of the sharing model", () => {
    expect(canView(doc, "priya")).toBe(true);
    expect(canEdit(doc, "priya")).toBe(false);
  });

  it("someone with no share at all can neither view nor edit", () => {
    expect(canView(doc, "stranger")).toBe(false);
    expect(canEdit(doc, "stranger")).toBe(false);
  });
});

describe("isOwner", () => {
  it("is true only for the owner, even if that user also happens to appear in shares", () => {
    const weirdDoc = { ownerId: "maya", shares: [{ userId: "maya", role: "VIEW" as const }] };
    expect(isOwner(weirdDoc, "maya")).toBe(true);
    expect(isOwner(doc, "sam")).toBe(false);
  });
});
