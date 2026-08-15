import { LOCATION_FIT, ROLE_KIND, type LocationFit, type RoleKind } from "./enums";

// Pure query layer for the Discover page: parse URL params into a validated
// JobQuery, then build the Prisma where/orderBy. No DB access — unit-tested.

export interface JobQuery {
  bucket: LocationFit | null;
  company: string | null;
  category: string | null;
  roleKind: RoleKind | null;
  minFitScore: number | null;
  activeOnly: boolean;
  inScopeOnly: boolean;
  sort: JobSort;
  page: number;
  pageSize: number;
}

export type JobSort = "fit" | "newest";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

function clampInt(v: string | null, min: number, max: number, fallback: number): number {
  if (v === null) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function cleanStr(v: string | null): string | null {
  const t = v?.trim();
  return t ? t : null;
}

function isTruthyFlag(v: string | null): boolean {
  return v === "1" || v === "true" || v === "yes";
}

export function parseJobQuery(params: URLSearchParams): JobQuery {
  const bucketRaw = params.get("bucket");
  const bucket = bucketRaw && bucketRaw in LOCATION_FIT ? (bucketRaw as LocationFit) : null;

  const roleRaw = params.get("role");
  const roleKind = roleRaw && roleRaw in ROLE_KIND ? (roleRaw as RoleKind) : null;

  const minFitRaw = params.get("minFit");
  let minFitScore: number | null = null;
  if (minFitRaw !== null && Number.isFinite(Number(minFitRaw))) {
    minFitScore = Math.min(100, Math.max(0, Math.floor(Number(minFitRaw))));
  }

  const active = params.get("active");
  const activeOnly = !(active === "all" || active === "0" || active === "false");

  return {
    bucket,
    company: cleanStr(params.get("company")),
    category: cleanStr(params.get("category")),
    roleKind,
    minFitScore,
    activeOnly,
    inScopeOnly: isTruthyFlag(params.get("inScope")),
    sort: params.get("sort") === "newest" ? "newest" : "fit",
    page: clampInt(params.get("page"), 1, Number.MAX_SAFE_INTEGER, 1),
    pageSize: clampInt(params.get("pageSize"), 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE),
  };
}

export function buildJobWhere(query: JobQuery): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (query.activeOnly) {
    where.active = true;
    where.isVisible = true;
  }
  if (query.inScopeOnly) where.inScope = true;
  if (query.bucket) where.locationFit = query.bucket;
  if (query.roleKind) where.roleKind = query.roleKind;
  if (query.company) where.company = { contains: query.company };
  if (query.category) where.category = { contains: query.category };
  if (query.minFitScore !== null) where.fitScore = { gte: query.minFitScore };
  return where;
}

// Two orderings, freshness kept separate from fit:
//  - "fit": location bucket (top-tier bump baked into locationRank at ingest),
//    then fitScore (NULLs sort low on SQLite, so scored jobs lead), then recency.
//  - "newest": most recently posted first, then location bucket as a tiebreak.
export function buildJobOrderBy(sort: JobSort = "fit") {
  return sort === "newest"
    ? [{ datePosted: "desc" }, { locationRank: "asc" }]
    : [{ locationRank: "asc" }, { fitScore: "desc" }, { datePosted: "desc" }];
}
