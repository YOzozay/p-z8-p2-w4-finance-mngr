import { useEffect, useMemo, useState } from "react";
import "./car.css";
import { API_URL } from "../../config/api";

export default function CarDashboard() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  const fetchCar = async () => {
    const cached = localStorage.getItem("cache_car");
    if (cached) setRows(JSON.parse(cached));
    if (!cached) setLoading(true);
    try {
      const res = await fetch(`${API_URL}?mode=car`);
      const json = await res.json();
      setRows(Array.isArray(json) ? json : []);
      localStorage.setItem("cache_car", JSON.stringify(json));
    } catch (e) {
      console.error("fetch car error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCar();
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const paidCount = rows.filter((r) => r[3] === "ชำระแล้ว").length;
    const unpaidCount = total - paidCount;
    const amountPerInstallment = rows.length > 0 ? Number(rows[0][2] || 0) : 0;
    const totalPaid = paidCount * amountPerInstallment;
    const remaining = unpaidCount * amountPerInstallment;
    const next = rows.find((r) => r[3] !== "ชำระแล้ว") || null;
    const progressPct = total > 0 ? Math.round((paidCount / total) * 100) : 0;
    return { total, paidCount, unpaidCount, totalPaid, remaining, next, progressPct, amountPerInstallment };
  }, [rows]);

  // ✅ แก้: ใช้ await fetchCar() แทน setTimeout
  const payInstallment = async (no) => {
    if (!confirm(`ยืนยันการชำระงวดที่ ${no}?`)) return;
    setLoading(true);
    try {
      await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ type: "pay_car", no }),
      });
      await fetchCar();
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <div className="car-root">
      <div className="car-header">
        <h2 className="car-title">Car payments</h2>
        <button className="car-refresh" onClick={fetchCar}>
          🔄 Refresh
        </button>
      </div>

      <div className="car-summary">
        <div className="car-summary-card">
          <div className="car-summary-label">ยอดคงเหลือ</div>
          <div className="car-summary-value">฿{stats.remaining.toLocaleString()}</div>
        </div>

        <div className="car-summary-card">
          <div className="car-summary-label">ความคืบหน้า</div>
          <div className="car-summary-value">
            {stats.paidCount}/{stats.total} ({stats.progressPct}%)
          </div>
          <div className="car-progress-bar">
            <div className="car-progress-fill" style={{ width: `${stats.progressPct}%` }} />
          </div>
        </div>

        <div className="car-summary-card">
          <div className="car-summary-label">งวดถัดไป</div>
          {stats.next ? (
            <>
              <div className="car-next-no">งวดที่ {stats.next[0]}</div>
              <div className="car-next-date">วันที่ {stats.next[1] || "-"}</div>
              <div className="car-next-amount">฿{Number(stats.next[2] || 0).toLocaleString()}</div>
              <button className="car-pay-btn" onClick={() => payInstallment(stats.next[0])}>
                ยืนยันชำระงวดนี้
              </button>
            </>
          ) : (
            <div className="car-done">ชำระครบแล้ว 🎉</div>
          )}
        </div>
      </div>

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
          {rows.length === 0 && <div className="car-empty">ยังไม่มีข้อมูล</div>}
        </div>
      </div>

      {loading && (
        <div className="car-loading">
          <div className="car-spinner" />
        </div>
      )}
    </div>
  );
}
