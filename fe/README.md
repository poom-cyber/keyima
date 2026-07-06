# keyima-fe (Frontend, static)

โค้ดฝั่งเบราว์เซอร์ทั้งหมด — เรียก BE ผ่าน API base URL

## โครง
- `store/` — หน้าร้านลูกค้า: index / products / product / cart / checkout / account + `assets/{css,js,img}` (526 รูป local)
- `admin/` — หน้าแอดมิน (index, login + assets/js: admin-api.js, app.js, login.js)
- `tools/` — `localize-images.mjs` โหลดรูป Shopee เก็บ local กัน hotlink (+ image-manifest.json)
- `_demo-prototype.html` — ต้นแบบ all-in-one (อ้างอิง)

## ต่อ backend
- store: `store/assets/js/config.js` → ตั้ง API base ให้ชี้ **storefront-api** (:3000)
- admin: หน้า login ตั้ง API base (เก็บใน localStorage `kps_api_base`) → ชี้ **admin-api** (:4000)

## รัน (dev)
`npx serve store` แล้วเปิดเบราว์เซอร์ (อย่าเปิด file:// ตรง ๆ — fetch/CORS จะพัง)
