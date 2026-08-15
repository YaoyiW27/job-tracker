import { describe, it, expect } from "vitest";
import {
  cleanPrefill,
  validateDraft,
  interpretCreateResponse,
} from "@/lib/application-draft";

describe("cleanPrefill", () => {
  it("passes through when company + title are already set", () => {
    expect(cleanPrefill({ company: "Acme", title: "Senior Engineer" })).toEqual({
      company: "Acme",
      title: "Senior Engineer",
      salary: null,
      location: null,
    });
  });

  it("splits 'Title - Company' when company is missing", () => {
    expect(cleanPrefill({ company: "", title: "Backend Engineer - Acme Corp" })).toEqual({
      company: "Acme Corp",
      title: "Backend Engineer",
      salary: null,
      location: null,
    });
  });

  it("splits on a pipe separator", () => {
    const r = cleanPrefill({ company: "", title: "Data Scientist | Globex" });
    expect(r).toEqual({ company: "Globex", title: "Data Scientist", salary: null, location: null });
  });

  it("splits on ' at '", () => {
    const r = cleanPrefill({ company: "", title: "ML Engineer at Initech" });
    expect(r).toEqual({ company: "Initech", title: "ML Engineer", salary: null, location: null });
  });

  it("drops boilerplate company segments like 'Careers'", () => {
    const r = cleanPrefill({ company: "", title: "Software Engineer - Careers" });
    expect(r).toEqual({ company: "", title: "Software Engineer", salary: null, location: null });
  });

  it("leaves a separatorless title alone", () => {
    expect(cleanPrefill({ company: "", title: "Careers" })).toEqual({
      company: "",
      title: "Careers",
      salary: null,
      location: null,
    });
  });

  it("does not overwrite an existing company from the title", () => {
    const r = cleanPrefill({ company: "Acme", title: "Eng - Acme" });
    expect(r.company).toBe("Acme");
    expect(r.title).toBe("Eng - Acme");
  });

  it("trims whitespace and preserves salary", () => {
    const r = cleanPrefill({ company: "  Acme ", title: "  SWE ", salary: "USD 120000" });
    expect(r).toEqual({ company: "Acme", title: "SWE", salary: "USD 120000", location: null });
  });
});

describe("validateDraft", () => {
  it("accepts a draft with company + title", () => {
    expect(validateDraft({ company: "Acme", title: "Eng" })).toEqual({ ok: true, errors: {} });
  });
  it("requires company", () => {
    const r = validateDraft({ company: "  ", title: "Eng" });
    expect(r.ok).toBe(false);
    expect(r.errors.company).toBeTruthy();
  });
  it("requires title", () => {
    const r = validateDraft({ company: "Acme", title: "" });
    expect(r.ok).toBe(false);
    expect(r.errors.title).toBeTruthy();
  });
});

describe("interpretCreateResponse", () => {
  it("maps 201 to created", () => {
    const app = { id: "x", company: "Acme", title: "Eng" };
    expect(interpretCreateResponse(201, app)).toEqual({ kind: "created", application: app });
  });
  it("maps 409 to duplicate with the existing row", () => {
    const existing = { id: "y", company: "Acme", title: "Eng", url: null, status: "APPLIED" };
    expect(interpretCreateResponse(409, { duplicate: true, existing })).toEqual({
      kind: "duplicate",
      existing,
    });
  });
  it("passes through the duplicate reason", () => {
    const existing = { id: "y", company: "Acme", title: "Eng", url: null, status: "SAVED" };
    expect(interpretCreateResponse(409, { duplicate: true, reason: "already-saved", existing })).toEqual({
      kind: "duplicate",
      existing,
      reason: "already-saved",
    });
  });
  it("maps 400 to invalid with the message", () => {
    expect(interpretCreateResponse(400, { error: "company and title are required" })).toEqual({
      kind: "invalid",
      message: "company and title are required",
    });
  });
  it("maps other statuses to error", () => {
    expect(interpretCreateResponse(500, {}).kind).toBe("error");
  });
});
