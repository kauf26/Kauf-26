import type { Express } from "express";
import { authStorage, type DailyProductLimitLockoutBody } from "./storage";
import { registerCatalogRoutes } from "./catalogRoutes";

export function registerRoutes(app: Express) {
 registerCatalogRoutes(app);

 app.delete("/api/user", async (req, res) => {
   if (!req.isAuthenticated()) {
     return res.status(401).send("Not logged in");
   }

   try {
     const sub = (req.user as { claims?: { sub?: string } })?.claims?.sub;
     if (!sub) {
       return res.status(400).json({ message: "Missing user subject" });
     }

     await authStorage.deleteUser(sub);

     req.logout((err) => {
       if (err) return res.status(500).send("Error logging out");
       res.sendStatus(200);
     });
   } catch (err) {
     res.status(500).json({ message: "Failed to delete account" });
   }
 });
}
