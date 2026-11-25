import Fastify from "fastify";
import cors from "@fastify/cors";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import fastifyStatic from "@fastify/static";
import { config } from "./config.js";
import { ensureDb } from "./db.js";
import { registerRoutes } from "./routes.js";
import { seed } from "./seed.js";

async function main() {
  await ensureDb();
  if (config.seedOnBoot) {
    await seed(false);
  } else {
    // 本機首次啟動自動 seed，方便零配置上手
    await seed(false);
  }

  const app = Fastify({
    logger: true,
    // 允許無 body 的 POST（例如一鍵調度）
  });
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    try {
      const raw = typeof body === "string" ? body : body.toString("utf8");
      done(null, raw.trim() === "" ? {} : JSON.parse(raw));
    } catch (err) {
      done(err as Error, undefined);
    }
  });
  await app.register(cors, {
    origin: true,
  });
  await registerRoutes(app);

  const webDist = resolve(process.cwd(), "../web/dist");
  if (existsSync(webDist)) {
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

  await app.listen({ port: config.port, host: config.host });
  console.log(`SilverCare API 聆聽於 http://${config.host}:${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
