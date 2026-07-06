/* ============================================================
   admin-api.js — ตัวเชื่อม API + จัดการ token (ใช้ทุกหน้า admin)
   ============================================================ */
// URL ของ backend ตอนขึ้นเว็บจริง (Render) — แอดมินอยู่ใต้ /admin *** เปลี่ยนเป็นของคุณหลัง deploy ***
const ADMIN_PROD_API = "https://keyima-api.onrender.com/admin";
const ADMIN_IS_LOCAL = ["localhost", "127.0.0.1", ""].includes(location.hostname);

const AdminAPI = {
  base() {
    return localStorage.getItem("kps_api_base") || (ADMIN_IS_LOCAL ? "http://localhost:4000" : ADMIN_PROD_API);
  },
  setBase(url) { localStorage.setItem("kps_api_base", url.replace(/\/$/, "")); },

  token() { return localStorage.getItem("kps_admin_token"); },
  setToken(t) { localStorage.setItem("kps_admin_token", t); },
  clearToken() { localStorage.removeItem("kps_admin_token"); },

  /* เรียก API พร้อมแนบ token */
  async req(method, path, body, isForm = false) {
    const opts = { method, headers: {} };
    if (this.token()) opts.headers["Authorization"] = "Bearer " + this.token();
    if (body && !isForm) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
    if (body && isForm) opts.body = body;
    const res = await fetch(this.base() + path, opts);
    if (res.status === 401) { this.clearToken(); location.href = "login.html"; throw new Error("เซสชันหมดอายุ"); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "เกิดข้อผิดพลาด (" + res.status + ")");
    return data;
  },

  // auth
  async login(username, password) {
    const res = await fetch(this.base() + "/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "เข้าสู่ระบบไม่สำเร็จ");
    this.setToken(data.token);
    return data;
  },
  changePassword(newPassword) { return this.req("POST", "/api/auth/change-password", { newPassword }); },

  // products
  products() { return this.req("GET", "/api/products"); },
  createProduct(p) { return this.req("POST", "/api/products", p); },
  updateProduct(id, p) { return this.req("PUT", "/api/products/" + id, p); },
  deleteProduct(id) { return this.req("DELETE", "/api/products/" + id); },

  // upload
  async upload(file) {
    const fd = new FormData(); fd.append("image", file);
    return this.req("POST", "/api/upload", fd, true);
  },

  // orders
  orders() { return this.req("GET", "/api/orders"); },
  setOrderStatus(no, status) { return this.req("PUT", "/api/orders/" + encodeURIComponent(no), { status }); },

  // settings
  getSettings() { return this.req("GET", "/api/settings"); },
  saveSettings(s) { return this.req("PUT", "/api/settings", s); },
  syncPrices() { return this.req("POST", "/api/sync-prices"); }
};

function requireLogin() {
  if (!AdminAPI.token()) location.href = "login.html";
}
