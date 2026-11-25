import { config } from "./config.js";
import { getApp } from "./app.js";

async function main() {
  const app = await getApp();
  await app.listen({ port: config.port, host: config.host });
  console.log(`SilverCare API 聆聽於 http://${config.host}:${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
