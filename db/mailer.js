/* ============================================================
   shared/mailer.js — ส่งอีเมล (ใบยืนยัน/ใบพรีออเดอร์ + แจ้งสถานะ)
   - ถ้าตั้งค่า SMTP_* ใน .env -> ส่งจริงผ่าน nodemailer (รองรับ SendGrid/SES/Gmail SMTP)
   - ถ้าไม่ตั้งค่า -> โหมด dev: log อีเมลออก console (ไม่ส่งจริง)
   ฟังก์ชันทุกตัวกันพลาดเอง(ไม่ throw) เพื่อไม่ให้กระทบ flow การสั่งซื้อ
   ============================================================ */
let nodemailer = null;
try { nodemailer = require("nodemailer"); } catch (_) { /* ยังไม่ติดตั้งก็ได้ -> ใช้ console */ }

const FROM = process.env.MAIL_FROM || "KEYIMA <no-reply@keyima.com>";
const SHOP = process.env.SHOP_NAME || "KEYIMA";

let transport = null;
function getTransport() {
  if (transport) return transport;
  if (nodemailer && process.env.SMTP_HOST) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE) === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
    });
  } else {
    // dev transport: ไม่ส่งจริง แค่ log
    transport = { sendMail: async (m) => { console.log("\n📧 [DEV EMAIL]\n  to:", m.to, "\n  subject:", m.subject, "\n  ---\n" + m.text.split("\n").map(l => "  " + l).join("\n") + "\n"); return { dev: true }; } };
  }
  return transport;
}

const baht = n => "฿" + Number(n || 0).toLocaleString("th-TH");
const STATUS_TH = { pending: "รอยืนยันการชำระเงิน", paid: "ยืนยันการชำระเงินแล้ว", abroad: "กำลังเดินทางจากต่างประเทศ", packing: "เตรียมจัดส่งในไทย", shipped: "จัดส่งแล้ว", delivered: "ส่งสำเร็จ", cancelled: "ยกเลิกคำสั่งซื้อ" };

function orderLines(o) {
  const items = (o.items || []).map(it => `  • ${it.name}\n     ${it.prize || ""}${it.opt ? " · " + it.opt : ""}  x${it.qty}  =  ${baht(it.price * it.qty)}`).join("\n");
  const isPre = (o.items || []).some(it => /preorder/i.test(it.status || ""));
  return [
    `เลขที่คำสั่งซื้อ: ${o.orderNo}`,
    `วันที่: ${new Date(o.createdAt).toLocaleString("th-TH")}`,
    ``, `รายการสินค้า:`, items, ``,
    `ยอดสินค้า: ${baht(o.subtotal)}`,
    `ค่าจัดส่ง: ${o.shipping === 0 ? "ฟรี" : baht(o.shipping)}`,
    `ยอดชำระทั้งสิ้น: ${baht(o.total)}`,
    ``,
    `จัดส่งถึง: ${o.name} (${o.phone})`,
    `${o.address} ${o.subdist ? "ต." + o.subdist : ""} ${o.district ? "อ." + o.district : ""} จ.${o.province} ${o.zip}`
  ].join("\n");
}

async function send(to, subject, text) {
  if (!to) return;
  try { await getTransport().sendMail({ from: FROM, to, subject, text }); }
  catch (e) { console.warn("ส่งอีเมลไม่สำเร็จ:", e.message); }
}

/* ใบยืนยัน / ใบพรีออเดอร์ (ส่งตอนสร้างออเดอร์) */
async function sendOrderConfirmation(o) {
  const hasPre = (o.items || []).some(it => it.preorder);
  const head = hasPre
    ? `ใบยืนยันการสั่งจอง (พรีออเดอร์) — ${SHOP}`
    : `ใบยืนยันคำสั่งซื้อ — ${SHOP}`;
  const text = `สวัสดีคุณ ${o.name}\n\nขอบคุณที่สั่งซื้อกับ ${SHOP} 🌸\nนี่คือ${hasPre ? "ใบพรีออเดอร์" : "ใบยืนยันคำสั่งซื้อ"}ของคุณ\n\n${orderLines(o)}\n\nเราจะแจ้งความคืบหน้าทางอีเมลนี้\nขอบคุณครับ/ค่ะ\n${SHOP}`;
  return send(o.email, `${head} #${o.orderNo}`, text);
}

/* แจ้งเปลี่ยนสถานะ / เลขพัสดุ (ส่งตอนแอดมินอัปเดต) */
async function sendOrderStatus(o) {
  const st = STATUS_TH[o.status] || o.status;
  const track = o.tracking ? `\nเลขพัสดุ: ${o.tracking}` : "";
  const text = `สวัสดีคุณ ${o.name}\n\nคำสั่งซื้อ #${o.orderNo} อัปเดตสถานะเป็น: ${st}${track}\n\n${orderLines(o)}\n\nขอบคุณครับ/ค่ะ\n${SHOP}`;
  return send(o.email, `อัปเดตคำสั่งซื้อ #${o.orderNo} — ${st}`, text);
}

module.exports = { sendOrderConfirmation, sendOrderStatus };
