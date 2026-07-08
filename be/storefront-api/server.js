/* ============================================================
   storefront-api — บริการสาธารณะ (ลูกค้าใช้งานจริง)
   พอร์ตแยกจาก admin · ไม่มี route ของแอดมินเลย (least privilege)
   ============================================================ */
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Products, Orders, Customers, Settings } = require("../../db/db");
const mailer = require("../../db/mailer");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.STOREFRONT_JWT_SECRET || "dev-store-secret-change-me";
const ORIGINS = ["https://keyima-store.onrender.com", "https://keyima.shop", "https://www.keyima.shop", ...(process.env.STOREFRONT_ORIGINS || "http://localhost:8080").split(",")].map(s => s.trim()).filter(Boolean);  // อนุญาตโดเมน static store + โดเมนจริง keyima.shop (default) + เพิ่มได้ผ่าน env

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: (o, cb) => cb(null, !o || ORIGINS.includes(o) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)), credentials: true }));  // อนุญาต: ไม่มี origin (file://) + origin ที่กำหนด + localhost ทุกพอร์ต (dev)     // จำกัด origin เฉพาะหน้าร้าน
app.use(express.json({ limit: "3mb" }));  // รองรับสลิป (base64)                  // จำกัดขนาด body
app.use(rateLimit({ windowMs: 60_000, max: 120 }));         // กันยิงถี่ทั้งบริการ

const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 20 }); // กัน brute-force ที่ login/register

/* ---------- auth helpers ---------- */
function sign(c) { return jwt.sign({ sub: c.email, name: c.name }, JWT_SECRET, { expiresIn: "30d" }); }
function auth(req, res, next) {
  const t = (req.headers.authorization || "").replace("Bearer ", "");
  try { req.user = jwt.verify(t, JWT_SECRET); next(); }
  catch { res.status(401).json({ message: "ต้องเข้าสู่ระบบ" }); }
}
const isEmail = s => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s || "");

/* ===================== PUBLIC: catalog ===================== */
app.get("/api/products", (_q, res) => res.json(Products.all().filter(p => p.status !== "hidden")));  // ไม่แสดงสินค้าที่ซ่อน
app.get("/api/products/:id", (req, res) => {
  const p = Products.get(req.params.id);
  return (p && p.status !== "hidden") ? res.json(p) : res.status(404).json({ message: "ไม่พบสินค้า" });
});
app.get("/api/settings", (_q, res) => {
  const s = Settings.all();
  res.json({ shopName: s.shopName, promo: s.promo, shippingFlat: s.shippingFlat, freeShipMin: s.freeShipMin, heroProductId: s.heroProductId });
});

/* ===================== customer auth ===================== */
app.post("/api/auth/register", authLimiter, (req, res) => {
  const { name, email, password, phone } = req.body || {};
  if (!name || !isEmail(email) || !password || password.length < 6)
    return res.status(400).json({ message: "กรอกชื่อ อีเมล และรหัสผ่าน (อย่างน้อย 6 ตัว)" });
  if (Customers.get(email.toLowerCase())) return res.status(409).json({ message: "อีเมลนี้สมัครแล้ว" });
  const c = Customers.create({ name, email: email.toLowerCase(), passwordHash: bcrypt.hashSync(password, 12), phone });
  res.status(201).json({ token: sign(c), user: c });
});
app.post("/api/auth/login", authLimiter, (req, res) => {
  const { email, password } = req.body || {};
  const c = Customers.get((email || "").toLowerCase());
  if (!c || !bcrypt.compareSync(password || "", c.passwordHash || ""))
    return res.status(401).json({ message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
  res.json({ token: sign(c), user: Customers.safe(c.email) });
});
app.get("/api/me", auth, (req, res) => res.json(Customers.safe(req.user.sub)));
app.put("/api/me", auth, (req, res) => { Customers.update(req.user.sub, { name: req.body.name, phone: req.body.phone, addresses: req.body.addresses }); res.json(Customers.safe(req.user.sub)); });
app.get("/api/me/orders", auth, (req, res) => res.json(Orders.byEmail(req.user.sub)));

/* ===================== orders (guest หรือ member) ===================== */
app.post("/api/orders", (req, res) => {
  const b = req.body || {};
  if (!isEmail(b.email)) return res.status(400).json({ message: "ต้องมีอีเมลเพื่อรับใบยืนยัน/ใบพรีออเดอร์" });
  if (!Array.isArray(b.items) || !b.items.length) return res.status(400).json({ message: "ตะกร้าว่าง" });
  for (const k of ["name", "phone", "address", "subdist", "district", "province", "zip"])
    if (!b[k]) return res.status(400).json({ message: "กรอกข้อมูลจัดส่งให้ครบ" });

  // *** สำคัญด้านความปลอดภัย: คำนวณยอดใหม่จากราคาใน DB เสมอ ไม่เชื่อราคาจาก client ***
  let subtotal = 0; const items = [];
  for (const it of b.items) {
    const p = Products.get(it.id); if (!p) return res.status(400).json({ message: "สินค้าไม่ถูกต้อง: " + it.id });
    const v = (p.variations || [])[it.idx] || { price: p.price, label: "", opt: "" };
    const qty = Math.max(1, Math.min(parseInt(it.qty) || 1, 99));
    subtotal += v.price * qty;
    items.push({ id: p.id, name: p.name, prize: v.label, opt: v.opt, price: v.price, qty, img: v.img || p.img });
  }
  const st = Settings.all();
  const shipping = subtotal >= st.freeShipMin ? 0 : st.shippingFlat;
  const order = Orders.create({
    orderNo: "KM" + Date.now().toString(36).toUpperCase(),
    email: b.email.toLowerCase(), name: b.name, phone: b.phone,
    address: b.address, subdist: b.subdist, district: b.district, province: b.province, zip: b.zip, note: b.note || "",
    items, subtotal, shipping, total: subtotal + shipping,
    payment: ["card", "promptpay", "cod"].includes(b.payment) ? b.payment : "promptpay",
    status: "pending", tracking: "", slip: typeof b.slip === "string" ? b.slip.slice(0, 2500000) : "", history: [{ s: "pending", at: new Date().toISOString() }],
    isGuest: req.headers.authorization ? 0 : 1, createdAt: new Date().toISOString()
  });
  mailer.sendOrderConfirmation(order).catch(() => {});   // ส่งใบยืนยัน/ใบพรีออเดอร์
  res.status(201).json({ orderNo: order.orderNo, total: order.total, status: order.status });
});

app.get("/healthz", (_q, res) => res.json({ ok: true, service: "storefront-api" }));
if (require.main === module) app.listen(PORT, () => console.log(`✅ storefront-api : http://localhost:${PORT}`));
module.exports = app;
