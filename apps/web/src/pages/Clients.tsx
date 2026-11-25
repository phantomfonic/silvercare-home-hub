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
          <h1>個案名冊</h1>
          <p>長者／家屬聯絡資料與服務區域。</p>
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
                <th>地址</th>
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
