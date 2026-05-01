import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const viteLogger = createLogger();

export const log = (message: string) => {
 const time = new Date().toLocaleTimeString("en-US", {
   hour: "2-digit",
   minute: "2-digit",
   second: "2-digit",
 });
 console.log(`[${time}] ${message}`);
};

export async function setupVite(app: Express, server: Server) {
 const serverOptions = {
   middlewareMode: true,
   hmr: { server, path: "/vite-hmr" },
   allowedHosts: true as const,
 };

 const vite = await createViteServer({
   ...viteConfig,
   configFile: false,
   customLogger: {
     ...viteLogger,
     error: (msg, options) => {
       viteLogger.error(msg, options);
       process.exit(1);
     },
   },
   server: serverOptions,
   appType: "custom",
 });

 app.use(vite.middlewares);

 app.use("*", async (req, res, next) => {
   const url = req.originalUrl;
   try {
     const clientTemplate = path.resolve(__dirname, "..", "client", "index.html");
     let template = await fs.promises.readFile(clientTemplate, "utf-8");

     template = template.replace(
       `src="/src/main.tsx"`,
       `src="/src/main.tsx?v=${nanoid()}"`,
     );

     const page = await vite.transformIndexHtml(url, template);
     res.status(200).set({ "Content-Type": "text/html" }).end(page);
   } catch (e) {
     vite.ssrFixStacktrace(e as Error);
     next(e);
   }
 });
}

export function serveStatic(app: Express) {
 const distPath = path.resolve(__dirname, "public");
 if (!fs.existsSync(distPath)) {
   // If running locally, this just acts as a safety check
   log(`Note: Static build directory not found at ${distPath}`);
 }
}