/* cart.js — หน้าตะกร้า (รองรับรางวัลย่อย) */
renderChrome("");

function render() {
  const FLAT = Storefront.settings.shippingFlat, FREE = Storefront.settings.freeShipMin;
  const root = document.getElementById("cart-root");
  const items = Store.cartItems();
  if (!items.length) {
    root.innerHTML = `<div class="empty"><div class="big">🛒</div><h3>ตะกร้ายังว่างอยู่</h3>
      <p>ไปเลือกของสะสมที่ถูกใจกันก่อนนะครับ</p>
      <p style="margin-top:18px;"><a class="btn btn--primary" href="products">เลือกซื้อสินค้า</a></p></div>`;
    return;
  }
  const subtotal = Store.cartTotal();
  const shipping = subtotal >= FREE ? 0 : FLAT;
  const total = subtotal + shipping;
  root.innerHTML = `
  <p class="muted" style="margin-bottom:20px;">มีสินค้า ${Store.cartCount()} ชิ้นในตะกร้า</p>
  <div class="cart-layout">
    <div class="cart-list">
      ${items.map(cartItemHTML).join("")}
      <button class="ci-remove" id="clear-all" style="align-self:flex-start;margin-top:6px;">🗑 ล้างตะกร้าทั้งหมด</button>
    </div>
    <aside class="summary">
      <h3>สรุปคำสั่งซื้อ</h3>
      <div class="line"><span>ยอดรวมสินค้า</span><span>${formatTHB(subtotal)}</span></div>
      <div class="line"><span>ค่าจัดส่ง</span><span>${shipping === 0 ? "ฟรี" : formatTHB(shipping)}</span></div>
      ${shipping > 0 ? `<p class="muted" style="font-size:.82rem;">ซื้อเพิ่มอีก ${formatTHB(FREE - subtotal)} เพื่อรับสิทธิ์ส่งฟรี</p>` : ""}
      <div class="line line--total"><span>ยอดชำระ</span><span>${formatTHB(total)}</span></div>
      <a href="checkout" class="btn btn--primary btn--block" style="margin-top:16px;">ดำเนินการชำระเงิน</a>
      <a href="products" class="btn btn--ghost btn--block" style="margin-top:10px;">เลือกซื้อต่อ</a>
    </aside>
  </div>`;
  bindEvents();
}

function cartItemHTML(it) {
  const max = it.status === "preorder" ? 99 : 99;
  return `
  <div class="cart-item" data-key="${it.key}">
    <a href="product?id=${it.id}"><img src="${it.img}" alt="${it.name}"></a>
    <div>
      <a class="ci-title" href="product?id=${it.id}">${it.name}</a>
      <div class="ci-series">${it.prize ? "🎁 " + it.prize + (it.opt ? " · " + it.opt : "") : it.series}</div>
      <div class="ci-series" style="font-size:.76rem;color:${it.express ? "#d8453f" : "#8a9099"}">${it.express ? "🚀 ส่งด่วน 7-15 วัน (+1,000)" : "🚚 รับสินค้าตามระบบ"}</div>
      ${it.status === "preorder" ? `<span class="pill pill--preorder" style="margin-top:6px;display:inline-block;">พรีออเดอร์</span>` : ""}
      <br><button class="ci-remove" data-remove="${it.key}">ลบออก</button>
    </div>
    <div class="ci-right">
      <div class="qty">
        <button data-dec="${it.key}">−</button>
        <input value="${it.qty}" data-qty="${it.key}" data-max="${max}" inputmode="numeric">
        <button data-inc="${it.key}">+</button>
      </div>
      <strong>${formatTHB(it.lineTotal)}</strong>
    </div>
  </div>`;
}

function bindEvents() {
  const q = k => (Store.getCart()[k] || {}).qty || 0;
  document.querySelectorAll("[data-inc]").forEach(b => b.onclick = () => { Store.setQty(b.dataset.inc, q(b.dataset.inc) + 1); render(); });
  document.querySelectorAll("[data-dec]").forEach(b => b.onclick = () => { Store.setQty(b.dataset.dec, q(b.dataset.dec) - 1); render(); });
  document.querySelectorAll("[data-qty]").forEach(inp => inp.onchange = () => {
    Store.setQty(inp.dataset.qty, Math.max(0, parseInt(inp.value) || 0)); render();
  });
  document.querySelectorAll("[data-remove]").forEach(b => b.onclick = () => { Store.removeFromCart(b.dataset.remove); showToast("ลบสินค้าออกแล้ว"); render(); });
  const clr = document.getElementById("clear-all");
  if (clr) clr.onclick = () => { if (confirm("ล้างสินค้าทั้งหมดในตะกร้า?")) { Store.clearCart(); render(); } };
}
Storefront.boot(render);
