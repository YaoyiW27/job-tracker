import { lookup } from "node:dns/promises";

// URL-prefill helper: ONE on-demand fetch of ONE page the user pasted, to
// pre-fill company + title. Metadata-first (JSON-LD JobPosting → OpenGraph →
// <title>), blank fallback. This is not scraping/crawling — a single GET.

export interface PrefillResult {
  company: string;
  title: string;
  salary: string | null;
  /** Which signals produced the values, for transparency/debugging. */
  via: string[];
  error?: string;
}

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 1_000_000;

export class PrefillError extends Error {}

export function assertHttpUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new PrefillError("Not a valid URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new PrefillError("Only http(s) URLs are supported");
  }
  return u;
}

export function isPrivateIp(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0") return true;
  const p = ip.split(".").map(Number);
  if (p.length === 4 && p.every((n) => Number.isFinite(n))) {
    if (p[0] === 10) return true;
    if (p[0] === 127) return true;
    if (p[0] === 169 && p[1] === 254) return true; // link-local
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
  }
  if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) return true;
  return false;
}

/** Block localhost / private-network targets to avoid SSRF from a pasted URL. */
export async function assertPublicHost(u: URL): Promise<void> {
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new PrefillError("Refusing to fetch a local/internal host");
  }
  try {
    const { address } = await lookup(host);
    if (isPrivateIp(address)) {
      throw new PrefillError("Refusing to fetch a private-network host");
    }
  } catch (err) {
    if (err instanceof PrefillError) throw err;
    // DNS failure — let the fetch attempt surface a normal error.
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .trim();
}

function metaContent(html: string, key: string): string | null {
  // Matches <meta property="og:title" content="..."> in either attribute order.
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${key}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1]);
  }
  return null;
}

function titleTag(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m?.[1] ? decodeEntities(m[1]) : null;
}

interface JobLd {
  title?: string;
  company?: string;
  salary?: string;
}

function jsonLdJob(html: string): JobLd | null {
  const blocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const b of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(b[1].trim());
    } catch {
      continue;
    }
    const nodes = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && "@graph" in parsed
        ? (parsed as { "@graph": unknown[] })["@graph"]
        : [parsed];
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const n = node as Record<string, unknown>;
      const type = n["@type"];
      const isJob = Array.isArray(type)
        ? type.includes("JobPosting")
        : type === "JobPosting";
      if (!isJob) continue;
      const org = n.hiringOrganization as Record<string, unknown> | string | undefined;
      const company =
        typeof org === "string" ? org : (org?.name as string | undefined);
      let salary: string | undefined;
      const bs = n.baseSalary as Record<string, unknown> | undefined;
      if (bs && typeof bs === "object") {
        const val = bs.value as Record<string, unknown> | undefined;
        const amount = val?.value ?? val?.minValue;
        const unit = val?.unitText;
        const cur = (bs.currency as string) ?? "";
        if (amount) salary = `${cur} ${amount}${unit ? ` / ${String(unit).toLowerCase()}` : ""}`.trim();
      }
      return {
        title: typeof n.title === "string" ? decodeEntities(n.title) : undefined,
        company: company ? decodeEntities(String(company)) : undefined,
        salary,
      };
    }
  }
  return null;
}

async function fetchHtml(u: URL): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(u.toString(), {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": "job-tracker-prefill/0.1 (single on-demand fetch)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) throw new PrefillError(`Page returned HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    return new TextDecoder("utf-8").decode(buf.slice(0, MAX_BYTES));
  } catch (err) {
    if (err instanceof PrefillError) throw err;
    if ((err as Error).name === "AbortError") throw new PrefillError("Fetch timed out");
    throw new PrefillError(`Could not fetch the page: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pure metadata extraction from an HTML string (no I/O). Preference order:
 * JSON-LD JobPosting → OpenGraph → <title>. Exported so it can be unit-tested
 * against fixture HTML without a network fetch.
 */
export function parseMetadata(html: string): PrefillResult {
  // An empty body is bot protection, not a page that happens to lack metadata:
  // careers.ibm.com answers a non-browser client with 202 and zero bytes, and
  // LinkedIn serves a login wall. Saying "no company/title found" sends you off
  // to retry a link that can never work.
  if (!html.trim()) {
    return {
      company: "",
      title: "",
      salary: null,
      via: [],
      error: "the site returned an empty page — it blocks automated fetching",
    };
  }

  const via: string[] = [];
  const ld = jsonLdJob(html);

  let title = "";
  if (ld?.title) {
    title = ld.title;
    via.push("json-ld");
  } else {
    const og = metaContent(html, "og:title");
    if (og) {
      title = og;
      via.push("og:title");
    } else {
      const t = titleTag(html);
      if (t) {
        title = t;
        via.push("title");
      }
    }
  }

  let company = "";
  if (ld?.company) {
    company = ld.company;
    if (!via.includes("json-ld")) via.push("json-ld");
  } else {
    const site = metaContent(html, "og:site_name");
    if (site) {
      company = site;
      via.push("og:site_name");
    }
  }

  return { company, title, salary: ld?.salary ?? null, via };
}

export async function prefillFromUrl(rawUrl: string): Promise<PrefillResult> {
  const u = assertHttpUrl(rawUrl);
  await assertPublicHost(u);
  const html = await fetchHtml(u);
  return parseMetadata(html);
}
