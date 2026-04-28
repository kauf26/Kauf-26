import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes"; // Removed .js
import { setupVite, serveStatic, log } from "./vite"; // Removed .js

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Custom logging middleware
app.use((req, res, next) => {
 const start = Date.now();
 const path = req.path;
 let resBody: any;

 const originalResJson = res.json;
 res.json = function (body) {
   resBody = body;
   return originalResJson.apply(res, arguments as any);
 };

 res.on("finish", () => {
   const duration = Date.now() - start;
   if (path.startsWith("/api")) {
     let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
     if (resBody) {
       logLine += ` :: ${JSON.stringify(resBody)}`;
     }
     if (logLine.length > 80) {
       logLine = logLine.slice(0, 79) + "…";
     }
     log(logLine);
   }
 });

 next();
});

(async () => {
 const server = await registerRoutes(app);

 // Error handling middleware
 app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
   const status = err.status || err.statusCode || 500;
   const message = err.message || "Internal Server Error";
   res.status(status).json({ message });
   throw err;
 });

 // Setup vite or static files
 if (app.get("env") === "development") {
   await setupVite(app, server);
 } else {
   serveStatic(app);
 }

 // Bind to 0.0.0.0 to work in all environments
 const PORT = 5000;
 server.listen(PORT, "0.0.0.0", () => {
   log(`serving on port ${PORT}`);
 });
})();
