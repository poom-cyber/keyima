/* db/db.js — Data layer (storefront-api + admin-api) ใช้ libsql (SQLite API แบบ sync)
   - local dev: ไฟล์ในเครื่อง (db/shop.db) เหมือนเดิม ไม่ต้องตั้งค่าอะไร
   - production: ตั้ง TURSO_DATABASE_URL + TURSO_AUTH_TOKEN → ใช้ Turso (embedded replica)
       เขียนลงไฟล์แคชในเครื่อง + ซิงค์ขึ้นคลาวด์ Turso อัตโนมัติ → ข้อมูลถาวร ไม่รีเซต แม้ host ฟรี */
const path = require("path");
const Database = require("libsql");
const bcrypt = require("bcryptjs");
const { PRODUCTS } = require("./seed-data");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "shop.db");
const SYNC_URL = process.env.TURSO_DATABASE_URL || "";
const AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || "";
const USE_TURSO = !!SYNC_URL;

// remote-only: เขียนตรงเข้า Turso cloud ทุก query → ข้อมูลถาวรจริง
// (เดิมใช้ embedded replica DB_PATH+syncUrl แต่ raw.sync() ของ libsql "ดึง" ได้อย่างเดียว ไม่ "ดัน" write ขึ้น
//  → seed ลง /tmp ที่ ephemeral แล้วหายทุก restart จึงเห็น 'seed products: 306' ทุกบูต และ Turso ว่างเสมอ)
const raw = USE_TURSO
  ? new Database(SYNC_URL, { authToken: AUTH_TOKEN })
  : new Database(DB_PATH);
if (USE_TURSO) console.log("  • Turso: เชื่อมแบบ remote (เขียนตรงเข้าคลาวด์)");

// libsql แนบ _metadata มากับทุกแถว — ตัดออกให้ผลลัพธ์เหมือน node:sqlite เดิม
const strip = r => { if (r && typeof r === "object") delete r._metadata; return r; };
let inTx = false;
function syncNow() { /* remote-only: write เข้า Turso ตรงๆ แล้ว ไม่ต้อง sync */ }
const db = {
  exec(s) {
    const r = raw.exec(s);
    const t = String(s).trim().toUpperCase();
    if (t.startsWith("BEGIN")) inTx = true;
    else if (t.startsWith("COMMIT") || t.startsWith("ROLLBACK")) { inTx = false; syncNow(); }
    return r;
  },
  prepare(sql) {
    const st = raw.prepare(sql);
    return {
      get: (...a) => strip(st.get(...a)),
      all: (...a) => st.all(...a).map(strip),
      run: (...a) => { const r = st.run(...a); if (!inTx) syncNow(); return r; }  // ซิงค์ขึ้น Turso หลังเขียน (นอก transaction)
    };
  },
  sync: syncNow,
  // libsql/Turso embedded replica ไม่รองรับ exec("BEGIN"/"COMMIT") → InvalidParserState("Init")
  // ใช้ autocommit ต่อแถว (ระงับ sync ระหว่างลูป) แล้วซิงค์ขึ้น Turso ครั้งเดียวหลังจบ
  transaction(fn) {
    inTx = true;
    try { fn(); } finally { inTx = false; }
    syncNow();
  }
};

if (!USE_TURSO) {
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");  // รอแทนที่จะ error เมื่ออีก service ล็อกไฟล์อยู่ (local เท่านั้น; Turso remote จัดการเอง)
}

db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT, series TEXT,
  grade TEXT, price INTEGER NOT NULL, priceMax INTEGER, oldPrice INTEGER,
  status TEXT DEFAULT 'instock', stock INTEGER DEFAULT 0, badge TEXT,
  addedAt TEXT, img TEXT, images TEXT, short TEXT, "desc" TEXT, variations TEXT
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, orderNo TEXT UNIQUE,
  email TEXT, name TEXT, phone TEXT,
  address TEXT, subdist TEXT, district TEXT, province TEXT, zip TEXT, note TEXT,
  items TEXT, subtotal INTEGER, shipping INTEGER, total INTEGER,
  payment TEXT, status TEXT DEFAULT 'paid', tracking TEXT,
  history TEXT, isGuest INTEGER DEFAULT 1, createdAt TEXT
);
CREATE TABLE IF NOT EXISTS customers (
  email TEXT PRIMARY KEY, name TEXT, passwordHash TEXT, phone TEXT,
  addresses TEXT, provider TEXT, createdAt TEXT
);
CREATE TABLE IF NOT EXISTS settings ( key TEXT PRIMARY KEY, value TEXT );
CREATE TABLE IF NOT EXISTS admins ( username TEXT PRIMARY KEY, passwordHash TEXT, role TEXT DEFAULT 'admin' );
CREATE TABLE IF NOT EXISTS audit_log ( id INTEGER PRIMARY KEY AUTOINCREMENT, who TEXT, action TEXT, detail TEXT, at TEXT );
`);
try { db.exec("ALTER TABLE orders ADD COLUMN slip TEXT"); } catch (e) { /* มีแล้ว */ }

// libsql remote (Turso/Hrana) ผูก named param (@name) ไม่ได้ → ค่าเข้าเป็น NULL
// จึงใช้ positional (?) เหมือน admin/customers/orders.update ที่ persist ได้จริง
const pcols15 = p => [p.name, p.category, p.series||"", p.grade||"", p.price, p.priceMax||p.price, p.oldPrice??null, p.status||"instock", p.stock||0, p.badge||"", p.img||"", JSON.stringify(p.images||[]), p.short||"", p.desc||"", JSON.stringify(p.variations||[])];
const prow = (p, addedAt) => { const c = pcols15(p); return [p.id, ...c.slice(0,10), addedAt, ...c.slice(10)]; };

function seed() {
  if (db.prepare("SELECT COUNT(*) c FROM products").get().c === 0) {
    const ins = db.prepare(`INSERT OR IGNORE INTO products (id,name,category,series,grade,price,priceMax,oldPrice,status,stock,badge,addedAt,img,images,short,"desc",variations) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    db.transaction(() => {
      PRODUCTS.forEach(p => ins.run(...prow(p, p.addedAt || new Date().toISOString().slice(0,10))));
    });
    console.log(`  • seed products: ${PRODUCTS.length}`);
  }
  const setDef = (k, v) => { if (!db.prepare("SELECT 1 FROM settings WHERE key=?").get(k)) db.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)").run(k, v); };
  setDef("shippingFlat","60"); setDef("freeShipMin","3000"); setDef("promo","ส่งฟรีเมื่อครบ ฿3,000 · ของแท้ญี่ปุ่น 100%"); setDef("shopName","KEYIMA");
  const u = process.env.ADMIN_USER || "admin"; const p = process.env.ADMIN_PASS || "admin123";
  if (!db.prepare("SELECT 1 FROM admins WHERE username=?").get(u)) {
    db.prepare("INSERT OR IGNORE INTO admins (username,passwordHash,role) VALUES (?,?,?)").run(u, bcrypt.hashSync(p, 12), "owner");
    console.log(`  • admin: ${u} / ${p}  (เปลี่ยนรหัสก่อนใช้จริง)`);
  }
}

const parseP = r => r && ({ ...r, images: JSON.parse(r.images || "[]"), variations: JSON.parse(r.variations || "[]") });
const Products = {
  all: () => db.prepare("SELECT * FROM products ORDER BY addedAt DESC").all().map(parseP),
  get: id => parseP(db.prepare("SELECT * FROM products WHERE id=?").get(id)),
  // ระบุพารามิเตอร์เป๊ะทุกตัว (whitelist) — กัน node:sqlite error "Unknown named parameter" ถาวร ไม่ว่าจะส่ง object หน้าตาแบบไหนเข้ามา
  _cols(p) { return { name:p.name, category:p.category, series:p.series||"", grade:p.grade||"", price:p.price, priceMax:p.priceMax||p.price, oldPrice:p.oldPrice??null, status:p.status||"instock", stock:p.stock||0, badge:p.badge||"", img:p.img||"", images:JSON.stringify(p.images||[]), short:p.short||"", desc:p.desc||"", variations:JSON.stringify(p.variations||[]) }; },
  create(p) { db.prepare(`INSERT INTO products (id,name,category,series,grade,price,priceMax,oldPrice,status,stock,badge,addedAt,img,images,short,"desc",variations) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(...prow(p, p.addedAt || new Date().toISOString().slice(0,10))); return Products.get(p.id); },
  update(id, p) { db.prepare(`UPDATE products SET name=?,category=?,series=?,grade=?,price=?,priceMax=?,oldPrice=?,status=?,stock=?,badge=?,img=?,images=?,short=?,"desc"=?,variations=? WHERE id=?`).run(...pcols15(p), id); return Products.get(id); },
  remove: id => db.prepare("DELETE FROM products WHERE id=?").run(id)
};
const Orders = {
  all: () => db.prepare("SELECT * FROM orders ORDER BY id DESC").all().map(o => ({ ...o, items: JSON.parse(o.items||"[]"), history: JSON.parse(o.history||"[]") })),
  byEmail: e => Orders.all().filter(o => o.email === e),
  get: no => { const o = db.prepare("SELECT * FROM orders WHERE orderNo=?").get(no); return o && { ...o, items: JSON.parse(o.items||"[]"), history: JSON.parse(o.history||"[]") }; },
  create(o) { db.prepare(`INSERT INTO orders (orderNo,email,name,phone,address,subdist,district,province,zip,note,items,subtotal,shipping,total,payment,status,tracking,history,isGuest,createdAt,slip) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(o.orderNo, o.email||"", o.name||"", o.phone||"", o.address||"", o.subdist||"", o.district||"", o.province||"", o.zip||"", o.note||"", JSON.stringify(o.items||[]), o.subtotal||0, o.shipping||0, o.total||0, o.payment||"", o.status||"paid", o.tracking||"", JSON.stringify(o.history||[]), o.isGuest??1, o.createdAt||new Date().toISOString(), o.slip||""); return Orders.get(o.orderNo); },
  update(no, patch) { const o = Orders.get(no); if (!o) return null; const h = o.history||[]; if (patch.status && patch.status !== o.status) h.push({ s:patch.status, at:new Date().toISOString() }); db.prepare("UPDATE orders SET status=?, tracking=?, history=? WHERE orderNo=?").run(patch.status||o.status, patch.tracking??o.tracking, JSON.stringify(h), no); return Orders.get(no); },
  editFull(no, f) { const o = Orders.get(no); if (!o) return null; const h = o.history||[]; if (f.status && f.status !== o.status) h.push({ s:f.status, at:new Date().toISOString() }); db.prepare("UPDATE orders SET name=?,phone=?,email=?,address=?,subdist=?,district=?,province=?,zip=?,note=?,status=?,tracking=?,history=? WHERE orderNo=?").run(f.name??o.name, f.phone??o.phone, (f.email||o.email||"").toLowerCase(), f.address??o.address, f.subdist??o.subdist, f.district??o.district, f.province??o.province, f.zip??o.zip, f.note??o.note, f.status??o.status, f.tracking??o.tracking, JSON.stringify(h), no); return Orders.get(no); },
  remove(no) { return db.prepare("DELETE FROM orders WHERE orderNo=?").run(no); }
};
const Customers = {
  get: e => db.prepare("SELECT * FROM customers WHERE email=?").get(e),
  safe: e => { const c = Customers.get(e); return c && { email:c.email, name:c.name, phone:c.phone, addresses:JSON.parse(c.addresses||"[]") }; },
  create(c) { db.prepare("INSERT INTO customers (email,name,passwordHash,phone,addresses,provider,createdAt) VALUES (?,?,?,?,?,?,?)").run(c.email, c.name, c.passwordHash||"", c.phone||"", JSON.stringify(c.addresses||[]), c.provider||"email", new Date().toISOString()); return Customers.safe(c.email); },
  update(e, patch) { const c = Customers.get(e); if (!c) return; db.prepare("UPDATE customers SET name=?, phone=?, addresses=? WHERE email=?").run(patch.name??c.name, patch.phone??c.phone, JSON.stringify(patch.addresses||JSON.parse(c.addresses||"[]")), e); },
  all: () => db.prepare("SELECT email,name,phone,createdAt FROM customers ORDER BY createdAt DESC").all(),
  getFull: e => { const c = Customers.get(e); return c && { email:c.email, name:c.name, phone:c.phone, provider:c.provider, createdAt:c.createdAt, addresses:JSON.parse(c.addresses||"[]") }; },
  adminUpdate(e, patch) { const c = Customers.get(e); if (!c) return; db.prepare("UPDATE customers SET name=?, phone=? WHERE email=?").run(patch.name??c.name, patch.phone??c.phone, e); },
  remove: e => db.prepare("DELETE FROM customers WHERE email=?").run(e)
};
const Settings = {
  all() { const o={}; db.prepare("SELECT * FROM settings").all().forEach(r => o[r.key]=r.value); o.shippingFlat=Number(o.shippingFlat||60); o.freeShipMin=Number(o.freeShipMin||3000); return o; },
  set: (k, v) => db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=?").run(k, String(v), String(v))
};
const Admins = {
  get: u => db.prepare("SELECT * FROM admins WHERE username=?").get(u),
  setPassword: (u, h) => db.prepare("UPDATE admins SET passwordHash=? WHERE username=?").run(h, u)
};
const Audit = { log: (who, action, detail) => db.prepare("INSERT INTO audit_log (who,action,detail,at) VALUES (?,?,?,?)").run(who, action, JSON.stringify(detail||{}), new Date().toISOString()),
  all: (limit=200) => db.prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?").all(limit) };

seed();
module.exports = { db, Products, Orders, Customers, Settings, Admins, Audit };
// fix: ca-certificates (Dockerfile) + libsql-safe transaction() for seed — no exec BEGIN/COMMIT
