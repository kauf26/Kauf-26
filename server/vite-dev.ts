import fs from "fs";
import path from "path";
import express, { type Express } from "express";
import type { Server } from "http";
import { createServer as createViteServer } from "vite";

/** Dev-only Vite middleware — not imported in production builds. */
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
