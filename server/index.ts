import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic } from "./vite.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

(async () => {
 // registerRoutes returns a Promise, so we MUST await it
 const server = await registerRoutes(app);

 if (app.get("env") === "development") {
   await setupVite(app, server);
 } else {
   serveStatic(app);
 }

 const PORT = 5001;
 server.listen(PORT, "0.0.0.0", () => {
   console.log(`Kauf26 server running on port ${PORT}`);
 });
})();