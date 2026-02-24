import { useState, useEffect } from "react";
import "./App.css";
import OtDashboard from "./modules/ot/OtDashboard.jsx";
import DebtDashboard from "./modules/debt/DebtDashboard.jsx";
import CarDashboard from "./modules/car/CarDashboard.jsx";
import { API_URL } from "./config/api";

const TABS = [
  { id: "car",  icon: "🚗", label: "Car payments" },
  { id: "ot",   icon: "⏱️", label: "OT + Salary" },
  { id: "debt", icon: "💳", label: "Debt & Bills" },
];

// ✅ แก้: เพิ่ม error handling + เช็คว่า response เป็น Array ก่อน cache
function prefetchAll() {
  const modes = ["debt", "ot", "car", "cards"];
  modes.forEach(mode => {
    fetch(`${API_URL}?mode=${mode}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) || typeof data === "object") {
          localStorage.setItem(`cache_${mode}`, JSON.stringify(data));
        }
      })
      .catch(() => {});
  });
}

export default function App() {
  const getInitialTab = () => {
    const hash = window.location.hash.replace("#", "");
    return TABS.find(t => t.id === hash) ? hash : "car";
  };

  const [tab, setTab] = useState(getInitialTab);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    prefetchAll();
  }, []);

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
      <aside className="sidebar">
        <SidebarContent />
      </aside>

      <div
        className={`drawer-overlay${drawerOpen ? " open" : ""}`}
        onClick={() => setDrawerOpen(false)}
      />
      <aside className={`sidebar drawer${drawerOpen ? " open" : ""}`}>
        <SidebarContent onNav={() => setDrawerOpen(false)} />
      </aside>

      <div className="main-content">
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
