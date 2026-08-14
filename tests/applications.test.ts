import { describe, it, expect } from "vitest";
import { findDuplicateIn, type DuplicateMatch } from "@/lib/applications";

const rows: DuplicateMatch[] = [
  { id: "a", company: "Acme", title: "Backend Engineer", url: "https://jobs.acme.com/123", status: "APPLIED" },
  { id: "b", company: "Globex", title: "ML Engineer", url: null, status: "SAVED" },
];

describe("findDuplicateIn", () => {
  it("matches on url case-insensitively", () => {
    const m = findDuplicateIn(rows, {
      url: "HTTPS://JOBS.ACME.COM/123",
      company: "Totally Different",
      title: "Other",
    });
    expect(m?.id).toBe("a");
  });

  it("matches on company + title case-insensitively when no url", () => {
    const m = findDuplicateIn(rows, { company: "  globex ", title: "ml engineer" });
    expect(m?.id).toBe("b");
  });

  it("returns null when nothing matches", () => {
    expect(findDuplicateIn(rows, { company: "Initech", title: "PM" })).toBeNull();
  });

  it("does not match on url alone if company+title differ and url is new", () => {
    const m = findDuplicateIn(rows, {
      url: "https://new.example.com/999",
      company: "Acme",
      title: "Frontend Engineer",
    });
    expect(m).toBeNull();
  });

  it("still matches company+title even when a (different) url is provided", () => {
    const m = findDuplicateIn(rows, {
      url: "https://elsewhere.example.com/1",
      company: "acme",
      title: "backend engineer",
    });
    expect(m?.id).toBe("a");
  });
});
