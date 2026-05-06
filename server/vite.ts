import express, { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
// @ts-ignore - This tells Cursor to ignore the red line if vite.config isn't found
import viteConfig from "../vite.config";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const viteLogger = createLogger();

export const log = (message: string) => {
 const time = new Date().toLocaleTimeString("en-US", {
   hour: "2-digit",
   minute: "2-digit",
   second: "2-digit",
 });
 console.log(`[${time}] ${message}`);
};

export async function setupVite(app: Express, server: Server) {
 const vite = await createViteServer({
   ...viteConfig,
   logLevel: "info",
   server: {
     middlewareMode: true,
     hmr: { server },
   },
   appType: "custom",
 });

 app.use(vite.middlewares);

 // FIXED: Using a regex literal (/.*/) to bypass the Express 5.x string parsing error
 app.use(/.*/, async (req, res, next) => {
   const url = req.originalUrl;

   try {
     const clientTemplate = path.resolve(__dirname, "..", "client", "index.html");
     const template = await fs.promises.readFile(clientTemplate, "utf-8");
     const page = await vite.transformIndexHtml(url, template);
     res.status(200).set({ "Content-Type": "text/html" }).end(page);
   } catch (e) {
     vite.ssrFixStacktrace(e as Error);
     next(e);
   }
 });
}

export function serveStatic(app: Express) {
 const distPath = path.resolve(__dirname, "public");

 if (!fs.existsSync(distPath)) {
   log(`Note: Static build directory not found at ${distPath}`);
 }

 app.use(express.static(distPath));

 // FIXED: Using regex literal here as well to ensure total compatibility
 app.get(/.*/, (_req, res) => {
   res.sendFile(path.resolve(distPath, "index.html"));
 });
}