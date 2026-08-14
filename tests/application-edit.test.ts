import { describe, it, expect } from "vitest";
import { toEditableRow, buildPatch, EDITABLE_FIELDS } from "@/lib/application-edit";

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
