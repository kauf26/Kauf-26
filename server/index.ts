import express from "express";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic, log } from "./vite.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

     if (logLine.length > 100) {
       logLine = logLine.substring(0, 99) + "...";
     }

     log(logLine);
   }
 });

 next();
});

(async () => {
 // Pass the express 'app' to registerRoutes
 const server = registerRoutes(app);

 // Global Error Handler
 app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
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