import { useState } from "react";
import "./App.css";

import OtDashboard from "./modules/ot/OtDashboard.jsx";
import DebtDashboard from "./modules/debt/DebtDashboard.jsx";
import CarDashboard from "./modules/car/CarDashboard.jsx";

const TABS = [
  { id: "car",  icon: "🚗", label: "งวดรถ" },
  { id: "ot",   icon: "⏱️", label: "OT & รายได้" },
  { id: "debt", icon: "💳", label: "หนี้ & บิล" },
];

export default function App() {
  const [tab, setTab] = useState("car");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const SidebarContent = ({ onNav }) => (
    <>
      <div className="sidebar-logo">
        <span>💰</span> MY HUB
      </div>
      {TABS.map(t => (
        <button
          key={t.id}
          className={`nav-btn${tab === t.id ? " active" : ""}`}
          onClick={() => { setTab(t.id); onNav?.(); }}
        >
          <span>{t.icon}</span> {t.label}
        </button>
      ))}
    </>
  );

  return (
    <div className="app-shell">
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      <div
        className={`drawer-overlay${drawerOpen ? " open" : ""}`}
        onClick={() => setDrawerOpen(false)}
      />
      <aside className={`sidebar drawer${drawerOpen ? " open" : ""}`}>
        <SidebarContent onNav={() => setDrawerOpen(false)} />
      </aside>

      {/* Main */}
      <div className="main-content">
        {/* Mobile Topbar */}
        <div className="mobile-topbar">
          <button className="hamburger" onClick={() => setDrawerOpen(true)}>☰</button>
          <span className="mobile-logo">💰 MY HUB</span>
        </div>

        {tab === "car"  && <CarDashboard />}
        {tab === "ot"   && <OtDashboard />}
        {tab === "debt" && <DebtDashboard />}
      </div>
    </div>
  );
}
