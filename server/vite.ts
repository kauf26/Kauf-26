import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express, { type Express } from "express"; // Added express import here
import type { Server } from "http";
import { createServer as createViteServer } from "vite";

/** ESM (tsx dev) uses import.meta.url; CJS bundle (dist/index.cjs) uses __filename. */
const runtimeDir =
  typeof __filename !== "undefined"
    ? path.dirname(__filename)
    : path.dirname(fileURLToPath(import.meta.url));

export async function setupVite(app: Express, server: Server) {
 const vite = await createViteServer({
   server: { middlewareMode: true, hmr: { server } },
   appType: "custom",
 });

 app.use(vite.middlewares);

 app.use(/.*/, async (req, res, next) => {
   const url = req.originalUrl;
   try {
     const clientTemplate = path.resolve(runtimeDir, "..", "index.html");
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
 const distPath = path.resolve(runtimeDir, "..", "dist", "public");
 if (!fs.existsSync(distPath)) {
   // Bundled build serves Vite output from dist/ (same folder as index.cjs).
   const bundledDist = fs.existsSync(path.join(runtimeDir, "index.html"))
     ? runtimeDir
     : path.resolve(runtimeDir, "..", "dist");
   if (!fs.existsSync(bundledDist)) {
     return;
   }
   app.use(express.static(bundledDist));
   return;
 }
 app.use(express.static(distPath));
}
