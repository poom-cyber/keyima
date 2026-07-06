# 🚀 คู่มือขึ้นเว็บ KEYIMA — ฟรีทั้งหมด ไม่รีเซต

สถาปัตยกรรม: หน้าร้าน & แอดมิน = static บน **Netlify (ฟรี)** · API = **Render (ฟรี)** · ฐานข้อมูล = **Turso (ฟรี)**

```
Netlify: keyima-shop.netlify.app  (fe/store) ─┐
Netlify: keyima-admin.netlify.app (fe/admin) ─┼─► Render: keyima-api.onrender.com
                                               │      /        = หน้าร้าน (สาธารณะ)
                                               │      /admin   = แอดมิน (ต้องล็อกอิน)
                                               └────────► Turso (libSQL) = ข้อมูลถาวร
                                                          ออเดอร์/สต็อก/ลูกค้า ไม่รีเซต
```

ทำไมถึงฟรี-ไม่รีเซต: Render ฟรีจะล้าง disk เมื่อ redeploy/หลับ แต่เราเก็บข้อมูลจริงไว้บน **Turso** (คลาวด์ SQLite ฟรี 5GB) backend แค่ sync ขึ้น-ลง Turso อัตโนมัติ

---

## ส่วนที่ 0 — สร้างฐานข้อมูล Turso (ทำครั้งเดียว)

1. สมัคร Turso ฟรีที่ https://turso.tech (ล็อกอินด้วย GitHub)
2. ติดตั้ง CLI แล้วสร้าง DB (บน Windows ใช้ผ่าน dashboard ก็ได้ — กด **Create Database**):
   ```
   turso db create keyima
   turso db show keyima --url          # ได้ค่า TURSO_DATABASE_URL (libsql://keyima-xxx.turso.io)
   turso db tokens create keyima       # ได้ค่า TURSO_AUTH_TOKEN
   ```
3. เก็บค่า **URL** และ **token** ไว้ใส่ใน Render (ส่วนที่ 1)

## ส่วนที่ 1 — Backend บน Render (ฟรี)

1. ดัน `keyima/` ขึ้น GitHub repo (private) — **อย่า** commit `.env`, `*.db`, `.netlify_token`
2. Render → **New +** → **Web Service** → เชื่อม repo → เลือกโฟลเดอร์ที่มี `Dockerfile` (root = `keyima/`)
3. Render จะอ่าน `render.yaml` ให้เอง หรือกรอกเอง: Runtime **Docker** · Plan **Free** · Health check `/healthz`
4. ตั้ง **Environment variables**:

   | ตัวแปร | ค่า |
   |---|---|
   | `TURSO_DATABASE_URL` | `libsql://keyima-xxx.turso.io` (จากส่วนที่ 0) |
   | `TURSO_AUTH_TOKEN` | token (จากส่วนที่ 0) |
   | `DB_PATH` | `/tmp/shop.db` |
   | `STOREFRONT_JWT_SECRET` | (กด Generate) |
   | `ADMIN_JWT_SECRET` | (กด Generate) |
   | `STOREFRONT_ORIGINS` | `https://keyima-shop.netlify.app` |
   | `ADMIN_ORIGINS` | `https://keyima-admin.netlify.app` |
   | `ADMIN_USER` | ชื่อแอดมิน (ไม่ใช่ `admin`) |
   | `ADMIN_PASS` | รหัสผ่านที่แข็งแรง |

5. Deploy → จด URL เช่น `https://keyima-api.onrender.com`
6. ทดสอบ: `/healthz` ต้องได้ `{"ok":true}` · `/api/products` ต้องมีสินค้า (306 รายการ seed อัตโนมัติ)
7. **โหลดราคาครบ 312:** หลัง deploy ครั้งแรก เข้าแอดมิน → ตั้งค่า → กด **🔄 ดึงราคาล่าสุด** ครั้งเดียว

> หมายเหตุ Render ฟรี: เซิร์ฟเวอร์ "หลับ" เมื่อไม่มีคนเข้า ~15 นาที คำขอแรกหลังหลับจะช้า ~30 วิ (cold start) แต่ **ข้อมูลไม่หาย** เพราะอยู่ Turso

## ส่วนที่ 2 — แก้ URL ใน FE ให้ชี้ backend จริง

แทนที่ `https://keyima-api.onrender.com` ด้วย URL Render ของคุณใน 4 ไฟล์:
- `fe/store/assets/js/config.js` → `PROD_API`
- `fe/admin/assets/js/admin-api.js` → `ADMIN_PROD_API` (ลงท้าย `/admin`)
- `fe/store/netlify.toml` → CSP (`connect-src`, `img-src`)
- `fe/admin/netlify.toml` → CSP (`connect-src`, `img-src`)

## ส่วนที่ 3 — หน้าร้าน + แอดมิน บน Netlify (2 ไซต์ ฟรี)

**ไซต์หน้าร้าน:** New site → เชื่อม repo → **Base directory:** `keyima/fe/store` · **Publish:** `keyima/fe/store` · Build command: เว้นว่าง
**ไซต์แอดมิน:** New site (อีกอัน) → **Base directory:** `keyima/fe/admin` · **Publish:** `keyima/fe/admin`

จด URL ทั้งสอง แล้วย้อนไปใส่ใน `STOREFRONT_ORIGINS` / `ADMIN_ORIGINS` บน Render ให้ตรง

## ส่วนที่ 4 — ✅ Checklist ก่อนเปิดจริง

- [ ] เปลี่ยนรหัสแอดมินจาก `admin/admin123` (ตั้ง `ADMIN_USER`/`ADMIN_PASS` ก่อน seed แรก)
- [ ] `STOREFRONT_JWT_SECRET` / `ADMIN_JWT_SECRET` = ค่าสุ่ม (ไม่ใช่ค่า default)
- [ ] `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` ใส่ถูก (log ตอนบูตต้องขึ้น "Turso: เชื่อม + ดึงข้อมูลครั้งแรกสำเร็จ")
- [ ] CORS (`*_ORIGINS`) ตรงกับโดเมน Netlify เป๊ะ (ไม่มี `/` ท้าย)
- [ ] `PROMPTPAY_ID` ใน `config.js` เป็นเบอร์พร้อมเพย์จริง (ตอนนี้: `0820095962`)
- [ ] `LINE_URL` ถูกต้อง (`https://lin.ee/aQLcKQK`)
- [ ] กด "🔄 ดึงราคาล่าสุด" แล้ว สินค้าครบ 312 ราคาตรง
- [ ] ทดสอบสั่งซื้อจริง 1 ออเดอร์ → ขึ้นในแอดมิน → เปลี่ยนสถานะ → ดูสลิปได้ → redeploy แล้วออเดอร์ยังอยู่
- [ ] ต้นทุนเงินเยน (`cost_jp`) ไม่หลุดถึงลูกค้า ✔ `catalog.json` ตัดออกแล้ว

## อัปเดตราคาเข้าเว็บจริง (เชื่อมกับตัวเช็คราคา Shopee×Mercari)

ตัวเช็คราคายังรันในเครื่องคุณเหมือนเดิม (ไม่ขึ้นเว็บ — มีต้นทุนเยน + ต้องใช้ Chrome):
1. รันตัวเช็คราคา → ได้ `db/data.json` ใหม่
2. `python db/build_catalog.py` → ได้ `db/catalog.json` (ราคาขายใหม่)
3. commit + push `catalog.json` → Render redeploy อัตโนมัติ
4. เข้าแอดมิน → กด **🔄 ดึงราคาล่าสุด** → ราคาบนเว็บอัปเดต (คงสต็อก/สถานะ/ออเดอร์เดิม)

## Local dev (เหมือนเดิม ไม่ต้องมี Turso)

ไม่ตั้ง `TURSO_DATABASE_URL` → db.js ใช้ไฟล์ในเครื่อง (`db/shop.db`) อัตโนมัติ
`config.js`/`admin-api.js` ตรวจ hostname เอง — เปิดจาก localhost ชี้ `localhost:3000/4000`
รัน: ดับเบิลคลิก `run-all.bat` (หรือรวมพอร์ตเดียว `node be/server.js`)
