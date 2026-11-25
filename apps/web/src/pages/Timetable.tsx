import { useEffect, useState } from "react";
import { api, type TimetableData } from "../api";

const STATUS_ZH: Record<string, string> = {
  pending: "待指派",
  assigned: "已指派",
  accepted: "已接單",
  in_progress: "服務中",
  completed: "已完成",
};

export default function Timetable() {
  const [data, setData] = useState<TimetableData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .timetable()
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <div className="empty">載入失敗：{error}</div>;
  if (!data) return <div className="empty">載入班表…</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>職員與服務時間表</h1>
          <p>
            本週 {data.weekLabel}：班表窗口 + 已排上門單。展示院舍如何把院內人力派出社區。
          </p>
        </div>
      </div>

      {data.unassigned.length > 0 && (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <div className="panel-head">
            <h2>待指派空缺</h2>
            <span className="badge pending">{data.unassigned.length}</span>
          </div>
          <div className="panel-body chip-row">
            {data.unassigned.map((u) => (
              <span key={u.id} className="badge pending">
                {u.client} · {u.service} ·{" "}
                {new Date(u.start).toLocaleString("zh-HK", {
                  timeZone: "Asia/Hong_Kong",
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h2>外展人力週視圖</h2>
        </div>
        <div className="table-wrap">
          <table className="timetable">
            <thead>
              <tr>
                <th>護理員</th>
                {data.days.map((d) => (
                  <th key={d.isoDate}>
                    {d.label}
                    <div className="stat-label">{d.dateLabel}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.staff.map((cg) => (
                <tr key={cg.id}>
                  <td>
                    <strong>{cg.name}</strong>
                    <div className="stat-label">{cg.district}</div>
                    <div className="chip-row" style={{ marginTop: 6 }}>
                      {cg.skills.slice(0, 3).map((s) => (
                        <span key={s} className="badge">
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  {cg.shifts.map((shift) => (
                    <td key={`${cg.id}-${shift.weekday}-${shift.dateLabel}`} className="tt-cell">
                      {shift.windows.length > 0 ? (
                        <div className="tt-shift">{shift.windows.join(" / ")}</div>
                      ) : (
                        <div className="tt-off">休</div>
                      )}
                      {shift.jobs.map((job) => (
                        <div key={job.id} className={`tt-job ${job.status}`}>
                          <strong>
                            {job.time} {job.service}
                          </strong>
                          <span>
                            {job.client} · {STATUS_ZH[job.status] ?? job.status}
                          </span>
                        </div>
                      ))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
