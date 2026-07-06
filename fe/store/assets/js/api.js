/* ============================================================
   api.js — เชื่อมหน้าร้านกับ backend (storefront-api)
   ถ้าเรียก API ไม่ได้ จะใช้ข้อมูลตัวอย่างจาก data.js แทน (โหมดสาธิต)
   ============================================================ */
const Storefront = {
  online: false,
  settings: { shippingFlat: 60, freeShipMin: 3000, promoText: "", shopName: "KEYIMA" },

  base() {
    return (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "http://localhost:3000";
  },

  async load() {
    try {
      const r = await fetch(this.base() + "/api/products");
      if (r.ok) {
        const list = await r.json();
        if (Array.isArray(list) && list.length) { window.PRODUCTS = list; this.online = true; }
      }
    } catch (e) { /* ออฟไลน์ → ใช้ data.js */ }
    try {
      const r = await fetch(this.base() + "/api/settings");
      if (r.ok) Object.assign(this.settings, await r.json());
    } catch (e) { /* ใช้ค่าเริ่มต้น */ }
    return window.PRODUCTS;
  },

  async createOrder(order) {
    try {
      const r = await fetch(this.base() + "/api/orders", {
        method: "POST",
        headers: { ...(this.token() ? { Authorization: "Bearer " + this.token() } : {}), "Content-Type": "application/json" },
        body: JSON.stringify(order)
      });
      if (r.ok) return await r.json();
    } catch (e) { /* โหมดสาธิต: ไม่บันทึกจริง */ }
    return null;
  },

  /* ---------- ระบบสมาชิก (storefront-api) ---------- */
  token() { return localStorage.getItem("kps_token"); },
  setToken(t) { if (t) { localStorage.setItem("kps_token", t); } else { localStorage.removeItem("kps_token"); } },
  isLoggedIn() { return !!this.token(); },

  async _req(method, path, body) {
    const r = await fetch(this.base() + path, {
      method,
      headers: { ...(this.token() ? { Authorization: "Bearer " + this.token() } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    if (r.status === 401) { this.setToken(null); }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.message || ("ผิดพลาด " + r.status));
    return data;
  },

  async register(p) {
    const d = await this._req("POST", "/api/auth/register", { name: p.name, email: p.email, password: p.password, phone: p.phone });
    this.setToken(d.token); return d.user;
  },
  async login(email, password) {
    const d = await this._req("POST", "/api/auth/login", { email, password });
    this.setToken(d.token); return d.user;
  },
  logout() { this.setToken(null); },
  me() { return this._req("GET", "/api/me"); },
  updateMe(patch) { return this._req("PUT", "/api/me", patch); },
  myOrders() { return this._req("GET", "/api/me/orders"); },

  async boot(fn) { await this.load(); fn(); }
};
window.Storefront = Storefront;
