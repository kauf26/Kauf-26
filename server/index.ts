import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { webhookRoutes } from "./webhookRoutes.js";
import { registerRoutes } from "./routes.js";
import { serveStatic } from "./static.js";
import { createServer } from "http";
import { createSubscriptionCheckout, createHoldPaymentIntent } from "./stripeClient.js";
import { scheduleImageCleanup } from "./cleanup.js";
import pg from "pg";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

async function runSchemaMigrations() {
 const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
 try {
   await pool.query(`
     ALTER TABLE users
     ADD COLUMN IF NOT EXISTS email VARCHAR UNIQUE,
     ADD COLUMN IF NOT EXISTS first_name VARCHAR,
     ADD COLUMN IF NOT EXISTS last_name VARCHAR,
     ADD COLUMN IF NOT EXISTS profile_image_url TEXT,
     ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
     ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
   `);
   console.log("Migrations completed");
 } catch (err) {
   console.error("Migration error:", err);
 } finally {
   await pool.end();
 }
}

const startServer = async () => {
 await runSchemaMigrations();
 const server = createServer(app);

 // This helps the editor find the route definitions
 registerRoutes(app);

 const PORT = 5001;
 server.listen(PORT, "0.0.0.0", () => {
   console.log(`Kauf26 Server running on port ${PORT}`);
 });
};

startServer();
