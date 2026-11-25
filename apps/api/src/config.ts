import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv();

function resolveMigrationsDir(): string {
  const fromEnv = process.env.MIGRATIONS_DIR;
  if (fromEnv) return resolve(process.cwd(), fromEnv);
  const candidates = [
    resolve(process.cwd(), "migrations"),
    resolve(process.cwd(), "../../migrations"),
    resolve(process.cwd(), "../migrations"),
  ];
  return candidates.find((p) => existsSync(p)) ?? candidates[0];
}

const onVercel = Boolean(process.env.VERCEL);

export const config = {
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? "0.0.0.0",
  databaseUrl: (process.env.DATABASE_URL ?? "").trim(),
  // Vercel serverless 檔案系統唯讀：改用記憶體 PGlite（每次冷啟動 seed）
  dataDir: onVercel || process.env.DATA_DIR === ":memory:" ? ":memory:" : (process.env.DATA_DIR ?? resolve(process.cwd(), "../../data")),
  migrationsDir: resolveMigrationsDir(),
  channelMode: (process.env.CHANNEL_MODE ?? "web") as "web" | "whatsapp",
  openaiApiKey: (process.env.OPENAI_API_KEY ?? "").trim(),
  openaiBaseUrl: (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, ""),
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  whatsappToken: (process.env.WHATSAPP_TOKEN ?? "").trim(),
  whatsappPhoneNumberId: (process.env.WHATSAPP_PHONE_NUMBER_ID ?? "").trim(),
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? "silvercare-verify",
  whatsappAppSecret: (process.env.WHATSAPP_APP_SECRET ?? "").trim(),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  centerName: process.env.CENTER_NAME ?? "銀護居家服務中心",
  seedOnBoot: process.env.SEED_ON_BOOT === "true",
};
