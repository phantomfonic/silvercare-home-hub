import { Navigate, Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import OpsLayout from "./pages/OpsLayout";
import Dashboard from "./pages/Dashboard";
import Bookings from "./pages/Bookings";
import Clients from "./pages/Clients";
import Caregivers from "./pages/Caregivers";
import LiveDemo from "./pages/LiveDemo";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/demo" element={<LiveDemo />} />
      <Route path="/ops" element={<OpsLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="dispatch" element={<Bookings />} />
        <Route path="cases" element={<Clients />} />
        <Route path="team" element={<Caregivers />} />
      </Route>
      <Route path="/chat" element={<Navigate to="/demo" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
