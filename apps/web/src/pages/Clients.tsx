import { useEffect, useState } from "react";
import { api } from "../api";

export default function Clients() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    api.clients().then(setRows);
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>居家個案</h1>
          <p>由院舍建立或經 WhatsApp 首次預約自動建檔；電話即為渠道身份。</p>
        </div>
      </div>
      <div className="panel">
        <div className="panel-head">
          <h2>個案名冊</h2>
          <span className="badge">{rows.length} 位</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>姓名</th>
                <th>聯絡電話</th>
                <th>服務區</th>
                <th>住址</th>
                <th>緊急聯絡</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.id)}>
                  <td>{String(row.name)}</td>
                  <td>{String(row.phone)}</td>
                  <td>{String(row.district)}</td>
                  <td>{String(row.address)}</td>
                  <td>{String(row.emergency_contact ?? "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
