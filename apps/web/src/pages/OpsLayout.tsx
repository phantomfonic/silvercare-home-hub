import { NavLink, Outlet, Link } from "react-router-dom";

export default function OpsLayout() {
  return (
    <div className="ops-shell">
      <aside className="ops-side">
        <div className="ops-brand">
          <div className="ops-brand-name">銀護</div>
          <div className="ops-brand-meta">院舍上門照護 · 調度中樞</div>
        </div>
        <nav className="ops-nav">
          <NavLink to="/ops" end>
            營運總覽
          </NavLink>
          <NavLink to="/ops/dispatch">即時調度</NavLink>
          <NavLink to="/ops/cases">居家個案</NavLink>
          <NavLink to="/ops/team">外展團隊</NavLink>
        </nav>
        <div className="ops-side-foot">
          <Link className="btn" to="/demo">
            現場演示
          </Link>
          <Link className="btn ghost" to="/">
            返回展覽首頁
          </Link>
        </div>
      </aside>
      <main className="ops-main">
        <Outlet />
      </main>
    </div>
  );
}
