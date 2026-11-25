import { ensureDb, sql, sqlOne } from "./db.js";
import { id } from "./ids.js";
import { config } from "./config.js";

export async function seed(force = false): Promise<void> {
  await ensureDb();
  const existing = await sqlOne("SELECT id FROM centers LIMIT 1");
  if (existing && !force) {
    console.log("已有資料，略過 seed（設 SEED_FORCE=true 可重播示範資料）");
    return;
  }

  if (force && existing) {
    await sql("DELETE FROM chat_messages");
    await sql("DELETE FROM chat_sessions");
    await sql("DELETE FROM audit_logs");
    await sql("DELETE FROM assignments");
    await sql("DELETE FROM bookings");
    await sql("DELETE FROM availability");
    await sql("DELETE FROM channel_identities");
    await sql("DELETE FROM caregivers");
    await sql("DELETE FROM elderly_clients");
    await sql("DELETE FROM service_types");
    await sql("DELETE FROM centers");
  }

  const centerId = id("ctr");
  await sql(
    `INSERT INTO centers (id, name, district, phone, address)
     VALUES ($1, $2, '觀塘', '21234567', '九龍觀塘成業街銀護示範院舍 3 樓（院舍＋社區外展）')`,
    [centerId, config.centerName],
  );

  const services: Array<[string, string, string, number, string[]]> = [
    ["cleaning", "家居清潔", "協助清潔家居環境", 90, ["清潔"]],
    ["bathing", "洗澡協助", "協助長者安全沐浴", 60, ["個人護理"]],
    ["escort", "陪診護送", "陪同覆診及往返醫院", 120, ["護送"]],
    ["rehab", "復康運動", "基本伸展與步行訓練", 60, ["復康"]],
    ["errand", "買餸購物", "代購日常用品", 60, ["生活支援"]],
    ["meal", "送飯服務", "送遞營養餐", 30, ["生活支援"]],
    ["companionship", "陪伴看護", "傾偈陪伴與看顧", 90, ["看護"]],
  ];

  const serviceIds: Record<string, string> = {};
  for (const [code, name, desc, mins, skills] of services) {
    const sid = id("svc");
    serviceIds[code] = sid;
    await sql(
      `INSERT INTO service_types (id, code, name_zh, duration_minutes, required_skills, description)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [sid, code, name, mins, skills, desc],
    );
  }

  const caregivers = [
    { name: "陳護理員", phone: "91230001", district: "觀塘", skills: ["清潔", "個人護理", "生活支援"] },
    { name: "李護理員", phone: "91230002", district: "黃大仙", skills: ["護送", "看護", "個人護理"] },
    { name: "王護理員", phone: "91230003", district: "九龍城", skills: ["復康", "看護", "清潔"] },
    { name: "張護理員", phone: "91230004", district: "沙田", skills: ["清潔", "生活支援", "護送"] },
  ];

  const caregiverIds: string[] = [];
  for (const cg of caregivers) {
    const cid = id("cg");
    caregiverIds.push(cid);
    await sql(
      `INSERT INTO caregivers (id, center_id, name, phone, district, skills, active, max_daily_jobs)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, 6)`,
      [cid, centerId, cg.name, cg.phone, cg.district, cg.skills],
    );
    for (let wd = 1; wd <= 6; wd++) {
      await sql(
        `INSERT INTO availability (id, caregiver_id, weekday, start_time, end_time)
         VALUES ($1, $2, $3, '09:00', '18:00')`,
        [id("av"), cid, wd],
      );
    }
    await sql(
      `INSERT INTO channel_identities (id, channel, external_id, role, ref_id, display_name)
       VALUES ($1, 'web', $2, 'caregiver', $3, $4)`,
      [id("cid"), cg.phone, cid, cg.name],
    );
  }

  const clients = [
    {
      name: "黃婆婆",
      phone: "61110001",
      district: "觀塘",
      address: "觀塘翠屏邨示範座 12 樓",
      emergency: "兒子 90001111",
      notes: "輕度行動不便；偏好上午時段",
    },
    {
      name: "劉伯",
      phone: "61110002",
      district: "黃大仙",
      address: "黃大仙下邨示範樓 5 樓",
      emergency: "女兒 90002222",
      notes: "定期覆診；需陪診護送",
    },
    {
      name: "周太太",
      phone: "61110003",
      district: "九龍城",
      address: "土瓜灣馬頭圍道示範大廈",
      emergency: "孫女 90003333",
      notes: "復康跟進中",
    },
    {
      name: "何婆婆",
      phone: "61110004",
      district: "觀塘",
      address: "藍田興田邨示範座",
      emergency: "兒子 90004444",
      notes: "送飯＋清潔組合",
    },
    {
      name: "馬伯",
      phone: "61110005",
      district: "沙田",
      address: "沙田瀝源邨示範樓",
      emergency: "女兒 90005555",
      notes: "認知障礙初期；需陪伴看護",
    },
  ];

  const clientIds: Record<string, string> = {};
  for (const c of clients) {
    const cid = id("cli");
    clientIds[c.phone] = cid;
    await sql(
      `INSERT INTO elderly_clients (id, center_id, name, phone, district, address, notes, emergency_contact)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [cid, centerId, c.name, c.phone, c.district, c.address, c.notes, c.emergency],
    );
    await sql(
      `INSERT INTO channel_identities (id, channel, external_id, role, ref_id, display_name)
       VALUES ($1, 'web', $2, 'family', $3, $4)`,
      [id("cid"), c.phone, cid, c.name],
    );
  }

  // 歷史已完成單（撐分析 Dashboard）
  const history: Array<{
    phone: string;
    service: string;
    caregiverIdx: number;
    daysAgo: number;
    hour: number;
  }> = [
    { phone: "61110001", service: "cleaning", caregiverIdx: 0, daysAgo: 12, hour: 10 },
    { phone: "61110001", service: "bathing", caregiverIdx: 0, daysAgo: 9, hour: 11 },
    { phone: "61110001", service: "cleaning", caregiverIdx: 0, daysAgo: 5, hour: 10 },
    { phone: "61110002", service: "escort", caregiverIdx: 1, daysAgo: 14, hour: 9 },
    { phone: "61110002", service: "escort", caregiverIdx: 1, daysAgo: 7, hour: 9 },
    { phone: "61110002", service: "companionship", caregiverIdx: 1, daysAgo: 3, hour: 15 },
    { phone: "61110003", service: "rehab", caregiverIdx: 2, daysAgo: 10, hour: 14 },
    { phone: "61110003", service: "rehab", caregiverIdx: 2, daysAgo: 6, hour: 14 },
    { phone: "61110003", service: "cleaning", caregiverIdx: 2, daysAgo: 2, hour: 10 },
    { phone: "61110004", service: "meal", caregiverIdx: 0, daysAgo: 8, hour: 12 },
    { phone: "61110004", service: "meal", caregiverIdx: 0, daysAgo: 4, hour: 12 },
    { phone: "61110004", service: "errand", caregiverIdx: 0, daysAgo: 1, hour: 16 },
    { phone: "61110005", service: "companionship", caregiverIdx: 3, daysAgo: 11, hour: 10 },
    { phone: "61110005", service: "companionship", caregiverIdx: 3, daysAgo: 4, hour: 10 },
  ];

  for (const h of history) {
    const start = atDaysAgo(h.daysAgo, h.hour, 0);
    const duration = services.find((s) => s[0] === h.service)?.[3] ?? 60;
    const end = new Date(start.getTime() + duration * 60 * 1000);
    const bookingId = id("bkg");
    const asgId = id("asg");
    await sql(
      `INSERT INTO bookings (id, center_id, client_id, service_type_id, requested_start, requested_end, status, notes, channel)
       VALUES ($1, $2, $3, $4, $5, $6, 'completed', '歷史服務（展覽分析）', 'web')`,
      [
        bookingId,
        centerId,
        clientIds[h.phone],
        serviceIds[h.service],
        start.toISOString(),
        end.toISOString(),
      ],
    );
    await sql(
      `INSERT INTO assignments (id, booking_id, caregiver_id, score, status, check_in_at, check_out_at)
       VALUES ($1, $2, $3, 80, 'completed', $4, $5)`,
      [asgId, bookingId, caregiverIds[h.caregiverIdx], start.toISOString(), end.toISOString()],
    );
  }

  // 本週即將／進行中：時間表用
  const upcoming: Array<{
    phone: string;
    service: string;
    caregiverIdx: number | null;
    dayOffset: number;
    hour: number;
    status: string;
  }> = [
    { phone: "61110001", service: "cleaning", caregiverIdx: null, dayOffset: 1, hour: 10, status: "pending" },
    { phone: "61110002", service: "escort", caregiverIdx: 1, dayOffset: 1, hour: 9, status: "accepted" },
    { phone: "61110003", service: "rehab", caregiverIdx: 2, dayOffset: 2, hour: 14, status: "assigned" },
    { phone: "61110004", service: "meal", caregiverIdx: 0, dayOffset: 2, hour: 12, status: "accepted" },
    { phone: "61110005", service: "companionship", caregiverIdx: 3, dayOffset: 3, hour: 10, status: "assigned" },
    { phone: "61110001", service: "bathing", caregiverIdx: 0, dayOffset: 4, hour: 11, status: "assigned" },
  ];

  for (const u of upcoming) {
    const start = atDayOffset(u.dayOffset, u.hour, 0);
    const duration = services.find((s) => s[0] === u.service)?.[3] ?? 60;
    const end = new Date(start.getTime() + duration * 60 * 1000);
    const bookingId = id("bkg");
    await sql(
      `INSERT INTO bookings (id, center_id, client_id, service_type_id, requested_start, requested_end, status, notes, channel)
       VALUES ($1, $2, $3, $4, $5, $6, $7, '本週排程（展覽時間表）', 'web')`,
      [
        bookingId,
        centerId,
        clientIds[u.phone],
        serviceIds[u.service],
        start.toISOString(),
        end.toISOString(),
        u.status,
      ],
    );
    if (u.caregiverIdx != null) {
      await sql(
        `INSERT INTO assignments (id, booking_id, caregiver_id, score, status)
         VALUES ($1, $2, $3, 85, $4)`,
        [
          id("asg"),
          bookingId,
          caregiverIds[u.caregiverIdx],
          u.status === "accepted" ? "accepted" : "offered",
        ],
      );
    }
  }

  console.log("Seed 完成：", config.centerName);
  console.log("家屬示範電話：61110001（黃婆婆）");
  console.log("護理員示範電話：91230001（陳護理員）");
}

function atDaysAgo(daysAgo: number, hour: number, minute: number): Date {
  const now = new Date();
  const d = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Hong_Kong" }));
  d.setDate(d.getDate() - daysAgo);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`;
  return new Date(iso);
}

function atDayOffset(offset: number, hour: number, minute: number): Date {
  const now = new Date();
  const d = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Hong_Kong" }));
  d.setDate(d.getDate() + offset);
  // 避開週日，往後挪一天
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`;
  return new Date(iso);
}

const isMain = process.argv[1]?.includes("seed");
if (isMain) {
  seed(process.env.SEED_FORCE === "true")
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
