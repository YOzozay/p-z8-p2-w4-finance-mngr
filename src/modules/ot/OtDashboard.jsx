// ============================================================
//  OTDASHBOARD.JSX — Overtime & Salary Tracker
//  คำนวณรายรับสุทธิ, OT รอบปัจจุบัน, ค่าเบี้ยเลี้ยง
//
//  รอบคำนวณ: วันที่ 21 ของเดือนก่อน → วันที่ 20 ของเดือนนี้
//
//  Column Index (Google Sheet OT):
//  [0]=วันที่  [1]=OT×1  [2]=OT×1.5  [3]=OT×3
//  [4]=เงินเดือน  [5]=ค่าหัก  [6]=ค่าข้าว  [7]=ค่าข้าวOT
//  [8]=ค่าน้ำมัน  [9]=หมายเหตุ  [10]=dayType
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "../../config/api";
import "./ot.css";

// ── ค่า Default Config (ถ้าไม่มีใน localStorage) ────────────
const DEFAULT_CONFIG = {
  salary:    18304,
  otRate:    76.26,
  deduct:    1475,
  food:      40,
  foodOt:    30,
  gas:       55,
  incentive: 1000,
};

// ── Settings Fields (label, key) ────────────────────────────
const SETTINGS_FIELDS = [
  ["เงินเดือน",   "salary"],
  ["รายการหัก",   "deduct"],
  ["เบี้ยขยัน",  "incentive"],
  ["เรท OT/ชม.", "otRate"],
  ["ค่าข้าวปกติ", "food"],
  ["ค่าข้าว OT",  "foodOt"],
  ["ค่าน้ำมัน",  "gas"],
];

export default function OtDashboard() {

  // ── State ────────────────────────────────────────────────
  const [loading,      setLoading]      = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSalary,   setShowSalary]   = useState(false); // ซ่อน/แสดงเงินเดือน
  const [data,         setData]         = useState([]);    // ข้อมูล OT ทั้งหมด

  // Config: โหลดจาก localStorage ถ้ามี
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem("app_config");
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });

  // บันทึก config ลง localStorage ทุกครั้งที่เปลี่ยน
  useEffect(() => {
    localStorage.setItem("app_config", JSON.stringify(config));
  }, [config]);

  // ฟอร์มบันทึก OT
  const [otForm, setOtForm] = useState({
    date:    new Date().toISOString().split("T")[0],
    ot1:     0,
    ot15:    0,
    ot3:     0,
    note:    "",
    dayType: "work", // "work" | "holiday"
  });

  // ============================================================
  //  DATA FETCHING
  // ============================================================

  /** โหลดข้อมูล OT (มี cache ใน localStorage) */
  const fetchOt = async () => {
    const cached = localStorage.getItem("cache_ot");
    if (cached) setData(JSON.parse(cached));
    if (!cached) setLoading(true);

    try {
      const res  = await fetch(`${API_URL}?mode=ot`);
      const json = await res.json();
      const list = Array.isArray(json) ? json : [];
      setData(list);
      localStorage.setItem("cache_ot", JSON.stringify(list));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOt();
  }, []);

  // ============================================================
  //  COMPUTED: สรุปรอบปัจจุบัน
  // ============================================================

  const otSummary = useMemo(() => {
    // ── กำหนดช่วงรอบปัจจุบัน (21 → 20) ──
    const toInt = (d) =>
      d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

    const now   = new Date();
    const today = now.getDate();

    // ถ้าวันนี้ <= 20: รอบเริ่มเดือนก่อน / ถ้า > 20: รอบเริ่มเดือนนี้
    const startOfCycle = today <= 20
      ? new Date(now.getFullYear(), now.getMonth() - 1, 21)
      : new Date(now.getFullYear(), now.getMonth(), 21);
    const endOfCycle = today <= 20
      ? new Date(now.getFullYear(), now.getMonth(), 20)
      : new Date(now.getFullYear(), now.getMonth() + 1, 20);

    const startInt = toInt(startOfCycle);
    const endInt   = toInt(endOfCycle);

    // ── กรองข้อมูลเฉพาะรอบปัจจุบัน ──
    let allowance       = 0;
    const cycleRows     = [];

    data.forEach((row) => {
      const rawDate    = new Date(row[0]);
      const rowDateInt = toInt(new Date(rawDate.getFullYear(), rawDate.getMonth(), rawDate.getDate()));
      if (rowDateInt < startInt || rowDateInt > endInt) return;

      const dayType = row[10];

      // วันหยุด/ลา: ไม่นับค่าข้าวและค่าน้ำมัน
      const foodNormal = dayType === "holiday" ? 0 : (Number(row[6]) || 0);
      const gas        = dayType === "holiday" ? 0 : (Number(row[8]) || 0);

      // ค่าข้าว OT: นับเฉพาะเมื่อ OT×1.5 >= 2 ชม. หรือมี OT×3
      const ot15      = Number(row[2]) || 0;
      const ot3       = Number(row[3]) || 0;
      const foodOt    = (ot15 >= 2 || ot3 > 0) ? (Number(row[7]) || 0) : 0;

      allowance += foodNormal + foodOt + gas;
      cycleRows.push(row);
    });

    // ── คำนวณชั่วโมง OT ──
    let hrsX1 = 0, hrsX15 = 0, hrsX3 = 0;
    cycleRows.forEach((row) => {
      hrsX1  += Number(row[1]) || 0;
      hrsX15 += Number(row[2]) || 0;
      hrsX3  += Number(row[3]) || 0;
    });

    // ── คำนวณรายรับ ──
    const otPay = cycleRows.reduce(
      (sum, row) =>
        sum +
        (Number(row[1]) || 0) * config.otRate +
        (Number(row[2]) || 0) * 1.5 * config.otRate +
        (Number(row[3]) || 0) * 3   * config.otRate,
      0
    );

    const netSalary =
      Number(config.salary)    -
      Number(config.deduct)    +
      Number(config.incentive) +
      otPay + allowance;

    return {
      totalHrs:        hrsX1 + hrsX15 + hrsX3,
      hrsX1,
      hrsX15,
      hrsX3,
      otPay,
      netSalary,
      allowance,
      currentCycleData: cycleRows.reverse(), // ล่าสุดอยู่ล่าง
    };
  }, [data, config]);

  // ============================================================
  //  ACTIONS
  // ============================================================

  /** บันทึก OT ใหม่ */
  const handleAddOt = async (e) => {
    e.preventDefault();
    setLoading(true);

    // วันอาทิตย์ถือเป็นวันหยุดอัตโนมัติ
    const isSunday     = new Date(otForm.date).getDay() === 0;
    const finalDayType = isSunday ? "holiday" : otForm.dayType;

    try {
      await fetch(API_URL, {
        method:  "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          type:      "add_ot",
          ...otForm,
          dayType:   finalDayType,
          salary:    config.salary,
          deduct:    config.deduct,
          food:      config.food,
          gas:       config.gas,
          foodOt:    config.foodOt,
          incentive: config.incentive,
        }),
      });

      // reset ฟอร์ม
      setOtForm({
        date:    new Date().toISOString().split("T")[0],
        ot1:     0,
        ot15:    0,
        ot3:     0,
        note:    "",
        dayType: "work",
      });
      await fetchOt();
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  /** ลบรายการ OT */
  const handleDeleteOt = async (date, ot1) => {
    if (!confirm("ยืนยันการลบรายการนี้?")) return;
    setLoading(true);
    try {
      await fetch(API_URL, {
        method:  "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ type: "delete_ot", date, ot1 }),
      });
      await fetchOt();
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  // ============================================================
  //  HELPERS
  // ============================================================

  /**
   * แสดงรายละเอียด OT ของแต่ละแถว
   * เช่น "x1.0: 2 | x1.5: 3" หรือ "วันหยุด/ลา"
   */
  const renderOtDetails = (row) => {
    if (row[10] === "holiday") return "วันหยุด/ลา";
    const parts = [];
    if (Number(row[1]) > 0) parts.push(`x1.0: ${row[1]}`);
    if (Number(row[2]) > 0) parts.push(`x1.5: ${row[2]}`);
    if (Number(row[3]) > 0) parts.push(`x3.0: ${row[3]}`);
    return parts.length > 0 ? parts.join(" | ") : "มาทำงาน";
  };

  /**
   * คำนวณรายรับรายวัน (OT + เบี้ยเลี้ยง) สำหรับแสดงใน history
   */
  const calcDailyIncome = (row) => {
    const dayType    = row[10];
    const foodNormal = dayType === "holiday" ? 0 : (Number(row[6]) || 0);
    const gas        = dayType === "holiday" ? 0 : (Number(row[8]) || 0);
    const ot15       = Number(row[2]) || 0;
    const ot3        = Number(row[3]) || 0;
    const foodOt     = (ot15 >= 2 || ot3 > 0) ? (Number(row[7]) || 0) : 0;

    return (
      ((Number(row[1]) || 0) + ot15 * 1.5 + ot3 * 3) * config.otRate +
      foodNormal + foodOt + gas
    );
  };

  // ============================================================
  //  RENDER
  // ============================================================

  return (
    <div className="ot-page">

      {/* ── Header ── */}
      <div className="ot-header">
        <h2>OT + Salary</h2>
        <button className="btn-ghost" onClick={() => setShowSettings(!showSettings)}>
          ⚙️ {showSettings ? "ปิดตั้งค่า" : "ตั้งค่า"}
        </button>
      </div>

      {/* ── Settings Panel ── */}
      {showSettings && (
        <div className="settings-card">
          {SETTINGS_FIELDS.map(([label, key]) => (
            <div className="field" key={key}>
              <label>{label}</label>
              <input
                type="number"
                value={config[key]}
                onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Summary Cards ── */}
      <div className="summary-grid">

        {/* รายรับสุทธิ */}
        <div className="card primary">
          <div className="card-label-container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="card-label">รายรับสุทธิ</div>
            <button
              onClick={() => setShowSalary(!showSalary)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem" }}
            >
              {showSalary ? "👁️" : "🙈"}
            </button>
          </div>
          <div className="card-value">
            ฿ {showSalary ? Math.floor(otSummary.netSalary).toLocaleString() : "******"}
          </div>
        </div>

        {/* สะสม OT รอบนี้ */}
        <div className="card">
          <div className="card-label">สะสม OT รอบนี้</div>
          <div className="card-value">{otSummary.totalHrs.toFixed(1)} ชม.</div>
          <div style={{ display: "flex", justifyContent: "space-around", fontSize: "0.85rem", margin: "4px 0", color: "#64748b", fontWeight: "bold" }}>
            <span>x1: {otSummary.hrsX1}</span>
            <span>x1.5: {otSummary.hrsX15}</span>
            <span>x3: {otSummary.hrsX3}</span>
          </div>
          <div className="card-sub">฿ {Math.floor(otSummary.otPay).toLocaleString()}</div>
        </div>

      </div>

      {/* ── Main Grid: ฟอร์ม + ประวัติ ── */}
      <div className="main-grid">

        {/* ฟอร์มบันทึก OT */}
        <form className="form-card" onSubmit={handleAddOt}>
          <h3>บันทึก OT</h3>

          {/* วันที่ */}
          <input
            type="date"
            value={otForm.date}
            onChange={(e) => setOtForm({ ...otForm, date: e.target.value })}
          />

          {/* ประเภทวัน */}
          <div className="toggle-row">
            <button
              type="button"
              className={otForm.dayType === "work" ? "toggle active" : "toggle"}
              onClick={() => setOtForm({ ...otForm, dayType: "work" })}
            >
              🏢 วันทำงาน
            </button>
            <button
              type="button"
              className={otForm.dayType === "holiday" ? "toggle holiday active" : "toggle holiday"}
              onClick={() => setOtForm({ ...otForm, dayType: "holiday" })}
            >
              🏖️ วันหยุด
            </button>
          </div>

          {/* ชั่วโมง OT ×1, ×1.5, ×3 */}
          <div className="ot-inputs">
            {["ot1", "ot15", "ot3"].map((k, i) => (
              <input
                key={k}
                type="number"
                step="0.5"
                min="0"
                placeholder={["1", "1.5", "3"][i]}
                value={otForm[k] === 0 ? "" : otForm[k]}
                onChange={(e) =>
                  setOtForm({ ...otForm, [k]: e.target.value === "" ? 0 : e.target.value })
                }
              />
            ))}
          </div>

          {/* หมายเหตุ */}
          <textarea
            placeholder="หมายเหตุ..."
            value={otForm.note}
            onChange={(e) => setOtForm({ ...otForm, note: e.target.value })}
          />

          <button type="submit" className="btn-primary">
            {otForm.dayType === "work" ? "บันทึกวันทำงาน" : "บันทึกวันหยุด"}
          </button>
        </form>

        {/* ประวัติรอบปัจจุบัน */}
        <div className="history-card">
          <div className="history-header">
            <h3>รอบปัจจุบัน 21-20</h3>
            <span>ค่าข้าว+น้ำมัน : ฿{otSummary.allowance.toLocaleString()}</span>
          </div>

          <div className="history-list">
            {otSummary.currentCycleData.length > 0 ? (
              otSummary.currentCycleData.map((row, idx) => (
                <div key={idx} className="history-row">
                  {/* วันที่ + หมายเหตุ */}
                  <div>
                    <div className="date">
                      {new Date(row[0]).toLocaleDateString("th-TH", {
                        day:   "2-digit",
                        month: "short",
                      })}
                    </div>
                    <div className="note">{row[9] || "-"}</div>
                  </div>

                  {/* OT details + รายรับ + ปุ่มลบ */}
                  <div className="right">
                    <div className="detail">{renderOtDetails(row)}</div>
                    <div className="money">฿{calcDailyIncome(row).toLocaleString()}</div>
                    <button
                      className="btn-delete"
                      onClick={() => handleDeleteOt(row[0], row[1])}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty">ยังไม่มีข้อมูลในรอบนี้</div>
            )}
          </div>
        </div>

      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="overlay">
          <div className="spinner" />
        </div>
      )}

    </div>
  );
}
