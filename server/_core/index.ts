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
import { registerPaymentWebhook } from "../mds/payment-webhook";
import { registerStorageProxy } from "./storageProxy";

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
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
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
