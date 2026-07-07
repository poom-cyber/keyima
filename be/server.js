/* be/server.js — บริการรวม (สำหรับ deploy บนเครื่องเดียว/Render ให้ SQLite แชร์ไฟล์ได้)
   storefront (สาธารณะ) อยู่ที่ราก /   ·   admin อยู่ใต้ /admin
   local dev ยังรันแยกได้ (node storefront-api/server.js + admin-api/server.js) */
require("dotenv").config();
const express = require("express");
const path = require("path");
const storefront = require("./storefront-api/server");
const admin = require("./admin-api/server");

const app = express();
app.set("trust proxy", 1);
app.get("/healthz", (_q, res) => res.json({ ok: true, service: "keyima-combined" }));

// API ก่อน (ให้ /admin/api/* และ /api/* เข้า router ก่อน static)
app.use("/admin", admin);   // /admin/api/... , /admin/uploads/...
app.use("/", storefront);   // /api/...

// เสิร์ฟหน้าเว็บ static จากโดเมนเดียวกับ API → same-origin ไม่ต้องตั้ง CORS
const FE = path.join(__dirname, "..", "fe");
app.use("/admin", express.static(path.join(FE, "admin"), { extensions: ["html"] }));   // /admin , /admin/login
app.use("/", express.static(path.join(FE, "store"), { extensions: ["html"] }));         // / , /products , /product , /cart ...

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`KEYIMA : http://localhost:${PORT}  ·  store /  ·  admin /admin`));
