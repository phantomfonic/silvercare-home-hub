import { useEffect, useState } from "react";
import { api, type AnalyticsData } from "../api";

function Bar({ value, max, label, sub }: { value: number; max: number; label: string; sub: string }) {
  const pct = max > 0 ? Math.max(6, Math.round((value / max) * 100)) : 0;
  return (
    <div className="bar-row">
      <div className="bar-meta">
        <strong>{label}</strong>
        <span>{sub}</span>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .analytics()
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <div className="empty">載入失敗：{error}</div>;
  if (!data) return <div className="empty">載入個案分析…</div>;

  const maxDistrict = Math.max(...data.byDistrict.map((d) => d.count), 1);
  const maxService = Math.max(...data.byService.map((d) => d.count), 1);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>個案與服務分析</h1>
          <p>給院長／督導：服務量、完成率、區域需求與個案活躍度——證明院舍外展「有數據可管」。</p>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">服務總單</div>
          <div className="stat-value">{data.kpis.totalBookings}</div>
        </div>
        <div className="stat">
          <div className="stat-label">完成率</div>
          <div className="stat-value">{data.kpis.completionRate}%</div>
        </div>
        <div className="stat">
          <div className="stat-label">服務時數</div>
          <div className="stat-value">{data.kpis.serviceHours}</div>
        </div>
        <div className="stat">
          <div className="stat-label">活躍個案</div>
          <div className="stat-value">{data.kpis.activeClients}</div>
        </div>
        <div className="stat">
          <div className="stat-label">已完成</div>
          <div className="stat-value">{data.kpis.completed}</div>
        </div>
      </div>

      <div className="analytics-grid">
        <div className="panel">
          <div className="panel-head">
            <h2>服務區域分布</h2>
          </div>
          <div className="panel-body">
            {data.byDistrict.map((d) => (
              <Bar
                key={d.district}
                label={d.district}
                value={d.count}
                max={maxDistrict}
                sub={`${d.count} 單 · ${d.hours} 小時`}
              />
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>服務項目需求</h2>
          </div>
          <div className="panel-body">
            {data.byService.map((d) => (
              <Bar
                key={d.name}
                label={d.name}
                value={d.count}
                max={maxService}
                sub={`${d.count} 單 · ${d.hours} 小時`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="analytics-grid" style={{ marginTop: "1rem" }}>
        <div className="panel">
          <div className="panel-head">
            <h2>高頻個案</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>長者</th>
                  <th>區域</th>
                  <th>完成次數</th>
                  <th>時數</th>
                  <th>最近服務</th>
                </tr>
              </thead>
              <tbody>
                {data.topClients.map((c) => (
                  <tr key={c.name}>
                    <td>{c.name}</td>
                    <td>{c.district}</td>
                    <td>{c.visits}</td>
                    <td>{c.hours}</td>
                    <td>
                      {c.lastVisit
                        ? new Date(c.lastVisit).toLocaleDateString("zh-HK", { timeZone: "Asia/Hong_Kong" })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>外展人力貢獻</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>護理員</th>
                  <th>主力區</th>
                  <th>完成單</th>
                  <th>時數</th>
                </tr>
              </thead>
              <tbody>
                {data.caregiverLoad.map((c) => (
                  <tr key={c.name}>
                    <td>{c.name}</td>
                    <td>{c.district}</td>
                    <td>{c.completedJobs}</td>
                    <td>{c.hours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
