import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { setupVite, serveStatic } from "./vite.js";
import { registerRoutes } from "./routes.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Logging middleware
app.use((req, res, next) => {
 const start = Date.now();
 const path = req.path;
 res.on("finish", () => {
   const duration = Date.now() - start;
   if (path.startsWith("/api")) {
     console.log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
   }
 });
 next();
});

(async () => {
 const server = createServer(app);

 // Error handling middleware
 app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
   const status = err.status || err.statusCode || 500;
   const message = err.message || "Internal Server Error";
   res.status(status).json({ message });
 });

 // IMPORTANT: registerRoutes should come BEFORE setupVite/serveStatic
 registerRoutes(app);

 if (process.env.NODE_ENV !== "production") {
   // This matches the 2-argument version: (app, server)
   await setupVite(app, server);
 } else {
   serveStatic(app);
 }

 const PORT = 5000;
 server.listen(PORT, "0.0.0.0", () => {
   console.log(`Kauf26 server running on port ${PORT}`);
 });
})();
