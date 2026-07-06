/* store.js — ตะกร้า (รองรับเลือกรางวัลย่อย) เก็บใน localStorage key kps_cart
   รูปแบบใหม่: { "<id>|<idx>": { id, idx, qty } } */
const CART_KEY = "kps_cart";

function vlistOf(p) {
  return (p && p.variations && p.variations.length)
    ? p.variations
    : [{ label: "", opt: "", price: p ? p.price : 0, stock: p ? p.stock : 0, img: p ? p.img : "" }];
}
function prizeLabel(v) {
  const l = (v.label || "").toLowerCase();
  if (!v.label && !v.opt) return "";
  if (l.startsWith("last")) return "Last One";
  if (/^[a-z]$/.test(l)) return "รางวัล " + v.label.toUpperCase();
  return v.label + (v.opt ? "" : "");
}

const Store = {
  getCart() {
    try {
      const c = JSON.parse(localStorage.getItem(CART_KEY)) || {};
      // ล้างตะกร้ารูปแบบเก่า (ค่าเป็นตัวเลข)
      for (const k in c) { if (typeof c[k] === "number") { localStorage.removeItem(CART_KEY); return {}; } }
      return c;
    } catch (e) { return {}; }
  },
  saveCart(cart) { localStorage.setItem(CART_KEY, JSON.stringify(cart)); Store.updateBadge(); },
  findProduct(id) { return (window.PRODUCTS || []).find(p => p.id === id); },
  variation(p, idx) { const vs = vlistOf(p); return vs[idx] || vs[0]; },

  addToCart(id, idx = 0, qty = 1) {
    const p = Store.findProduct(id);
    if (!p || p.status === "soldout") return false;
    const v = Store.variation(p, idx);
    const key = id + "|" + idx;
    const cart = Store.getCart();
    const cur = (cart[key] && cart[key].qty) || 0;
    const max = p.status === "preorder" ? 99 : (v.stock > 0 ? v.stock : 99);
    cart[key] = { id, idx, qty: Math.min(cur + qty, max) };
    Store.saveCart(cart);
    return true;
  },
  setQty(key, qty) {
    const cart = Store.getCart(); const e = cart[key]; if (!e) return;
    if (qty <= 0) { delete cart[key]; }
    else {
      const p = Store.findProduct(e.id); const v = Store.variation(p, e.idx);
      const max = p && p.status === "preorder" ? 99 : (v && v.stock > 0 ? v.stock : 99);
      e.qty = Math.min(qty, max);
    }
    Store.saveCart(cart);
  },
  removeFromCart(key) { const cart = Store.getCart(); delete cart[key]; Store.saveCart(cart); },
  clearCart() { localStorage.removeItem(CART_KEY); Store.updateBadge(); },

  cartItems() {
    const cart = Store.getCart();
    return Object.keys(cart).map(key => {
      const e = cart[key]; const p = Store.findProduct(e.id); if (!p) return null;
      const v = Store.variation(p, e.idx);
      return { key, id: e.id, idx: e.idx, name: p.name, series: p.series, grade: p.grade,
        status: p.status, img: v.img || p.img, prize: prizeLabel(v), opt: v.opt || "",
        price: v.price, qty: e.qty, lineTotal: v.price * e.qty };
    }).filter(Boolean);
  },
  cartCount() { return Object.values(Store.getCart()).reduce((a, b) => a + ((b && b.qty) || 0), 0); },
  cartTotal() { return Store.cartItems().reduce((a, it) => a + it.lineTotal, 0); },

  updateBadge() {
    const count = Store.cartCount();
    document.querySelectorAll("[data-cart-badge]").forEach(el => {
      el.textContent = count; el.style.display = count > 0 ? "flex" : "none";
    });
  }
};
function formatTHB(n) { return "฿" + Number(n).toLocaleString("th-TH"); }
window.Store = Store; window.formatTHB = formatTHB; window.prizeLabel = prizeLabel;
