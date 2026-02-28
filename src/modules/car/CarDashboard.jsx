// ============================================================
//  CARDASHBOARD.JSX — Car Loan Payment Tracker
//  แสดงยอดคงเหลือ, ความคืบหน้า, งวดถัดไป, ประวัติการชำระ
// ============================================================

import { useEffect, useMemo, useState } from "react";
import "./car.css";
import { API_URL } from "../../config/api";

// ── Column Index Reference (Google Sheet) ───────────────────
// r[0] = งวดที่  r[1] = วันที่ชำระ  r[2] = จำนวนเงิน  r[3] = สถานะ

export default function CarDashboard() {

  const [loading, setLoading] = useState(false);
  const [rows,    setRows]    = useState([]); // ข้อมูลทุกงวด

  // ============================================================
  //  DATA FETCHING
  // ============================================================

  /** โหลดข้อมูลงวดรถ (มี cache ใน localStorage) */
  const fetchCar = async () => {
    const cached = localStorage.getItem("cache_car");
    if (cached) setRows(JSON.parse(cached));
    if (!cached) setLoading(true);

    try {
      const res  = await fetch(`${API_URL}?mode=car`);
      const json = await res.json();
      const list = Array.isArray(json) ? json : [];
      setRows(list);
      localStorage.setItem("cache_car", JSON.stringify(list));
    } catch (e) {
      console.error("fetch car error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCar();
  }, []);

  // ============================================================
  //  COMPUTED: สถิติสรุป
  // ============================================================

  const stats = useMemo(() => {
    const total     = rows.length;
    const paidCount = rows.filter((r) => r[3] === "ชำระแล้ว").length;
    const unpaid    = total - paidCount;

    // ยอดต่องวดดูจากแถวแรก (งวดทุกงวดเท่ากัน)
    const perInstallment = rows.length > 0 ? Number(rows[0][2] || 0) : 0;

    return {
      total,
      paidCount,
      unpaidCount:  unpaid,
      totalPaid:    paidCount * perInstallment,
      remaining:    unpaid * perInstallment,
      progressPct:  total > 0 ? Math.round((paidCount / total) * 100) : 0,
      next:         rows.find((r) => r[3] !== "ชำระแล้ว") || null, // งวดถัดไป
    };
  }, [rows]);

  // ============================================================
  //  ACTIONS
  // ============================================================

  /** ชำระงวดที่ระบุ */
  const payInstallment = async (no) => {
    if (!confirm(`ยืนยันการชำระงวดที่ ${no}?`)) return;
    setLoading(true);
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ type: "pay_car", no }),
      });
      await fetchCar(); // โหลดใหม่หลังชำระ
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  // ============================================================
  //  RENDER
  // ============================================================

  return (
    <div className="car-root">

      {/* ── Header ── */}
      <div className="car-header">
        <h2 className="car-title">Car payments</h2>
        <button className="car-refresh" onClick={fetchCar}>
          🔄 Refresh
        </button>
      </div>

      {/* ── Summary Cards (3 col) ── */}
      <div className="car-summary">

        {/* ยอดคงเหลือ */}
        <div className="car-summary-card">
          <div className="car-summary-label">ยอดคงเหลือ</div>
          <div className="car-summary-value">฿{stats.remaining.toLocaleString()}</div>
        </div>

        {/* ความคืบหน้า */}
        <div className="car-summary-card">
          <div className="car-summary-label">ความคืบหน้า</div>
          <div className="car-summary-value">
            {stats.paidCount}/{stats.total} ({stats.progressPct}%)
          </div>
          <div className="car-progress-bar">
            <div className="car-progress-fill" style={{ width: `${stats.progressPct}%` }} />
          </div>
        </div>

        {/* งวดถัดไป */}
        <div className="car-summary-card">
          <div className="car-summary-label">งวดถัดไป</div>
          {stats.next ? (
            <>
              <div className="car-next-no">งวดที่ {stats.next[0]}</div>
              <div className="car-next-date">วันที่ {stats.next[1] || "-"}</div>
              <div className="car-next-amount">
                ฿{Number(stats.next[2] || 0).toLocaleString()}
              </div>
              <button
                className="car-pay-btn"
                onClick={() => payInstallment(stats.next[0])}
              >
                ยืนยันชำระงวดนี้
              </button>
            </>
          ) : (
            <div className="car-done">ชำระครบแล้ว 🎉</div>
          )}
        </div>

      </div>

      {/* ── ประวัติการชำระ ── */}
      <div className="car-history">
        <div className="car-history-header">ประวัติการชำระ</div>
        <div className="car-history-list">
          {rows.map((r, i) => (
            <div key={i} className="car-row">
              <div className="car-row-no">#{r[0]}</div>
              <div className="car-row-date">{r[1] || "-"}</div>
              <div className="car-row-amount">฿{Number(r[2] || 0).toLocaleString()}</div>
              <div className={`car-row-status ${r[3] === "ชำระแล้ว" ? "paid" : "unpaid"}`}>
                {r[3]}
              </div>
              <div className="car-row-action">
                {r[3] !== "ชำระแล้ว" && (
                  <button className="car-row-pay" onClick={() => payInstallment(r[0])}>
                    ชำระ
                  </button>
                )}
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="car-empty">ยังไม่มีข้อมูล</div>
          )}
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="car-loading">
          <div className="car-spinner" />
        </div>
      )}

    </div>
  );
}
