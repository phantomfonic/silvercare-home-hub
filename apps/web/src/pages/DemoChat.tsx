import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api";

type Msg = { role: "user" | "bot"; body: string };

const QUICK = [
  "有什麼服務？",
  "幫我預約明天上午10點家居清潔",
  "查詢我的預約",
  "接單",
  "到達",
  "完成",
];

export default function DemoChat() {
  const [meta, setMeta] = useState<Awaited<ReturnType<typeof api.meta>> | null>(null);
  const [role, setRole] = useState<"family" | "caregiver">("family");
  const [phone, setPhone] = useState("61110001");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "bot",
      body: "這是 Channel Adapter 的 Web Chat 演示。正式環境可切換 WhatsApp Cloud API，對話邏輯相同。",
    },
  ]);

  useEffect(() => {
    api.meta().then((m) => {
      setMeta(m);
      setPhone(m.demoPhones.family);
    });
  }, []);

  const roleHint = useMemo(() => {
    if (role === "caregiver") {
      return `護理員示範電話：${meta?.demoPhones.caregiver ?? "91230001"}。可試「接單」「到達」「完成」。`;
    }
    return `家屬示範電話：${meta?.demoPhones.family ?? "61110001"}。可試預約家居清潔／陪診。`;
  }, [role, meta]);

  function switchRole(next: "family" | "caregiver") {
    setRole(next);
    if (meta) {
      setPhone(next === "family" ? meta.demoPhones.family : meta.demoPhones.caregiver);
    }
  }

  async function send(raw: string) {
    const value = raw.trim();
    if (!value || busy) return;
    setBusy(true);
    setMessages((m) => [...m, { role: "user", body: value }]);
    setText("");
    try {
      const result = await api.chat({
        externalId: phone,
        text: value,
        displayName: role === "family" ? "家屬演示" : "護理員演示",
      });
      setMessages((m) => [
        ...m,
        { role: "bot", body: `${result.reply}\n\n〔intent: ${result.intent}${result.bookingId ? ` · ${result.bookingId}` : ""}〕` },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "bot", body: `錯誤：${e instanceof Error ? e.message : String(e)}` },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(text);
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Demo Chat</h1>
          <p>模擬 WhatsApp 對話：家屬預約 ↔ AI Agent ↔ 自動調度 ↔ 護理員接單。</p>
        </div>
      </div>

      <div className="chat-layout">
        <aside className="chat-side">
          <label>
            角色
            <select
              value={role}
              onChange={(e) => switchRole(e.target.value as "family" | "caregiver")}
            >
              <option value="family">家屬／長者</option>
              <option value="caregiver">護理員</option>
            </select>
          </label>
          <label>
            電話（channel identity）
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <div className="hint">{roleHint}</div>
          <div className="hint">
            快捷句：
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {QUICK.map((q) => (
                <button key={q} type="button" className="btn ghost" onClick={() => void send(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="chat-main">
          <div className="messages">
            {messages.map((m, i) => (
              <div key={`${i}-${m.role}`} className={`bubble ${m.role === "user" ? "user" : "bot"}`}>
                {m.body}
              </div>
            ))}
          </div>
          <form className="composer" onSubmit={onSubmit}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="用粵語／繁中輸入，例如：幫我預約明天上午10點家居清潔"
              disabled={busy}
            />
            <button className="btn" disabled={busy || !text.trim()}>
              傳送
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
