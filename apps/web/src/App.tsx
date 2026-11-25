import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Bookings from "./pages/Bookings";
import Clients from "./pages/Clients";
import Caregivers from "./pages/Caregivers";
import DemoChat from "./pages/DemoChat";

export default function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">銀護 SilverCare</div>
          <div className="brand-sub">Home Hub 調度中心</div>
        </div>
        <nav className="nav">
          <NavLink to="/" end>
            儀表板
          </NavLink>
          <NavLink to="/bookings">服務單</NavLink>
          <NavLink to="/clients">個案</NavLink>
          <NavLink to="/caregivers">護理員</NavLink>
          <NavLink to="/chat">Demo Chat</NavLink>
        </nav>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/caregivers" element={<Caregivers />} />
          <Route path="/chat" element={<DemoChat />} />
        </Routes>
      </main>
    </div>
  );
}
