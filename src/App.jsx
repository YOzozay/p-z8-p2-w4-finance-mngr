import { useState, useEffect } from "react";
import "./App.css";
import OtDashboard from "./modules/ot/OtDashboard.jsx";
import DebtDashboard from "./modules/debt/DebtDashboard.jsx";
import CarDashboard from "./modules/car/CarDashboard.jsx";
import { API_URL } from "./config/api";

const TABS = [
  { id: "car",  icon: "🚗", label: "งวดรถ" },
  { id: "ot",   icon: "⏱️", label: "OT & รายได้" },
  { id: "debt", icon: "💳", label: "หนี้ & บิล" },
];

// ---- prefetch ทุก module แล้วเก็บ cache ----
function prefetchAll() {
  const modes = ["debt", "ot", "car", "cards"];
  modes.forEach(mode => {
    fetch(`${API_URL}?mode=${mode}`)
      .then(r => r.json())
      .then(data => {
        localStorage.setItem(`cache_${mode}`, JSON.stringify(data));
      })
      .catch(() => {});
  });
}

export default function App() {
  // ---- อ่าน tab จาก URL hash (F5 อยู่หน้าเดิม) ----
  const getInitialTab = () => {
    const hash = window.location.hash.replace("#", "");
    return TABS.find(t => t.id === hash) ? hash : "car";
  };

  const [tab, setTab] = useState(getInitialTab);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ---- prefetch ตอนเปิดแอป ----
  useEffect(() => {
    prefetchAll();
  }, []);

  // ---- sync tab กับ URL hash ----
  const handleNav = (id, onNav) => {
    setTab(id);
    window.location.hash = id;
    onNav?.();
  };

  const SidebarContent = ({ onNav }) => (
    <>
      <div className="sidebar-logo">
        <span>💰</span> MY HUB
      </div>
      {TABS.map(t => (
        <button
          key={t.id}
          className={`nav-btn${tab === t.id ? " active" : ""}`}
          onClick={() => handleNav(t.id, onNav)}
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