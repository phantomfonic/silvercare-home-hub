import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { handleChat } from "./agent/handler.js";
import { getAnalytics, getTimetable } from "./analytics.js";
import { autoAssign, findCandidates } from "./dispatch.js";
import { config } from "./config.js";
import { sql, sqlOne } from "./db.js";
import { id } from "./ids.js";
import { seed } from "./seed.js";

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

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({
    ok: true,
    service: "silvercare-home-hub",
    channelMode: config.channelMode,
    centerName: config.centerName,
    llm: Boolean(config.openaiApiKey),
  }));

  app.get("/api/meta", async () => ({
    centerName: config.centerName,
    channelMode: config.channelMode,
    districtsHint: "香港十八區",
    demoPhones: {
      family: "61110001",
      caregiver: "91230001",
    },
  }));

  app.get("/api/dashboard", async () => {
    const counts = await sqlOne<{
      clients: string | number;
      caregivers: string | number;
      pending: string | number;
      active: string | number;
      completed: string | number;
    }>(
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

    return { counts, upcoming };
  });

  app.get("/api/analytics", async () => getAnalytics());

  app.get("/api/timetable", async () => getTimetable());

  app.get("/api/clients", async () => {
    return sql(
      `SELECT id, name, phone, district, address, emergency_contact, notes, created_at
       FROM elderly_clients ORDER BY created_at DESC`,
    );
  });

  app.get("/api/caregivers", async () => {
    const rows = await sql(
      `SELECT id, name, phone, district, skills, active, max_daily_jobs FROM caregivers ORDER BY name`,
    );
    return rows.map((r) => ({ ...r, skills: asStringArray(r.skills) }));
  });

  app.get("/api/services", async () => {
    const rows = await sql(`SELECT * FROM service_types ORDER BY name_zh`);
    return rows.map((r) => ({ ...r, required_skills: asStringArray(r.required_skills) }));
  });

  app.get("/api/bookings", async (req) => {
    const q = req.query as { status?: string };
    if (q.status) {
      return sql(
        `SELECT b.*, st.name_zh AS service_name, c.name AS client_name, c.district AS client_district,
                cg.name AS caregiver_name, a.status AS assignment_status, a.score
         FROM bookings b
         JOIN service_types st ON st.id = b.service_type_id
         JOIN elderly_clients c ON c.id = b.client_id
         LEFT JOIN assignments a ON a.booking_id = b.id
         LEFT JOIN caregivers cg ON cg.id = a.caregiver_id
         WHERE b.status = $1
         ORDER BY b.requested_start DESC`,
        [q.status],
      );
    }
    return sql(
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
  });

  app.post("/api/bookings/:id/dispatch", async (req) => {
    const { id: bookingId } = req.params as { id: string };
    const candidates = await findCandidates(bookingId);
    const result = await autoAssign(bookingId);
    return { ...result, candidates };
  });

  app.post("/api/bookings", async (req, reply) => {
    const body = z
      .object({
        clientId: z.string(),
        serviceTypeId: z.string(),
        requestedStart: z.string(),
        notes: z.string().optional(),
        autoDispatch: z.boolean().optional().default(true),
      })
      .parse(req.body);

    const client = await sqlOne<{ id: string; center_id: string }>(
      `SELECT id, center_id FROM elderly_clients WHERE id = $1`,
      [body.clientId],
    );
    if (!client) return reply.code(404).send({ error: "個案不存在" });

    const service = await sqlOne<{ id: string; duration_minutes: number }>(
      `SELECT id, duration_minutes FROM service_types WHERE id = $1`,
      [body.serviceTypeId],
    );
    if (!service) return reply.code(404).send({ error: "服務不存在" });

    const start = new Date(body.requestedStart);
    const end = new Date(start.getTime() + service.duration_minutes * 60 * 1000);
    const bookingId = id("bkg");
    await sql(
      `INSERT INTO bookings (id, center_id, client_id, service_type_id, requested_start, requested_end, status, notes, channel)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, 'web')`,
      [bookingId, client.center_id, client.id, service.id, start.toISOString(), end.toISOString(), body.notes ?? ""],
    );

    let dispatch = null;
    if (body.autoDispatch) {
      dispatch = await autoAssign(bookingId);
    }
    const booking = await sqlOne(`SELECT * FROM bookings WHERE id = $1`, [bookingId]);
    return { booking, dispatch };
  });

  app.post("/api/chat", async (req) => {
    const body = z
      .object({
        externalId: z.string().min(3),
        text: z.string().min(1),
        displayName: z.string().optional(),
        channel: z.enum(["web", "whatsapp"]).optional().default("web"),
      })
      .parse(req.body);
    return handleChat({
      channel: body.channel,
      externalId: body.externalId,
      text: body.text,
      displayName: body.displayName,
    });
  });

  app.get("/api/chat/sessions", async () => {
    return sql(
      `SELECT s.*, (
         SELECT body FROM chat_messages m WHERE m.session_id = s.id ORDER BY created_at DESC LIMIT 1
       ) AS last_message
       FROM chat_sessions s
       ORDER BY updated_at DESC
       LIMIT 50`,
    );
  });

  app.get("/api/chat/sessions/:id/messages", async (req) => {
    const { id: sessionId } = req.params as { id: string };
    return sql(
      `SELECT id, direction, body, created_at, meta_json
       FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId],
    );
  });

  app.post("/api/seed", async (req) => {
    const force = (req.query as { force?: string }).force === "1";
    await seed(force);
    return { ok: true };
  });

  // WhatsApp webhook verification
  app.get("/webhook/whatsapp", async (req, reply) => {
    const q = req.query as Record<string, string>;
    if (q["hub.mode"] === "subscribe" && q["hub.verify_token"] === config.whatsappVerifyToken) {
      return reply.send(q["hub.challenge"]);
    }
    return reply.code(403).send("Forbidden");
  });

  app.post("/webhook/whatsapp", async (req, reply) => {
    const payload = req.body as {
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
      const name = change?.contacts?.[0]?.profile?.name;
      await handleChat({
        channel: "whatsapp",
        externalId: message.from,
        text: message.text.body,
        displayName: name,
      });
    }
    return reply.send({ ok: true });
  });
}
