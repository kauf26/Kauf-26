import express from "express";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

(async () => {
 const server = await registerRoutes(app);

 // Global Error Handler
 app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
   const status = err.status || err.statusCode || 500;
   const message = err.message || "Internal Server Error";
   res.status(status).json({ message });
   throw err;
 });

 if (app.get("env") === "development") {
   await setupVite(app, server);
 } else {
   serveStatic(app);
 }

 const PORT = 5000;
 server.listen(PORT, "0.0.0.0", () => {
   log(`Kauf26 serving on port ${PORT}`);
 });
})();