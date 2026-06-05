#!/usr/bin/env npx tsx
/**
 * CLI: queue a draft for multi-marketplace publishing.
 * Usage: npm run publish:draft -- 112 ebay allegro
 */
import "dotenv/config";
import { db } from "../server/db";
import { productDrafts, publishJobs, publishTasks } from "../shared/schema";
import { eq } from "drizzle-orm";
import {
  draftToPublishPayload,
  SUPPORTED_MARKETPLACE_IDS,
} from "../server/publishToMarketplaces";

const draftId = Number(process.argv[2]);
const marketplaceIds = process.argv.slice(3);

const defaults =
  process.env.DEFAULT_PUBLISH_MARKETPLACES?.split(",").map((s) => s.trim()) ??
  ["ebay", "allegro"];

const targets =
  marketplaceIds.length > 0 ? marketplaceIds : defaults;

async function main() {
  if (!draftId || Number.isNaN(draftId)) {
    console.error(
      "Usage: npm run publish:draft -- <draftId> [marketplaceId ...]\n" +
        `Supported: ${SUPPORTED_MARKETPLACE_IDS.join(", ")}`
    );
    process.exit(1);
  }

  const [draft] = await db
    .select()
    .from(productDrafts)
    .where(eq(productDrafts.id, draftId));

  if (!draft) {
    console.error(`Draft ${draftId} not found`);
    process.exit(1);
  }

  const payload = draftToPublishPayload(draft);

  const [job] = await db
    .insert(publishJobs)
    .values({ productData: payload })
    .returning();

  await db.insert(publishTasks).values(
    targets.map((marketplaceId) => ({
      jobId: job.id,
      marketplaceId,
      status: "pending",
      attempts: 0,
    }))
  );

  console.log(
    `✅ Queued draft #${draftId} "${draft.title}" → job #${job.id} [${targets.join(", ")}]`
  );
  console.log(`   Poll: GET http://localhost:3000/api/marketplaces/status/${job.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
