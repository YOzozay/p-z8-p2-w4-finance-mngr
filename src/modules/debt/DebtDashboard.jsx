import { useEffect, useMemo, useState } from "react";
import { API_URL } from "../../config/api";
import "./debt.css";

// ---------- helpers ----------
function currency(n) {
  const num = Number(n || 0);
  return "฿" + num.toLocaleString("th-TH");
}
function showDate(d) {
  if (!d) return "";
  return d.replace(/-/g, "/");
}
function ym(d) {
  if (!d) return "";
  // ✅ แก้: เช็ค format DD/MM/YYYY (/ อยู่ตำแหน่ง index <= 2)
  if (d.includes("/") && d.indexOf("/") <= 2) {
    const parts = d.split("/");
    const y = parts[2];
    const m = String(parts[1]).padStart(2, "0");
    return `${y}-${m}`;
  }
  return d.slice(0, 7);
}
function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function lastNMonths(n = 6) {
  const res = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    res.push(`${y}-${m}`);
  }
  return res;
}

// ---------- component ----------
export default function DebtDashboard() {
  const [tab, setTab] = useState("add");
  const [cards, setCards] = useState([]);
  const [debts, setDebts] = useState([]);

  const [cardName, setCardName] = useState("");
  const [cutOffDay, setCutOffDay] = useState("");

  const [date, setDate] = useState(todayISO());
  const [sourceType, setSourceType] = useState("bill");
  const [selectedCardId, setSelectedCardId] = useState("");
  const [itemName, setItemName] = useState("");
  const [isInstallment, setIsInstallment] = useState(false);
  const [installCardId, setInstallCardId] = useState("");
  const [amount, setAmount] = useState("");
  const [perMonth, setPerMonth] = useState("");
  const [months, setMonths] = useState("");

  const [openPlanId, setOpenPlanId] = useState(null);

  const months6 = useMemo(() => lastNMonths(6), []);
  const [filterMonth, setFilterMonth] = useState(ym(todayISO()));
  const [filterStatus, setFilterStatus] = useState("all");
  // ✅ เพิ่ม: state สำหรับฟิลเตอร์เดือนถัดไป
  const [showNextMonth, setShowNextMonth] = useState(false);

  // ✅ เพิ่ม: function คำนวณเดือนถัดไป
  const getNextMonthDate = () => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const y = nextMonth.getFullYear();
    const m = String(nextMonth.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  };

  // ---- load ----
  async function loadCards() {
    const cached = localStorage.getItem("cache_cards");
    if (cached) setCards(JSON.parse(cached));
    try {
      const res = await fetch(`${API_URL}?mode=cards`);
      const data = await res.json();
      setCards(Array.isArray(data) ? data : []);
      localStorage.setItem("cache_cards", JSON.stringify(data));
    } catch (e) {
      console.error("loadCards error", e);
      if (!cached) alert("โหลดข้อมูลบัตรไม่สำเร็จ กรุณารีเฟรชหน้า");
    }
  }

  async function loadDebts() {
    const cached = localStorage.getItem("cache_debt");
    if (cached) setDebts(JSON.parse(cached));
    try {
      const res = await fetch(`${API_URL}?mode=debt`);
      const data = await res.json();
      setDebts(Array.isArray(data) ? data : []);
      localStorage.setItem("cache_debt", JSON.stringify(data));
    } catch (e) {
      console.error("loadDebts error", e);
      if (!cached) alert("โหลดข้อมูลหนี้ไม่สำเร็จ กรุณารีเฟรชหน้า");
    }
  }

  useEffect(() => {
    loadCards();
    loadDebts();
  }, []);

  // ---- actions: cards ----
  async function addCard() {
    if (!cardName.trim()) return alert("กรอกชื่อบัตร");
    const d = Number(cutOffDay);
    if (!d || d < 1 || d > 31) return alert("วันตัดรอบต้องอยู่ระหว่าง 1-31");
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ type: "add_card", name: cardName.trim(), cutOffDay: d }),
    });
    setCardName("");
    setCutOffDay("");
    await loadCards();
  }

  async function deleteCard(cardId) {
    if (!window.confirm("ลบบัตรนี้?")) return;
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ type: "delete_card", cardId }),
    });
    await loadCards();
  }

  async function deleteDebt(id) {
    if (!window.confirm("ลบรายการนี้?")) return;
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ type: "delete_debt", id }),
    });
    await loadDebts();
  }

  async function togglePaid(id) {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ type: "toggle_debt_paid", id }),
    });
    await loadDebts();
  }

  async function payAllThisMonth() {
    if (!window.confirm("ต้องการจ่ายทุกรายการของเดือนนี้หรือไม่? (ไม่รวมผ่อน)")) return;
    const targets = debts.filter(
      (r) => r[2] !== "installment" && ym(r[1]) === filterMonth && r[6] !== "yes"
    );
    // ✅ แก้: ทำทีละรายการ รอให้เสร็จ
    for (const r of targets) {
      try {
        await fetch(API_URL, {
          method: "POST",
          body: JSON.stringify({ type: "toggle_debt_paid", id: r[0] }),
        });
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (e) {
        console.error("Toggle error:", e);
      }
    }
    await loadDebts();
  }

  async function addItem() {
    if (!itemName.trim()) return alert("กรอกชื่อรายการ");

    if (!isInstallment) {
      if (!amount || Number(amount) <= 0) return alert("กรอกจำนวนเงิน");
      if (sourceType === "bill") {
        await fetch(API_URL, {
          method: "POST",
          body: JSON.stringify({
            type: "add_debt",
            date,
            debtType: "bill",
            name: itemName.trim(),
            category: "",
            amount: Number(amount),
            paid: false,
            note: "",
          }),
        });
      } else {
        if (!selectedCardId) return alert("เลือกบัตรเครดิต");
        await fetch(API_URL, {
          method: "POST",
          body: JSON.stringify({
            type: "add_credit_txn",
            usedDate: date,
            cardId: selectedCardId,
            name: itemName.trim(),
            category: "",
            amount: Number(amount),
          }),
        });
      }
    } else {
      if (!perMonth || Number(perMonth) <= 0) return alert("กรอกยอดต่อเดือน");
      if (!months || Number(months) <= 0) return alert("กรอกจำนวนเดือน");
      await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
          type: "add_installment_plan",
          startDate: date,
          name: itemName.trim(),
          category: installCardId,
          perMonth: Number(perMonth),
          months: Number(months),
        }),
      });
    }

    setItemName("");
    setAmount("");
    setPerMonth("");
    setMonths("");
    setSelectedCardId("");
    setInstallCardId("");
    await loadDebts();
  }

  const installmentPlans = useMemo(() => {
    const map = {};
    debts.forEach((r) => {
      const type = r[2];
      const planId = r[8];
      if (type === "installment" && planId) {
        if (!map[planId]) map[planId] = [];
        map[planId].push(r);
      }
    });
    return Object.values(map);
  }, [debts]);

  const installmentMonthlyTotal = useMemo(() => {
    return installmentPlans.reduce((sum, plan) => {
      const hasUnpaid = plan.some((r) => r[6] !== "yes");
      if (!hasUnpaid) return sum;
      return sum + Number(plan[0][5] || 0);
    }, 0);
  }, [installmentPlans]);

  const installmentTotalPreview = useMemo(() => {
    return Number(perMonth || 0) * Number(months || 0);
  }, [perMonth, months]);

  const currentYM = filterMonth;
  const monthRows = useMemo(
    () => debts.filter((r) => r[2] !== "installment" && ym(r[1]) === currentYM),
    [debts, currentYM]
  );
  const monthTotal = useMemo(() => monthRows.reduce((s, r) => s + Number(r[5] || 0), 0), [monthRows]);
  const monthPaid = useMemo(
    () => monthRows.filter((r) => r[6] === "yes").reduce((s, r) => s + Number(r[5] || 0), 0),
    [monthRows]
  );
  const monthUnpaid = useMemo(() => monthTotal - monthPaid, [monthTotal, monthPaid]);
  const monthPercent = monthTotal > 0 ? Math.round((monthPaid / monthTotal) * 100) : 0;

  const chartData = useMemo(() => {
    const map = {};
    months6.forEach((m) => (map[m] = 0));
    debts.forEach((r) => {
      if (r[2] === "installment") return;
      const k = ym(r[1]);
      if (map[k] != null) map[k] += Number(r[5] || 0);
    });
    return months6.map((m) => ({ m, v: map[m] || 0 }));
  }, [debts, months6]);

  const maxChart = Math.max(1, ...chartData.map((d) => d.v));

  // ✅ แก้: filteredRows - เพิ่มตรวจสอบ showNextMonth
  const filteredRows = useMemo(() => {
    let res = debts.filter((r) => r[2] !== "installment");

    if (showNextMonth) {
      const nextMonthYM = getNextMonthDate();
      res = res.filter((r) => ym(r[1]) === nextMonthYM);
    } else {
      res = res.filter((r) => ym(r[1]) === filterMonth);
    }

    res = res.filter((r) => {
      if (filterStatus === "paid") return r[6] === "yes";
      if (filterStatus === "unpaid") return r[6] !== "yes";
      return true;
    });

    return res;
  }, [debts, filterMonth, filterStatus, showNextMonth]);

  async function deletePlan(plan) {
    if (!window.confirm("ลบทั้งแผนผ่อนนี้? (จะลบทุกงวด)")) return;
    // ✅ แก้: ลบทีละงวด แล้วรอให้เสร็จ เพื่อหลีกเลี่ยง race condition
    for (const r of plan) {
      try {
        await fetch(API_URL, {
          method: "POST",
          body: JSON.stringify({ type: "delete_debt", id: r[0] }),
        });
        // เล็กน้อยของเวลาเพื่อให้ delete เสร็จ
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        console.error("Delete error:", e);
      }
    }
    setOpenPlanId(null);
    await loadDebts();
  }

  async function payCurrentInstallment(plan) {
    const sorted = plan.slice().sort((a, b) => Number(a[9]) - Number(b[9]));
    const target = sorted.find((r) => r[6] !== "yes");
    if (!target) return alert("แผนนี้จ่ายครบแล้ว");
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ type: "toggle_debt_paid", id: target[0] }),
    });
    await loadDebts();
  }

  return (
    <div className="debt-page">
      <h2 className="page-title">Debt & Bills</h2>

      <div className="card-box">
        <h3>สรุปเดือน {currentYM}</h3>
        <div className="summary-grid">
          <div className="sum-card">
            <div className="label">ต้องจ่าย</div>
            <div className="value">{currency(monthTotal + installmentMonthlyTotal)}</div>
            {installmentMonthlyTotal > 0 && (
              <div className="muted">
                บิล {currency(monthTotal)} + ผ่อน {currency(installmentMonthlyTotal)}
              </div>
            )}
          </div>
          <div className="sum-card ok">
            <div className="label">จ่ายแล้ว</div>
            <div className="value">{currency(monthPaid)}</div>
          </div>
          <div className="sum-card wait">
            <div className="label">ค้างจ่าย</div>
            <div className="value">{currency(monthUnpaid)}</div>
          </div>
        </div>
        <div className="progress-wrap">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${monthPercent}%` }} />
          </div>
          <div className="muted">{monthPercent}%</div>
        </div>
        <button className="btn primary" onClick={payAllThisMonth}>
          💸 จ่ายทั้งหมดของเดือนนี้
        </button>
      </div>

      <div className="card-box">
        <h3>กราฟยอดต้องจ่ายย้อนหลัง 6 เดือน</h3>
        <div className="chart">
          {chartData.map((d) => (
            <div key={d.m} className="bar-col">
              <div className="bar" style={{ height: `${(d.v / maxChart) * 100}%` }} />
              <div className="bar-label">{d.m}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="tab-row">
        <button className={tab === "add" ? "tab active" : "tab"} onClick={() => setTab("add")}>
          เพิ่มรายการ
        </button>
        <button className={tab === "cards" ? "tab active" : "tab"} onClick={() => setTab("cards")}>
          จัดการบัตรเครดิต
        </button>
      </div>

      {tab === "cards" && (
        <div className="card-box">
          <h3>จัดการบัตรเครดิต</h3>
          <div className="form-row">
            <input placeholder="ชื่อบัตร" value={cardName} onChange={(e) => setCardName(e.target.value)} />
            <input
              placeholder="วันตัดรอบ (1-31)"
              type="number"
              min="1"
              max="31"
              value={cutOffDay}
              onChange={(e) => setCutOffDay(e.target.value)}
            />
            <button className="btn-add" onClick={addCard}>+ เพิ่มบัตร</button>
          </div>
          <div className="card-list">
            {cards.length === 0 && <div className="empty">ยังไม่มีบัตร</div>}
            {cards.map((c) => (
              <div className="card-row" key={c.cardId}>
                <div><b>{c.name}</b> (ตัดรอบ {c.cutOffDay})</div>
                <button className="btn-delete" onClick={() => deleteCard(c.cardId)}>ลบ</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "add" && (
        <>
          <div className="card-box">
            <h3>เพิ่มรายการ</h3>
            <div className="form-grid">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <select value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
                <option value="bill">บิล / เงินสด</option>
                <option value="credit">บัตรเครดิต</option>
              </select>

              {sourceType === "credit" && !isInstallment && (
                <select value={selectedCardId} onChange={(e) => setSelectedCardId(e.target.value)}>
                  <option value="">-- เลือกบัตร --</option>
                  {cards.map((c) => (
                    <option key={c.cardId} value={c.cardId}>
                      {c.name} (ตัดรอบ {c.cutOffDay})
                    </option>
                  ))}
                </select>
              )}

              {/* ✅ เพิ่ม: แสดงบัตรเมื่อเลือก credit + ผ่อน */}
              {sourceType === "credit" && isInstallment && (
                <select value={installCardId} onChange={(e) => setInstallCardId(e.target.value)}>
                  <option value="">-- เลือกบัตรที่ผ่อน --</option>
                  {cards.map((c) => (
                    <option key={c.cardId} value={c.cardId}>
                      {c.name} (ตัดรอบ {c.cutOffDay})
                    </option>
                  ))}
                </select>
              )}

              <input
                placeholder="ชื่อรายการ (เช่น ค่าไฟ / ประกัน)"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
              />

              <select value={isInstallment ? "yes" : "no"} onChange={(e) => setIsInstallment(e.target.value === "yes")}>
                <option value="no">ไม่ผ่อน</option>
                <option value="yes">ผ่อน</option>
              </select>

              {!isInstallment && (
                <input type="number" placeholder="จำนวนเงิน" value={amount} onChange={(e) => setAmount(e.target.value)} />
              )}

              {isInstallment && (
                <>
                  <input type="number" placeholder="ยอดต่อเดือน" value={perMonth} onChange={(e) => setPerMonth(e.target.value)} />
                  <input type="number" placeholder="จำนวนเดือน" value={months} onChange={(e) => setMonths(e.target.value)} />
                  <div className="muted">ยอดรวม: <b>{currency(installmentTotalPreview)}</b></div>
                </>
              )}

              <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "center", marginTop: "10px" }}>
                <button className="btn-add" onClick={addItem}>+ เพิ่มรายการ</button>
              </div>
            </div>
          </div>

          <div className="card-container">
            {installmentPlans.length > 0 && (
              <div className="card-box-1">
                <h3>รายการผ่อน</h3>
                <div className="installment-grid">
                  {installmentPlans.map((plan, idx) => {
                    const planId = plan[0][8];
                    const total = plan.length;
                    const paid = plan.filter((r) => r[6] === "yes").length;
                    const percent = Math.round((paid / total) * 100);
                    const name = plan[0][3];
                    const per = Number(plan[0][5]);
                    const sum = per * total;
                    const isOpen = openPlanId === planId;
                    const planCardId = plan[0][4];
                    const planCardName = cards.find((c) => c.cardId === planCardId)?.name;

                    return (
                      <div key={idx} className="install-wrap">
                        <div className="install-card clickable" onClick={() => setOpenPlanId(isOpen ? null : planId)}>
                          <div className="title">{name} <span className="chev">{isOpen ? "▾" : "▸"}</span></div>
                          {planCardName && (
                            <div className="muted" style={{ fontSize: "0.72rem", color: "var(--accent)", marginBottom: "2px" }}>
                              💳 {planCardName}
                            </div>
                          )}
                          <div className="muted">{paid}/{total} งวด</div>
                          <div className="bar">
                            <div className="bar-fill" style={{ width: `${percent}%` }} />
                          </div>
                          <div className="row">
                            <span>{percent}%</span>
                            <span>{currency(per)} / เดือน</span>
                          </div>
                          <div className="muted">รวม {currency(sum)}</div>
                          <div className="row actions">
                            <button className="btn primary" onClick={(e) => { e.stopPropagation(); payCurrentInstallment(plan); }}>
                              จ่ายงวดนี้
                            </button>
                            <button className="btn danger" onClick={(e) => { e.stopPropagation(); deletePlan(plan); }}>
                              ลบทั้งแผน
                            </button>
                          </div>
                        </div>

                        <div className={`slide-panel ${isOpen ? "open" : ""}`}>
                          <div className="slide-inner">
                            {plan.slice().sort((a, b) => Number(a[9]) - Number(b[9])).map((r, i) => (
                              <div className="install-row" key={i}>
                                <div>งวด {r[9]} / {r[10]}</div>
                                <div>{showDate(r[1])}</div>
                                <div>{currency(r[5])}</div>
                                <div>
                                  {r[6] === "yes"
                                    ? <span className="badge ok">จ่ายแล้ว</span>
                                    : <span className="badge wait">ค้างจ่าย</span>}
                                </div>
                                <div>
                                  <button className="btn-delete" onClick={() => deleteDebt(r[0])}>ลบ</button>
                                  <button className="btn" onClick={() => togglePaid(r[0])}>สลับสถานะ</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="card-box-2">
              <h3>รายการทั้งหมด</h3>
              <div className="filter-row">
                {/* ✅ เพิ่ม: ตัวเลือกสำหรับเดือนถัดไป */}
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <select 
                    value={filterMonth} 
                    onChange={(e) => {
                      setFilterMonth(e.target.value);
                      setShowNextMonth(false);
                    }}
                    disabled={showNextMonth}
                  >
                    {months6.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <button 
                    className={`btn-month ${showNextMonth ? 'active' : ''}`}
                    onClick={() => setShowNextMonth(!showNextMonth)}
                    style={{
                      padding: "6px 12px",
                      background: showNextMonth ? "var(--accent)" : "#e0e7ff",
                      color: showNextMonth ? "white" : "var(--text-primary)",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontWeight: "500"
                    }}
                  >
                    📅 เดือนถัดไป
                  </button>
                </div>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="all">ทั้งหมด</option>
                  <option value="paid">จ่ายแล้ว</option>
                  <option value="unpaid">ค้างจ่าย</option>
                </select>
              </div>

              <div className="table">
                <div className="thead">
                  <div>วันที่</div>
                  <div>รายการ</div>
                  <div>ประเภท</div>
                  <div>จำนวนเงิน</div>
                  <div>สถานะ</div>
                </div>
                {filteredRows.map((r, i) => (
                  <div className="trow" key={i}>
                    <div>{showDate(r[1])}</div>
                    <div>{r[3]}</div>
                    <div>
                      {r[2] === "credit"
                        ? <span className="badge" style={{ background: "#dbeafe", color: "#1d4ed8" }}>💳 บัตรเครดิต</span>
                        : <span className="badge" style={{ background: "#f0fdf4", color: "#15803d" }}>🧾 บิล</span>}
                    </div>
                    <div>{currency(r[5])}</div>
                    <div className="action-group">
                      <div className="status-badge">
                        {r[6] === "yes"
                          ? <span className="badge ok">จ่ายแล้ว</span>
                          : <span className="badge wait">ค้างจ่าย</span>}
                      </div>
                      <div className="button-group">
                        <button className="btn-delete" onClick={() => deleteDebt(r[0])}>ลบ</button>
                        <button className="btn" onClick={() => togglePaid(r[0])}>สลับสถานะ</button>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredRows.length === 0 && <div className="empty">ไม่พบรายการตามตัวกรอง</div>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}