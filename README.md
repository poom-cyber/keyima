# KEYIMA — โครง be / fe / db (แยกงานชัด)

จัดระเบียบจากโปรเจกต์ `kuji-poke-shop` เดิม (ของเดิมไม่ถูกแตะ) ให้พร้อมแยกเป็น 3 repo

```
keyima/
├── db/   ← ฐานข้อมูล + data layer (SQLite) + seed + sync ราคาขายเอง
├── be/   ← backend 2 บริการ: storefront-api (:3000) + admin-api (:4000)
└── fe/   ← frontend: store/ (ลูกค้า) + admin/ (แอดมิน) + tools/
```

## การไหลของข้อมูล
ไปป์ไลน์ราคา Mercari → `db/catalog.json` (312 รายการ, ราคาขายเอง) → `sync-catalog.js` → **DB (SQLite)** ← `be` อ่าน/เขียน ← `fe` เรียกผ่าน API

## เริ่ม (โลคัล, Node ≥ 22.5)
1. `cd be && npm install`  (ผูก @keyima/db จาก ../db + ติดตั้ง express ฯลฯ)
2. `cd ../db && node --experimental-sqlite sync-catalog.js`  (โหลด 312 สินค้าราคาขายเองเข้า DB)
3. `cp be/storefront-api/.env.example be/storefront-api/.env` และ `cp be/admin-api/.env.example be/admin-api/.env` (ตั้ง secret จริง)
4. `cd be && npm run start:store` (:3000) + `npm run start:admin` (:4000, คนละหน้าต่าง)
5. เสิร์ฟ `fe/store` (เช่น `npx serve fe/store`) แล้วตั้ง API base ใน `fe/store/assets/js/config.js` ให้ชี้ :3000

## แยกเป็น 3 git repo
`cd db && git init` · `cd be && git init` · `cd fe && git init`
> be ผูก db แบบ `file:../db` (เครื่องเดียว) — ถ้าคนละเครื่อง/คนละ repo ให้ publish `@keyima/db` เป็น private package หรือใช้ git submodule

รายละเอียดแต่ละส่วน: `db/README.md`, `be/README.md`, `fe/README.md`
สถาปัตย์/ความปลอดภัยของเดิม (อ้างอิง): `../services/ARCHITECTURE.md`, `../services/SECURITY.md`
