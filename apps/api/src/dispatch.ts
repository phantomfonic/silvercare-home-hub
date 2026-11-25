import { districtDistance } from "./districts.js";
import { id } from "./ids.js";
import { sql, sqlOne } from "./db.js";

export type BookingRow = {
  id: string;
  center_id: string;
  client_id: string;
  service_type_id: string;
  requested_start: string;
  requested_end: string;
  status: string;
  notes: string;
};

type Candidate = {
  caregiver_id: string;
  name: string;
  phone: string;
  district: string;
  skills: string[];
  score: number;
  reasons: string[];
};

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

function weekdayInHk(iso: string): number {
  // 以香港時區計算星期（0=日）
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Hong_Kong",
    weekday: "short",
  });
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[fmt.format(new Date(iso))] ?? new Date(iso).getUTCDay();
}

function hhmmInHk(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export async function findCandidates(bookingId: string): Promise<Candidate[]> {
  const booking = await sqlOne<BookingRow & { client_district: string; required_skills: unknown }>(
    `SELECT b.*, c.district AS client_district, st.required_skills
     FROM bookings b
     JOIN elderly_clients c ON c.id = b.client_id
     JOIN service_types st ON st.id = b.service_type_id
     WHERE b.id = $1`,
    [bookingId],
  );
  if (!booking) return [];

  const required = asStringArray(booking.required_skills);
  const wd = weekdayInHk(booking.requested_start);
  const startHm = hhmmInHk(booking.requested_start);
  const endHm = hhmmInHk(booking.requested_end);

  const caregivers = await sql<{
    id: string;
    name: string;
    phone: string;
    district: string;
    skills: unknown;
    max_daily_jobs: number;
  }>(
    `SELECT * FROM caregivers
     WHERE center_id = $1 AND active = TRUE`,
    [booking.center_id],
  );

  const candidates: Candidate[] = [];

  for (const cg of caregivers) {
    const skills = asStringArray(cg.skills);
    const reasons: string[] = [];
    let score = 100;

    const missing = required.filter((s) => !skills.includes(s));
    if (missing.length > 0) {
      continue;
    }
    reasons.push("技能符合");

    const avail = await sqlOne<{ id: string }>(
      `SELECT id FROM availability
       WHERE caregiver_id = $1 AND weekday = $2
         AND start_time <= $3 AND end_time >= $4
       LIMIT 1`,
      [cg.id, wd, startHm, endHm],
    );
    if (!avail) {
      continue;
    }
    reasons.push("班表有空");

    const overlap = await sqlOne<{ cnt: string | number }>(
      `SELECT COUNT(*)::int AS cnt
       FROM assignments a
       JOIN bookings b ON b.id = a.booking_id
       WHERE a.caregiver_id = $1
         AND a.status IN ('offered','accepted','in_progress')
         AND b.status NOT IN ('cancelled','completed')
         AND b.requested_start < $3
         AND b.requested_end > $2`,
      [cg.id, booking.requested_start, booking.requested_end],
    );
    if (Number(overlap?.cnt ?? 0) > 0) {
      continue;
    }

    const dayJobs = await sqlOne<{ cnt: string | number }>(
      `SELECT COUNT(*)::int AS cnt
       FROM assignments a
       JOIN bookings b ON b.id = a.booking_id
       WHERE a.caregiver_id = $1
         AND b.requested_start::date = $2::date
         AND b.status NOT IN ('cancelled')`,
      [cg.id, booking.requested_start],
    );
    const jobs = Number(dayJobs?.cnt ?? 0);
    if (jobs >= cg.max_daily_jobs) {
      continue;
    }

    const dist = districtDistance(cg.district, booking.client_district);
    score -= dist * 18;
    reasons.push(dist === 0 ? "同區" : dist === 1 ? "鄰區" : `距離${dist}`);

    score -= jobs * 6;
    reasons.push(`當日已接${jobs}單`);

    candidates.push({
      caregiver_id: cg.id,
      name: cg.name,
      phone: cg.phone,
      district: cg.district,
      skills,
      score,
      reasons,
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

export async function autoAssign(bookingId: string): Promise<{
  ok: boolean;
  message: string;
  assignment?: Record<string, unknown>;
  candidate?: Candidate;
}> {
  const booking = await sqlOne<BookingRow>("SELECT * FROM bookings WHERE id = $1", [bookingId]);
  if (!booking) return { ok: false, message: "找不到服務單" };
  if (!["pending", "assigned"].includes(booking.status)) {
    return { ok: false, message: `服務單狀態為 ${booking.status}，無法重新調度` };
  }

  const existing = await sqlOne("SELECT id FROM assignments WHERE booking_id = $1", [bookingId]);
  if (existing) {
    await sql("DELETE FROM assignments WHERE booking_id = $1", [bookingId]);
  }

  const candidates = await findCandidates(bookingId);
  const top = candidates[0];
  if (!top) {
    await sql(
      `UPDATE bookings SET status = 'pending', updated_at = NOW() WHERE id = $1`,
      [bookingId],
    );
    return { ok: false, message: "目前沒有符合技能／班表／區域的護理員" };
  }

  const assignmentId = id("asg");
  await sql(
    `INSERT INTO assignments (id, booking_id, caregiver_id, score, status)
     VALUES ($1, $2, $3, $4, 'offered')`,
    [assignmentId, bookingId, top.caregiver_id, top.score],
  );
  await sql(
    `UPDATE bookings SET status = 'assigned', updated_at = NOW() WHERE id = $1`,
    [bookingId],
  );
  await sql(
    `INSERT INTO audit_logs (id, actor, action, detail_json)
     VALUES ($1, 'dispatcher', 'auto_assign', $2)`,
    [
      id("aud"),
      JSON.stringify({
        bookingId,
        caregiverId: top.caregiver_id,
        score: top.score,
        reasons: top.reasons,
      }),
    ],
  );

  const assignment = await sqlOne("SELECT * FROM assignments WHERE id = $1", [assignmentId]);
  return {
    ok: true,
    message: `已指派給 ${top.name}（分數 ${top.score}）`,
    assignment: assignment ?? undefined,
    candidate: top,
  };
}
