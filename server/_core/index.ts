import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerAutomationRoutes } from "../mds/automation";
import { registerVoiceRoutes } from "../mds/voice-agent";
import { registerPaymentWebhook } from "../mds/payment-webhook";
import { registerStorageProxy } from "./storageProxy";
import { createHash } from "node:crypto";
import { getDb } from "../db";
import * as schema from "../../drizzle/schema";

async function startServer() {
  const app = express();
  const server = createServer(app);
  registerStorageProxy(app);

  // Verify exact request bytes before the JSON body parser changes them.
  registerPaymentWebhook(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "8mb" }));
  app.use(express.urlencoded({ limit: "8mb", extended: true }));
  registerAutomationRoutes(app);
  registerVoiceRoutes(app);
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.post("/api/site-visit", async (req, res) => {
    try {
      const db = await getDb();
      if (!db) return res.status(204).end();
      const forwarded = req.headers["x-forwarded-for"];
      const ip =
        (typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : "") ||
        req.socket.remoteAddress ||
        "unknown";
      const userAgent = req.get("user-agent") || "unknown";
      const visitDay = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Paris",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const salt =
        process.env.MDS_VISIT_SALT ||
        process.env.MANUS_JWT_SECRET ||
        process.env.DATABASE_URL ||
        "mds-visit-fallback";
      const visitorHash = createHash("sha256")
        .update(`${salt}|${visitDay}|${ip}|${userAgent}`)
        .digest("hex");
      const path =
        typeof req.body?.path === "string" && req.body.path.startsWith("/")
          ? req.body.path.slice(0, 120)
          : "/";
      try {
        await db.insert(schema.siteVisits).values({ visitorHash, visitDay, path });
      } catch (error) {
        const code = (error as { code?: string })?.code;
        if (code !== "ER_DUP_ENTRY" && code !== "1062") throw error;
      }
      return res.status(204).end();
    } catch {
      return res.status(204).end();
    }
  });
  app.get("/api/platform/config.js", (_req, res) => {
    res
      .set("Cache-Control", "no-store")
      .type("application/javascript")
      .send(publicPlatformScript());
  });
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    (_req, res, next) => {
      res.set("Cache-Control", "private, no-store");
      res.set("X-Content-Type-Options", "nosniff");
      next();
    },
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid PORT");
  server.on("error", error => {
    console.error("Server failed:", error.message);
    process.exit(1);
  });
  server.listen(port, "0.0.0.0", () =>
    console.log(`Server listening on port ${port}`)
  );
}

startServer().catch(error => {
  console.error(error);
  process.exit(1);
});
