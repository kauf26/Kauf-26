import express, { type Express } from "express";
import fs from "fs";
import path from "path";

/** Serve Vite client build (production). Safe no-op when only the API bundle exists. */
export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist");
  const indexPath = path.join(distPath, "index.html");

  if (!fs.existsSync(indexPath)) {
    return;
  }

  app.use(express.static(distPath, { index: false }));

  app.use(/.*/, (_req, res, next) => {
    if (_req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(indexPath);
  });
}
