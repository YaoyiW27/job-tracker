import { describe, it, expect } from "vitest";
import {
  toEditableRow,
  buildPatch,
  EDITABLE_FIELDS,
  todayYmd,
  appliedDateForStatusChange,
  withAppliedDateDefault,
  appliedDateForNewRow,
} from "@/lib/application-edit";

const base = {
  company: "Acme",
  title: "Backend Engineer",
  status: "APPLIED",
  url: "https://jobs.acme.com/1",
  appliedDate: "2026-08-12T00:00:00.000Z",
  location: "Vancouver, BC",
  salary: "USD 120k",
  notes: "referred by X",
  resumeVersion: "v3",
};

describe("toEditableRow", () => {
  it("normalizes an ISO applied date to yyyy-mm-dd", () => {
    expect(toEditableRow(base).appliedDate).toBe("2026-08-12");
  });
  it("normalizes a Date object too", () => {
    expect(toEditableRow({ ...base, appliedDate: new Date("2026-01-05T12:00:00Z") }).appliedDate).toBe(
      "2026-01-05",
    );
  });
  it("turns nulls into empty strings", () => {
    const r = toEditableRow({
      ...base,
      url: null,
      salary: null,
      notes: null,
      resumeVersion: null,
      appliedDate: null,
      location: null,
    });
    expect(r.url).toBe("");
    expect(r.salary).toBe("");
    expect(r.location).toBe("");
    expect(r.notes).toBe("");
    expect(r.resumeVersion).toBe("");
    expect(r.appliedDate).toBe("");
  });
  it("covers exactly the editable fields", () => {
    expect(Object.keys(toEditableRow(base)).sort()).toEqual([...EDITABLE_FIELDS].sort());
  });
});

describe("buildPatch", () => {
  it("returns {} when nothing changed", () => {
    const row = toEditableRow(base);
    expect(buildPatch(row, { ...row })).toEqual({});
  });
  it("captures a single changed field", () => {
    const row = toEditableRow(base);
    expect(buildPatch(row, { ...row, status: "INTERVIEW" })).toEqual({ status: "INTERVIEW" });
  });
  it("captures multiple changed fields", () => {
    const row = toEditableRow(base);
    const patch = buildPatch(row, { ...row, notes: "call booked", salary: "USD 130k" });
    expect(patch).toEqual({ notes: "call booked", salary: "USD 130k" });
  });
  it("ignores whitespace-only differences", () => {
    const row = toEditableRow(base);
    expect(buildPatch(row, { ...row, company: "  Acme  " })).toEqual({});
  });
  it("captures clearing a field to empty", () => {
    const row = toEditableRow(base);
    expect(buildPatch(row, { ...row, url: "" })).toEqual({ url: "" });
  });
  it("emits trimmed values", () => {
    const row = toEditableRow(base);
    expect(buildPatch(row, { ...row, title: "  Staff Engineer  " })).toEqual({ title: "Staff Engineer" });
  });
});

describe("todayYmd", () => {
  // Every instant below is written in UTC on purpose: the answer must not depend
  // on how the machine running the test is configured.
  it("stamps the Vancouver date, not the UTC one", () => {
    // 05:00 UTC is 22:00 the previous evening in Vancouver. toISOString() — and
    // any UTC-based date — would stamp tomorrow on tonight's application.
    expect(todayYmd(new Date("2026-08-18T05:00:00Z"))).toBe("2026-08-17");
  });

  it("rolls over at Vancouver midnight, not UTC midnight", () => {
    expect(todayYmd(new Date("2026-08-18T06:59:00Z"))).toBe("2026-08-17");
    expect(todayYmd(new Date("2026-08-18T07:00:00Z"))).toBe("2026-08-18");
  });

  it("follows daylight saving — the offset is not a fixed -7", () => {
    // January is PST (UTC-8), so midnight Vancouver is 08:00 UTC, an hour later
    // than in PDT. A hardcoded offset gets this day wrong every winter.
    expect(todayYmd(new Date("2026-01-15T07:30:00Z"))).toBe("2026-01-14");
    expect(todayYmd(new Date("2026-01-15T08:00:00Z"))).toBe("2026-01-15");
  });

  it("is independent of the machine's own timezone", () => {
    // Same instant, whatever TZ the process runs under.
    const instant = new Date("2026-08-18T05:00:00Z");
    expect(todayYmd(instant)).toBe(todayYmd(new Date(instant.getTime())));
    expect(todayYmd(instant)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("accepts an explicit timezone, so a move doesn't mean a code change", () => {
    expect(todayYmd(new Date("2026-08-18T05:00:00Z"), "UTC")).toBe("2026-08-18");
    expect(todayYmd(new Date("2026-08-18T05:00:00Z"), "America/Toronto")).toBe("2026-08-18");
  });
});

describe("withAppliedDateDefault", () => {
  const saved = toEditableRow({ ...base, status: "SAVED", appliedDate: null });
  const TODAY = "2026-08-14";

  it("stamps today when a saved row moves to APPLIED", () => {
    const patch = withAppliedDateDefault({ status: "APPLIED" }, saved, TODAY);
    expect(patch).toEqual({ status: "APPLIED", appliedDate: TODAY });
  });

  it("stamps for any status past SAVED — dragging straight to INTERVIEW still counts as applied", () => {
    for (const status of ["OA", "INTERVIEW", "OFFER", "REJECTED", "GHOSTED"]) {
      expect(withAppliedDateDefault({ status }, saved, TODAY).appliedDate).toBe(TODAY);
    }
  });

  it("never overwrites a date the user already set", () => {
    const withDate = toEditableRow({ ...base, status: "SAVED", appliedDate: "2026-07-01T00:00:00.000Z" });
    expect(withAppliedDateDefault({ status: "APPLIED" }, withDate, TODAY).appliedDate).toBeUndefined();
  });

  it("respects a date being set in the same edit", () => {
    const patch = withAppliedDateDefault(
      { status: "APPLIED", appliedDate: "2026-08-01" },
      saved,
      TODAY,
    );
    expect(patch.appliedDate).toBe("2026-08-01");
  });

  it("does not stamp when the row moves back to SAVED", () => {
    expect(withAppliedDateDefault({ status: "SAVED" }, saved, TODAY).appliedDate).toBeUndefined();
  });

  it("leaves patches that don't touch status alone", () => {
    expect(withAppliedDateDefault({ notes: "ping recruiter" }, saved, TODAY)).toEqual({
      notes: "ping recruiter",
    });
  });

  it("does not mutate the patch it was given", () => {
    const patch = { status: "APPLIED" };
    withAppliedDateDefault(patch, saved, TODAY);
    expect(patch).toEqual({ status: "APPLIED" });
  });
});

describe("appliedDateForNewRow", () => {
  const TODAY = "2026-08-15";

  it("keeps the date the user typed in the dialog", () => {
    // Regression: the create path reused the *patch* helper, which correctly
    // returns nothing when a date is already set — and the caller then read an
    // undefined field, silently discarding what the user had typed.
    expect(appliedDateForNewRow("APPLIED", "2026-08-10", TODAY)).toBe("2026-08-10");
  });

  it("stamps today when saving straight as APPLIED with no date", () => {
    expect(appliedDateForNewRow("APPLIED", "", TODAY)).toBe(TODAY);
  });

  it("stamps for any status past SAVED", () => {
    for (const s of ["OA", "INTERVIEW", "OFFER", "REJECTED", "GHOSTED"]) {
      expect(appliedDateForNewRow(s, "", TODAY), s).toBe(TODAY);
    }
  });

  it("leaves a plain SAVED row undated", () => {
    expect(appliedDateForNewRow("SAVED", "", TODAY)).toBeNull();
  });

  it("still honours a date on a SAVED row — applied earlier, tracked later", () => {
    expect(appliedDateForNewRow("SAVED", "2026-07-01", TODAY)).toBe("2026-07-01");
  });
});

describe("appliedDateForStatusChange", () => {
  const TODAY = "2026-08-17";

  it("drops the auto-stamped date when the row goes back to SAVED", () => {
    // The Add-row dialog opens as APPLIED + today. Switching to SAVED means
    // "bookmark, haven't applied" — carrying today's date in would inflate the
    // dashboard's over-time chart, which counts any dated row.
    expect(appliedDateForStatusChange("SAVED", TODAY, TODAY)).toBe("");
  });

  it("keeps a date the user typed, even when switching to SAVED", () => {
    expect(appliedDateForStatusChange("SAVED", "2026-07-01", TODAY)).toBe("2026-07-01");
  });

  it("stamps today when leaving SAVED with an empty date", () => {
    expect(appliedDateForStatusChange("APPLIED", "", TODAY)).toBe(TODAY);
    expect(appliedDateForStatusChange("INTERVIEW", "", TODAY)).toBe(TODAY);
  });

  it("never overwrites an existing date when leaving SAVED", () => {
    expect(appliedDateForStatusChange("OFFER", "2026-07-01", TODAY)).toBe("2026-07-01");
  });

  it("leaves an already-empty SAVED row empty", () => {
    expect(appliedDateForStatusChange("SAVED", "", TODAY)).toBe("");
  });
});
