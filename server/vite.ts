import fs from "fs";
import path from "path";
import express, { type Express } from "express";
import type { Server } from "http";
import { createServer as createViteServer } from "vite";

/** Project root — npm start runs from repo root; dist/index.cjs lives in dist/. */
const projectRoot = process.cwd();

export async function setupVite(app: Express, server: Server) {
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: { server } },
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use(/.*/, async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path.resolve(projectRoot, "index.html");
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
  const distPath = path.resolve(projectRoot, "dist");
  if (!fs.existsSync(distPath)) {
    return;
  }
  app.use(express.static(distPath));
}
