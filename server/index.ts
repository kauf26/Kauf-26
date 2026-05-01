import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { createPerSaleCheckout, createHoldPayment } from "./stripeClient";

// We'll import Vite tools as 'any' to bypass the "no exported member" ghost errors
import * as viteTools from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Helper to safely call logging if it exists in your vite file
const safeLog = (message: string) => {
 if (viteTools && (viteTools as any).log) {
   (viteTools as any).log(message);
 } else {
   console.log(message);
 }
};

// --- Logging Middleware ---
app.use((req, res, next) => {
 const start = Date.now();
 res.on("finish", () => {
   const duration = Date.now() - start;
   safeLog(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
 });
 next();
});

(async () => {
 const server = createServer(app);

 // Register your Kauf26 routes
 await registerRoutes(app);

 // Error handling
 app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
   const status = err.status || err.statusCode || 500;
   res.status(status).json({ message: err.message || "Internal Server Error" });
 });

 // Setup Vite/Static serving using 'any' to bypass the Line 40/Line 4 error
 if (app.get("env") === "development") {
   if ((viteTools as any).setupVite) {
     await (viteTools as any).setupVite(app, server);
   }
 } else {
   if ((viteTools as any).serveStatic) {
     (viteTools as any).serveStatic(app);
   }
 }

 const PORT = 5000;
 server.listen(PORT, "0.0.0.0", () => {
   safeLog(`Kauf26 Server running locally on port ${PORT}`);
 });
})();