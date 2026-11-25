import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-top">
        <div className="landing-brand">銀護 SilverCare</div>
        <div className="landing-nav">
          <Link className="btn ghost" to="/ops">
            調度中樞
          </Link>
          <Link className="btn" to="/demo">
            現場演示
          </Link>
        </div>
      </header>

      <section className="hero">
        <div className="hero-media" aria-hidden="true" />
        <div className="hero-content">
          <div className="hero-kicker">安老院舍 · 上門照護轉型</div>
          <h1>銀護 SilverCare</h1>
          <p className="hero-lead">
            把院舍既有的護理團隊，透過 WhatsApp 與 AI 調度延伸到長者家中——不用另建 App，先以試點承接居家服務。
          </p>
          <div className="hero-cta">
            <Link className="btn light" to="/demo">
              三分鐘現場演示
            </Link>
            <Link className="btn ghost" to="/ops" style={{ color: "#f7faf9", borderColor: "rgba(247,250,249,0.35)" }}>
              進入營運調度台
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-narrow">
          <h2>院舍如何承接居家服務</h2>
          <p className="section-lead">
            不是再買一套複雜系統，而是用院舍熟悉的溝通方式，把「預約—指派—到離—完成」閉環起來。
          </p>
          <div className="story-grid">
            <article className="story-step">
              <div className="story-index">01 · 家屬</div>
              <h3>WhatsApp 直接預約</h3>
              <p>長者家屬用日常對話預約清潔、陪診、洗澡協助。無需下載新 App，降低學習成本。</p>
            </article>
            <article className="story-step">
              <div className="story-index">02 · 院舍</div>
              <h3>AI 自動匹配人手</h3>
              <p>按技能、班表、服務區域與當日負荷即時指派，督導可在調度台一鍵覆核或改派。</p>
            </article>
            <article className="story-step">
              <div className="story-index">03 · 護理員</div>
              <h3>接單到離回報</h3>
              <p>護理員同樣用 WhatsApp 接單、到達、完成。院舍即時掌握上門進度與服務紀錄。</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section exhibit-band">
        <div className="section-narrow">
          <h2>展覽講解建議（約 4 分鐘）</h2>
          <p className="section-lead">向來賓說明「院舍能力外延」時，可依此順序操作。</p>
          <div className="script-list">
            <div className="script-item">
              <div className="script-role">開場</div>
              <div>院舍已有護理員與服務標準；缺的是把流程拉到社區的調度層。</div>
            </div>
            <div className="script-item">
              <div className="script-role">Act 1–3</div>
              <div>WhatsApp：家屬預約 → 護理員接單 → 到離完成。</div>
            </div>
            <div className="script-item">
              <div className="script-role">分析</div>
              <div>調度台「個案分析」：完成率、服務時數、區域／項目需求、高頻個案。</div>
            </div>
            <div className="script-item">
              <div className="script-role">班表</div>
              <div>「班表時間表」：誰可派出、本週已排上門單、待指派空缺——院舍可立即外展。</div>
            </div>
          </div>
          <div className="hero-cta" style={{ marginTop: "1.6rem" }}>
            <Link className="btn light" to="/demo">
              開始演示
            </Link>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <span>銀護 SilverCare Home Hub · 開源調度平台</span>
        <span>示範中心：觀塘 · 粵語／繁中 WhatsApp Agent</span>
      </footer>
    </div>
  );
}
