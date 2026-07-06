/* account.js — บัญชีลูกค้า (ต่อ storefront-api ผ่าน Storefront.auth) */
renderChrome("");

const root = document.getElementById("acct-root");
const STATUS = { paid: "ชำระแล้ว", packing: "กำลังแพ็ก", shipped: "จัดส่งแล้ว", delivered: "ส่งสำเร็จ", cancelled: "ยกเลิก" };
const FLOW = ["paid", "packing", "shipped", "delivered"];
let authMode = "login";

Storefront.boot(() => {
  if (Storefront.isLoggedIn()) renderAccount();
  else renderAuth();
});

function renderAuth() {
  root.innerHTML = `
  <div class="auth-card">
    <h1 style="font-size:1.4rem;font-weight:800;text-align:center">บัญชี KEYIMA</h1>
    <p class="muted" style="text-align:center;margin-bottom:18px">เข้าสู่ระบบเพื่อดูประวัติและติดตามคำสั่งซื้อ</p>
    <div class="tabsw">
      <button class="${authMode === 'login' ? 'on' : ''}" onclick="authMode='login';renderAuth()">เข้าสู่ระบบ</button>
      <button class="${authMode === 'register' ? 'on' : ''}" onclick="authMode='register';renderAuth()">สมัครสมาชิก</button>
    </div>
    ${authMode === 'register' ? `<div class="field" style="margin-bottom:12px"><label>ชื่อ-นามสกุล</label><input id="a-name"></div>` : ''}
    <div class="field" style="margin-bottom:12px"><label>อีเมล</label><input id="a-email" type="email"></div>
    ${authMode === 'register' ? `<div class="field" style="margin-bottom:12px"><label>เบอร์โทร (ไม่บังคับ)</label><input id="a-phone"></div>` : ''}
    <div class="field" style="margin-bottom:14px"><label>รหัสผ่าน${authMode === 'register' ? ' (อย่างน้อย 6 ตัว)' : ''}</label><input id="a-pass" type="password"></div>
    <p id="a-err" style="color:var(--accent);font-size:.85rem;min-height:18px;margin:0 0 8px"></p>
    <button class="btn btn--primary btn--block" id="a-go">${authMode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}</button>
    <p class="muted" style="text-align:center;font-size:.8rem;margin-top:12px">เชื่อมกับเซิร์ฟเวอร์จริง — ใช้ข้ามอุปกรณ์ได้</p>
  </div>`;
  document.getElementById("a-go").onclick = doAuth;
}

async function doAuth() {
  const err = document.getElementById("a-err");
  const btn = document.getElementById("a-go");
  err.textContent = ""; btn.disabled = true;
  try {
    if (authMode === "login") {
      await Storefront.login(document.getElementById("a-email").value.trim(), document.getElementById("a-pass").value);
    } else {
      await Storefront.register({
        name: document.getElementById("a-name").value.trim(),
        email: document.getElementById("a-email").value.trim(),
        phone: document.getElementById("a-phone").value.trim(),
        password: document.getElementById("a-pass").value
      });
    }
    showToast("ยินดีต้อนรับ 🎉");
    renderAccount();
  } catch (e) {
    err.textContent = e.message; btn.disabled = false;
  }
}

async function renderAccount() {
  root.innerHTML = `<p class="muted" style="padding:30px 0">กำลังโหลดบัญชี…</p>`;
  let me, orders;
  try { me = await Storefront.me(); orders = await Storefront.myOrders(); }
  catch (e) {
    if (!Storefront.isLoggedIn()) return renderAuth();
    root.innerHTML = `<div class="empty"><p>เชื่อมเซิร์ฟเวอร์ไม่ได้: ${e.message}</p><p class="muted">ตรวจว่ารัน storefront-api อยู่</p></div>`;
    return;
  }
  const ordersHTML = orders.length ? orders.map(orderCard).join("")
    : `<div class="empty"><div class="big">🧾</div><h3>ยังไม่มีคำสั่งซื้อ</h3><p><a class="btn btn--primary" href="products">เลือกซื้อสินค้า</a></p></div>`;
  root.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin:28px 0 18px;flex-wrap:wrap;gap:10px">
    <div><h1 style="font-size:1.5rem;font-weight:800;margin:0">สวัสดี ${me.name}</h1><p class="muted" style="margin:0">${me.email}${me.phone ? " · " + me.phone : ""}</p></div>
    <button class="btn btn--ghost btn--sm" onclick="Storefront.logout();location.reload()">ออกจากระบบ</button>
  </div>
  <h3 style="margin-bottom:12px">ประวัติคำสั่งซื้อ (${orders.length})</h3>
  ${ordersHTML}`;
}

function orderCard(o) {
  const idx = FLOW.indexOf(o.status);
  const steps = FLOW.map((s, k) => `<div class="step ${o.status !== 'cancelled' && idx >= k ? 'done' : ''}"><div class="b">${o.status !== 'cancelled' && idx >= k ? '✓' : k + 1}</div>${STATUS[s]}</div>`).join("");
  return `<div class="ord">
    <div class="top"><div><strong>${o.orderNo}</strong> <span class="muted" style="font-size:.82rem">· ${new Date(o.createdAt).toLocaleDateString("th-TH")}</span></div><span class="stag">${STATUS[o.status] || o.status}</span></div>
    ${o.status === 'cancelled' ? '' : `<div class="steps">${steps}</div>`}
    ${o.tracking ? `<p class="muted" style="font-size:.84rem">เลขพัสดุ: <b style="color:var(--ink)">${o.tracking}</b></p>` : ''}
    <div style="margin-top:8px">${(o.items || []).slice(0, 3).map(it => `<div style="display:flex;gap:10px;align-items:center;padding:4px 0"><img src="${it.img}" style="width:40px;height:40px;border-radius:8px;object-fit:cover"><div style="flex:1;font-size:.85rem">${it.name.slice(0, 36)}<br><span class="muted">${it.prize || ''}${it.opt ? ' · ' + it.opt : ''} ×${it.qty}</span></div><span style="font-size:.85rem">${formatTHB(it.price * it.qty)}</span></div>`).join("")}</div>
    <div style="display:flex;justify-content:space-between;border-top:1px solid var(--line);margin-top:10px;padding-top:10px;font-weight:800"><span>ยอดรวม</span><span>${formatTHB(o.total)}</span></div>
  </div>`;
}
