import { useEffect, useMemo, useState } from "react";
import { API_URL } from "../../config/api";
import "./ot.css";

export default function OtDashboard() {
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [data, setData] = useState([]);
  const [showSalary, setShowSalary] = useState(false); // เริ่มต้นเป็น false (ปิดตา)

  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem("app_config");
    return saved
      ? JSON.parse(saved)
      : {
          salary: 15000,
          otRate: 76.26,
          deduct: 1350,
          food: 40,
          foodOt: 30,
          gas: 55,
          incentive: 1000,
          carPrice: 12220,
          totalInstallments: 72,
        };
  });

  useEffect(() => {
    localStorage.setItem("app_config", JSON.stringify(config));
  }, [config]);

  const [otForm, setOtForm] = useState({
    date: new Date().toISOString().split("T")[0],
    ot1: 0,
    ot15: 0,
    ot3: 0,
    note: "",
    dayType: "work",
  });

  const fetchOt = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?mode=ot`);
      const json = await res.json();
      setData(Array.isArray(json) ? json : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOt();
  }, []);

  const otSummary = useMemo(() => {
    let totalHrsCurrentCycle = 0;
    let allowanceCurrentCycle = 0;
    
    // 1. เพิ่มตัวแปรเก็บสะสมชั่วโมงแยกประเภท
    let hrsX1 = 0;
    let hrsX15 = 0;
    let hrsX3 = 0;

    const currentCycleRows = [];
    const toInt = (d) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

    const now = new Date();
    const today = now.getDate();
    let startOfCycle, endOfCycle;

    if (today <= 20) {
      startOfCycle = new Date(now.getFullYear(), now.getMonth() - 1, 21);
      endOfCycle = new Date(now.getFullYear(), now.getMonth(), 20);
    } else {
      startOfCycle = new Date(now.getFullYear(), now.getMonth(), 21);
      endOfCycle = new Date(now.getFullYear(), now.getMonth() + 1, 20);
    }

    const startInt = toInt(startOfCycle);
    const endInt = toInt(endOfCycle);

    data.forEach((row) => {
      const rawDate = new Date(row[0]);
      const rowDateInt = toInt(new Date(rawDate.getFullYear(), rawDate.getMonth(), rawDate.getDate()));

      const foodNormal = Number(row[6]) || 0;
      const gas = Number(row[8]) || 0;
      const isOt15or3 = (Number(row[2]) || 0) > 0 || (Number(row[3]) || 0) > 0;
      const foodOt = isOt15or3 ? (Number(row[7]) || 0) : 0;
      const dailyTotalAllowance = foodNormal + foodOt + gas;

      if (rowDateInt >= startInt && rowDateInt <= endInt) {
        allowanceCurrentCycle += dailyTotalAllowance;
        currentCycleRows.push(row);
      }
    });

    // 2. คำนวณชั่วโมงแยกประเภทจากข้อมูลรอบปัจจุบัน
    currentCycleRows.forEach((row) => {
      const h1 = Number(row[1]) || 0;
      const h15 = Number(row[2]) || 0;
      const h3 = Number(row[3]) || 0;

      hrsX1 += h1;
      hrsX15 += h15;
      hrsX3 += h3;
      totalHrsCurrentCycle += (h1 + h15 + h3);
    });

    const otPay = currentCycleRows.reduce(
      (sum, row) =>
        sum +
        (Number(row[1]) || 0) * config.otRate +
        (Number(row[2]) || 0) * 1.5 * config.otRate +
        (Number(row[3]) || 0) * 3 * config.otRate,
      0
    );

    const netSalary =
      Number(config.salary) -
      Number(config.deduct) +
      Number(config.incentive) +
      otPay +
      allowanceCurrentCycle;

    return {
      totalHrs: totalHrsCurrentCycle,
      hrsX1,  
      hrsX15, 
      hrsX3,  
      otPay,
      netSalary,
      allowance: allowanceCurrentCycle,
      currentCycleData: currentCycleRows.reverse(),
    };
  }, [data, config]);

  const handleAddOt = async (e) => {
    e.preventDefault();
    setLoading(true);
    const checkDate = new Date(otForm.date);
    const isSunday = checkDate.getDay() === 0;
    const finalDayType = isSunday ? "holiday" : otForm.dayType;

    try {
      await fetch(API_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          type: "add_ot",
          ...otForm,
          dayType: finalDayType,
          salary: config.salary,
          deduct: config.deduct,
          food: config.food,
          gas: config.gas,
          foodOt: config.foodOt,
          incentive: config.incentive,
        }),
      });
      setOtForm({ ...otForm, ot1: 0, ot15: 0, ot3: 0, note: "", dayType: "work" });
      setTimeout(fetchOt, 800);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const handleDeleteOt = async (rowIndex) => {
    if (!confirm("ยืนยันการลบรายการนี้?")) return;
    setLoading(true);
    try {
      await fetch(API_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ type: "delete_ot", rowIndex }),
      });
      setTimeout(fetchOt, 800);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const renderOtDetails = (row) => {
    const parts = [];
    if (Number(row[1]) > 0) parts.push(`x1.0: ${row[1]}`);
    if (Number(row[2]) > 0) parts.push(`x1.5: ${row[2]}`);
    if (Number(row[3]) > 0) parts.push(`x3.0: ${row[3]}`);
    return parts.length > 0 ? parts.join(" | ") : row[6] > 0 ? "มาทำงาน" : "วันหยุด/ลา";
  };

  return (
    <div className="ot-page">
      <div className="ot-header">
        <h2>OT & รายได้</h2>
        <button className="btn-ghost" onClick={() => setShowSettings(!showSettings)}>
          ⚙️ {showSettings ? "ปิดตั้งค่า" : "ตั้งค่า"}
        </button>
      </div>

      {showSettings && (
        <div className="settings-card">
          {[
            ["เงินเดือน", "salary"],
            ["รายการหัก", "deduct"],
            ["เบี้ยขยัน", "incentive"],
            ["เรท OT/ชม.", "otRate"],
            ["ค่าข้าวปกติ", "food"],
            ["ค่าข้าว OT", "foodOt"],
            ["ค่าน้ำมัน", "gas"],
          ].map(([label, key]) => (
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

      <div className="summary-grid">
        <div className="card primary">
          <div className="card-label-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="card-label">รายรับสุทธิ</div>
            <button 
              onClick={() => setShowSalary(!showSalary)} 
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
            >
              {showSalary ? "👁️" : "🙈"}
            </button>
          </div>
          <div className="card-value">
            ฿ {showSalary 
              ? Math.floor(otSummary.netSalary).toLocaleString() 
              : "******"}
          </div>
        </div>

        <div className="card">
          <div className="card-label">สะสม OT รอบนี้</div>
          <div className="card-value">
            {otSummary.totalHrs.toFixed(1)} ชม.
          </div>
          
          {/* 3. ส่วนแสดง ชม. แยกประเภท x1, x1.5, x3 */}
          <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '0.85rem', margin: '4px 0', color: '#64748b', fontWeight: 'bold' }}>
            <span>x1: {otSummary.hrsX1}</span>
            <span>x1.5: {otSummary.hrsX15}</span>
            <span>x3: {otSummary.hrsX3}</span>
          </div>

          <div className="card-sub">
            {/* 4. ยกเลิกการใช้ showSalary ตรงนี้เพื่อให้โชว์ยอดเงินตลอดเวลา */}
             ฿ {Math.floor(otSummary.otPay).toLocaleString()} 
          </div>
        </div>
      </div>

      <div className="main-grid">
        <form className="form-card" onSubmit={handleAddOt}>
          <h3>บันทึกสถานะรายวัน</h3>
          <input
            type="date"
            value={otForm.date}
            onChange={(e) => setOtForm({ ...otForm, date: e.target.value })}
          />
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
          <textarea
            placeholder="หมายเหตุ..."
            value={otForm.note}
            onChange={(e) => setOtForm({ ...otForm, note: e.target.value })}
          />
          <button type="submit" className="btn-primary">
            {otForm.dayType === "work" ? "บันทึกวันทำงาน" : "บันทึกวันหยุด"}
          </button>
        </form>

        <div className="history-card">
          <div className="history-header">
            <h3>ประวัติ (รอบปัจจุบัน 21-20)</h3>
            <span>สวัสดิการรอบนี้: ฿{otSummary.allowance.toLocaleString()}</span>
          </div>
          <div className="history-list">
            {otSummary.currentCycleData.length > 0 ? (
              otSummary.currentCycleData.map((row, idx) => (
                <div key={idx} className="history-row">
                  <div>
                    <div className="date">
                      {new Date(row[0]).toLocaleDateString("th-TH", { day: "2-digit", month: "short" })}
                    </div>
                    <div className="note">{row[9] || "-"}</div>
                  </div>
                  <div className="right">
                    <div className="detail">{renderOtDetails(row)}</div>
                    <div className="money">
                      ฿
                      {(() => {
                        const isOt15or3 = (Number(row[2]) || 0) > 0 || (Number(row[3]) || 0) > 0;
                        return (
                          ((Number(row[1]) || 0) +
                            Number(row[2]) * 1.5 +
                            Number(row[3]) * 3) *
                            config.otRate +
                          (Number(row[6]) || 0) +
                          (isOt15or3 ? (Number(row[7]) || 0) : 0) +
                          (Number(row[8]) || 0)
                        ).toLocaleString();
                      })()}
                    </div>
                    <button className="btn-delete" onClick={() => handleDeleteOt(row[10])}>
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

      {loading && (
        <div className="overlay">
          <div className="spinner" />
        </div>
      )}
    </div>
  );
}