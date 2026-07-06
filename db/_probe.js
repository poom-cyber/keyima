const Database = require("libsql");
const db = new Database("/tmp/libsql_probe.db");
db.exec("PRAGMA journal_mode = WAL");
db.exec(`CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT, price INTEGER, oldPrice INTEGER, images TEXT);`);
db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);`);
// named params @ แบบ db.js
db.prepare(`INSERT INTO products (id,name,price,oldPrice,images) VALUES (@id,@name,@price,@oldPrice,@images)`)
  .run({ id:"p1", name:"ฟิกเกอร์ A", price:1490, oldPrice:null, images:JSON.stringify(["a","b"]) });
// get / all
console.log("get:", db.prepare("SELECT * FROM products WHERE id=?").get("p1"));
console.log("count:", db.prepare("SELECT COUNT(*) c FROM products").get().c);
console.log("all:", db.prepare("SELECT * FROM products ORDER BY name").all().length, "แถว");
// ON CONFLICT (settings.set)
const set = db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=?");
set.run("promo","x","x"); set.run("promo","y","y");
console.log("upsert:", db.prepare("SELECT value FROM settings WHERE key=?").get("promo"));
// BEGIN/COMMIT ผ่าน exec
db.exec("BEGIN"); db.prepare("INSERT INTO products (id,name,price) VALUES (?,?,?)").run("p2","B",990); db.exec("COMMIT");
// run return shape
const r = db.prepare("UPDATE products SET price=? WHERE id=?").run(1290,"p2");
console.log("run return:", r, " (ต้องมี changes)");
// ALTER try/catch
try { db.exec("ALTER TABLE products ADD COLUMN slip TEXT"); console.log("alter ok"); } catch(e){ console.log("alter dup:", e.message.slice(0,40)); }
try { db.exec("ALTER TABLE products ADD COLUMN slip TEXT"); } catch(e){ console.log("alter 2 (คาดว่า error ซ้ำ):", e.message.slice(0,50)); }
console.log("\n✅ libsql sync API ใช้แทน node:sqlite ได้");
