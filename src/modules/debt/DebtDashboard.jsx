import { useEffect, useMemo, useState } from "react";
import { API_URL } from "../../config/api";
import "./debt.css";

// ============================================================
//  HELPERS
// ============================================================

/** แปลงตัวเลขเป็นสกุลเงินบาท เช่น 1234 → ฿1,234 */
function currency(n) {
  return "฿" + Number(n || 0).toLocaleString("th-TH");
}

/** แสดงวันที่โดยแทน - ด้วย / เพื่อให้อ่านง่าย */
function showDate(d) {
  if (!d) return "";
  return d.replace(/-/g, "/");
}

/**
 * แปลงวันที่เป็น YYYY-MM สำหรับใช้ filter เดือน
 * รองรับทั้ง DD/MM/YYYY และ YYYY-MM-DD
 */
function ym(d) {
  if (!d) return "";
  if (d.includes("/") && d.indexOf("/") <= 2) {
    const [, m, y] = d.split("/");
    return `${y}-${String(m).padStart(2, "0")}`;
  }
  return d.slice(0, 7);
}

/** คืนค่าวันนี้ในรูปแบบ YYYY-MM-DD */
function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** คืน array ของ YYYY-MM ย้อนหลัง n เดือน (เรียงเก่า→ใหม่) */
function lastNMonths(n = 6) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

/** คืน YYYY-MM ของเดือนถัดไป */
function getNextMonthYM() {
  const d = new Date();
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

// ============================================================
//  COMPONENT
// ============================================================

export default function DebtDashboard() {

  // ── State: ข้อมูลหลัก ──────────────────────────────────────
  const [cards, setCards]   = useState([]);   // รายการบัตรเครดิต
  const [debts, setDebts]   = useState([]);   // รายการหนี้/บิลทั้งหมด

  // ── State: แท็บ ────────────────────────────────────────────
  const [tab, setTab] = useState("add"); // "add" | "cards"

  // ── State: ฟอร์มเพิ่มบัตร ──────────────────────────────────
  const [cardName,   setCardName]   = useState("");
  const [cutOffDay,  setCutOffDay]  = useState("");

  // ── State: ฟอร์มเพิ่มรายการ ────────────────────────────────
  const [date,           setDate]           = useState(todayISO());
  const [sourceType,     setSourceType]     = useState("bill");    // "bill" | "credit"
  const [selectedCardId, setSelectedCardId] = useState("");        // บัตรสำหรับ credit txn
  const [installCardId,  setInstallCardId]  = useState("");        // บัตรสำหรับ installment
  const [itemName,       setItemName]       = useState("");
  const [isInstallment,  setIsInstallment]  = useState(false);
  const [amount,         setAmount]         = useState("");
  const [perMonth,       setPerMonth]       = useState("");
  const [months,         setMonths]         = useState("");

  // ── State: UI ──────────────────────────────────────────────
  const [openPlanId,    setOpenPlanId]    = useState(null);  // slide panel ที่เปิดอยู่
  const [showNextMonth, setShowNextMonth] = useState(false); // toggle ดูเดือนถัดไป

  // ── State: ฟิลเตอร์ ────────────────────────────────────────
  const months6     = useMemo(() => lastNMonths(6), []);
  const [filterMonth,  setFilterMonth]  = useState(ym(todayISO()));
  const [filterStatus, setFilterStatus] = useState("all"); // "all" | "paid" | "unpaid"

  // ============================================================
  //  DATA FETCHING
  // ============================================================

  /** โหลดรายการบัตรเครดิต (มี cache ใน localStorage) */
  async function loadCards() {
    const cached = localStorage.getItem("cache_cards");
    if (cached) setCards(JSON.parse(cached));
    try {
      const res  = await fetch(`${API_URL}?mode=cards`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setCards(list);
      localStorage.setItem("cache_cards", JSON.stringify(list));
    } catch (e) {
      console.error("loadCards error", e);
      if (!cached) alert("โหลดข้อมูลบัตรไม่สำเร็จ กรุณารีเฟรชหน้า");
    }
  }

  /** โหลดรายการหนี้/บิลทั้งหมด (มี cache ใน localStorage) */
  async function loadDebts() {
    const cached = localStorage.getItem("cache_debt");
    if (cached) setDebts(JSON.parse(cached));
    try {
      const res  = await fetch(`${API_URL}?mode=debt`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setDebts(list);
      localStorage.setItem("cache_debt", JSON.stringify(list));
    } catch (e) {
      console.error("loadDebts error", e);
      if (!cached) alert("โหลดข้อมูลหนี้ไม่สำเร็จ กรุณารีเฟรชหน้า");
    }
  }

  // โหลดข้อมูลครั้งแรกเมื่อ component mount
  useEffect(() => {
    loadCards();
    loadDebts();
  }, []);

  // ============================================================
  //  ACTIONS: บัตรเครดิต
  // ============================================================

  /** เพิ่มบัตรเครดิตใหม่ */
  async function addCard() {
    if (!cardName.trim()) return alert("กรอกชื่อบัตร");
    const day = Number(cutOffDay);
    if (!day || day < 1 || day > 31) return alert("วันตัดรอบต้องอยู่ระหว่าง 1-31");

    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ type: "add_card", name: cardName.trim(), cutOffDay: day }),
    });

    setCardName("");
    setCutOffDay("");
    await loadCards();
  }

  /** ลบบัตรเครดิต */
  async function deleteCard(cardId) {
    if (!window.confirm("ลบบัตรนี้?")) return;
    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ type: "delete_card", cardId }),
    });
    await loadCards();
  }

  // ============================================================
  //  ACTIONS: รายการหนี้/บิล
  // ============================================================

  /** เพิ่มรายการใหม่ (บิล / บัตรเครดิต / ผ่อน) */
  async function addItem() {
    if (!itemName.trim()) return alert("กรอกชื่อรายการ");

    if (!isInstallment) {
      // ── บิลหรือบัตรเครดิตปกติ ──
      if (!amount || Number(amount) <= 0) return alert("กรอกจำนวนเงิน");

      if (sourceType === "bill") {
        await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({
            type:     "add_debt",
            date,
            debtType: "bill",
            name:     itemName.trim(),
            category: "",
            amount:   Number(amount),
            paid:     false,
            note:     "",
          }),
        });
      } else {
        // บัตรเครดิต
        if (!selectedCardId) return alert("เลือกบัตรเครดิต");
        await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({
            type:     "add_credit_txn",
            usedDate: date,
            cardId:   selectedCardId,
            name:     itemName.trim(),
            category: "",
            amount:   Number(amount),
          }),
        });
      }
    } else {
      // ── ผ่อนชำระ ──
      if (!perMonth || Number(perMonth) <= 0) return alert("กรอกยอดต่อเดือน");
      if (!months  || Number(months)   <= 0) return alert("กรอกจำนวนเดือน");

      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          type:      "add_installment_plan",
          startDate: date,
          name:      itemName.trim(),
          category:  installCardId, // เก็บ cardId ไว้ใน category
          perMonth:  Number(perMonth),
          months:    Number(months),
        }),
      });
    }

    // reset ฟอร์ม
    setItemName("");
    setAmount("");
    setPerMonth("");
    setMonths("");
    setSelectedCardId("");
    setInstallCardId("");
    await loadDebts();
  }

  /** ลบรายการหนี้/บิล */
  async function deleteDebt(id) {
    if (!window.confirm("ลบรายการนี้?")) return;
    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ type: "delete_debt", id }),
    });
    await loadDebts();
  }

  /** สลับสถานะจ่าย/ค้างจ่าย */
  async function togglePaid(id) {
    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ type: "toggle_debt_paid", id }),
    });
    await loadDebts();
  }

  /** จ่ายทุกรายการของเดือนที่เลือก (ไม่รวมผ่อน) */
  async function payAllThisMonth() {
    if (!window.confirm("ต้องการจ่ายทุกรายการของเดือนนี้หรือไม่? (ไม่รวมผ่อน)")) return;

    const targets = debts.filter(
      (r) => r[2] !== "installment" && ym(r[1]) === filterMonth && r[6] !== "yes"
    );

    // ทำทีละรายการเพื่อหลีกเลี่ยง race condition
    for (const r of targets) {
      try {
        await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ type: "toggle_debt_paid", id: r[0] }),
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (e) {
        console.error("Toggle error:", e);
      }
    }
    await loadDebts();
  }

  // ============================================================
  //  ACTIONS: ผ่อนชำระ
  // ============================================================

  /** ลบแผนผ่อนทั้งหมด (ลบทุกงวด) */
  // ใหม่ ✅
  async function deletePlan(plan) {
    if (!window.confirm("ลบทั้งแผนผ่อนนี้? (จะลบทุกงวด)")) return;
    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        type: "delete_debt_bulk",
        ids: plan.map((r) => r[0]),
      }),
    });
    setOpenPlanId(null);
    await loadDebts();
  }

  /** จ่ายงวดปัจจุบัน (งวดที่ยังไม่จ่าย งวดเล็กสุด) */
  async function payCurrentInstallment(plan) {
    const sorted = plan.slice().sort((a, b) => Number(a[9]) - Number(b[9]));
    const target = sorted.find((r) => r[6] !== "yes");
    if (!target) return alert("แผนนี้จ่ายครบแล้ว");

    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ type: "toggle_debt_paid", id: target[0] }),
    });
    await loadDebts();
  }

  // ============================================================
  //  COMPUTED: ผ่อนชำระ
  // ============================================================

  /** จัดกลุ่มรายการผ่อนตาม planId → [[งวด...], [งวด...], ...] */
  const installmentPlans = useMemo(() => {
    const map = {};
    debts.forEach((r) => {
      if (r[2] === "installment" && r[8]) {
        if (!map[r[8]]) map[r[8]] = [];
        map[r[8]].push(r);
      }
    });
    return Object.values(map);
  }, [debts]);

  /** ยอดผ่อนรวมต่อเดือน (เฉพาะแผนที่ยังไม่ครบ) */
  const installmentMonthlyTotal = useMemo(() => {
    return installmentPlans.reduce((sum, plan) => {
      const hasUnpaid = plan.some((r) => r[6] !== "yes");
      return hasUnpaid ? sum + Number(plan[0][5] || 0) : sum;
    }, 0);
  }, [installmentPlans]);

  /** Preview ยอดรวมผ่อนจากฟอร์ม */
  const installmentTotalPreview = useMemo(
    () => Number(perMonth || 0) * Number(months || 0),
    [perMonth, months]
  );

  // ============================================================
  //  COMPUTED: สรุปเดือน
  // ============================================================

  /** รายการของเดือนที่เลือก (ไม่รวมผ่อน) */
  const monthRows = useMemo(
    () => debts.filter((r) => r[2] !== "installment" && ym(r[1]) === filterMonth),
    [debts, filterMonth]
  );

  const monthTotal   = useMemo(() => monthRows.reduce((s, r) => s + Number(r[5] || 0), 0), [monthRows]);
  const monthPaid    = useMemo(() => monthRows.filter((r) => r[6] === "yes").reduce((s, r) => s + Number(r[5] || 0), 0), [monthRows]);
  const monthUnpaid  = useMemo(() => monthTotal - monthPaid, [monthTotal, monthPaid]);
  const monthPercent = monthTotal > 0 ? Math.round((monthPaid / monthTotal) * 100) : 0;

  // ============================================================
  //  COMPUTED: กราฟ
  // ============================================================

  /** ข้อมูลกราฟ 6 เดือนย้อนหลัง */
  const chartData = useMemo(() => {
    const map = Object.fromEntries(months6.map((m) => [m, 0]));
    debts.forEach((r) => {
      if (r[2] === "installment") return;
      const k = ym(r[1]);
      if (k in map) map[k] += Number(r[5] || 0);
    });
    return months6.map((m) => ({ m, v: map[m] }));
  }, [debts, months6]);

  const maxChart = Math.max(1, ...chartData.map((d) => d.v));

  // ============================================================
  //  COMPUTED: รายการที่กรองแล้ว
  // ============================================================

  const filteredRows = useMemo(() => {
    // เลือกเดือนปัจจุบันหรือเดือนถัดไป
    const targetYM = showNextMonth ? getNextMonthYM() : filterMonth;

    return debts
      .filter((r) => r[2] !== "installment")
      .filter((r) => ym(r[1]) === targetYM)
      .filter((r) => {
        if (filterStatus === "paid")   return r[6] === "yes";
        if (filterStatus === "unpaid") return r[6] !== "yes";
        return true;
      });
  }, [debts, filterMonth, filterStatus, showNextMonth]);

  // ============================================================
  //  RENDER
  // ============================================================

  return (
    <div className="debt-page">
      <h2 className="page-title">Debt & Bills</h2>

      {/* ── สรุปเดือน ── */}
      <div className="card-box">
        <h3>สรุปเดือน {filterMonth}</h3>
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

        {/* Progress Bar */}
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

      {/* ── กราฟ ── */}
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

      {/* ── Tab Navigation ── */}
      <div className="tab-row">
        <button
          className={tab === "add" ? "tab active" : "tab"}
          onClick={() => setTab("add")}
        >
          เพิ่มรายการ
        </button>
        <button
          className={tab === "cards" ? "tab active" : "tab"}
          onClick={() => setTab("cards")}
        >
          จัดการบัตรเครดิต
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════
          TAB: จัดการบัตรเครดิต
      ══════════════════════════════════════════════════════ */}
      {tab === "cards" && (
        <div className="card-box">
          <h3>จัดการบัตรเครดิต</h3>

          {/* ฟอร์มเพิ่มบัตร */}
          <div className="form-row">
            <input
              placeholder="ชื่อบัตร"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
            />
            <input
              type="number"
              placeholder="วันตัดรอบ (1-31)"
              min="1"
              max="31"
              value={cutOffDay}
              onChange={(e) => setCutOffDay(e.target.value)}
            />
            <button className="btn-add" onClick={addCard}>
              + เพิ่มบัตร
            </button>
          </div>

          {/* รายการบัตร */}
          <div className="card-list">
            {cards.length === 0 && <div className="empty">ยังไม่มีบัตร</div>}
            {cards.map((c) => (
              <div className="card-row" key={c.cardId}>
                <div>
                  <b>{c.name}</b> (ตัดรอบ {c.cutOffDay})
                </div>
                <button className="btn-delete" onClick={() => deleteCard(c.cardId)}>
                  ลบ
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB: เพิ่มรายการ
      ══════════════════════════════════════════════════════ */}
      {tab === "add" && (
        <>
          {/* ── ฟอร์มเพิ่มรายการ ── */}
          <div className="card-box">
            <h3>เพิ่มรายการ</h3>
            <div className="form-grid">

              {/* วันที่ */}
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />

              {/* ประเภท: บิล / บัตรเครดิต */}
              <select value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
                <option value="bill">บิล / เงินสด</option>
                <option value="credit">บัตรเครดิต</option>
              </select>

              {/* ✅ ย้ายขึ้นมา: ประเภท ผ่อน/ไม่ผ่อน */}
              <select
                value={isInstallment ? "yes" : "no"}
                onChange={(e) => setIsInstallment(e.target.value === "yes")}
              >
                <option value="no">ไม่ผ่อน</option>
                <option value="yes">ผ่อน</option>
              </select>

              {/* เลือกบัตร (credit + ไม่ผ่อน) */}
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

              {/* เลือกบัตรที่ผ่อน (credit + ผ่อน) */}
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

              {/* ชื่อรายการ */}
              <input
                placeholder="ชื่อรายการ (เช่น ค่าไฟ / ประกัน)"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
              />

              {/* จำนวนเงิน (ไม่ผ่อน) */}
              {!isInstallment && (
                <input
                  type="number"
                  placeholder="จำนวนเงิน"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              )}

              {/* ยอดต่อเดือน + จำนวนเดือน (ผ่อน) */}
              {isInstallment && (
                <>
                  <input
                    type="number"
                    placeholder="ยอดต่อเดือน"
                    value={perMonth}
                    onChange={(e) => setPerMonth(e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="จำนวนเดือน"
                    value={months}
                    onChange={(e) => setMonths(e.target.value)}
                  />
                  <div className="muted">
                    ยอดรวม: <b>{currency(installmentTotalPreview)}</b>
                  </div>
                </>
              )}

              {/* ปุ่มเพิ่ม */}
              <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "center", marginTop: "10px" }}>
                <button className="btn-add" onClick={addItem}>
                  + เพิ่มรายการ
                </button>
              </div>
            </div>
          </div>

          {/* ── 2-column: ผ่อน + รายการทั้งหมด ── */}
          <div className="card-container">

            {/* ── รายการผ่อน (ซ้าย) ── */}
            {installmentPlans.length > 0 && (
              <div className="card-box-1">
                <h3>รายการผ่อน</h3>
                <div className="installment-grid">
                  {installmentPlans.map((plan, idx) => {
                    const planId      = plan[0][8];
                    const total       = plan.length;
                    const paid        = plan.filter((r) => r[6] === "yes").length;
                    const percent     = Math.round((paid / total) * 100);
                    const name        = plan[0][3];
                    const per         = Number(plan[0][5]);
                    const isOpen      = openPlanId === planId;
                    const planCardId  = plan[0][4];
                    const planCardName = cards.find((c) => c.cardId === planCardId)?.name;

                    return (
                      <div key={idx} className="install-wrap">

                        {/* การ์ดผ่อน (คลิกเพื่อขยาย/ยุบ) */}
                        <div
                          className="install-card clickable"
                          onClick={() => setOpenPlanId(isOpen ? null : planId)}
                        >
                          <div className="title">
                            {name} <span className="chev">{isOpen ? "▾" : "▸"}</span>
                          </div>

                          {/* ชื่อบัตรที่ผ่อน */}
                          {planCardName && (
                            <div className="muted" style={{ fontSize: "0.72rem", color: "var(--accent)", marginBottom: "2px" }}>
                              💳 {planCardName}
                            </div>
                          )}

                          <div className="muted">{paid}/{total} งวด</div>

                          {/* Progress bar */}
                          <div className="bar">
                            <div className="bar-fill" style={{ width: `${percent}%` }} />
                          </div>
                          <div className="row">
                            <span>{percent}%</span>
                            <span>{currency(per)} / เดือน</span>
                          </div>
                          <div className="muted">รวม {currency(per * total)}</div>

                          {/* ปุ่มจ่าย / ลบ */}
                          <div className="row actions">
                            <button
                              className="btn primary"
                              onClick={(e) => { e.stopPropagation(); payCurrentInstallment(plan); }}
                            >
                              จ่ายงวดนี้
                            </button>
                            <button
                              className="btn danger"
                              onClick={(e) => { e.stopPropagation(); deletePlan(plan); }}
                            >
                              ลบทั้งแผน
                            </button>
                          </div>
                        </div>

                        {/* Slide panel: รายละเอียดแต่ละงวด */}
                        <div className={`slide-panel ${isOpen ? "open" : ""}`}>
                          <div className="slide-inner">
                            {plan
                              .slice()
                              .sort((a, b) => Number(a[9]) - Number(b[9]))
                              .map((r, i) => (
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
                                    <button className="btn"        onClick={() => togglePaid(r[0])}>สลับสถานะ</button>
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

            {/* ── รายการทั้งหมด (ขวา) ── */}
            <div className="card-box-2">
              <h3>รายการทั้งหมด</h3>

              {/* Filter bar */}
              <div className="filter-row">
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  {/* เลือกเดือน */}
                  <select
                    value={filterMonth}
                    disabled={showNextMonth}
                    onChange={(e) => { setFilterMonth(e.target.value); setShowNextMonth(false); }}
                  >
                    {months6.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>

                  {/* Toggle ดูเดือนถัดไป */}
                  <button
                    className={`btn-month ${showNextMonth ? "active" : ""}`}
                    onClick={() => setShowNextMonth(!showNextMonth)}
                    style={{
                      padding:      "6px 12px",
                      background:   showNextMonth ? "var(--accent)" : "#e0e7ff",
                      color:        showNextMonth ? "white" : "var(--text-primary)",
                      border:       "none",
                      borderRadius: "4px",
                      cursor:       "pointer",
                      fontWeight:   "500",
                    }}
                  >
                    📅 เดือนถัดไป
                  </button>
                </div>

                {/* กรองสถานะ */}
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">ทั้งหมด</option>
                  <option value="paid">จ่ายแล้ว</option>
                  <option value="unpaid">ค้างจ่าย</option>
                </select>
              </div>

              {/* ตารางรายการ */}
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
                        <button className="btn"        onClick={() => togglePaid(r[0])}>สลับสถานะ</button>
                      </div>
                    </div>
                  </div>
                ))}

                {filteredRows.length === 0 && (
                  <div className="empty">ไม่พบรายการตามตัวกรอง</div>
                )}
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
