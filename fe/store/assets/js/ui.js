/* ============================================================
   ui.js — ส่วนประกอบ UI ร่วม (header, footer, toast, การ์ดสินค้า)
   ============================================================ */
const LOGO_SVG = `<span class="brand-logo"><svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="57" fill="#fbf3cf" stroke="#d8453f" stroke-width="4"/><text x="60" y="60" text-anchor="middle" font-family="'Noto Sans Thai',sans-serif" font-weight="700" font-size="34"><tspan fill="#d8453f">可</tspan><tspan fill="#2f7fb0">以</tspan><tspan fill="#d8453f">吗</tspan></text><text x="60" y="88" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="15" letter-spacing="1"><tspan fill="#2f7fb0">KE </tspan><tspan fill="#d8453f">YI </tspan><tspan fill="#2f7fb0">MA</tspan></text></svg></span>`;

function renderChrome(activePage) {
  const line = (window.APP_CONFIG && window.APP_CONFIG.LINE_URL) || "#";
  const header = `
  <header class="site-header">
    <div class="container header-inner">
      <a href="/" class="brand">${LOGO_SVG}<span class="brand-text"><strong>KEYIMA</strong></span></a>
      <nav class="main-nav">
        <a href="/" class="${activePage === 'home' ? 'active' : ''}">หน้าแรก</a>
        <a href="products?cat=kuji" class="${activePage === 'kuji' ? 'active' : ''}">Ichiban Kuji</a>
        <a href="products?cat=pokemon" class="${activePage === 'pokemon' ? 'active' : ''}">การ์ดโปเกม่อน</a>
        <a href="products?status=preorder" class="${activePage === 'preorder' ? 'active' : ''}">พรีออเดอร์</a>
      </nav>
      <div class="header-actions">
        <a href="products" class="icon-btn" aria-label="ค้นหา" title="ค้นหาสินค้า">🔍</a>
        <a href="account" class="icon-btn" aria-label="บัญชี" title="บัญชีของฉัน">👤</a>
        <a href="cart" class="icon-btn cart-link" aria-label="ตะกร้า" title="ตะกร้าสินค้า">🛒<span class="cart-badge" data-cart-badge>0</span></a>
      </div>
    </div>
  </header>`;

  const footer = `
  <footer class="site-footer">
    <div class="container footer-grid">
      <div>
        <div class="brand brand--footer">${LOGO_SVG}<span class="brand-text"><strong>KEYIMA</strong></span></div>
        <p class="muted">ร้านฟิกเกอร์ Ichiban Kuji รางวัลใหญ่ และการ์ด/ของสะสมของแท้จากญี่ปุ่น พร้อมส่งและพรีออเดอร์</p>
      </div>
      <div><h4>หมวดสินค้า</h4>
        <a href="products?cat=kuji">Ichiban Kuji</a>
        <a href="products?cat=pokemon">การ์ดโปเกม่อน</a>
        <a href="products?status=preorder">สินค้าพรีออเดอร์</a>
      </div>
      <div><h4>ช่วยเหลือ</h4>
        <a href="/">วิธีสั่งซื้อ</a><a href="/">การจัดส่ง</a><a href="/">การรับประกันของแท้</a>
      </div>
      <div><h4>ติดต่อ</h4>
        <a href="${line}" target="_blank" rel="noopener">💬 แอดไลน์ร้าน</a>
        <a href="${line}" target="_blank" rel="noopener">ส่งสลิป / สอบถาม</a>
      </div>
    </div>
    <div class="container footer-bottom muted">© 2026 KEYIMA · ของแท้ญี่ปุ่น 100%</div>
  </footer>`;

  const headerSlot = document.getElementById("site-header");
  const footerSlot = document.getElementById("site-footer");
  if (headerSlot) headerSlot.innerHTML = header;
  if (footerSlot) footerSlot.innerHTML = footer;
  Store.updateBadge();
}

/* ---------- Toast ---------- */
let toastTimer;
function showToast(message, type = "ok") {
  let el = document.getElementById("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; document.body.appendChild(el); }
  el.textContent = message;
  el.className = "toast show " + (type === "err" ? "toast--err" : "toast--ok");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = "toast"; }, 2200);
}

/* ---------- ป้ายสถานะ ---------- */
function statusBadge(p) {
  if (p.status === "soldout") return `<span class="pill pill--soldout">สินค้าหมด</span>`;
  if (p.status === "preorder") return `<span class="pill pill--preorder">พรีออเดอร์</span>`;
  if (p.stock > 0 && p.stock <= 3) return `<span class="pill pill--low">เหลือ ${p.stock} ชิ้น</span>`;
  return `<span class="pill pill--instock">พร้อมส่ง</span>`;
}
function cornerBadge(p) {
  if (p.badge === "new") return `<span class="corner corner--new">ใหม่</span>`;
  if (p.badge === "hot") return `<span class="corner corner--hot">ฮอต</span>`;
  return "";
}

/* ---------- การ์ดสินค้า (hover เลื่อนภาพรางวัลย่อย) ---------- */
function productCard(p) {
  const vs = (p.variations && p.variations.length) ? p.variations : [];
  const many = vs.length > 1;
  const imgs = [p.img, ...vs.map(v => v.img), ...(p.images || [])].filter((u, i, a) => u && a.indexOf(u) === i).slice(0, 8);
  const priceBlock = (p.priceMax && p.priceMax > p.price)
    ? `<span class="price"><small class="price-from">เริ่ม</small> ${formatTHB(p.price)}</span>`
    : `<span class="price">${formatTHB(p.price)}</span>`;
  const btn = p.status === "soldout"
    ? `<button class="btn btn--ghost btn--sm" disabled>สินค้าหมด</button>`
    : many ? `<a class="btn btn--primary btn--sm" href="product?id=${p.id}">เลือกรางวัล</a>`
           : `<button class="btn btn--primary btn--sm" data-add="${p.id}">ใส่ตะกร้า</button>`;
  return `
  <article class="card">
    <a class="card-media" href="product?id=${p.id}" data-imgs='${JSON.stringify(imgs).replace(/'/g, "%27")}'>
      ${cornerBadge(p)}
      <img src="${p.img}" alt="${p.name}" loading="lazy">
      ${many ? `<span class="card-prizecount">🎁 ${vs.length} รางวัล</span>` : ""}
    </a>
    <div class="card-body">
      <div class="card-meta">${statusBadge(p)} <span class="muted">${p.series}</span></div>
      <a class="card-title" href="product?id=${p.id}">${p.name}</a>
      <div class="card-foot"><div class="price-wrap">${priceBlock}</div>${btn}</div>
    </div>
  </article>`;
}

/* ---------- hover → เลื่อนภาพรางวัลย่อยในการ์ด ---------- */
function bindCardHover() {
  document.querySelectorAll(".card-media[data-imgs]").forEach(a => {
    if (a._hoverBound) return; a._hoverBound = true;
    let imgs = []; try { imgs = JSON.parse(a.getAttribute("data-imgs")); } catch (e) {}
    const img = a.querySelector("img");
    if (!img || imgs.length < 2) return;
    let i = 0, timer = null;
    a.addEventListener("mouseenter", () => { clearInterval(timer); timer = setInterval(() => { i = (i + 1) % imgs.length; img.src = imgs[i]; }, 650); });
    a.addEventListener("mouseleave", () => { clearInterval(timer); i = 0; img.src = imgs[0]; });
  });
}

/* ปุ่ม "ใส่ตะกร้า" (สินค้ารางวัลเดียว) + ผูก hover */
function bindAddButtons() {
  document.querySelectorAll("[data-add]").forEach(btn => {
    if (btn._addBound) return; btn._addBound = true;
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-add");
      const ok = Store.addToCart(id, 0, 1);
      const p = Store.findProduct(id);
      showToast(ok ? `เพิ่ม "${(p ? p.name : "").slice(0, 26)}…" ลงตะกร้าแล้ว` : "ไม่สามารถเพิ่มสินค้าได้", ok ? "ok" : "err");
    });
  });
  bindCardHover();
}
function bindCards() { bindAddButtons(); }

window.renderChrome = renderChrome;
window.showToast = showToast;
window.productCard = productCard;
window.bindAddButtons = bindAddButtons;
window.bindCards = bindCards;
window.bindCardHover = bindCardHover;
window.statusBadge = statusBadge;
window.cornerBadge = cornerBadge;
