import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic, log } from "./vite.js";
import * as stripeService from "./stripeClient.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req: Request, res: Response, next: NextFunction) => {
 const start = Date.now();
 const path = req.path;
 let resBody: any;

 const originalResJson = res.json;
 res.json = function (bodyJson, ...args) {
   resBody = bodyJson;
   return originalResJson.apply(res, [bodyJson, ...args]);
 };

 res.on("finish", () => {
   const duration = Date.now() - start;
   if (path.startsWith("/api")) {
     let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
     if (resBody) {
       logLine += ` :: ${JSON.stringify(resBody)}`;
     }

     if (logLine.length > 80) {
       logLine = logLine.substring(0, 77) + "...";
     }

     log(logLine);
   }
 });

 next();
});

(async () => {
 const server = registerRoutes(app);

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
   log(`Kauf26 running on port ${PORT}`);
 });
})();