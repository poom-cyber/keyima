/* checkout.js — ที่อยู่ครบ + จ่ายด้วย QR พร้อมเพย์ + แนบสลิป + LINE (ออเดอร์สถานะ "รอตรวจสอบ") */
renderChrome("");
const root = document.getElementById("checkout-root");
let items, subtotal, shipping, total, slipData = "";

Storefront.boot(() => {
  items = Store.cartItems();
  subtotal = Store.cartTotal();
  shipping = subtotal >= Storefront.settings.freeShipMin ? 0 : Storefront.settings.shippingFlat;
  total = subtotal + shipping;
  if (!items.length) {
    root.innerHTML = `<div class="empty"><div class="big">🛒</div><h3>ยังไม่มีสินค้าในตะกร้า</h3>
      <p><a class="btn btn--primary" href="products">เลือกซื้อสินค้า</a></p></div>`;
    return;
  }
  renderForm();
});

function renderForm() {
  const cfg = window.APP_CONFIG || {};
  const ppId = (cfg.PROMPTPAY_ID || "").replace(/[^0-9]/g, "");
  const qr = ppId ? `https://promptpay.io/${ppId}/${total}.png` : "";
  root.innerHTML = `
  <div class="checkout-layout">
    <div>
      <div class="form-card"><h3>ข้อมูลการจัดส่ง</h3>
        <div class="form-grid">
          <div class="field"><label>ชื่อ *</label><input id="f-first"></div>
          <div class="field"><label>นามสกุล *</label><input id="f-last"></div>
          <div class="field"><label>เบอร์โทร *</label><input id="f-phone" inputmode="tel"></div>
          <div class="field"><label>อีเมล *</label><input id="f-email" type="email"></div>
          <div class="field full"><label>ที่อยู่ (บ้านเลขที่ / หมู่ / ซอย / ถนน) *</label><input id="f-addr"></div>
          <div class="field"><label>ตำบล / แขวง *</label><input id="f-subdist"></div>
          <div class="field"><label>อำเภอ / เขต *</label><input id="f-district"></div>
          <div class="field"><label>จังหวัด *</label><input id="f-province"></div>
          <div class="field"><label>รหัสไปรษณีย์ *</label><input id="f-zip" inputmode="numeric"></div>
          <div class="field full"><label>หมายเหตุถึงร้าน (ถ้ามี)</label><textarea id="f-note" rows="2"></textarea></div>
        </div>
      </div>
      <div class="form-card"><h3>ชำระเงิน — สแกน QR พร้อมเพย์</h3>
        <div style="text-align:center;">
          ${qr ? `<img src="${qr}" alt="PromptPay QR" style="width:220px;max-width:70%;border:1px solid #eee;border-radius:12px;padding:8px;background:#fff;">`
               : `<div class="note">⚠️ ยังไม่ได้ตั้งเลขพร้อมเพย์ของร้าน — ใส่ <code>PROMPTPAY_ID</code> ใน assets/js/config.js</div>`}
          <p style="margin:12px 0 2px;font-weight:800;font-size:1.1rem;">ยอดโอน ${formatTHB(total)}</p>
          <p class="muted" style="font-size:.85rem;">สแกนจ่ายแล้ว "แนบสลิป" ด้านล่าง หรือส่งสลิปทาง LINE</p>
        </div>
        <div class="field full" style="margin-top:12px;"><label>แนบสลิปการโอน (รูปภาพ)</label><input id="f-slip" type="file" accept="image/*"></div>
        <div id="slip-preview" style="text-align:center;"></div>
        ${cfg.LINE_URL ? `<a class="btn btn--ghost btn--block" href="${cfg.LINE_URL}" target="_blank" rel="noopener" style="margin-top:8px;">💬 ส่งสลิป / สอบถามทาง LINE</a>` : ""}
      </div>
    </div>
    <aside class="summary">
      <h3>คำสั่งซื้อของคุณ</h3>
      <div style="margin:8px 0 14px;">
        ${items.map(it => `<div class="mini-summary-item"><img src="${it.img}" alt="">
          <div style="flex:1;"><div style="font-size:.86rem;font-weight:600;line-height:1.3;">${it.name.slice(0, 38)}${it.name.length > 38 ? "…" : ""}</div>
          <div class="muted" style="font-size:.78rem;">${it.prize ? "🎁 " + it.prize + " · " : ""}x${it.qty}</div></div>
          <strong style="font-size:.9rem;">${formatTHB(it.lineTotal)}</strong></div>`).join("")}
      </div>
      <div class="line"><span>ยอดรวมสินค้า</span><span>${formatTHB(subtotal)}</span></div>
      <div class="line"><span>ค่าจัดส่ง</span><span>${shipping === 0 ? "ฟรี" : formatTHB(shipping)}</span></div>
      <div class="line line--total"><span>ยอดชำระ</span><span>${formatTHB(total)}</span></div>
      <button class="btn btn--primary btn--block" id="pay-btn" style="margin-top:16px;">ยืนยันสั่งซื้อ ${formatTHB(total)}</button>
      <p class="muted" style="font-size:.8rem;text-align:center;margin-top:10px;">เราจะยืนยันออเดอร์หลังตรวจสอบสลิป</p>
    </aside>
  </div>`;

  document.getElementById("f-slip").addEventListener("change", e => {
    const f = e.target.files[0];
    if (!f) { slipData = ""; document.getElementById("slip-preview").innerHTML = ""; return; }
    if (f.size > 2.5 * 1024 * 1024) { showToast("ไฟล์ใหญ่เกิน 2.5MB", "err"); e.target.value = ""; return; }
    const rd = new FileReader();
    rd.onload = () => { slipData = rd.result; document.getElementById("slip-preview").innerHTML = `<img src="${slipData}" alt="slip" style="max-width:180px;border-radius:10px;margin-top:10px;">`; };
    rd.readAsDataURL(f);
  });
  document.getElementById("pay-btn").addEventListener("click", submit);
}

const val = id => (document.getElementById(id).value || "").trim();

async function submit() {
  const req = ["f-first", "f-last", "f-phone", "f-email", "f-addr", "f-subdist", "f-district", "f-province", "f-zip"];
  for (const id of req) { if (!val(id)) { document.getElementById(id).focus(); showToast("กรอกข้อมูลจัดส่งให้ครบ (รวมตำบล/อำเภอ)", "err"); return; } }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val("f-email"))) { showToast("อีเมลไม่ถูกต้อง", "err"); return; }
  const btn = document.getElementById("pay-btn"); btn.disabled = true; btn.textContent = "กำลังบันทึก…";
  const payload = {
    name: val("f-first") + " " + val("f-last"), phone: val("f-phone"), email: val("f-email"),
    address: val("f-addr"), subdist: val("f-subdist"), district: val("f-district"), province: val("f-province"), zip: val("f-zip"),
    note: val("f-note"), payment: "promptpay", slip: slipData,
    items: items.map(it => ({ id: it.id, idx: it.idx, qty: it.qty }))
  };
  const saved = await Storefront.createOrder(payload);
  if (!saved || !saved.orderNo) { btn.disabled = false; btn.textContent = "ยืนยันสั่งซื้อ " + formatTHB(total); showToast("บันทึกออเดอร์ไม่สำเร็จ — เช็กว่าเซิร์ฟเวอร์รันอยู่", "err"); return; }
  Store.clearCart();
  const cfg = window.APP_CONFIG || {};
  root.innerHTML = `
  <div class="success-box"><div class="check">✓</div><h2>รับออเดอร์แล้ว!</h2>
    <p class="muted">ขอบคุณ ${payload.name} — เราจะยืนยันหลังตรวจสอบสลิป</p>
    <div class="form-card" style="max-width:420px;margin:24px auto;text-align:left;"><div class="pdp-meta" style="border:none;margin:0;padding:0;">
      <div class="row"><span>เลขที่คำสั่งซื้อ</span><strong>${saved.orderNo}</strong></div>
      <div class="row"><span>ยอดชำระ</span><strong>${formatTHB(saved.total || total)}</strong></div>
      <div class="row"><span>สถานะ</span><span>รอตรวจสอบการชำระเงิน</span></div>
    </div></div>
    ${!slipData && cfg.LINE_URL
      ? `<p class="muted">ยังไม่ได้แนบสลิป — ส่งให้เราทาง LINE ได้เลย</p><p><a class="btn btn--primary" href="${cfg.LINE_URL}" target="_blank" rel="noopener">💬 ส่งสลิปทาง LINE</a> <a class="btn btn--ghost" href="/">กลับหน้าแรก</a></p>`
      : `<p style="margin-top:18px;"><a class="btn btn--primary" href="/">กลับหน้าแรก</a></p>`}
  </div>`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}
