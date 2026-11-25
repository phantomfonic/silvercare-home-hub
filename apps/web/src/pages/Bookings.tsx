import { useEffect, useState } from "react";
import { api } from "../api";

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
          <h1>服務單與調度</h1>
          <p>按技能、班表、區域鄰近度自動指派護理員。</p>
        </div>
        {msg && <span className="badge">{msg}</span>}
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>單號</th>
                <th>時間</th>
                <th>服務</th>
                <th>長者</th>
                <th>護理員</th>
                <th>狀態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.id)}>
                  <td>
                    <code>{String(row.id)}</code>
                  </td>
                  <td>
                    {new Date(String(row.requested_start)).toLocaleString("zh-HK", {
                      timeZone: "Asia/Hong_Kong",
                    })}
                  </td>
                  <td>{String(row.service_name)}</td>
                  <td>
                    {String(row.client_name)}
                    <div className="stat-label">{String(row.client_district)}</div>
                  </td>
                  <td>
                    {row.caregiver_name ? String(row.caregiver_name) : "—"}
                    {row.score != null && <div className="stat-label">分數 {String(row.score)}</div>}
                  </td>
                  <td>
                    <span className={`badge ${String(row.status)}`}>{String(row.status)}</span>
                  </td>
                  <td>
                    {(row.status === "pending" || row.status === "assigned") && (
                      <button
                        className="btn"
                        disabled={busy === String(row.id)}
                        onClick={() => dispatch(String(row.id))}
                      >
                        {busy === String(row.id) ? "調度中…" : "自動調度"}
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
