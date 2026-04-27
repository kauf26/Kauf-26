import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const viteLogger = createLogger();

export const log = (message: string) => {
 const time = new Date().toLocaleTimeString("en-US", {
   hour: "2-digit",
   minute: "2-digit",
   second: "2-digit",
   hour12: false,
 });
 console.log(`${time} [express] ${message}`);
};

export async function setupVite(app: Express, server: Server) {
 const vite = await createViteServer({
   server: {
     middlewareMode: true,
     hmr: { server },
   },
   appType: "custom",
 });

 app.use(vite.middlewares);
}

export function serveStatic(app: Express) {
 const distPath = path.resolve(__dirname, "public");
 if (!fs.existsSync(distPath)) {
   // Safety check for local assets
 }
}
