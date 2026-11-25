import { useEffect, useState } from "react";
import { api } from "../api";

function statusBadge(status: unknown) {
  const s = String(status ?? "");
  return <span className={`badge ${s}`}>{s || "—"}</span>;
}

export default function Dashboard() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.dashboard>> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .dashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <div className="empty">載入失敗：{error}</div>;
  if (!data) return <div className="empty">載入中…</div>;

  const c = data.counts;
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>今日調度總覽</h1>
          <p>香港上門居家服務：預約、自動指派、到離回報一覽。</p>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">個案</div>
          <div className="stat-value">{c.clients}</div>
        </div>
        <div className="stat">
          <div className="stat-label">護理員</div>
          <div className="stat-value">{c.caregivers}</div>
        </div>
        <div className="stat">
          <div className="stat-label">待調度</div>
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
          <h2>即將到來的服務單</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>時間</th>
                <th>服務</th>
                <th>長者</th>
                <th>區域</th>
                <th>護理員</th>
                <th>狀態</th>
              </tr>
            </thead>
            <tbody>
              {data.upcoming.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    暫無服務單
                  </td>
                </tr>
              )}
              {data.upcoming.map((row) => (
                <tr key={String(row.id)}>
                  <td>
                    {new Date(String(row.requested_start)).toLocaleString("zh-HK", {
                      timeZone: "Asia/Hong_Kong",
                    })}
                  </td>
                  <td>{String(row.service_name)}</td>
                  <td>{String(row.client_name)}</td>
                  <td>{String(row.district)}</td>
                  <td>{row.caregiver_name ? String(row.caregiver_name) : "—"}</td>
                  <td>{statusBadge(row.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
