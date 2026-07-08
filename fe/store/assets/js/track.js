/* track.js — ติดตามคำสั่งซื้อสำหรับ guest (เลขออเดอร์ + อีเมล) */
renderChrome("");
const FLOW = [
  { k: "pending", label: "รอยืนยันชำระเงิน", icon: "⏳" },
  { k: "paid", label: "ชำระเงินแล้ว", icon: "💳" },
  { k: "abroad", label: "เดินทางจากต่างประเทศ", icon: "✈️" },
  { k: "packing", label: "เตรียมส่งในไทย", icon: "📦" },
  { k: "shipped", label: "จัดส่งแล้ว", icon: "🚚" },
  { k: "delivered", label: "ส่งสำเร็จ", icon: "🏠" }
];
const STATUS_TH = Object.fromEntries(FLOW.map(f => [f.k, f.label]).concat([["cancelled", "ยกเลิกคำสั่งซื้อ"]]));

/* progress bar แนวนอน + icon แสดงขั้นตอนคำสั่งซื้อ */
function stepperHTML(status) {
  if (status === "cancelled") return `<div class="note" style="margin:12px 0;">❌ คำสั่งซื้อนี้ถูกยกเลิก</div>`;
  const steps = [{ label: "สั่งซื้อแล้ว", icon: "🛒" }].concat(FLOW);
  const idx = FLOW.findIndex(f => f.k === status);
  const curIdx = idx >= 0 ? idx + 1 : 0;
  return `<div class="track-bar">` + steps.map((s, i) => {
    const cls = i === curIdx ? "cur" : (i < curIdx ? "done" : "todo");
    return `<div class="tb-step ${cls}"><div class="tb-ico">${i < curIdx ? "✓" : s.icon}</div><div class="tb-lbl">${s.label}</div></div>`;
  }).join("") + `</div>`;
}

Storefront.boot(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("no")) document.getElementById("t-no").value = params.get("no");
  if (params.get("email")) document.getElementById("t-email").value = params.get("email");
  document.getElementById("t-btn").addEventListener("click", lookup);
  document.getElementById("t-email").addEventListener("keydown", e => { if (e.key === "Enter") lookup(); });
  renderSaved();
  if (params.get("no") && params.get("email")) lookup();
});

/* รายการคำสั่งซื้อที่จำไว้ในเบราว์เซอร์ (กดดูได้เลยไม่ต้องจำเลข) */
function renderSaved() {
  const box = document.getElementById("t-saved"); if (!box) return;
  let mine = []; try { mine = JSON.parse(localStorage.getItem("kps_myorders") || "[]"); } catch (e) {}
  if (!mine.length) { box.innerHTML = ""; return; }
  box.innerHTML = `<div class="form-card" style="margin-bottom:16px;"><h3>คำสั่งซื้อของคุณ</h3>
    ${mine.map(m => `<button class="btn btn--ghost btn--block" style="margin-top:8px;text-align:left;" data-mno="${m.no}" data-memail="${m.email}">#${m.no} · ${formatTHB(m.total)} · ${new Date(m.date).toLocaleDateString("th-TH")}</button>`).join("")}</div>`;
  box.querySelectorAll("[data-mno]").forEach(b => b.onclick = () => {
    document.getElementById("t-no").value = b.dataset.mno;
    document.getElementById("t-email").value = b.dataset.memail;
    lookup();
  });
}

async function lookup() {
  const no = (document.getElementById("t-no").value || "").trim();
  const email = (document.getElementById("t-email").value || "").trim();
  const res = document.getElementById("t-result");
  if (!no || !email) { showToast("กรอกเลขคำสั่งซื้อและอีเมล", "err"); return; }
  res.innerHTML = `<p class="muted">กำลังค้นหา…</p>`;
  try {
    const r = await fetch(Storefront.base() + "/api/orders/track?no=" + encodeURIComponent(no) + "&email=" + encodeURIComponent(email));
    const o = await r.json();
    if (!r.ok) { res.innerHTML = `<div class="note">⚠️ ${o.message || "ไม่พบคำสั่งซื้อ"}</div>`; return; }
    res.innerHTML = `
      <div class="form-card">
        <h3>คำสั่งซื้อ #${o.orderNo}</h3>
        ${stepperHTML(o.status)}
        <div class="pdp-meta">
          ${o.tracking ? `<div class="row"><span>เลขพัสดุ</span><strong>${o.tracking}</strong></div>` : ""}
          <div class="row"><span>ยอดรวม</span><span>${formatTHB(o.total)}</span></div>
          <div class="row"><span>วันที่สั่ง</span><span>${new Date(o.createdAt).toLocaleString("th-TH")}</span></div>
        </div>
        <div style="margin-top:12px;">
          ${(o.items || []).map(it => `<div class="muted" style="font-size:.85rem;padding:3px 0;">• ${it.name}${it.prize ? " (" + it.prize + ")" : ""} × ${it.qty}${it.ship ? " · " + it.ship : ""}</div>`).join("")}
        </div>
        ${(!o.hasSlip && o.status === "pending") ? slipUploadHTML() : ""}
      </div>`;
    if (!o.hasSlip && o.status === "pending") bindSlipUpload(o.orderNo, email);
  } catch (e) { res.innerHTML = `<div class="note">เกิดข้อผิดพลาด ลองใหม่อีกครั้ง</div>`; }
}

/* กล่องแนบสลิป (โชว์เฉพาะออเดอร์ที่ยังไม่มีสลิป + รอชำระ) */
function slipUploadHTML() {
  const line = (window.APP_CONFIG && window.APP_CONFIG.LINE_URL) || "";
  return `<div style="margin-top:14px;padding:14px;border:1px dashed #d8453f;border-radius:12px;background:#fff7f6;">
    <div style="font-weight:700;color:#d8453f;margin-bottom:2px;">ยังไม่ได้แนบสลิปการโอน</div>
    <div class="muted" style="font-size:.85rem;margin-bottom:10px;">แนบสลิปที่นี่ เพื่อให้เรายืนยันการชำระเงินได้เร็วขึ้น</div>
    <input id="slip-file" type="file" accept="image/*" style="display:block;width:100%;margin-bottom:6px;">
    <div id="slip-prev" style="text-align:center;"></div>
    <button class="btn btn--primary btn--block" id="slip-send" style="margin-top:8px;" disabled>อัปโหลดสลิป</button>
    ${line ? `<a class="btn btn--ghost btn--block" href="${line}" target="_blank" rel="noopener" style="margin-top:8px;">💬 หรือส่งสลิปทาง LINE</a>` : ""}
  </div>`;
}

function bindSlipUpload(no, email) {
  const file = document.getElementById("slip-file");
  const btn = document.getElementById("slip-send");
  const prev = document.getElementById("slip-prev");
  if (!file || !btn) return;
  let data = "";
  file.addEventListener("change", e => {
    const f = e.target.files[0];
    if (!f) { data = ""; btn.disabled = true; prev.innerHTML = ""; return; }
    if (f.size > 2500000) { showToast("รูปใหญ่เกินไป (เกิน ~2MB)", "err"); file.value = ""; return; }
    const rd = new FileReader();
    rd.onload = () => { data = rd.result; btn.disabled = false; prev.innerHTML = `<img src="${data}" alt="slip" style="max-width:200px;border-radius:10px;margin:8px 0;">`; };
    rd.readAsDataURL(f);
  });
  btn.addEventListener("click", async () => {
    if (!data) return;
    btn.disabled = true; btn.textContent = "กำลังอัปโหลด…";
    try {
      const r = await fetch(Storefront.base() + "/api/orders/track/slip", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ no, email, slip: data })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { showToast(j.message || "อัปโหลดไม่สำเร็จ", "err"); btn.disabled = false; btn.textContent = "อัปโหลดสลิป"; return; }
      showToast("แนบสลิปเรียบร้อย ✓", "ok");
      lookup();
    } catch (e) { showToast("เกิดข้อผิดพลาด ลองใหม่", "err"); btn.disabled = false; btn.textContent = "อัปโหลดสลิป"; }
  });
}
