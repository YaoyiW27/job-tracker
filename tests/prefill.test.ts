import { describe, it, expect } from "vitest";
import {
  assertHttpUrl,
  assertPublicHost,
  isPrivateIp,
  parseMetadata,
  PrefillError,
} from "@/lib/prefill";

describe("assertHttpUrl", () => {
  it("accepts http(s) URLs", () => {
    expect(assertHttpUrl("https://example.com/job").hostname).toBe("example.com");
  });
  it("rejects non-http schemes", () => {
    expect(() => assertHttpUrl("file:///etc/passwd")).toThrow(PrefillError);
    expect(() => assertHttpUrl("ftp://x/y")).toThrow(PrefillError);
  });
  it("rejects malformed URLs", () => {
    expect(() => assertHttpUrl("not a url")).toThrow(PrefillError);
  });
});

describe("isPrivateIp (SSRF guard)", () => {
  it("flags loopback and private ranges", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.5", "172.16.9.9", "169.254.1.1", "::1"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });
  it("allows public addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34"]) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });
});

describe("assertPublicHost — refuses local/internal hosts", () => {
  it("refuses localhost and .local/.internal", async () => {
    await expect(assertPublicHost(new URL("http://localhost/admin"))).rejects.toThrow(PrefillError);
    await expect(assertPublicHost(new URL("http://db.local/"))).rejects.toThrow(PrefillError);
    await expect(assertPublicHost(new URL("http://svc.internal/"))).rejects.toThrow(PrefillError);
  });
});

describe("parseMetadata — extraction precedence", () => {
  it("prefers JSON-LD JobPosting for title + company", () => {
    const html = `<html><head>
      <title>Careers | Acme</title>
      <meta property="og:title" content="Ignored OG Title" />
      <script type="application/ld+json">
      {"@type":"JobPosting","title":"Senior Backend Engineer",
       "hiringOrganization":{"@type":"Organization","name":"Acme Corp"}}
      </script>
    </head></html>`;
    const r = parseMetadata(html);
    expect(r.title).toBe("Senior Backend Engineer");
    expect(r.company).toBe("Acme Corp");
    expect(r.via).toContain("json-ld");
  });

  it("falls back to OpenGraph when no JSON-LD", () => {
    const html = `<head>
      <meta property="og:title" content="Platform Engineer" />
      <meta property="og:site_name" content="Globex" />
      <title>whatever</title>
    </head>`;
    const r = parseMetadata(html);
    expect(r.title).toBe("Platform Engineer");
    expect(r.company).toBe("Globex");
    expect(r.via).toEqual(expect.arrayContaining(["og:title", "og:site_name"]));
  });

  it("falls back to <title> when no JSON-LD or OG title", () => {
    const r = parseMetadata(`<head><title>ML Engineer - Initech</title></head>`);
    expect(r.title).toBe("ML Engineer - Initech");
    expect(r.via).toContain("title");
  });

  it("decodes HTML entities", () => {
    const r = parseMetadata(`<head><title>R&amp;D Engineer &#39;27</title></head>`);
    expect(r.title).toBe("R&D Engineer '27");
  });

  it("returns blanks when nothing is present, and says why", () => {
    // No JSON-LD, no og:title, not even a <title> — a real page always has one,
    // so this is reported as an interstitial rather than a metadata-less page.
    const r = parseMetadata(`<html><body>no metadata here</body></html>`);
    expect(r).toMatchObject({ company: "", title: "", salary: null, via: [] });
    expect(r.error).toBeDefined();
  });

  it("extracts salary from JSON-LD baseSalary when present", () => {
    const html = `<script type="application/ld+json">
      {"@type":"JobPosting","title":"SWE",
       "baseSalary":{"currency":"USD","value":{"value":120000,"unitText":"YEAR"}}}
      </script>`;
    const r = parseMetadata(html);
    expect(r.salary).toContain("120000");
  });
});

describe("blocked / interstitial responses", () => {
  // Trimmed from what careers.ibm.com actually serves a non-browser client:
  // HTTP 202, an AWS WAF challenge, and an empty <title>.
  const WAF_PAGE =
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title></title>' +
    '<script type="text/javascript">window.awsWafCookieDomainList = [];</script>' +
    "</head><body></body></html>";

  it("names bot protection instead of blaming the page's contents", () => {
    const r = parseMetadata(WAF_PAGE);
    expect(r.via).toEqual([]);
    expect(r.error).toMatch(/bot-check|blocks automated/i);
  });

  it("flags an empty body the same way", () => {
    expect(parseMetadata("").error).toMatch(/bot-check|blocks automated/i);
    expect(parseMetadata("   \n  ").error).toMatch(/bot-check|blocks automated/i);
  });

  it("does not flag a real page that simply lacks job metadata", () => {
    const html = "<html><head><title>Careers</title></head><body><p>hi</p></body></html>";
    const r = parseMetadata(html);
    expect(r.via).toContain("title");
    expect(r.error).toBeUndefined();
  });
});
