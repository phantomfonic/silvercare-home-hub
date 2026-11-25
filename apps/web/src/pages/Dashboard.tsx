import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

function statusLabel(status: unknown) {
  const map: Record<string, string> = {
    pending: "待指派",
    assigned: "已指派",
    accepted: "已接單",
    en_route: "前往中",
    in_progress: "服務中",
    completed: "已完成",
    cancelled: "已取消",
  };
  const s = String(status ?? "");
  return map[s] ?? s;
}

export default function Dashboard() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.dashboard>> | null>(null);
  const [meta, setMeta] = useState<Awaited<ReturnType<typeof api.meta>> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.dashboard(), api.meta()])
      .then(([d, m]) => {
        setData(d);
        setMeta(m);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <div className="empty">載入失敗：{error}</div>;
  if (!data) return <div className="empty">載入營運數據…</div>;

  const c = data.counts;
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>營運總覽</h1>
          <p>
            {meta?.centerName ?? "銀護示範院舍"} — 將院內護理能量調度至社區居家服務。
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link className="btn ghost" to="/ops/analytics">
            個案分析
          </Link>
          <Link className="btn ghost" to="/ops/timetable">
            班表時間表
          </Link>
          <Link className="btn" to="/demo">
            開啟現場演示
          </Link>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">居家個案</div>
          <div className="stat-value">{c.clients}</div>
        </div>
        <div className="stat">
          <div className="stat-label">外展護理員</div>
          <div className="stat-value">{c.caregivers}</div>
        </div>
        <div className="stat">
          <div className="stat-label">待指派</div>
          <div className="stat-value">{c.pending}</div>
        </div>
        <div className="stat">
          <div className="stat-label">進行中</div>
          <div className="stat-value">{c.active}</div>
        </div>
        <div className="stat">
          <div className="stat-label">已完成</div>
          <div className="stat-value">{c.completed}</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>
            <span className="live-dot" />
            今日／即將上門服務
          </h2>
          <Link className="btn ghost" to="/ops/dispatch">
            前往即時調度
          </Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>預約時間</th>
                <th>服務項目</th>
                <th>長者</th>
                <th>服務區</th>
                <th>護理員</th>
                <th>狀態</th>
              </tr>
            </thead>
            <tbody>
              {data.upcoming.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    暫無服務單 — 可在「現場演示」建立第一張預約
                  </td>
                </tr>
              )}
              {data.upcoming.map((row) => (
                <tr key={String(row.id)}>
                  <td>
                    {new Date(String(row.requested_start)).toLocaleString("zh-HK", {
                      timeZone: "Asia/Hong_Kong",
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td>{String(row.service_name)}</td>
                  <td>{String(row.client_name)}</td>
                  <td>{String(row.district)}</td>
                  <td>{row.caregiver_name ? String(row.caregiver_name) : "—"}</td>
                  <td>
                    <span className={`badge ${String(row.status)}`}>{statusLabel(row.status)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
