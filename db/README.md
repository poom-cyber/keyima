# keyima-db (DB / data layer)

ฐานข้อมูล + data layer — **SQLite ผ่าน node:sqlite** (ไม่ต้องคอมไพล์/ไม่ต้องมี Python)

## ไฟล์
- `db.js` — data layer: products, orders, customers, settings, admins, audit_log (+ seed อัตโนมัติถ้า DB ว่าง)
- `mailer.js` — อีเมลใบยืนยัน/แจ้งสถานะ (ไม่ตั้ง SMTP = โหมด dev log)
- `seed-data.js` — แคตตาล็อกตั้งต้น (306) สำหรับ seed ครั้งแรก
- `catalog.json` — **แคตตาล็อกราคาขายเองจากไปป์ไลน์ Mercari** (312)
- `sync-catalog.js` — upsert `catalog.json` → ตาราง products (รันซ้ำได้ทุกครั้งที่ราคาอัปเดต)

BE เรียกผ่าน `require("@keyima/db")` และ `require("@keyima/db/mailer")`

อัปเดตราคา: วาง `catalog.json` ใหม่ → `node --experimental-sqlite sync-catalog.js` (Node 24: ตัด `--experimental-sqlite`)
> `shop.db` ต้องอยู่บนดิสก์ปกติ (WAL) · ตั้ง `DB_PATH` ได้ · ทดสอบแล้ว: seed 306 + sync = **312 สินค้า**
