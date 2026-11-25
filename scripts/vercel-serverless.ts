import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ensureDb, sql, sqlOne } from "../apps/api/src/db.js";
import { handleChat } from "../apps/api/src/agent/handler.js";
import { getAnalytics, getTimetable } from "../apps/api/src/analytics.js";
import { autoAssign, findCandidates } from "../apps/api/src/dispatch.js";
import { seed } from "../apps/api/src/seed.js";
import { config } from "../apps/api/src/config.js";

let booted: Promise<void> | undefined;

async function boot() {
  booted ??= (async () => {
    process.env.DATA_DIR ||= ":memory:";
    process.env.MIGRATIONS_DIR ||= "migrations";
    await ensureDb();
    await seed(false);
  })();
  await booted;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return value.replace(/[{}]/g, "").split(",").filter(Boolean);
    }
  }
  return [];
}

async function readJson(req: VercelRequest): Promise<unknown> {
  if (req.body != null && typeof req.body === "object") return req.body;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await boot();
    const method = (req.method ?? "GET").toUpperCase();
    const url = new URL(req.url ?? "/", `https://${req.headers.host ?? "localhost"}`);
    const path = url.pathname.replace(/\/$/, "") || "/";

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    if (path === "/health") {
      res.status(200).json({
        ok: true,
        service: "silvercare-home-hub",
        channelMode: config.channelMode,
        centerName: config.centerName,
        llm: Boolean(config.openaiApiKey),
        runtime: "vercel",
      });
      return;
    }

    if (path === "/api/meta" && method === "GET") {
      res.status(200).json({
        centerName: config.centerName,
        channelMode: config.channelMode,
        demoPhones: { family: "61110001", caregiver: "91230001" },
      });
      return;
    }

    if (path === "/api/dashboard" && method === "GET") {
      const counts = await sqlOne(
        `SELECT
          (SELECT COUNT(*) FROM elderly_clients) AS clients,
          (SELECT COUNT(*) FROM caregivers WHERE active) AS caregivers,
          (SELECT COUNT(*) FROM bookings WHERE status = 'pending') AS pending,
          (SELECT COUNT(*) FROM bookings WHERE status IN ('assigned','accepted','en_route','in_progress')) AS active,
          (SELECT COUNT(*) FROM bookings WHERE status = 'completed') AS completed`,
      );
      const upcoming = await sql(
        `SELECT b.id, b.status, b.requested_start, b.requested_end,
                st.name_zh AS service_name, c.name AS client_name, c.district,
                cg.name AS caregiver_name
         FROM bookings b
         JOIN service_types st ON st.id = b.service_type_id
         JOIN elderly_clients c ON c.id = b.client_id
         LEFT JOIN assignments a ON a.booking_id = b.id
         LEFT JOIN caregivers cg ON cg.id = a.caregiver_id
         WHERE b.status NOT IN ('cancelled')
         ORDER BY b.requested_start ASC
         LIMIT 20`,
      );
      res.status(200).json({ counts, upcoming });
      return;
    }

    if (path === "/api/analytics" && method === "GET") {
      res.status(200).json(await getAnalytics());
      return;
    }

    if (path === "/api/timetable" && method === "GET") {
      res.status(200).json(await getTimetable());
      return;
    }

    if (path === "/api/clients" && method === "GET") {
      res.status(200).json(
        await sql(
          `SELECT id, name, phone, district, address, emergency_contact, notes, created_at
           FROM elderly_clients ORDER BY created_at DESC`,
        ),
      );
      return;
    }

    if (path === "/api/caregivers" && method === "GET") {
      const rows = await sql(
        `SELECT id, name, phone, district, skills, active, max_daily_jobs FROM caregivers ORDER BY name`,
      );
      res.status(200).json(rows.map((r) => ({ ...r, skills: asStringArray(r.skills) })));
      return;
    }

    if (path === "/api/services" && method === "GET") {
      const rows = await sql(`SELECT * FROM service_types ORDER BY name_zh`);
      res.status(200).json(rows.map((r) => ({ ...r, required_skills: asStringArray(r.required_skills) })));
      return;
    }

    if (path === "/api/bookings" && method === "GET") {
      const status = url.searchParams.get("status");
      const q = status
        ? await sql(
            `SELECT b.*, st.name_zh AS service_name, c.name AS client_name, c.district AS client_district,
                    cg.name AS caregiver_name, a.status AS assignment_status, a.score
             FROM bookings b
             JOIN service_types st ON st.id = b.service_type_id
             JOIN elderly_clients c ON c.id = b.client_id
             LEFT JOIN assignments a ON a.booking_id = b.id
             LEFT JOIN caregivers cg ON cg.id = a.caregiver_id
             WHERE b.status = $1
             ORDER BY b.requested_start DESC`,
            [status],
          )
        : await sql(
            `SELECT b.*, st.name_zh AS service_name, c.name AS client_name, c.district AS client_district,
                    cg.name AS caregiver_name, a.status AS assignment_status, a.score
             FROM bookings b
             JOIN service_types st ON st.id = b.service_type_id
             JOIN elderly_clients c ON c.id = b.client_id
             LEFT JOIN assignments a ON a.booking_id = b.id
             LEFT JOIN caregivers cg ON cg.id = a.caregiver_id
             ORDER BY b.requested_start DESC
             LIMIT 100`,
          );
      res.status(200).json(q);
      return;
    }

    const dispatchMatch = path.match(/^\/api\/bookings\/([^/]+)\/dispatch$/);
    if (dispatchMatch && method === "POST") {
      const bookingId = decodeURIComponent(dispatchMatch[1]);
      const candidates = await findCandidates(bookingId);
      const result = await autoAssign(bookingId);
      res.status(200).json({ ...result, candidates });
      return;
    }

    if (path === "/api/chat" && method === "POST") {
      const body = (await readJson(req)) as {
        externalId?: string;
        text?: string;
        displayName?: string;
        channel?: "web" | "whatsapp";
      };
      if (!body.externalId || !body.text) {
        res.status(400).json({ error: "externalId and text required" });
        return;
      }
      res.status(200).json(
        await handleChat({
          channel: body.channel ?? "web",
          externalId: body.externalId,
          text: body.text,
          displayName: body.displayName,
        }),
      );
      return;
    }

    if (path === "/api/seed" && method === "POST") {
      await seed(url.searchParams.get("force") === "1");
      res.status(200).json({ ok: true });
      return;
    }

    if (path === "/webhook/whatsapp" && method === "GET") {
      if (
        url.searchParams.get("hub.mode") === "subscribe" &&
        url.searchParams.get("hub.verify_token") === config.whatsappVerifyToken
      ) {
        res.status(200).send(url.searchParams.get("hub.challenge") ?? "");
        return;
      }
      res.status(403).send("Forbidden");
      return;
    }

    if (path === "/webhook/whatsapp" && method === "POST") {
      const payload = (await readJson(req)) as {
        entry?: {
          changes?: {
            value?: {
              messages?: { from: string; text?: { body?: string }; type?: string }[];
              contacts?: { profile?: { name?: string } }[];
            };
          }[];
        }[];
      };
      const change = payload.entry?.[0]?.changes?.[0]?.value;
      const message = change?.messages?.[0];
      if (message?.type === "text" && message.text?.body) {
        await handleChat({
          channel: "whatsapp",
          externalId: message.from,
          text: message.text.body,
          displayName: change?.contacts?.[0]?.profile?.name,
        });
      }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(404).json({ error: "Not found", path });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[silvercare vercel]", message, err instanceof Error ? err.stack : undefined);
    res.status(500).json({ error: "SilverCare API failed", message });
  }
}
