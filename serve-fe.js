/* serve-fe.js — static server หน้าร้าน (Node ล้วน ไม่มี dependency)
   - URL สะอาด: /  → index.html, /products → products.html, /product?id=.. → product.html
   - redirect *.html → URL สะอาด (301)
   - Security: CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy
   - กัน path traversal + dotfiles + อนุญาตเฉพาะ GET/HEAD
   ใช้:  node serve-fe.js <โฟลเดอร์> <พอร์ต>              (เช่น node serve-fe.js fe/store 5173)
   ตั้ง API ที่อนุญาตใน connect-src ผ่าน env: API_ORIGINS="http://localhost:3000,http://localhost:4000" */
const http = require("http"), fs = require("fs"), path = require("path");

const root = path.resolve(process.argv[2] || ".");
const port = Number(process.argv[3] || 5173);
const API = process.env.API_ORIGINS || "http://localhost:3000 http://localhost:4000";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".gif": "image/gif", ".ico": "image/x-icon", ".woff2": "font/woff2"
};

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  "img-src 'self' data: https://cf.shopee.co.th https://promptpay.io https://placehold.co",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "script-src 'self' 'unsafe-inline'",              // FE มี inline handler บางจุด — โปรดักชันแนะนำ refactor แล้วตัด unsafe-inline
  "connect-src 'self' " + API.replace(/,/g, " ")
].join("; ");

function sec(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=(), interest-cohort=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Content-Security-Policy", CSP);
}
function end(res, code, body, type) { sec(res); res.writeHead(code, { "Content-Type": type || "text/plain; charset=utf-8" }); res.end(body); }

http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") return end(res, 405, "method not allowed");

  const qIndex = (req.url || "/").indexOf("?");
  const query = qIndex >= 0 ? req.url.slice(qIndex) : "";
  let p = decodeURIComponent((req.url || "/").split("?")[0]);

  // กัน traversal + dotfiles (.env, .git, ฯลฯ)
  if (p.includes("..") || p.split("/").some(seg => seg.startsWith("."))) return end(res, 403, "forbidden");

  // *.html → URL สะอาด (301)
  if (p.endsWith(".html")) {
    const clean = p === "/index.html" ? "/" : p.slice(0, -5);
    sec(res); res.writeHead(301, { Location: clean + query }); return res.end();
  }

  // เลือกไฟล์ที่จะเสิร์ฟ
  let file = null;
  if (p === "/" || p === "") file = "index.html";
  else {
    const rel = p.replace(/^\/+/, "");
    const abs = path.join(root, rel);
    if (abs.startsWith(root) && fs.existsSync(abs) && fs.statSync(abs).isFile()) file = rel;         // ไฟล์จริง (assets/รูป)
    else if (fs.existsSync(path.join(root, rel + ".html"))) file = rel + ".html";                    // extensionless → .html
  }
  if (!file) return end(res, 404, "<h1>404</h1><p>ไม่พบหน้าที่ต้องการ</p>", "text/html; charset=utf-8");

  const fp = path.join(root, file);
  if (!fp.startsWith(root)) return end(res, 403, "forbidden");
  fs.readFile(fp, (e, buf) => {
    if (e) return end(res, 404, "not found");
    sec(res);
    res.writeHead(200, { "Content-Type": TYPES[path.extname(fp).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(req.method === "HEAD" ? undefined : buf);
  });
}).listen(port, () => console.log(`FE (secure, clean-url) → http://localhost:${port}   dir: ${root}`));
