import { useEffect, useState } from "react";
import { api } from "../api";

export default function Caregivers() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    api.caregivers().then(setRows);
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>護理員班底</h1>
          <p>技能、服務區域與每日接單上限，供自動調度使用。</p>
        </div>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>姓名</th>
                <th>電話</th>
                <th>區域</th>
                <th>技能</th>
                <th>每日上限</th>
                <th>狀態</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.id)}>
                  <td>{String(row.name)}</td>
                  <td>{String(row.phone)}</td>
                  <td>{String(row.district)}</td>
                  <td>
                    {(Array.isArray(row.skills) ? row.skills : []).map((s) => (
                      <span key={String(s)} className="badge" style={{ marginRight: 4 }}>
                        {String(s)}
                      </span>
                    ))}
                  </td>
                  <td>{String(row.max_daily_jobs)}</td>
                  <td>
                    <span className={`badge ${row.active ? "in_progress" : "cancelled"}`}>
                      {row.active ? "在職" : "停用"}
                    </span>
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
