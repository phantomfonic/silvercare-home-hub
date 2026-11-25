import { sql, sqlOne } from "./db.js";

function num(v: unknown): number {
  return Number(v ?? 0);
}

/** 展覽用個案／服務分析（以現有 bookings 聚合） */
export async function getAnalytics() {
  const summary = await sqlOne<{
    total_bookings: string | number;
    completed: string | number;
    cancelled: string | number;
    active_clients: string | number;
    service_minutes: string | number;
  }>(
    `SELECT
      (SELECT COUNT(*) FROM bookings) AS total_bookings,
      (SELECT COUNT(*) FROM bookings WHERE status = 'completed') AS completed,
      (SELECT COUNT(*) FROM bookings WHERE status = 'cancelled') AS cancelled,
      (SELECT COUNT(DISTINCT client_id) FROM bookings) AS active_clients,
      (SELECT COALESCE(SUM(
         EXTRACT(EPOCH FROM (requested_end - requested_start)) / 60
       ), 0) FROM bookings WHERE status = 'completed') AS service_minutes`,
  );

  const byDistrict = await sql<{ district: string; cnt: string | number; hours: string | number }>(
    `SELECT c.district,
            COUNT(*)::int AS cnt,
            COALESCE(SUM(EXTRACT(EPOCH FROM (b.requested_end - b.requested_start)) / 3600), 0) AS hours
     FROM bookings b
     JOIN elderly_clients c ON c.id = b.client_id
     WHERE b.status NOT IN ('cancelled')
     GROUP BY c.district
     ORDER BY cnt DESC`,
  );

  const byService = await sql<{ name_zh: string; cnt: string | number; hours: string | number }>(
    `SELECT st.name_zh,
            COUNT(*)::int AS cnt,
            COALESCE(SUM(EXTRACT(EPOCH FROM (b.requested_end - b.requested_start)) / 3600), 0) AS hours
     FROM bookings b
     JOIN service_types st ON st.id = b.service_type_id
     WHERE b.status NOT IN ('cancelled')
     GROUP BY st.name_zh
     ORDER BY cnt DESC`,
  );

  const topClients = await sql<{
    name: string;
    district: string;
    visits: string | number;
    hours: string | number;
    last_visit: string | null;
  }>(
    `SELECT c.name, c.district,
            COUNT(*)::int AS visits,
            COALESCE(SUM(EXTRACT(EPOCH FROM (b.requested_end - b.requested_start)) / 3600), 0) AS hours,
            MAX(b.requested_start) AS last_visit
     FROM bookings b
     JOIN elderly_clients c ON c.id = b.client_id
     WHERE b.status = 'completed'
     GROUP BY c.id, c.name, c.district
     ORDER BY visits DESC
     LIMIT 8`,
  );

  const caregiverLoad = await sql<{
    name: string;
    district: string;
    completed_jobs: string | number;
    hours: string | number;
  }>(
    `SELECT cg.name, cg.district,
            COUNT(*)::int AS completed_jobs,
            COALESCE(SUM(EXTRACT(EPOCH FROM (b.requested_end - b.requested_start)) / 3600), 0) AS hours
     FROM assignments a
     JOIN caregivers cg ON cg.id = a.caregiver_id
     JOIN bookings b ON b.id = a.booking_id
     WHERE b.status = 'completed'
     GROUP BY cg.id, cg.name, cg.district
     ORDER BY completed_jobs DESC`,
  );

  const completed = num(summary?.completed);
  const total = num(summary?.total_bookings);
  const minutes = num(summary?.service_minutes);

  return {
    kpis: {
      totalBookings: total,
      completed,
      cancelled: num(summary?.cancelled),
      activeClients: num(summary?.active_clients),
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      serviceHours: Math.round((minutes / 60) * 10) / 10,
    },
    byDistrict: byDistrict.map((r) => ({
      district: r.district,
      count: num(r.cnt),
      hours: Math.round(num(r.hours) * 10) / 10,
    })),
    byService: byService.map((r) => ({
      name: r.name_zh,
      count: num(r.cnt),
      hours: Math.round(num(r.hours) * 10) / 10,
    })),
    topClients: topClients.map((r) => ({
      name: r.name,
      district: r.district,
      visits: num(r.visits),
      hours: Math.round(num(r.hours) * 10) / 10,
      lastVisit: r.last_visit,
    })),
    caregiverLoad: caregiverLoad.map((r) => ({
      name: r.name,
      district: r.district,
      completedJobs: num(r.completed_jobs),
      hours: Math.round(num(r.hours) * 10) / 10,
    })),
  };
}

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

function hkDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** 本週職員班表 + 已排服務（香港時間） */
export async function getTimetable() {
  const now = new Date();
  const hk = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Hong_Kong" }));
  const day = hk.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(hk);
  monday.setDate(hk.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dayNum = String(d.getDate()).padStart(2, "0");
    return {
      weekday: d.getDay(),
      label: `週${WEEKDAY_LABELS[d.getDay()]}`,
      dateLabel: `${m}/${dayNum}`,
      isoDate: `${y}-${m}-${dayNum}`,
    };
  });

  const weekStartIso = `${weekDays[0].isoDate}T00:00:00+08:00`;
  const weekEndIso = `${weekDays[6].isoDate}T23:59:59+08:00`;

  const caregivers = await sql<{
    id: string;
    name: string;
    district: string;
    skills: unknown;
  }>(`SELECT id, name, district, skills FROM caregivers WHERE active = TRUE ORDER BY name`);

  const availability = await sql<{
    caregiver_id: string;
    weekday: number;
    start_time: string;
    end_time: string;
  }>(`SELECT caregiver_id, weekday, start_time, end_time FROM availability`);

  const bookings = await sql<{
    id: string;
    caregiver_id: string | null;
    caregiver_name: string | null;
    client_name: string;
    service_name: string;
    status: string;
    requested_start: string;
    requested_end: string;
  }>(
    `SELECT b.id, a.caregiver_id, cg.name AS caregiver_name, c.name AS client_name,
            st.name_zh AS service_name, b.status, b.requested_start, b.requested_end
     FROM bookings b
     JOIN elderly_clients c ON c.id = b.client_id
     JOIN service_types st ON st.id = b.service_type_id
     LEFT JOIN assignments a ON a.booking_id = b.id
     LEFT JOIN caregivers cg ON cg.id = a.caregiver_id
     WHERE b.requested_start >= $1 AND b.requested_start <= $2
       AND b.status NOT IN ('cancelled')
     ORDER BY b.requested_start ASC`,
    [weekStartIso, weekEndIso],
  );

  function asSkills(value: unknown): string[] {
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

  const staff = caregivers.map((cg) => {
    const shifts = weekDays.map((wd) => {
      const windows = availability
        .filter((a) => a.caregiver_id === cg.id && Number(a.weekday) === wd.weekday)
        .map((a) => `${a.start_time}-${a.end_time}`);
      const jobs = bookings
        .filter((b) => b.caregiver_id === cg.id)
        .filter((b) => hkDateKey(b.requested_start) === wd.isoDate)
        .map((b) => ({
          id: b.id,
          time: new Date(b.requested_start).toLocaleTimeString("zh-HK", {
            timeZone: "Asia/Hong_Kong",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }),
          service: b.service_name,
          client: b.client_name,
          status: b.status,
        }));
      return {
        weekday: wd.weekday,
        dateLabel: wd.dateLabel,
        label: wd.label,
        windows,
        jobs,
      };
    });

    return {
      id: cg.id,
      name: cg.name,
      district: cg.district,
      skills: asSkills(cg.skills),
      shifts,
    };
  });

  const unassigned = bookings
    .filter((b) => !b.caregiver_id)
    .map((b) => ({
      id: b.id,
      service: b.service_name,
      client: b.client_name,
      status: b.status,
      start: b.requested_start,
    }));

  return {
    weekLabel: `${weekDays[0].dateLabel} – ${weekDays[6].dateLabel}`,
    days: weekDays,
    staff,
    unassigned,
  };
}
