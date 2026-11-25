import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

type Msg = { role: "user" | "bot"; body: string; meta?: string };

type Act = {
  id: string;
  title: string;
  desc: string;
  role: "family" | "caregiver";
  suggest: string;
};

const ACTS: Act[] = [
  {
    id: "book",
    title: "Act 1 · 家屬預約",
    desc: "模擬家屬用 WhatsApp 預約上門清潔",
    role: "family",
    suggest: "幫我預約明天上午10點家居清潔",
  },
  {
    id: "accept",
    title: "Act 2 · 護理員接單",
    desc: "切換院舍護理員，回覆接單",
    role: "caregiver",
    suggest: "接單",
  },
  {
    id: "complete",
    title: "Act 3 · 到離完成",
    desc: "現場到達並完成服務回報",
    role: "caregiver",
    suggest: "到達",
  },
];

export default function LiveDemo() {
  const [meta, setMeta] = useState<Awaited<ReturnType<typeof api.meta>> | null>(null);
  const [actId, setActId] = useState(ACTS[0].id);
  const [phone, setPhone] = useState("61110001");
  const [text, setText] = useState(ACTS[0].suggest);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "bot",
      body: "您好，這裡是銀護居家服務中心。可直接告訴我要預約的服務與時間。",
      meta: "系統自動回覆",
    },
  ]);

  const act = ACTS.find((a) => a.id === actId) ?? ACTS[0];

  useEffect(() => {
    api.meta().then((m) => {
      setMeta(m);
      setPhone(m.demoPhones.family);
    });
  }, []);

  const headerSub = useMemo(() => {
    if (act.role === "caregiver") {
      return `護理員頻道 · ${phone}`;
    }
    return `家屬頻道 · ${phone}`;
  }, [act.role, phone]);

  function selectAct(next: Act) {
    setActId(next.id);
    setText(next.suggest);
    if (meta) {
      setPhone(next.role === "family" ? meta.demoPhones.family : meta.demoPhones.caregiver);
    } else {
      setPhone(next.role === "family" ? "61110001" : "91230001");
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
        displayName: act.role === "family" ? "家屬（展覽演示）" : "護理員（展覽演示）",
      });
      setMessages((m) => [
        ...m,
        {
          role: "bot",
          body: result.reply,
          meta: result.bookingId ? `意圖 ${result.intent} · ${result.bookingId}` : `意圖 ${result.intent}`,
        },
      ]);

      // Act 3 引導：到達後自動提示「完成」
      if (act.id === "complete" && value.includes("到達")) {
        setText("完成");
      } else if (act.id === "book" && result.bookingId) {
        // 預約成功後提示切到 Act 2
      }
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "bot", body: `系統暫時未能回覆：${e instanceof Error ? e.message : String(e)}` },
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
    <div className="landing" style={{ minHeight: "100vh", paddingBottom: "2rem" }}>
      <header className="landing-top">
        <Link to="/" className="landing-brand">
          銀護 SilverCare
        </Link>
        <div className="landing-nav">
          <Link className="btn ghost" to="/ops">
            查看調度台
          </Link>
          <Link className="btn ghost" to="/">
            展覽首頁
          </Link>
        </div>
      </header>

      <div className="section" style={{ paddingTop: "0.5rem" }}>
        <div className="section-narrow">
          <div className="page-head" style={{ marginBottom: "1rem" }}>
            <div>
              <h1 style={{ fontFamily: "var(--font-brand)", color: "var(--brand)", margin: 0 }}>
                現場演示
              </h1>
              <p style={{ margin: "0.35rem 0 0", color: "var(--ink-muted)" }}>
                三分鐘走完：家屬預約 → 自動指派 → 護理員接單到離。適合展覽講解。
              </p>
            </div>
          </div>

          <div className="demo-layout">
            <aside className="demo-coach">
              <h2>講解腳本</h2>
              <p className="stat-label" style={{ margin: 0 }}>
                依序點選 Act，輸入框會帶入建議對白；按傳送即可。
              </p>
              <div className="demo-steps">
                {ACTS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`demo-step ${actId === item.id ? "active" : ""}`}
                    onClick={() => selectAct(item)}
                  >
                    <div className="demo-step-title">{item.title}</div>
                    <div className="demo-step-desc">{item.desc}</div>
                  </button>
                ))}
              </div>

              <label className="stat-label">
                目前身份電話
                <input value={phone} onChange={(e) => setPhone(e.target.value)} style={{ marginTop: 6, width: "100%" }} />
              </label>

              <div className="chip-row">
                <button type="button" className="chip" onClick={() => void send(act.suggest)}>
                  一鍵傳送此幕對白
                </button>
                {act.id === "complete" && (
                  <button type="button" className="chip" onClick={() => void send("完成")}>
                    完成服務
                  </button>
                )}
              </div>

              <p className="stat-label" style={{ margin: 0 }}>
                演示後請到「調度台」展示服務單狀態已同步更新。
              </p>
            </aside>

            <section className="wa-frame">
              <div className="wa-header">
                <div>
                  <strong>{meta?.centerName ?? "銀護居家服務中心"}</strong>
                  <span>{headerSub}</span>
                </div>
                <span style={{ fontSize: "0.78rem" }}>WhatsApp 業務頻道 · 演示</span>
              </div>
              <div className="wa-body">
                {messages.map((m, i) => (
                  <div key={`${i}-${m.role}`} className={`wa-bubble ${m.role === "user" ? "user" : "bot"}`}>
                    {m.body}
                    {m.meta && <div className="wa-meta">{m.meta}</div>}
                  </div>
                ))}
              </div>
              <form className="wa-composer" onSubmit={onSubmit}>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="以粵語／繁中輸入…"
                  disabled={busy}
                />
                <button className="btn" disabled={busy || !text.trim()}>
                  傳送
                </button>
              </form>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
