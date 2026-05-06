import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic, log } from "./vite.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
 const start = Date.now();
 res.on("finish", () => {
   const duration = Date.now() - start;
   if (req.path.startsWith("/api")) {
     log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
   }
 });
 next();
});

(async () => {
 // THE FIX: You must 'await' registerRoutes because it returns a Promise
 const server = await registerRoutes(app);

 app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
   const status = err.status || err.statusCode || 500;
   const message = err.message || "Internal Server Error";
   res.status(status).json({ message });
 });

 if (process.env.NODE_ENV !== "production") {
   await setupVite(app, server);
 } else {
   serveStatic(app);
 }

 const PORT = 5000;
 server.listen(PORT, "0.0.0.0", () => {
   log(`Kauf26 server running on port ${PORT}`);
 });
})();
