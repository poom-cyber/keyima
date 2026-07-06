# keyima-be (Backend)

2 บริการแยกโปรเซส/พอร์ต/โดเมน (least privilege)

| บริการ | พอร์ต | ใคร | หน้าที่ |
|---|---|---|---|
| `storefront-api` | 3000 | ลูกค้า (สาธารณะ) | ดูสินค้า/ตั้งค่า · สมัคร/ล็อกอินลูกค้า · **สร้างออเดอร์ (คำนวณยอดที่เซิร์ฟเวอร์)** |
| `admin-api` | 4000 | แอดมิน (ปิดล็อก) | CRUD สินค้า/ออเดอร์/สมาชิก/ตั้งค่า · อัปโหลดรูป · audit log |

ปลอดภัย: JWT แยก secret 2 ฝั่ง · bcrypt · helmet · rate-limit · CORS allowlist · admin จำกัด IP ได้ · ไม่เชื่อยอดจาก client

## รัน (Node ≥ 22.5)
```bash
cd be && npm install
cp storefront-api/.env.example storefront-api/.env   # ตั้ง STOREFRONT_JWT_SECRET, STOREFRONT_ORIGINS
cp admin-api/.env.example     admin-api/.env          # ตั้ง ADMIN_JWT_SECRET (คนละตัว), ADMIN_ORIGINS, ADMIN_PASS
npm run start:store   # :3000
npm run start:admin   # :4000
```
ใช้ `@keyima/db` (../db) ร่วมกัน · ก่อนเปิดจริงดู `../../services/SECURITY.md`
