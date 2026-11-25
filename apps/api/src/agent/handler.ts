import { config } from "../config.js";
import { getAdapter } from "../channels/index.js";
import { autoAssign } from "../dispatch.js";
import { id } from "../ids.js";
import { sql, sqlOne } from "../db.js";
import { parseRuleIntent, parseWithLlm, type ParsedIntent } from "./intents.js";

export type ChatRequest = {
  channel: "web" | "whatsapp";
  externalId: string;
  text: string;
  displayName?: string;
};

export type ChatResult = {
  reply: string;
  sessionId: string;
  intent: string;
  bookingId?: string;
};

type SessionRow = {
  id: string;
  channel: string;
  external_id: string;
  role: string | null;
  ref_id: string | null;
  context_json: string;
};

async function resolveIdentity(
  channel: string,
  externalId: string,
): Promise<{ role: string; refId: string | null; name: string | null }> {
  const identity = await sqlOne<{ role: string; ref_id: string | null; display_name: string | null }>(
    `SELECT role, ref_id, display_name FROM channel_identities
     WHERE channel = $1 AND external_id = $2`,
    [channel, externalId],
  );
  if (identity) {
    return { role: identity.role, refId: identity.ref_id, name: identity.display_name };
  }

  const caregiver = await sqlOne<{ id: string; name: string }>(
    `SELECT id, name FROM caregivers WHERE phone = $1 OR phone = $2 LIMIT 1`,
    [externalId, normalizePhone(externalId)],
  );
  if (caregiver) {
    await upsertIdentity(channel, externalId, "caregiver", caregiver.id, caregiver.name);
    return { role: "caregiver", refId: caregiver.id, name: caregiver.name };
  }

  const client = await sqlOne<{ id: string; name: string }>(
    `SELECT id, name FROM elderly_clients WHERE phone = $1 OR phone = $2 LIMIT 1`,
    [externalId, normalizePhone(externalId)],
  );
  if (client) {
    await upsertIdentity(channel, externalId, "family", client.id, client.name);
    return { role: "family", refId: client.id, name: client.name };
  }

  return { role: "family", refId: null, name: null };
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("852") && digits.length > 8) return digits.slice(-8);
  return digits;
}

async function upsertIdentity(
  channel: string,
  externalId: string,
  role: string,
  refId: string,
  name: string,
): Promise<void> {
  await sql(
    `INSERT INTO channel_identities (id, channel, external_id, role, ref_id, display_name)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (channel, external_id)
     DO UPDATE SET role = EXCLUDED.role, ref_id = EXCLUDED.ref_id, display_name = EXCLUDED.display_name`,
    [id("cid"), channel, externalId, role, refId, name],
  );
}

async function getOrCreateSession(req: ChatRequest, role: string, refId: string | null): Promise<SessionRow> {
  const existing = await sqlOne<SessionRow>(
    `SELECT * FROM chat_sessions WHERE channel = $1 AND external_id = $2`,
    [req.channel, req.externalId],
  );
  if (existing) {
    await sql(
      `UPDATE chat_sessions SET role = $1, ref_id = $2, updated_at = NOW() WHERE id = $3`,
      [role, refId, existing.id],
    );
    return { ...existing, role, ref_id: refId };
  }
  const sessionId = id("ses");
  await sql(
    `INSERT INTO chat_sessions (id, channel, external_id, role, ref_id, context_json)
     VALUES ($1, $2, $3, $4, $5, '{}')`,
    [sessionId, req.channel, req.externalId, role, refId],
  );
  return {
    id: sessionId,
    channel: req.channel,
    external_id: req.externalId,
    role,
    ref_id: refId,
    context_json: "{}",
  };
}

function helpText(role: string | null): string {
  if (role === "caregiver") {
    return [
      `👋 你好，我是${config.centerName}調度助理。`,
      "護理員指令：",
      "• 回覆「接單」／「拒單」",
      "• 「到達」開始服務、「完成」結束服務",
      "• 「查詢」查看指派中的服務單",
    ].join("\n");
  }
  return [
    `👋 你好，我是${config.centerName} AI 助理。`,
    "你可以這樣說：",
    "• 「幫我預約明天上午10點家居清潔」",
    "• 「有什麼服務？」",
    "• 「查詢我的預約」",
    "• 「取消預約」／「改期」",
    "",
    "服務：家居清潔、洗澡、陪診護送、復康、買餸、送飯、陪伴看護",
  ].join("\n");
}

async function listServices(): Promise<string> {
  const rows = await sql<{ name_zh: string; duration_minutes: number; description: string }>(
    `SELECT name_zh, duration_minutes, description FROM service_types ORDER BY name_zh`,
  );
  return ["📋 服務項目：", ...rows.map((r) => `• ${r.name_zh}（約 ${r.duration_minutes} 分鐘）${r.description ? ` — ${r.description}` : ""}`)].join(
    "\n",
  );
}

function parseHongKongDateTime(dateHint?: string, timeHint?: string): { start: Date; end: Date } | null {
  const now = new Date();
  const hkNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Hong_Kong" }));
  const base = new Date(hkNow);

  if (!dateHint && !timeHint) {
    // 預設：下一個工作天 10:00
    base.setDate(base.getDate() + 1);
    if (base.getDay() === 0) base.setDate(base.getDate() + 1);
    base.setHours(10, 0, 0, 0);
  } else {
    if (dateHint) {
      if (/今天|今日/.test(dateHint)) {
        /* keep */
      } else if (/明天|聽日/.test(dateHint)) {
        base.setDate(base.getDate() + 1);
      } else if (/後日/.test(dateHint)) {
        base.setDate(base.getDate() + 2);
      } else {
        const m = dateHint.match(/(\d{1,2})[\/月](\d{1,2})/);
        if (m) {
          base.setMonth(Number(m[1]) - 1, Number(m[2]));
        }
      }
    } else {
      base.setDate(base.getDate() + 1);
    }

    let hour = 10;
    let minute = 0;
    if (timeHint) {
      const tm = timeHint.match(/(\d{1,2})/);
      if (tm) hour = Number(tm[1]);
      const mm = timeHint.match(/[:：](\d{2})/);
      if (mm) minute = Number(mm[1]);
      if (/下午|晚上|pm/i.test(timeHint) && hour < 12) hour += 12;
      if (/上午|早上|am/i.test(timeHint) && hour === 12) hour = 0;
      if (/點/.test(timeHint) && !timeHint.includes(":") && !timeHint.includes("：")) {
        // 「10點」
      }
    }
    base.setHours(hour, minute, 0, 0);
  }

  // 轉成真實 UTC：把 HK wall time 當本地再校正
  const asUtc = wallTimeHongKongToUtc(base);
  const end = new Date(asUtc.getTime() + 60 * 60 * 1000);
  return { start: asUtc, end };
}

function wallTimeHongKongToUtc(wall: Date): Date {
  const parts = {
    y: wall.getFullYear(),
    m: wall.getMonth(),
    d: wall.getDate(),
    h: wall.getHours(),
    min: wall.getMinutes(),
  };
  // 構造 ISO 並用 Hong Kong offset 估算（標準 +08，忽略 DST——香港無 DST）
  const iso = `${parts.y}-${String(parts.m + 1).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}T${String(parts.h).padStart(2, "0")}:${String(parts.min).padStart(2, "0")}:00+08:00`;
  return new Date(iso);
}

async function ensureClient(
  phone: string,
  displayName?: string,
): Promise<{ id: string; center_id: string; name: string }> {
  const existing = await sqlOne<{ id: string; center_id: string; name: string }>(
    `SELECT id, center_id, name FROM elderly_clients WHERE phone = $1 OR phone = $2 LIMIT 1`,
    [phone, normalizePhone(phone)],
  );
  if (existing) return existing;

  const center = await sqlOne<{ id: string }>(`SELECT id FROM centers ORDER BY created_at LIMIT 1`);
  if (!center) throw new Error("尚未初始化中心資料，請先執行 seed");

  const clientId = id("cli");
  const name = displayName || `市民${normalizePhone(phone).slice(-4) || "新戶"}`;
  await sql(
    `INSERT INTO elderly_clients (id, center_id, name, phone, district, address, notes)
     VALUES ($1, $2, $3, $4, '觀塘', '待補地址', '經聊天渠道自動建立')`,
    [clientId, center.id, name, normalizePhone(phone) || phone],
  );
  return { id: clientId, center_id: center.id, name };
}

async function bookService(
  session: SessionRow,
  intent: ParsedIntent,
  displayName?: string,
): Promise<{ reply: string; bookingId?: string }> {
  const client = session.ref_id
    ? await sqlOne<{ id: string; center_id: string; name: string }>(
        `SELECT id, center_id, name FROM elderly_clients WHERE id = $1`,
        [session.ref_id],
      )
    : await ensureClient(session.external_id, displayName);

  if (!client) return { reply: "找不到個案資料，請聯絡中心職員。" };

  await upsertIdentity(session.channel, session.external_id, "family", client.id, client.name);

  const serviceCode = intent.slots.service ?? "cleaning";
  const service = await sqlOne<{ id: string; name_zh: string; duration_minutes: number }>(
    `SELECT id, name_zh, duration_minutes FROM service_types WHERE code = $1`,
    [serviceCode],
  );
  if (!service) return { reply: "暫時未能識別服務類型，請先問「有什麼服務？」" };

  if (!intent.slots.dateHint && !intent.slots.timeHint) {
    return {
      reply: `好的，想預約「${service.name_zh}」。請告訴我日期同時間，例如：「明天上午10點」。`,
    };
  }

  const when = parseHongKongDateTime(intent.slots.dateHint, intent.slots.timeHint);
  if (!when) return { reply: "未能理解時間，請用「明天上午10點」格式再試。" };

  const end = new Date(when.start.getTime() + service.duration_minutes * 60 * 1000);
  const bookingId = id("bkg");
  await sql(
    `INSERT INTO bookings (id, center_id, client_id, service_type_id, requested_start, requested_end, status, notes, channel)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8)`,
    [
      bookingId,
      client.center_id,
      client.id,
      service.id,
      when.start.toISOString(),
      end.toISOString(),
      intent.slots.service ? "" : "預設服務",
      session.channel,
    ],
  );

  const assigned = await autoAssign(bookingId);
  const startLabel = when.start.toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong" });

  if (assigned.ok && assigned.candidate) {
    const adapter = getAdapter(session.channel);
    await adapter.send({
      to: assigned.candidate.phone,
      body: [
        `🛎️ 新服務指派`,
        `服務：${service.name_zh}`,
        `時間：${startLabel}`,
        `長者：${client.name}`,
        `回覆「接單」或「拒單」`,
      ].join("\n"),
    });

    return {
      reply: [
        `✅ 已為你預約「${service.name_zh}」`,
        `時間：${startLabel}（香港時間）`,
        `狀態：已自動指派護理員 ${assigned.candidate.name}`,
        `單號：${bookingId}`,
        `可用「查詢我的預約」查看進度。`,
      ].join("\n"),
      bookingId,
    };
  }

  return {
    reply: [
      `📝 已收到「${service.name_zh}」預約`,
      `時間：${startLabel}（香港時間）`,
      `單號：${bookingId}`,
      `暫時未能自動指派護理員：${assigned.message}`,
      `中心職員會儘快人手安排。`,
    ].join("\n"),
    bookingId,
  };
}

async function queryStatus(session: SessionRow): Promise<string> {
  if (session.role === "caregiver" && session.ref_id) {
    const rows = await sql<{
      id: string;
      status: string;
      requested_start: string;
      name_zh: string;
      client_name: string;
      asg_status: string;
    }>(
      `SELECT b.id, b.status, b.requested_start, st.name_zh, c.name AS client_name, a.status AS asg_status
       FROM assignments a
       JOIN bookings b ON b.id = a.booking_id
       JOIN service_types st ON st.id = b.service_type_id
       JOIN elderly_clients c ON c.id = b.client_id
       WHERE a.caregiver_id = $1 AND b.status NOT IN ('completed','cancelled')
       ORDER BY b.requested_start ASC LIMIT 5`,
      [session.ref_id],
    );
    if (rows.length === 0) return "目前沒有進行中的指派。";
    return [
      "🗂️ 你的服務單：",
      ...rows.map(
        (r) =>
          `• ${r.name_zh}｜${new Date(r.requested_start).toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong" })}｜${r.client_name}｜指派:${r.asg_status}／單:${r.status}（${r.id}）`,
      ),
    ].join("\n");
  }

  if (!session.ref_id) return "尚未綁定個案。請先預約一次，或請中心登記電話。";

  const rows = await sql<{
    id: string;
    status: string;
    requested_start: string;
    name_zh: string;
    caregiver_name: string | null;
  }>(
    `SELECT b.id, b.status, b.requested_start, st.name_zh, cg.name AS caregiver_name
     FROM bookings b
     JOIN service_types st ON st.id = b.service_type_id
     LEFT JOIN assignments a ON a.booking_id = b.id
     LEFT JOIN caregivers cg ON cg.id = a.caregiver_id
     WHERE b.client_id = $1 AND b.status NOT IN ('cancelled')
     ORDER BY b.requested_start DESC LIMIT 5`,
    [session.ref_id],
  );
  if (rows.length === 0) return "暫時未有預約紀錄。";
  return [
    "📌 你的預約：",
    ...rows.map(
      (r) =>
        `• ${r.name_zh}｜${new Date(r.requested_start).toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong" })}｜${r.status}${r.caregiver_name ? `｜護理員 ${r.caregiver_name}` : ""}（${r.id}）`,
    ),
  ].join("\n");
}

async function updateLatestBooking(
  session: SessionRow,
  nextStatus: string,
  note: string,
): Promise<string> {
  if (!session.ref_id) return "尚未綁定個案。";
  const booking = await sqlOne<{ id: string; status: string }>(
    `SELECT id, status FROM bookings
     WHERE client_id = $1 AND status NOT IN ('completed','cancelled')
     ORDER BY requested_start DESC LIMIT 1`,
    [session.ref_id],
  );
  if (!booking) return "找不到可更新的預約。";
  await sql(`UPDATE bookings SET status = $1, updated_at = NOW(), notes = COALESCE(notes,'') || $2 WHERE id = $3`, [
    nextStatus,
    `\n${note}`,
    booking.id,
  ]);
  return `已更新服務單 ${booking.id} → ${nextStatus}`;
}

async function caregiverAction(session: SessionRow, intent: ParsedIntent): Promise<string> {
  if (!session.ref_id) return "未能識別護理員身份，請確認登記電話。";

  const row = await sqlOne<{
    assignment_id: string;
    booking_id: string;
    asg_status: string;
    booking_status: string;
    name_zh: string;
  }>(
    `SELECT a.id AS assignment_id, a.booking_id, a.status AS asg_status, b.status AS booking_status, st.name_zh
     FROM assignments a
     JOIN bookings b ON b.id = a.booking_id
     JOIN service_types st ON st.id = b.service_type_id
     WHERE a.caregiver_id = $1 AND a.status IN ('offered','accepted','in_progress')
     ORDER BY a.offered_at DESC LIMIT 1`,
    [session.ref_id],
  );
  if (!row) return "目前沒有待處理的服務單。";

  if (intent.intent === "accept_job") {
    await sql(`UPDATE assignments SET status = 'accepted', responded_at = NOW() WHERE id = $1`, [
      row.assignment_id,
    ]);
    await sql(`UPDATE bookings SET status = 'accepted', updated_at = NOW() WHERE id = $1`, [row.booking_id]);
    return `已接單：${row.name_zh}（${row.booking_id}）。到達時請回覆「到達」。`;
  }
  if (intent.intent === "decline_job") {
    await sql(`UPDATE assignments SET status = 'declined', responded_at = NOW() WHERE id = $1`, [
      row.assignment_id,
    ]);
    await sql(`UPDATE bookings SET status = 'pending', updated_at = NOW() WHERE id = $1`, [row.booking_id]);
    await sql(`DELETE FROM assignments WHERE id = $1`, [row.assignment_id]);
    const again = await autoAssign(row.booking_id);
    return `已拒單。系統${again.ok ? `已改派給 ${again.candidate?.name}` : `未能改派：${again.message}`}`;
  }
  if (intent.intent === "check_in") {
    await sql(`UPDATE assignments SET status = 'in_progress', check_in_at = NOW() WHERE id = $1`, [
      row.assignment_id,
    ]);
    await sql(`UPDATE bookings SET status = 'in_progress', updated_at = NOW() WHERE id = $1`, [row.booking_id]);
    return `已記錄到達，開始「${row.name_zh}」。完成後回覆「完成」。`;
  }
  if (intent.intent === "check_out" || intent.intent === "complete_service") {
    await sql(
      `UPDATE assignments SET status = 'completed', check_out_at = NOW() WHERE id = $1`,
      [row.assignment_id],
    );
    await sql(`UPDATE bookings SET status = 'completed', updated_at = NOW() WHERE id = $1`, [row.booking_id]);
    return `已完成「${row.name_zh}」，多謝！服務單 ${row.booking_id} 已關閉。`;
  }
  return "未能處理此指令。";
}

export async function handleChat(req: ChatRequest): Promise<ChatResult> {
  const identity = await resolveIdentity(req.channel, req.externalId);
  const session = await getOrCreateSession(req, identity.role, identity.refId);

  await sql(
    `INSERT INTO chat_messages (id, session_id, direction, body, meta_json)
     VALUES ($1, $2, 'inbound', $3, $4)`,
    [id("msg"), session.id, req.text, JSON.stringify({ displayName: req.displayName })],
  );

  let parsed = parseRuleIntent(req.text, session.role);
  if (config.openaiApiKey) {
    const llm = await parseWithLlm(
      req.text,
      session.role,
      config.openaiApiKey,
      config.openaiBaseUrl,
      config.openaiModel,
    );
    if (llm && llm.confidence >= parsed.confidence) parsed = llm;
  }

  let reply: string;
  let bookingId: string | undefined;

  switch (parsed.intent) {
    case "help":
      reply = helpText(session.role);
      break;
    case "list_services":
      reply = await listServices();
      break;
    case "book_service": {
      const result = await bookService(session, parsed, req.displayName ?? identity.name ?? undefined);
      reply = result.reply;
      bookingId = result.bookingId;
      break;
    }
    case "query_status":
      reply = await queryStatus(session);
      break;
    case "cancel":
      reply = await updateLatestBooking(session, "cancelled", "用戶要求取消");
      break;
    case "reschedule":
      reply =
        "改期：請直接說新時間，例如「改去後天下午3點家居清潔」。或先取消再重新預約。";
      break;
    case "accept_job":
    case "decline_job":
    case "check_in":
    case "check_out":
    case "complete_service":
      reply = await caregiverAction(session, parsed);
      break;
    default:
      reply = `${helpText(session.role)}\n\n（未能確定意圖，已顯示說明）`;
  }

  await sql(
    `INSERT INTO chat_messages (id, session_id, direction, body, meta_json)
     VALUES ($1, $2, 'outbound', $3, $4)`,
    [id("msg"), session.id, reply, JSON.stringify({ intent: parsed.intent })],
  );

  const adapter = getAdapter(req.channel);
  if (req.channel === "whatsapp") {
    await adapter.send({ to: req.externalId, body: reply });
  }

  return { reply, sessionId: session.id, intent: parsed.intent, bookingId };
}
