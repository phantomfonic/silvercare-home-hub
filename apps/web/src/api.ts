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

export const api = {
  meta: () => request<{ centerName: string; demoPhones: { family: string; caregiver: string } }>("/api/meta"),
  dashboard: () =>
    request<{
      counts: Record<string, number | string>;
      upcoming: Array<Record<string, unknown>>;
    }>("/api/dashboard"),
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
