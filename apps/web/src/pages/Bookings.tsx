import { useEffect, useState } from "react";
import { api } from "../api";

const STATUS_ZH: Record<string, string> = {
  pending: "待指派",
  assigned: "已指派",
  accepted: "已接單",
  en_route: "前往中",
  in_progress: "服務中",
  completed: "已完成",
  cancelled: "已取消",
};

export default function Bookings() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  async function load() {
    setRows(await api.bookings());
  }

  useEffect(() => {
    load().catch((e: Error) => setMsg(e.message));
  }, []);

  async function dispatch(id: string) {
    setBusy(id);
    setMsg("");
    try {
      const result = await api.dispatch(id);
      setMsg(result.message);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>即時調度</h1>
          <p>按技能、班表、區域鄰近度與當日負荷自動指派；督導可一鍵重跑匹配。</p>
        </div>
        {msg && <span className="badge assigned">{msg}</span>}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>服務單隊列</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>服務單</th>
                <th>時間</th>
                <th>項目</th>
                <th>個案／區域</th>
                <th>指派</th>
                <th>狀態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.id)}>
                  <td>
                    <code style={{ fontSize: "0.78rem" }}>{String(row.id)}</code>
                  </td>
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
                  <td>
                    {String(row.client_name)}
                    <div className="stat-label">{String(row.client_district)}</div>
                  </td>
                  <td>
                    {row.caregiver_name ? String(row.caregiver_name) : "未指派"}
                    {row.score != null && <div className="stat-label">匹配分 {String(row.score)}</div>}
                  </td>
                  <td>
                    <span className={`badge ${String(row.status)}`}>
                      {STATUS_ZH[String(row.status)] ?? String(row.status)}
                    </span>
                  </td>
                  <td>
                    {(row.status === "pending" || row.status === "assigned") && (
                      <button
                        className="btn"
                        disabled={busy === String(row.id)}
                        onClick={() => dispatch(String(row.id))}
                      >
                        {busy === String(row.id) ? "匹配中…" : "自動調度"}
                      </button>
                    )}
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
