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
          <h1>外展團隊</h1>
          <p>院舍護理員外派上門；技能與服務區域決定自動調度優先次序。</p>
        </div>
      </div>
      <div className="panel">
        <div className="panel-head">
          <h2>可派出人力</h2>
          <span className="badge">{rows.filter((r) => r.active).length} 人在崗</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>姓名</th>
                <th>WhatsApp</th>
                <th>主力區域</th>
                <th>技能標籤</th>
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
                  <td>{String(row.max_daily_jobs)} 單</td>
                  <td>
                    <span className={`badge ${row.active ? "in_progress" : "cancelled"}`}>
                      {row.active ? "可派出" : "停用"}
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
