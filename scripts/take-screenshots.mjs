import puppeteer from "puppeteer";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "screenshots");
mkdirSync(OUT, { recursive: true });

const SLIDES = ["upload", "analyze", "listings", "sales", "dashboard"];

// Apple App Store: iPhone 15 Pro Max — 1290×2796 (430×932 viewport at 3x)
// Google Play: same images are accepted (1080×1920 range)
const CONFIGS = [
  { name: "iphone", width: 430, height: 932, dpr: 3 },
  { name: "ipad", width: 768, height: 1024, dpr: 2 },
];

async function main() {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  for (const cfg of CONFIGS) {
    console.log(`\n--- Capturing ${cfg.name} screenshots (${cfg.width}x${cfg.height} @${cfg.dpr}x) ---`);
    const page = await browser.newPage();
    await page.setViewport({ width: cfg.width, height: cfg.height, deviceScaleFactor: cfg.dpr });

    for (const slide of SLIDES) {
      const url = `http://localhost:5000/screenshots?slide=${slide}`;
      console.log(`  Capturing: ${slide}...`);
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await new Promise(r => setTimeout(r, 800));

      const outFile = join(OUT, `${cfg.name}-${slide}.png`);
      await page.screenshot({ path: outFile, fullPage: false });
      console.log(`  ✓ Saved: ${outFile}`);
    }

    await page.close();
  }

  await browser.close();
  console.log("\nAll screenshots captured!");
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
