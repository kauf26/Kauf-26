import "dotenv/config";
import { webhookRoutes } from "./webhookRoutes";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";

import { serveStatic } from "./static";
import { createServer } from "http";
import { getStripeSync, createSubscriptionCheckout } from "./stripeClient";

import { scheduleImageCleanup } from "./cleanup";
import pg from "pg";

async function runSchemaMigrations() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS email VARCHAR UNIQUE,
      ADD COLUMN IF NOT EXISTS first_name VARCHAR,
      ADD COLUMN IF NOT EXISTS last_name VARCHAR,
      ADD COLUMN IF NOT EXISTS profile_image_url TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       `);
    console.log("Migrations completed");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await pool.end();
  }
 }

const app: any = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));




const server = createServer(app);

registerRoutes(app);
const PORT = 5001;
app.listen(PORT, "0.0.0.0", () => {
 console.log(`Kauf26 Server running on port ${PORT}`);
});
