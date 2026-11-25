import { ensureDb } from "./db.js";

await ensureDb();
console.log("Migrations applied.");
