/* be/server.js — บริการรวม (สำหรับ deploy บนเครื่องเดียว/Render ให้ SQLite แชร์ไฟล์ได้)
   storefront (สาธารณะ) อยู่ที่ราก /   ·   admin อยู่ใต้ /admin
   local dev ยังรันแยกได้ (node storefront-api/server.js + admin-api/server.js) */
require("dotenv").config();
const express = require("express");
const storefront = require("./storefront-api/server");
const admin = require("./admin-api/server");

const app = express();
app.set("trust proxy", 1);
app.get("/healthz", (_q, res) => res.json({ ok: true, service: "keyima-combined" }));
app.use("/admin", admin);   // /admin/api/... , /admin/uploads/...
app.use("/", storefront);   // /api/...

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`KEYIMA backend (combined) : http://localhost:${PORT}  ·  storefront /  ·  admin /admin`));
