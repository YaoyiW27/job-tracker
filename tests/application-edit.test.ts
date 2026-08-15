import { describe, it, expect } from "vitest";
import {
  toEditableRow,
  buildPatch,
  EDITABLE_FIELDS,
  todayYmd,
  withAppliedDateDefault,
} from "@/lib/application-edit";

const base = {
  company: "Acme",
  title: "Backend Engineer",
  status: "APPLIED",
  url: "https://jobs.acme.com/1",
  appliedDate: "2026-08-12T00:00:00.000Z",
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
    const r = toEditableRow({ ...base, url: null, salary: null, notes: null, resumeVersion: null, appliedDate: null });
    expect(r.url).toBe("");
    expect(r.salary).toBe("");
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
  it("uses local calendar date, not UTC", () => {
    // 2026-08-14 21:00 local — toISOString() would roll this to the 15th in any
    // timezone west of UTC, stamping tomorrow's date on tonight's application.
    const local = new Date(2026, 7, 14, 21, 0, 0);
    expect(todayYmd(local)).toBe("2026-08-14");
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
