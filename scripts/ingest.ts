// Entry point for `npm run ingest`. Fetches every registered source, tags each
// posting (location fit + scope/auth flags), and upserts into SQLite.
//
//   npm run ingest                     # active + visible postings only
//   npm run ingest -- --include-inactive   # include inactive/invisible too
import { runIngest } from "../src/ingest";
import { db } from "../src/lib/db";

const includeInactive =
  process.argv.includes("--include-inactive") || process.argv.includes("--all");

runIngest({ includeInactive })
  .then(() => db.$disconnect())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
