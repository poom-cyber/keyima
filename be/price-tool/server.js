/* be/price-tool/server.js — "เครื่องมือราคา" (ส่วนตัว: ต้นทุน Mercari + มาร์จิน)
   ────────────────────────────────────────────────────────────────────────────
   ⚠️ ตรงนี้มีข้อมูลลับ (ต้นทุนเยน jp + มาร์จิน) — ห้ามหลุดออกสาธารณะ

   ล็อกด้วย Basic Auth เทียบกับตาราง admins (bcrypt) ที่มีอยู่แล้ว
     -> ใช้บัญชีแอดมินทีมเดิม ไม่ต้องตั้งรหัสชุดใหม่
     -> ถอนสิทธิ์คนออกจากทีม = ลบ/เปลี่ยนรหัสในตาราง admins ที่เดียว

   เส้นทาง (ทั้งหมดอยู่ใต้ /price):
     GET  /price/            หน้าเครื่องมือราคา          (ล็อก)
     GET  /price/data.json   ข้อมูลราคา+ต้นทุน           (ล็อก)
     GET  /price/history.json ประวัติราคา                (ล็อก)
     POST /price/sync        บอทส่งข้อมูลรายวันเข้ามา     (ใช้ PRICE_SYNC_TOKEN)

   บอทส่งข้อมูลผ่าน /price/sync => ไม่ต้อง git push / ไม่ต้อง redeploy ทุกวัน
*/
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const crypto = require("node:crypto");
const { Admins, PriceData, Audit } = require("../../db/db");

const app = express.Router();

app.use(helmet({ contentSecurityPolicy: false }));           // หน้า tool ใช้ inline script
app.use(rateLimit({ windowMs: 15 * 60_000, max: 300 }));     // กันยิงถี่
// ห้าม index / ห้าม cache ข้อมูลลับ
app.use((_q, res, next) => {
  res.set("X-Robots-Tag", "noindex, nofollow");
  res.set("Cache-Control", "private, no-store");
  next();
});

/* ---------- 1) บอทซิงค์ข้อมูล (ก่อน Basic Auth — ใช้ token แทน) ---------- */
const SYNC_TOKEN = process.env.PRICE_SYNC_TOKEN || "";
const syncLimiter = rateLimit({ windowMs: 60_000, max: 10 });

app.post("/sync", syncLimiter, express.json({ limit: "25mb" }), (req, res) => {
  if (!SYNC_TOKEN) return res.status(503).json({ message: "ยังไม่ได้ตั้ง PRICE_SYNC_TOKEN" });
  const got = req.get("x-sync-token") || "";
  // เทียบยาวเท่ากันแบบไม่ให้เดาจากเวลาตอบ
  if (got.length !== SYNC_TOKEN.length || !require("crypto").timingSafeEqual(
        Buffer.from(got.padEnd(SYNC_TOKEN.length).slice(0, SYNC_TOKEN.length)),
        Buffer.from(SYNC_TOKEN))) {
    return res.status(401).json({ message: "sync token ไม่ถูกต้อง" });
  }
  const { data, history } = req.body || {};
  if (!data) return res.status(400).json({ message: "ต้องมีฟิลด์ data (เนื้อหา data.json)" });

  PriceData.set("data", JSON.stringify(data));
  if (history) PriceData.set("history", JSON.stringify(history));

  const nCols = (data.collections || []).length;
  Audit.log("bot", "price_sync", { collections: nCols, updated: data.updated || null });
  res.json({ ok: true, collections: nCols, updated: data.updated || null });
});

/* ---------- 2) Basic Auth (ทุกอย่างที่เหลือใต้ /price) ---------- */
const loginLimiter = rateLimit({ windowMs: 15 * 60_000, max: 30 }); // กัน brute-force

function unauthorized(res) {
  res.set("WWW-Authenticate", 'Basic realm="KEYIMA Price Tool (private)", charset="UTF-8"');
  return res.status(401).send("ต้องล็อกอินด้วยบัญชีแอดมินก่อนใช้งาน");
}

/* รับรหัสได้ 2 ทาง (ทางไหนผ่านก็เข้าได้):
     1) KUJI_USERS (env)  = poom:รหัส,mint:รหัส   <- คุมเองได้เต็มที่ ใช้ฟอร์แมตเดียวกับฝั่ง Netlify
     2) ตาราง admins (bcrypt) = บัญชีแอดมินร้านเดิม
   เหตุที่ต้องมีทาง 1: ADMIN_USER/ADMIN_PASS ใช้แค่ตอน seed ครั้งแรก
   ถ้า DB มีแอดมินอยู่ก่อนแล้ว การตั้ง env ทีหลังจะไม่เปลี่ยนรหัส -> ล็อกอินไม่เข้าแล้วงมหาสาเหตุ */
function envUsers() {
  const m = new Map();
  for (const pair of (process.env.KUJI_USERS || "").split(",")) {
    const s = pair.trim();
    const i = s.indexOf(":");
    if (i > 0) m.set(s.slice(0, i).trim(), s.slice(i + 1));
  }
  return m;
}
const ENV_USERS = envUsers();

function checkPassword(username, password) {
  // ทาง 1: env
  const want = ENV_USERS.get(username);
  if (want !== undefined && password.length === want.length &&
      crypto.timingSafeEqual(Buffer.from(password), Buffer.from(want))) {
    return { sub: username, role: "env" };
  }
  // ทาง 2: ตาราง admins (bcrypt)
  const a = Admins.get(username);
  // เรียก bcrypt เสมอแม้ไม่เจอ user -> ไม่ให้เดาจากเวลาตอบว่า username มีจริงไหม
  const hash = (a && a.passwordHash) || "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidina";
  let ok = false;
  try { ok = bcrypt.compareSync(password || "", hash); } catch { ok = false; }
  if (a && ok) return { sub: username, role: a.role };
  return null;
}

app.use(loginLimiter, (req, res, next) => {
  const h = req.get("authorization") || "";
  const [scheme, encoded] = h.split(" ");
  if (scheme !== "Basic" || !encoded) return unauthorized(res);

  let decoded = "";
  try { decoded = Buffer.from(encoded, "base64").toString("utf8"); } catch { return unauthorized(res); }
  const i = decoded.indexOf(":");
  if (i < 0) return unauthorized(res);

  const username = decoded.slice(0, i);
  const password = decoded.slice(i + 1);

  const who = checkPassword(username, password);
  if (!who) {
    Audit.log(username || "?", "price_tool_login_fail", { ip: req.ip });
    return unauthorized(res);
  }
  req.admin = who;
  next();
});

/* ---------- 3) ข้อมูลราคา (ล็อกแล้ว) ---------- */
function serveJson(key) {
  return (_q, res) => {
    const row = PriceData.get(key);
    if (!row) return res.status(404).json({ message: `ยังไม่มีข้อมูล "${key}" — รอบอทซิงค์เข้ามาก่อน` });
    res.type("application/json").send(row.json);
  };
}
app.get("/data.json", serveJson("data"));
app.get("/history.json", serveJson("history"));

/* ---------- 4) หน้าเว็บเครื่องมือ (static, ล็อกแล้ว) ---------- */
app.use(express.static(path.join(__dirname, "public"), { index: "index.html" }));

module.exports = app;
