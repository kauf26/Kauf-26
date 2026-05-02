import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { createPerSaleCheckout } from "./stripeClient";

// Import Vite tools as 'any' to bypass environment sync ghost errors
import * as viteTools from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/**
* Helper to safely call logging if it exists in your local vite file.
*/
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
   if (req.path.startsWith("/api")) {
     safeLog(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
   }
 });
 next();
});

(async () => {
 const server = createServer(app);

 // Register the updated Kauf26 routes
 registerRoutes(app);

 // Global Error Handling
 app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
   const status = err.status || err.statusCode || 500;
   const message = err.message || "Internal Server Error";
   res.status(status).json({ message });
   console.error(`[Server Error] ${status}: ${message}`);
 });

 // Force PORT to be a number to satisfy the listener requirements
 const PORT = Number(process.env.PORT) || 2626;

 // Start the server
 server.listen(PORT, "0.0.0.0", () => {
   safeLog(`Kauf26 local server is live at http://localhost:${PORT}`);
 });
})();