import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express, { type Express } from "express"; // Added express import here
import type { Server } from "http";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function setupVite(app: Express, server: Server) {
 const vite = await createViteServer({
   server: { middlewareMode: true, hmr: { server } },
   appType: "custom",
 });

 app.use(vite.middlewares);

 app.use(/.*/, async (req, res, next) => {
   const url = req.originalUrl;
   try {
     const clientTemplate = path.resolve(__dirname, "..", "index.html");
     const template = await fs.promises.readFile(clientTemplate, "utf8");
     const page = await vite.transformIndexHtml(url, template);
     res.status(200).set({ "Content-Type": "text/html" }).end(page);
   } catch (e) {
     vite.ssrFixStacktrace(e as Error);
     next(e);
   }
 });
}

export function serveStatic(app: Express) {
 const distPath = path.resolve(__dirname, "..", "dist", "public");
 if (!fs.existsSync(distPath)) {
   // This is fine for dev; it only throws if you're trying to run production build
   return;
 }
 app.use(express.static(distPath));
}
