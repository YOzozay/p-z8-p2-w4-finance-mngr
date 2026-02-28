// ============================================================
//  APP.JSX — Root Component
//  จัดการ routing (hash-based), sidebar, mobile drawer
// ============================================================

import { useState, useEffect } from "react";
import "./App.css";
import CarDashboard  from "./modules/car/CarDashboard.jsx";
import OtDashboard   from "./modules/ot/OtDashboard.jsx";
import DebtDashboard from "./modules/debt/DebtDashboard.jsx";
import { API_URL }   from "./config/api";

// ── Tab Definitions ─────────────────────────────────────────
const TABS = [
  { id: "car",  icon: "🚗", label: "Car payments" },
  { id: "ot",   icon: "⏱️", label: "OT + Salary"  },
  { id: "debt", icon: "💳", label: "Debt & Bills"  },
];

// ============================================================
//  PREFETCH — โหลดข้อมูลทุก mode ล่วงหน้าแล้วเก็บ cache
//  ทำให้แต่ละหน้าแสดงผลได้ทันทีโดยไม่ต้องรอ API
// ============================================================
function prefetchAll() {
  ["debt", "ot", "car", "cards"].forEach((mode) => {
    fetch(`${API_URL}?mode=${mode}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) || typeof data === "object") {
          localStorage.setItem(`cache_${mode}`, JSON.stringify(data));
        }
      })
      .catch(() => {}); // ไม่แสดง error ถ้า prefetch ล้มเหลว
  });
}

// ============================================================
//  COMPONENT
// ============================================================
export default function App() {

  // อ่าน tab จาก URL hash (#car, #ot, #debt) ถ้าไม่มีใช้ "car"
  const getInitialTab = () => {
    const hash = window.location.hash.replace("#", "");
    return TABS.find((t) => t.id === hash) ? hash : "car";
  };

  const [tab,        setTab]        = useState(getInitialTab);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // prefetch ทุก mode เมื่อแอปเริ่มทำงาน
  useEffect(() => {
    prefetchAll();
  }, []);

  /** เปลี่ยนหน้า + อัปเดต URL hash + ปิด drawer (ถ้ามี) */
  const handleNav = (id, onNav) => {
    setTab(id);
    window.location.hash = id;
    onNav?.();
  };

  // ── Sidebar Content (ใช้ทั้ง desktop sidebar และ mobile drawer) ──
  const SidebarContent = ({ onNav }) => (
    <>
      <div className="sidebar-logo">
        <span>💰</span> MY HUB
      </div>
      {TABS.map((t) => (
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

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="app-shell">

      {/* Sidebar — desktop (sticky) */}
      <aside className="sidebar">
        <SidebarContent />
      </aside>

      {/* Overlay + Drawer — mobile */}
      <div
        className={`drawer-overlay${drawerOpen ? " open" : ""}`}
        onClick={() => setDrawerOpen(false)}
      />
      <aside className={`sidebar drawer${drawerOpen ? " open" : ""}`}>
        <SidebarContent onNav={() => setDrawerOpen(false)} />
      </aside>

      {/* Main Content */}
      <div className="main-content">

        {/* Topbar — mobile only */}
        <div className="mobile-topbar">
          <button className="hamburger" onClick={() => setDrawerOpen(true)}>
            ☰
          </button>
          <span className="mobile-logo">💰 MY HUB</span>
        </div>

        {/* Page Rendering */}
        {tab === "car"  && <CarDashboard  />}
        {tab === "ot"   && <OtDashboard   />}
        {tab === "debt" && <DebtDashboard />}
      </div>

    </div>
  );
}
