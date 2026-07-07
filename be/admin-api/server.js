/* ============================================================
   admin-api — บริการหลังบ้าน (เฉพาะแอดมิน) แยกพอร์ต/โปรเซส
   ความปลอดภัย: JWT แยก secret, bcrypt, helmet, rate-limit เข้ม,
   CORS เฉพาะโดเมนแอดมิน, ทุก route ต้องล็อกอิน, มี audit log
   *** ควร deploy หลัง VPN / IP allowlist / reverse proxy + HTTPS ***
   ============================================================ */
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { Products, Orders, Customers, Settings, Admins, Audit } = require("../../db/db");
const mailer = require("../../db/mailer");

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || "dev-admin-secret-change-me";
const ORIGINS = (process.env.ADMIN_ORIGINS || "http://localhost:5173").split(",");
const IP_ALLOW = (process.env.ADMIN_IP_ALLOWLIST || "").split(",").map(s => s.trim()).filter(Boolean);

app.set("trust proxy", 1);
// CSP ชัดเจน: อนุญาตหน้าแอดมิน (served same-origin ใต้ /admin) ให้ยิง API same-origin ได้
// (connect-src 'self'), โหลดสคริปต์/สไตล์ของตัวเอง, รูปจาก https ภายนอกได้, ฟอนต์ Google
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(cors({ origin: (o, cb) => cb(null, !o || ORIGINS.includes(o) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)), credentials: true }));  // อนุญาต: ไม่มี origin (file://) + origin ที่กำหนด + localhost ทุกพอร์ต (dev)
// เสิร์ฟหน้าแอดมิน (static) แบบ same-origin ใต้ /admin — /admin/login.html, /admin/index.html, /admin/assets/*
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 60_000, max: 200 }));

// (ทางเลือก) จำกัด IP ที่เข้าถึง admin API ได้
app.use((req, res, next) => {
  if (!IP_ALLOW.length) return next();
  const ip = (req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();
  return IP_ALLOW.includes(ip) ? next() : res.status(403).json({ message: "ไม่อนุญาตจาก IP นี้" });
});

/* ---------- auth ---------- */
const loginLimiter = rateLimit({ windowMs: 15 * 60_000, max: 10 }); // กัน brute-force เข้ม
function auth(req, res, next) {
  const t = (req.headers.authorization || "").replace("Bearer ", "");
  try { req.admin = jwt.verify(t, JWT_SECRET); next(); }
  catch { res.status(401).json({ message: "ต้องเข้าสู่ระบบผู้ดูแล" }); }
}

app.post("/api/auth/login", loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  const a = Admins.get(username);
  if (!a || !bcrypt.compareSync(password || "", a.passwordHash)) {
    Audit.log(username || "?", "login_fail", { ip: req.ip });
    return res.status(401).json({ message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
  }
  Audit.log(username, "login_ok", {});
  res.json({ token: jwt.sign({ sub: username, role: a.role }, JWT_SECRET, { expiresIn: "8h" }), username, role: a.role });
});
app.post("/api/auth/change-password", auth, (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ message: "รหัสใหม่อย่างน้อย 8 ตัว" });
  Admins.setPassword(req.admin.sub, bcrypt.hashSync(newPassword, 12));
  Audit.log(req.admin.sub, "change_password", {});
  res.json({ ok: true });
});

app.use("/api", auth); // ทุก route ใต้ /api ต้องล็อกอิน (ยกเว้น login ด้านบนที่ผ่านไปแล้ว)

/* ---------- products ---------- */
const num = (v, d = 0) => { const n = parseInt(v); return isNaN(n) ? d : n; };
function normP(b) {
  return { id: b.id, name: (b.name || "").trim(), category: b.category === "pokemon" ? "pokemon" : "kuji",
    series: b.series || "", grade: b.grade || "", price: num(b.price), priceMax: num(b.priceMax || b.price),
    oldPrice: b.oldPrice ? num(b.oldPrice) : null, status: ["instock", "preorder", "soldout"].includes(b.status) ? b.status : "instock",
    stock: num(b.stock), badge: b.badge || "", addedAt: b.addedAt || new Date().toISOString().slice(0, 10),
    img: b.img || "", images: b.images || [], short: b.short || "", desc: b.desc || "", variations: b.variations || [] };
}
app.get("/api/products", (_q, res) => res.json(Products.all()));
app.post("/api/products", (req, res) => {
  const p = normP(req.body); if (!p.id) p.id = (p.category === "pokemon" ? "poke-" : "kuji-") + Date.now();
  if (!p.name || !p.price) return res.status(400).json({ message: "ต้องมีชื่อและราคา" });
  if (Products.get(p.id)) return res.status(409).json({ message: "มีรหัสนี้แล้ว" });
  Audit.log(req.admin.sub, "product_create", { id: p.id });
  res.status(201).json(Products.create(p));
});
app.put("/api/products/:id", (req, res) => {
  if (!Products.get(req.params.id)) return res.status(404).json({ message: "ไม่พบสินค้า" });
  Audit.log(req.admin.sub, "product_update", { id: req.params.id });
  res.json(Products.update(req.params.id, normP({ ...req.body, id: req.params.id })));
});
app.delete("/api/products/:id", (req, res) => { Products.remove(req.params.id); Audit.log(req.admin.sub, "product_delete", { id: req.params.id }); res.json({ ok: true }); });

/* ---------- orders ---------- */
app.get("/api/orders", (_q, res) => res.json(Orders.all()));
app.get("/api/orders/:no", (req, res) => { const o = Orders.get(req.params.no); return o ? res.json(o) : res.status(404).json({ message: "ไม่พบออเดอร์" }); });
app.put("/api/orders/:no", (req, res) => {
  if (req.body.status && !["pending", "paid", "packing", "shipped", "delivered", "cancelled"].includes(req.body.status))
    return res.status(400).json({ message: "สถานะไม่ถูกต้อง" });
  const o = Orders.editFull(req.params.no, req.body);   // แก้ได้ทั้งสถานะ/พัสดุ/ข้อมูลลูกค้า/ที่อยู่/หมายเหตุ
  if (!o) return res.status(404).json({ message: "ไม่พบออเดอร์" });
  Audit.log(req.admin.sub, "order_update", { no: req.params.no, status: req.body.status });
  if (req.body.status || req.body.tracking) mailer.sendOrderStatus(o).catch(() => {});  // แจ้งลูกค้าเมื่อสถานะ/พัสดุเปลี่ยน
  res.json(o);
});
app.delete("/api/orders/:no", (req, res) => { Orders.remove(req.params.no); Audit.log(req.admin.sub, "order_delete", { no: req.params.no }); res.json({ ok: true }); });

/* ---------- members ---------- */
app.get("/api/members", (_q, res) => res.json(Customers.all()));
app.get("/api/members/:email", (req, res) => {
  const c = Customers.getFull(req.params.email);
  if (!c) return res.status(404).json({ message: "ไม่พบสมาชิก" });
  res.json({ ...c, orders: Orders.byEmail(req.params.email) });
});
app.put("/api/members/:email", (req, res) => {
  Customers.adminUpdate(req.params.email, { name: req.body.name, phone: req.body.phone });
  Audit.log(req.admin.sub, "member_update", { email: req.params.email });
  res.json(Customers.getFull(req.params.email));
});
app.delete("/api/members/:email", (req, res) => { Customers.remove(req.params.email); Audit.log(req.admin.sub, "member_delete", { email: req.params.email }); res.json({ ok: true }); });

/* ---------- audit log ---------- */
app.get("/api/audit", (_q, res) => res.json(Audit.all(200)));

/* ---------- settings ---------- */
app.get("/api/settings", (_q, res) => res.json(Settings.all()));
app.put("/api/settings", (req, res) => {
  ["shippingFlat", "freeShipMin", "promo", "shopName"].forEach(k => { if (k in req.body) Settings.set(k, req.body[k]); });
  Audit.log(req.admin.sub, "settings_update", {});
  res.json(Settings.all());
});

/* ---------- sync ราคา จากระบบเช็คราคา (Mercari -> catalog.json) ---------- */
app.post("/api/sync-prices", (req, res) => {
  try {
    const p = path.join(__dirname, "..", "..", "db", "catalog.json");
    const cat = JSON.parse(fs.readFileSync(p, "utf8"));
    const items = cat.products || cat;
    const r = Products.bulkUpsert(items);   // ยิงเป็นชุด (chunk 100) — เร็ว ~2-3 วิ แทนทีละตัว
    Audit.log(req.admin.sub, "sync_prices", { count: r.n });
    res.json({ ok: true, count: r.n, updatedAt: (cat.meta && cat.meta.updated) || null });
  } catch (e) { res.status(500).json({ message: "ซิงค์ราคาไม่สำเร็จ: " + e.message }); }
});

/* ---------- upload ---------- */
const UP = path.join(__dirname, "uploads"); if (!fs.existsSync(UP)) fs.mkdirSync(UP);
const upload = multer({ dest: UP, limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_r, f, cb) => cb(/jpeg|jpg|png|webp|gif/.test(f.mimetype) ? null : new Error("รูปเท่านั้น"), /jpeg|jpg|png|webp|gif/.test(f.mimetype)) });
app.use("/uploads", express.static(UP));
app.post("/api/upload", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "ไม่พบไฟล์" });
  res.json({ url: `${req.protocol}://${req.get("host")}${req.baseUrl}/uploads/${req.file.filename}` });
});

app.get("/healthz", (_q, res) => res.json({ ok: true, service: "admin-api" }));
if (require.main === module) app.listen(PORT, () => console.log(`🔒 admin-api : http://localhost:${PORT}  (จำกัด origin: ${ORIGINS.join(", ")})`));
module.exports = app;
