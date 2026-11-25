const BASE = import.meta.env.VITE_API_BASE?.replace(/\/$/, "") ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export type AnalyticsData = {
  kpis: {
    totalBookings: number;
    completed: number;
    cancelled: number;
    activeClients: number;
    completionRate: number;
    serviceHours: number;
  };
  byDistrict: Array<{ district: string; count: number; hours: number }>;
  byService: Array<{ name: string; count: number; hours: number }>;
  topClients: Array<{
    name: string;
    district: string;
    visits: number;
    hours: number;
    lastVisit: string | null;
  }>;
  caregiverLoad: Array<{
    name: string;
    district: string;
    completedJobs: number;
    hours: number;
  }>;
};

export type TimetableData = {
  weekLabel: string;
  days: Array<{ weekday: number; label: string; dateLabel: string; isoDate: string }>;
  staff: Array<{
    id: string;
    name: string;
    district: string;
    skills: string[];
    shifts: Array<{
      weekday: number;
      dateLabel: string;
      label: string;
      windows: string[];
      jobs: Array<{
        id: string;
        time: string;
        service: string;
        client: string;
        status: string;
      }>;
    }>;
  }>;
  unassigned: Array<{
    id: string;
    service: string;
    client: string;
    status: string;
    start: string;
  }>;
};

export const api = {
  meta: () => request<{ centerName: string; demoPhones: { family: string; caregiver: string } }>("/api/meta"),
  dashboard: () =>
    request<{
      counts: Record<string, number | string>;
      upcoming: Array<Record<string, unknown>>;
    }>("/api/dashboard"),
  analytics: () => request<AnalyticsData>("/api/analytics"),
  timetable: () => request<TimetableData>("/api/timetable"),
  clients: () => request<Array<Record<string, unknown>>>("/api/clients"),
  caregivers: () => request<Array<Record<string, unknown>>>("/api/caregivers"),
  services: () => request<Array<Record<string, unknown>>>("/api/services"),
  bookings: (status?: string) =>
    request<Array<Record<string, unknown>>>(`/api/bookings${status ? `?status=${status}` : ""}`),
  dispatch: (id: string) =>
    request<{ ok: boolean; message: string; candidates?: unknown[] }>(`/api/bookings/${id}/dispatch`, {
      method: "POST",
      body: "{}",
    }),
  chat: (body: { externalId: string; text: string; displayName?: string }) =>
    request<{ reply: string; intent: string; bookingId?: string; sessionId: string }>("/api/chat", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
