#!/usr/bin/env npx tsx
/**
 * Kauf26 CLI
 *
 *   kauft publish <draftId> --marketplaces ebay,allegro,facebook
 *   npm run kauft -- publish 112 --marketplaces ebay,allegro
 */
import "dotenv/config";
import {
  publishDraft,
  formatPublishReport,
} from "../server/services/publishEngine";
import { getEnabledMarketplaceIds } from "../server/config/marketplaces";

function parseArgs(argv: string[]) {
  const cmd = argv[0];
  if (cmd !== "publish") {
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

  const positional = argv
    .slice(2)
    .filter((a, i) => i !== flagIdx - 2 && i !== flagIdx - 1 && !a.startsWith("--"));

  if (!marketplaces?.length && positional.length > 0) {
    marketplaces = positional;
  }

  return { draftId, marketplaces };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  if (!parsed || !parsed.draftId || Number.isNaN(parsed.draftId)) {
    console.log(`Kauf26 CLI

Usage:
  kauft publish <draftId> --marketplaces ebay,allegro,facebook
  npm run kauft -- publish 112 --marketplaces ebay,allegro

Enabled marketplaces: ${getEnabledMarketplaceIds().join(", ")}
`);
    process.exit(parsed ? 1 : 0);
  }

  const report = await publishDraft(parsed.draftId, parsed.marketplaces, {
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
