import { describe, it, expect } from "vitest";
import { jobToApplicationInput } from "@/lib/job-save";

const job = {
  id: "job1",
  company: "Acme",
  title: "Backend Engineer",
  url: "https://jobs.acme.com/1",
  salary: "USD 120k",
};

describe("jobToApplicationInput", () => {
  it("maps core fields and defaults status to SAVED with the jobId link", () => {
    expect(jobToApplicationInput(job)).toEqual({
      company: "Acme",
      title: "Backend Engineer",
      url: "https://jobs.acme.com/1",
      salary: "USD 120k",
      jobId: "job1",
      status: "SAVED",
    });
  });

  it("drops a synthesized urn: url (no real apply link)", () => {
    expect(jobToApplicationInput({ ...job, url: "urn:simplify:new-grad:abc" }).url).toBeNull();
  });

  it("handles null url and salary", () => {
    const r = jobToApplicationInput({ ...job, url: null, salary: null });
    expect(r.url).toBeNull();
    expect(r.salary).toBeNull();
  });
});
