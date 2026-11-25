import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv();

export const config = {
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? "0.0.0.0",
  databaseUrl: (process.env.DATABASE_URL ?? "").trim(),
  dataDir: process.env.DATA_DIR ?? resolve(process.cwd(), "../../data"),
  migrationsDir: resolve(process.cwd(), process.env.MIGRATIONS_DIR ?? "../../migrations"),
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
