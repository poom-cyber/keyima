/* track.js — ติดตามคำสั่งซื้อสำหรับ guest (เลขออเดอร์ + อีเมล) */
renderChrome("");
const STATUS_TH = { pending: "รอตรวจสอบการชำระเงิน", paid: "ชำระเงินแล้ว", packing: "กำลังแพ็กสินค้า", shipped: "จัดส่งแล้ว", delivered: "ส่งสำเร็จ", cancelled: "ยกเลิกคำสั่งซื้อ" };

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
    const st = STATUS_TH[o.status] || o.status;
    res.innerHTML = `
      <div class="form-card">
        <h3>คำสั่งซื้อ #${o.orderNo}</h3>
        <div class="pdp-meta">
          <div class="row"><span>สถานะ</span><strong style="color:#d8453f;">${st}</strong></div>
          ${o.tracking ? `<div class="row"><span>เลขพัสดุ</span><strong>${o.tracking}</strong></div>` : ""}
          <div class="row"><span>ยอดรวม</span><span>${formatTHB(o.total)}</span></div>
          <div class="row"><span>วันที่สั่ง</span><span>${new Date(o.createdAt).toLocaleString("th-TH")}</span></div>
        </div>
        <div style="margin-top:12px;">
          ${(o.items || []).map(it => `<div class="muted" style="font-size:.85rem;padding:3px 0;">• ${it.name}${it.prize ? " (" + it.prize + ")" : ""} × ${it.qty}${it.ship ? " · " + it.ship : ""}</div>`).join("")}
        </div>
      </div>`;
  } catch (e) { res.innerHTML = `<div class="note">เกิดข้อผิดพลาด ลองใหม่อีกครั้ง</div>`; }
}
