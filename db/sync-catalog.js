/* db/sync-catalog.js — นำ "แคตตาล็อกราคาขายเอง" (จากไปป์ไลน์ Mercari → catalog.json)
   เข้าตาราง products (upsert). รันซ้ำได้ทุกครั้งที่ราคาอัปเดต
   ใช้:  node --experimental-sqlite sync-catalog.js            (Node 22.x)
        node sync-catalog.js                                   (Node 24)
   env:  CATALOG=path/to/catalog.json  DB_PATH=path/to/shop.db */
const path = require("path"), fs = require("fs");
const { Products } = require("./db");
const SRC = process.env.CATALOG || path.join(__dirname, "catalog.json");
const j = JSON.parse(fs.readFileSync(SRC, "utf8"));
const items = j.products || j;
let created = 0, updated = 0;
for (const p of items) {
  const row = { id:p.id, name:p.name, category:p.category, series:p.series||"", grade:"",
    price:p.price, priceMax:p.priceMax||p.price, oldPrice:null, status:p.status||"instock",
    stock:p.stock||0, badge:p.badge||"", addedAt:p.addedAt||new Date().toISOString().slice(0,10),
    img:p.img, images:p.images||[], short:"", desc:p.desc||p.name, variations:p.variations||[] };
  if (Products.get(p.id)) { Products.update(p.id, row); updated++; }
  else { Products.create(row); created++; }
}
console.log(`✅ sync-catalog: +${created} new, ~${updated} updated  (จาก ${SRC})`);
