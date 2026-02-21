import { useState } from "react";
import "./App.css";

// 👉 import หน้า OT ที่แยกไฟล์แล้ว
import OtDashboard from "./modules/ot/OtDashboard.jsx";
import DebtDashboard from "./modules/debt/DebtDashboard.jsx";
import CarDashboard from "./modules/car/CarDashboard.jsx";

export default function App() {
  const [tab, setTab] = useState("car");

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r p-4 space-y-2">
        <h1 className="text-xl font-bold text-green-600 mb-4">MY HUB</h1>
        <button
          className="w-full text-left p-2 rounded hover:bg-slate-100"
          onClick={() => setTab("car")}
        >
          🚗 งวดรถ
        </button>
        <button
          className="w-full text-left p-2 rounded hover:bg-slate-100"
          onClick={() => setTab("ot")}
        >
          ⏱️ OT & รายได้
        </button>
        <button
          className="w-full text-left p-2 rounded hover:bg-slate-100"
          onClick={() => setTab("debt")}
        >
          💳 หนี้ & บิล
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1">
        {tab === "car" && <CarDashboard />}
        {tab === "ot" && <OtDashboard />}
        {tab === "debt" && <DebtDashboard />}
      </main>
    </div>
  );
}
