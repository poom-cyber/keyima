/* app.js — แดชบอร์ดหลังบ้าน */
requireLogin();

let PRODUCTS = [];
let ORDERS = [];
let editingId = null;   // null = เพิ่มใหม่

/* ---------- Toast ---------- */
let tT;
function toast(msg, type = "ok") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast show" + (type === "err" ? " toast--err" : "");
  clearTimeout(tT); tT = setTimeout(() => el.className = "toast", 2400);
}
function THB(n) { return "฿" + Number(n || 0).toLocaleString("th-TH"); }

/* ---------- แท็บ ---------- */
document.querySelectorAll(".side-nav a").forEach(a => {
  a.addEventListener("click", () => {
    document.querySelectorAll(".side-nav a").forEach(x => x.classList.remove("active"));
    a.classList.add("active");
    const tab = a.dataset.tab;
    document.querySelectorAll("[data-panel]").forEach(p => p.hidden = p.dataset.panel !== tab);
    if (tab === "orders") loadOrders();
    if (tab === "settings") loadSettings();
  });
});

document.getElementById("logout").onclick = () => { AdminAPI.clearToken(); location.href = "login.html"; };

/* ================= สินค้า ================= */
async function loadProducts() {
  try {
    PRODUCTS = await AdminAPI.products();
    renderProducts();
  } catch (e) { toast(e.message, "err"); }
}

function statusTag(p) {
  if (p.status === "soldout") return `<span class="tag tag--soldout">หมด</span>`;
  if (p.status === "preorder") return `<span class="tag tag--preorder">พรีออเดอร์</span>`;
  if (p.stock <= 3) return `<span class="tag tag--low">เหลือ ${p.stock}</span>`;
  return `<span class="tag tag--instock">พร้อมส่ง</span>`;
}

function renderProducts() {
  const q = (document.getElementById("prod-search").value || "").toLowerCase();
  const cat = document.getElementById("prod-filter").value;
  let list = PRODUCTS.filter(p =>
    (cat === "all" || p.category === cat) &&
    (!q || p.name.toLowerCase().includes(q) || (p.series || "").toLowerCase().includes(q))
  );
  document.getElementById("prod-count").textContent = `ทั้งหมด ${PRODUCTS.length} รายการ`;
  const tb = document.querySelector("#prod-table tbody");
  tb.innerHTML = list.map(p => `
    <tr>
      <td><img class="thumb" src="${p.img || ''}" alt=""></td>
      <td><strong>${p.name}</strong><br><span class="muted">${p.series || ''}</span></td>
      <td>${p.category === 'kuji' ? 'Kuji' : 'Pokemon'}</td>
      <td>${THB(p.price)}${p.oldPrice ? `<br><span class="muted" style="text-decoration:line-through">${THB(p.oldPrice)}</span>` : ''}</td>
      <td>${p.stock}</td>
      <td>${statusTag(p)}</td>
      <td><div class="row-actions">
        <button class="icon-act" data-edit="${p.id}">แก้ไข</button>
        <button class="icon-act del" data-del="${p.id}">ลบ</button>
      </div></td>
    </tr>`).join("") || `<tr><td colspan="7" style="text-align:center;padding:30px" class="muted">ไม่พบสินค้า</td></tr>`;

  tb.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => openModal(b.dataset.edit));
  tb.querySelectorAll("[data-del]").forEach(b => b.onclick = () => delProduct(b.dataset.del));
}

document.getElementById("prod-search").addEventListener("input", renderProducts);
document.getElementById("prod-filter").addEventListener("change", renderProducts);

async function delProduct(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!confirm(`ลบสินค้า "${p?.name}" ?`)) return;
  try { await AdminAPI.deleteProduct(id); toast("ลบสินค้าแล้ว"); loadProducts(); }
  catch (e) { toast(e.message, "err"); }
}

/* ---------- Modal ---------- */
const modal = document.getElementById("product-modal");
const F = id => document.getElementById("m-" + id);

function openModal(id) {
  editingId = id || null;
  document.getElementById("modal-title").textContent = id ? "แก้ไขสินค้า" : "เพิ่มสินค้า";
  const p = id ? PRODUCTS.find(x => x.id === id) : {};
  F("name").value = p.name || "";
  F("category").value = p.category || "kuji";
  F("series").value = p.series || "";
  F("grade").value = p.grade || "";
  F("status").value = p.status || "instock";
  F("price").value = p.price || "";
  F("oldPrice").value = p.oldPrice || "";
  F("stock").value = p.stock ?? "";
  F("badge").value = p.badge || "";
  F("short").value = p.short || "";
  F("desc").value = p.desc || "";
  F("img").value = p.img || "";
  F("preview").src = p.img || "";
  document.getElementById("upload-status").textContent = "";
  renderVarEditor(p.variations || []);
  modal.hidden = false;
}
function closeModal() { modal.hidden = true; }

document.getElementById("add-product").onclick = () => openModal(null);
document.getElementById("modal-close").onclick = closeModal;
document.getElementById("modal-cancel").onclick = closeModal;
modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });

F("img").addEventListener("input", () => F("preview").src = F("img").value);

/* อัปโหลดรูป */
F("file").addEventListener("change", async () => {
  const file = F("file").files[0];
  if (!file) return;
  const st = document.getElementById("upload-status");
  st.textContent = "กำลังอัปโหลด…";
  try {
    const { url } = await AdminAPI.upload(file);
    F("img").value = url;
    F("preview").src = url;
    st.textContent = "อัปโหลดสำเร็จ ✔";
  } catch (e) { st.textContent = ""; toast(e.message, "err"); }
});

/* บันทึก */
document.getElementById("modal-save").onclick = async () => {
  const payload = {
    name: F("name").value.trim(),
    category: F("category").value,
    series: F("series").value.trim(),
    grade: F("grade").value.trim(),
    status: F("status").value,
    price: F("price").value,
    oldPrice: F("oldPrice").value || null,
    stock: F("stock").value || 0,
    badge: F("badge").value,
    short: F("short").value.trim(),
    desc: F("desc").value.trim(),
    img: F("img").value.trim(),
    variations: collectVariations()
  };
  if (!payload.name || !payload.price) { toast("กรอกชื่อและราคาก่อน", "err"); return; }
  try {
    if (editingId) await AdminAPI.updateProduct(editingId, payload);
    else await AdminAPI.createProduct(payload);
    toast(editingId ? "บันทึกการแก้ไขแล้ว" : "เพิ่มสินค้าแล้ว");
    closeModal(); loadProducts();
  } catch (e) { toast(e.message, "err"); }
};

/* ================= ออเดอร์ ================= */
async function loadOrders() {
  try {
    ORDERS = await AdminAPI.orders();
    const tb = document.querySelector("#order-table tbody");
    document.getElementById("order-count").textContent = `ทั้งหมด ${ORDERS.length} ออเดอร์`;
    tb.innerHTML = ORDERS.map(o => {
      const items = safeItems(o.items);
      const date = new Date(o.createdAt).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
      return `<tr>
        <td><strong>${o.orderNo}</strong><br><span class="muted">${items.length} ชิ้น</span></td>
        <td>${o.name || '-'}<br><span class="muted">${o.email || ''}</span></td>
        <td>${THB(o.total)}</td>
        <td>${o.payment === 'card' ? 'บัตร' : o.payment === 'promptpay' ? 'พร้อมเพย์' : (o.payment||'-')}${o.slip ? '<br><a href="#" class="slip-link" data-slip="'+o.orderNo+'">🧾 ดูสลิป</a>' : '<br><span class="muted" style="font-size:.75rem">— ไม่มีสลิป</span>'}</td>
        <td class="muted">${date}</td>
        <td><span class="tag tag--${o.status}">${statusLabel(o.status)}</span></td>
        <td><select class="input" style="padding:6px 8px" data-order="${o.orderNo}">
          ${["pending","paid","packing","shipped","delivered","cancelled"].map(s => `<option value="${s}" ${o.status === s ? "selected" : ""}>${statusLabel(s)}</option>`).join("")}
        </select></td>
      </tr>`;
    }).join("") || `<tr><td colspan="7" style="text-align:center;padding:30px" class="muted">ยังไม่มีออเดอร์</td></tr>`;

    tb.querySelectorAll("[data-order]").forEach(sel => sel.onchange = async () => {
      try { await AdminAPI.setOrderStatus(sel.dataset.order, sel.value); toast("อัปเดตสถานะแล้ว"); }
      catch (e) { toast(e.message, "err"); }
    });
    tb.querySelectorAll("[data-slip]").forEach(a => a.onclick = (e) => {
      e.preventDefault(); const o = ORDERS.find(x => x.orderNo === a.dataset.slip); showSlip(o && o.slip, o);
    });
  } catch (e) { toast(e.message, "err"); }
}
function safeItems(s){ return Array.isArray(s)?s:(function(){try{return JSON.parse(s)||[]}catch(e){return[]}})(); }
function statusLabel(s) { return ({ pending: "รอตรวจสลิป", paid: "ชำระแล้ว", packing: "กำลังแพ็ก", shipped: "จัดส่งแล้ว", delivered: "ส่งสำเร็จ", cancelled: "ยกเลิก" })[s] || s; }

/* ================= ตั้งค่า ================= */
async function loadSettings() {
  try {
    const s = await AdminAPI.getSettings();
    document.getElementById("s-shopName").value = s.shopName || "";
    document.getElementById("s-promoText").value = s.promo || "";
    document.getElementById("s-shippingFlat").value = s.shippingFlat ?? 60;
    document.getElementById("s-freeShipMin").value = s.freeShipMin ?? 3000;
  } catch (e) { toast(e.message, "err"); }
}
document.getElementById("save-settings").onclick = async () => {
  try {
    await AdminAPI.saveSettings({
      shopName: document.getElementById("s-shopName").value,
      promo: document.getElementById("s-promoText").value,
      shippingFlat: document.getElementById("s-shippingFlat").value,
      freeShipMin: document.getElementById("s-freeShipMin").value
    });
    toast("บันทึกการตั้งค่าแล้ว");
  } catch (e) { toast(e.message, "err"); }
};
document.getElementById("change-pass").onclick = async () => {
  const np = document.getElementById("s-newpass").value;
  if (np.length < 8) { toast("รหัสผ่านต้องยาวอย่างน้อย 8 ตัว", "err"); return; }
  try { await AdminAPI.changePassword(np); document.getElementById("s-newpass").value = ""; toast("เปลี่ยนรหัสผ่านแล้ว"); }
  catch (e) { toast(e.message, "err"); }
};

/* เริ่มต้น */
loadProducts();


/* ---------- ดูสลิป + ยืนยันการชำระเงิน ---------- */
function showSlip(url, order) {
  if (!url) { toast("ออเดอร์นี้ยังไม่มีสลิป", "err"); return; }
  let ov = document.getElementById("slip-ov");
  if (!ov) { ov = document.createElement("div"); ov.id = "slip-ov"; document.body.appendChild(ov); }
  ov.style.cssText = "position:fixed;inset:0;background:rgba(20,20,30,.7);display:grid;place-items:center;z-index:200;padding:20px";
  ov.innerHTML = `<div style="background:#fff;border-radius:16px;max-width:420px;width:100%;max-height:92vh;overflow:auto;padding:18px;text-align:center">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <strong>สลิปการโอน · ${order ? order.orderNo : ""}</strong>
      <button id="slip-x" style="border:none;background:none;font-size:1.2rem;cursor:pointer">✕</button></div>
    <img src="${url}" alt="slip" style="max-width:100%;border-radius:10px;border:1px solid #eee">
    <div style="margin-top:12px;display:flex;gap:8px;justify-content:center">
      <button class="btn btn--primary" id="slip-confirm">✓ ยืนยันชำระเงิน (paid)</button>
      <button class="btn btn--ghost" id="slip-close">ปิด</button></div></div>`;
  const close = () => ov.remove();
  ov.querySelector("#slip-x").onclick = close;
  ov.querySelector("#slip-close").onclick = close;
  ov.onclick = e => { if (e.target === ov) close(); };
  ov.querySelector("#slip-confirm").onclick = async () => {
    try { await AdminAPI.setOrderStatus(order.orderNo, "paid"); toast("ยืนยันชำระเงินแล้ว"); close(); loadOrders(); }
    catch (e) { toast(e.message, "err"); }
  };
}


/* ---------- ตัวแก้รางวัลย่อย (variations) ---------- */
function varRowHTML(v) {
  const e = s => (s || "").replace(/"/g, "&quot;");
  return `<div class="var-row" style="display:grid;grid-template-columns:56px 96px 78px 60px 1fr 26px;gap:6px;align-items:center;margin-bottom:6px">
    <input class="input v-label" placeholder="A" value="${e(v.label)}" style="padding:6px">
    <input class="input v-opt" placeholder="รอบส่ง" value="${e(v.opt)}" style="padding:6px">
    <input class="input v-price" inputmode="numeric" placeholder="฿" value="${v.price || ''}" style="padding:6px">
    <input class="input v-stock" inputmode="numeric" placeholder="0" value="${v.stock ?? ''}" style="padding:6px">
    <input class="input v-img" placeholder="URL รูป (ไม่บังคับ)" value="${e(v.img)}" style="padding:6px">
    <button type="button" class="icon-act del v-del" title="ลบรางวัลนี้">\u2715</button></div>`;
}
function renderVarEditor(vars) {
  const c = document.getElementById("m-variations"); if (!c) return;
  c.innerHTML = (vars || []).map(varRowHTML).join("");
  bindVarDel();
}
function bindVarDel() {
  document.querySelectorAll("#m-variations .v-del").forEach(b => b.onclick = () => b.closest(".var-row").remove());
}
function collectVariations() {
  return [...document.querySelectorAll("#m-variations .var-row")].map(r => ({
    label: r.querySelector(".v-label").value.trim(),
    opt: r.querySelector(".v-opt").value.trim(),
    price: parseInt(r.querySelector(".v-price").value) || 0,
    stock: parseInt(r.querySelector(".v-stock").value) || 0,
    img: r.querySelector(".v-img").value.trim()
  })).filter(v => v.label || v.price);
}
const addVarBtn = document.getElementById("m-add-var");
if (addVarBtn) addVarBtn.addEventListener("click", () => {
  document.getElementById("m-variations").insertAdjacentHTML("beforeend", varRowHTML({}));
  bindVarDel();
});

/* ---------- ปุ่มดึงราคาล่าสุด ---------- */
const syncBtn = document.getElementById("sync-prices");
if (syncBtn) syncBtn.addEventListener("click", async () => {
  const st = document.getElementById("sync-status");
  syncBtn.disabled = true; st.textContent = "กำลังดึงราคา…";
  try {
    const r = await AdminAPI.syncPrices();
    st.textContent = `อัปเดต ${r.count} รายการ${r.updatedAt ? " (ข้อมูล " + r.updatedAt + ")" : ""} \u2714`;
    loadProducts();
  } catch (e) { st.textContent = ""; toast(e.message, "err"); }
  syncBtn.disabled = false;
});
