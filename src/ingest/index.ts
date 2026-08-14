import { db } from "../lib/db";
import { classifyLocation, isTopTier } from "../lib/location";
import { evaluateScope } from "../lib/scope";
import { effectiveLocationRank } from "../lib/scoring";
import { LOCATION_RANK, type LocationFit } from "../lib/enums";
import { SOURCES } from "./sources/registry";
import { extractListing } from "./normalize";

export interface IngestOptions {
  /** Include inactive/invisible postings (default: skip them). */
  includeInactive?: boolean;
}

export interface IngestSummary {
  scanned: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  buckets: Record<string, number>;
}

/**
 * fetch → tag → upsert. Dedupes on Job.url (real or synthesized). Existing
 * fitScore/fitReason are preserved across runs because they're not part of the
 * upsert payload. A failing source logs and is skipped; others still run.
 */
export async function runIngest(opts: IngestOptions = {}): Promise<IngestSummary> {
  const includeInactive = opts.includeInactive ?? false;
  const buckets: Record<string, number> = {};
  let scanned = 0;
  let processed = 0;
  let skipped = 0;

  const beforeCount = await db.job.count();

  for (const source of SOURCES) {
    let records;
    try {
      records = await source.fetch();
    } catch (err) {
      console.error(`[!] ${source.label}: fetch failed — ${(err as Error).message}`);
      continue;
    }

    console.log(`[i] ${source.label}: ${records.length} records`);
    if (records[0]) {
      console.log(`    fields: ${Object.keys(records[0]).sort().join(", ")}`);
    }

    for (const raw of records) {
      scanned++;
      const ex = extractListing(raw, source);
      if (!ex) {
        skipped++;
        continue;
      }
      if (!includeInactive && (!ex.active || !ex.isVisible)) {
        skipped++;
        continue;
      }

      const cls = classifyLocation(ex.locations);
      const topTier = isTopTier(ex.company);
      const scope = evaluateScope({
        fit: cls.fit,
        locations: ex.locations,
        terms: ex.terms,
        title: ex.title,
        sponsorshipText: ex.sponsorshipNote ?? undefined,
      });
      buckets[cls.fit] = (buckets[cls.fit] ?? 0) + 1;

      // fitScore/fitReason intentionally omitted → preserved on update.
      const data = {
        source: source.key,
        externalId: ex.externalId,
        company: ex.company,
        companyUrl: ex.companyUrl,
        title: ex.title,
        locations: JSON.stringify(ex.locations),
        url: ex.url,
        datePosted: ex.datePosted,
        dateUpdated: ex.dateUpdated,
        active: ex.active,
        isVisible: ex.isVisible,
        terms: ex.terms.length ? JSON.stringify(ex.terms) : null,
        category: ex.category,
        roleKind: source.roleKind,
        locationFit: cls.fit,
        locationRank: effectiveLocationRank(cls.fit, topTier),
        inScope: scope.inScope,
        relocation: cls.relocation,
        topTier,
        sponsorshipNote: ex.sponsorshipNote,
        authFlag: scope.authFlags.length ? scope.authFlags.join("; ") : null,
        salary: ex.salary,
        rawJson: JSON.stringify(ex.raw),
      };

      try {
        await db.job.upsert({ where: { url: ex.url }, create: data, update: data });
        processed++;
      } catch (err) {
        skipped++;
        console.error(`[!] upsert failed for ${ex.company} — ${ex.title}: ${(err as Error).message}`);
      }
    }
  }

  const afterCount = await db.job.count();
  const created = afterCount - beforeCount;
  const updated = processed - created;

  const summary: IngestSummary = { scanned, processed, created, updated, skipped, buckets };
  printSummary(summary);
  return summary;
}

function printSummary(s: IngestSummary): void {
  console.log("");
  console.log(`[✓] scanned ${s.scanned} · upserted ${s.processed} (${s.created} new, ${s.updated} updated) · skipped ${s.skipped}`);
  const fits = Object.keys(s.buckets) as LocationFit[];
  fits.sort((a, b) => LOCATION_RANK[a] - LOCATION_RANK[b]);
  for (const fit of fits) {
    console.log(`      ${fit.padEnd(16)} ${s.buckets[fit]}`);
  }
}
