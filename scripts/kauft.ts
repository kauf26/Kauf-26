#!/usr/bin/env npx tsx
/**
 * Kauf26 CLI
 *
 *   kauft publish <draftId> --marketplaces ebay,allegro,amazon
 *   kauft publish-all <draftId>
 *   npm run kauft -- publish 112 --marketplaces ebay,etsy,shopify
 */
import "dotenv/config";
import {
  publishDraft,
  publishDraftToAll,
  formatPublishReport,
} from "../server/services/publishEngine";
import {
  getEnabledMarketplaceIds,
  MASTER_MARKETPLACES,
} from "../server/config/marketplaces";

function parseArgs(argv: string[]) {
  const cmd = argv[0];
  if (cmd !== "publish" && cmd !== "publish-all") {
    return null;
  }

  const draftId = Number(argv[1]);
  let marketplaces: string[] | undefined;

  const flagIdx = argv.indexOf("--marketplaces");
  if (flagIdx !== -1 && argv[flagIdx + 1]) {
    marketplaces = argv[flagIdx + 1]
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  return { cmd, draftId, marketplaces };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  if (!parsed || !parsed.draftId || Number.isNaN(parsed.draftId)) {
    console.log(`Kauf26 CLI

Usage:
  kauft publish <draftId> --marketplaces ebay,allegro,amazon,etsy
  kauft publish-all <draftId>
  npm run kauft -- publish 112 --marketplaces ebay,etsy,shopify
  npm run kauft -- publish-all 112

Enabled for publishing (${getEnabledMarketplaceIds().length}): ${getEnabledMarketplaceIds().join(", ")}

All platforms (${MASTER_MARKETPLACES.length}): ${MASTER_MARKETPLACES.map((m) => m.id).join(", ")}
`);
    process.exit(parsed ? 1 : 0);
  }

  const report =
    parsed.cmd === "publish-all"
      ? await publishDraftToAll(parsed.draftId, {
          sync: true,
          createJob: true,
        })
      : await publishDraft(parsed.draftId, parsed.marketplaces, {
          sync: true,
          createJob: true,
        });

  console.log(formatPublishReport(report));
  process.exit(report.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
