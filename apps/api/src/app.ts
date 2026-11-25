import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import fastifyStatic from "@fastify/static";
import { ensureDb } from "./db.js";
import { registerRoutes } from "./routes.js";
import { seed } from "./seed.js";

let appPromise: Promise<FastifyInstance> | undefined;

/** 建立（或重用）Fastify app，供本機 listen 與 Vercel serverless 共用 */
export async function getApp(): Promise<FastifyInstance> {
  appPromise ??= buildApp();
  return appPromise;
}

async function buildApp(): Promise<FastifyInstance> {
  await ensureDb();
  await seed(false);

  const app = Fastify({
    logger: !process.env.VERCEL,
  });

  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    try {
      const raw = typeof body === "string" ? body : Buffer.isBuffer(body) ? body.toString("utf8") : String(body ?? "");
      done(null, raw.trim() === "" ? {} : JSON.parse(raw));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  await app.register(cors, { origin: true });
  await registerRoutes(app);

  const webDistCandidates = [
    resolve(process.cwd(), "../web/dist"),
    resolve(process.cwd(), "apps/web/dist"),
    resolve(process.cwd(), "dist"),
  ];
  const webDist = webDistCandidates.find((p) => existsSync(p));
  if (webDist) {
    await app.register(fastifyStatic, {
      root: webDist,
      prefix: "/",
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api") || req.url.startsWith("/webhook") || req.url === "/health") {
        return reply.code(404).send({ error: "Not found" });
      }
      return reply.sendFile("index.html");
    });
  }

  await app.ready();
  return app;
}
