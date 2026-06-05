/**
 * Verbose identify/scrape pipeline logging.
 * Enable: IDENTIFY_DEBUG=true npm run server
 * CLI:    npm run scrape:debug -- "Rolex Submariner"
 */

export function isIdentifyDebug(): boolean {
  return (
    process.env.IDENTIFY_DEBUG === "true" ||
    process.env.IDENTIFY_DEBUG === "1" ||
    process.env.SCRAPE_DEBUG === "true" ||
    process.env.SCRAPE_DEBUG === "1"
  );
}

export function debugIdentify(
  stage: string,
  data: Record<string, unknown>
): void {
  if (!isIdentifyDebug()) return;
  console.log(
    `[IdentifyDebug][${stage}]`,
    JSON.stringify(data, null, 2)
  );
}
