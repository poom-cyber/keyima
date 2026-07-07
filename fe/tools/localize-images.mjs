/* ============================================================
   localize-images.mjs — โหลดรูปสินค้าทั้งหมดจาก Shopee มาเก็บกับเว็บ
   (ภาพปก + แกลเลอรี + รูปของแต่ละรางวัล) แล้วแก้ลิงก์ให้ชี้ไฟล์ในเครื่อง
   กันรูปหายจาก hotlink protection ของ Shopee

   ใช้: (ต้องมี Node 18 ขึ้นไป)
     cd kuji-poke-shop
     node tools/localize-images.mjs

   สคริปต์จะค้นหา URL รูปของ Shopee ในไฟล์เหล่านี้เอง แล้วโหลด + แก้ลิงก์ให้:
     - demo.html
     - assets/js/data.js
     - server/seed-data.js
   ============================================================ */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const IMG_DIR = path.join(ROOT, "assets", "img");
const CONCURRENCY = 12;

const FILES = [
  path.join(ROOT, "demo.html"),
  path.join(ROOT, "assets", "js", "data.js"),
  path.join(ROOT, "server", "seed-data.js")
].filter(f => fs.existsSync(f));

const URL_RE = /https:\/\/cf\.shopee\.co\.th\/file\/[A-Za-z0-9_\-]+/g;

function extFromType(ct = "") {
  if (ct.includes("png")) return ".png";
  if (ct.includes("webp")) return ".webp";
  if (ct.includes("gif")) return ".gif";
  return ".jpg";
}
const localName = (url) => url.split("/file/")[1];   // ส่วน hash ท้าย URL = ชื่อไฟล์ (ไม่ซ้ำ)

async function download(url) {
  // ข้ามถ้ามีแล้ว
  const base = localName(url);
  for (const e of [".jpg", ".png", ".webp", ".gif"]) {
    if (fs.existsSync(path.join(IMG_DIR, base + e)))
      return { url, local: "assets/img/" + base + e, skipped: true };
  }
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://shopee.co.th/" } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const ext = extFromType(res.headers.get("content-type"));
  fs.writeFileSync(path.join(IMG_DIR, base + ext), Buffer.from(await res.arrayBuffer()));
  return { url, local: "assets/img/" + base + ext };
}

async function run() {
  if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

  // 1) รวบรวม URL ไม่ซ้ำจากทุกไฟล์
  const urls = new Set();
  for (const f of FILES) (fs.readFileSync(f, "utf8").match(URL_RE) || []).forEach(u => urls.add(u));
  const list = [...urls];
  console.log(`พบรูปจาก Shopee ${list.length} รูป — เริ่มดาวน์โหลดไปที่ assets/img/`);
  if (!list.length) { console.log("ไม่พบ URL ของ Shopee (อาจโหลด/แก้ไปแล้ว)"); return; }

  // 2) ดาวน์โหลดแบบจำกัด concurrency
  const map = {}; let done = 0, failed = 0; const fails = [];
  for (let i = 0; i < list.length; i += CONCURRENCY) {
    const batch = list.slice(i, i + CONCURRENCY);
    const out = await Promise.allSettled(batch.map(download));
    out.forEach((r, k) => {
      if (r.status === "fulfilled") { map[r.value.url] = r.value.local; done++; }
      else { failed++; fails.push(batch[k]); }
    });
    process.stdout.write(`\r  ดาวน์โหลด ${done}/${list.length}${failed ? " (พลาด " + failed + ")" : ""}`);
  }
  console.log("\nกำลังแก้ลิงก์รูปในไฟล์...");

  // 3) แทนที่ URL -> พาธในเครื่อง (เรียงยาวก่อนกันชนกัน)
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const f of FILES) {
    let s = fs.readFileSync(f, "utf8"), n = 0;
    for (const url of keys) if (s.includes(url)) { s = s.split(url).join(map[url]); n++; }
    fs.writeFileSync(f, s);
    console.log(`  ${path.relative(ROOT, f)} : แก้ ${n} ลิงก์`);
  }

  console.log(`\nเสร็จ ✓  สำเร็จ ${done} รูป, พลาด ${failed} รูป`);
  if (failed) {
    console.log("รูปที่พลาด (ยังใช้ลิงก์เดิม) — รันสคริปต์ซ้ำเพื่อลองใหม่ได้:");
    fails.slice(0, 10).forEach(u => console.log("   " + u));
    if (fails.length > 10) console.log(`   ...และอีก ${fails.length - 10} รูป`);
  }
}

run().catch(e => { console.error("ผิดพลาด:", e.message); process.exit(1); });
