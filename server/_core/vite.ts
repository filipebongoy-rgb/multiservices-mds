import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { isPageRoute, publicPageHtml } from "../publicHtml";

export async function setupVite(app: Express, server: Server) {
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: { middlewareMode: true, hmr: { server }, allowedHosts: true },
    appType: "custom",
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const pathname = new URL(req.originalUrl, "http://localhost").pathname;
    if (pathname.startsWith("/api/")) {
      res.status(404).json({ error: "API introuvable" });
      return;
    }
    try {
      const clientDir = path.resolve(import.meta.dirname, "../..", "client");
      let template = await fs.promises.readFile(
        path.join(clientDir, "index.html"),
        "utf8"
      );
      template = template.replace(
        'src="/src/main.tsx"',
        'src="/src/main.tsx?v=' + nanoid() + '"'
      );
      template = publicPageHtml(
        template,
        pathname,
        path.join(clientDir, "public")
      );
      const page = await vite.transformIndexHtml(req.originalUrl, template);
      res
        .status(isPageRoute(pathname) ? 200 : 404)
        .set({
          "Content-Type": "text/html",
          "Cache-Control": "private, no-store",
        })
        .end(page);
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      next(error);
    }
  });
}
export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath))
    console.error("Frontend build directory missing:", distPath);
  app.use(express.static(distPath, { index: false }));
  app.use("*", (req, res) => {
    const pathname = new URL(req.originalUrl, "http://localhost").pathname;
    if (pathname.startsWith("/api/")) {
      res.status(404).json({ error: "API introuvable" });
      return;
    }
    const template = fs.readFileSync(path.join(distPath, "index.html"), "utf8");
    res
      .status(isPageRoute(pathname) ? 200 : 404)
      .set({
        "Content-Type": "text/html",
        "Cache-Control": "private, no-store",
      })
      .send(publicPageHtml(template, pathname, distPath));
  });
}
