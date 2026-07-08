/* home.js — หน้าแรก: hero carousel (หลายคอล) + section จัดเรียงได้ + แนะนำตามความสนใจ */
renderChrome("home");
function byDateDesc(a, b) { return new Date(b.addedAt) - new Date(a.addedAt); }
function readPrefs() { try { return JSON.parse(localStorage.getItem("kps_prefs") || "{}"); } catch (e) { return {}; } }

Storefront.boot(() => {
  const all = window.PRODUCTS.filter(p => p.status !== "hidden");
  const S = Storefront.settings || {};

  setupHero(all, S);

  const order = String(S.homeSections || "new,series").split(",").map(s => s.trim()).filter(Boolean);
  const html = order.map(key => renderSection(key, all)).filter(Boolean).join("");
  document.getElementById("home-sections").innerHTML = html + viewAllHTML();
  bindAddButtons();
  bindHRows();
});

/* ---------- HERO (เลือกได้หลายคอล → สไลด์อัตโนมัติ) ---------- */
function setupHero(all, S) {
  let ids = String(S.heroProductIds || "").split(",").map(x => x.trim()).filter(Boolean);
  if (!ids.length && S.heroProductId) ids = [S.heroProductId];
  let heroes = ids.map(id => all.find(p => p.id === id)).filter(Boolean);
  if (!heroes.length) { const n = [...all].sort(byDateDesc)[0]; if (n) heroes = [n]; }
  const img = document.getElementById("hero-img");
  const link = document.getElementById("hero-link");
  const dots = document.getElementById("hero-dots");
  if (!heroes.length || !img) return;
  let i = 0;
  function show(n) {
    i = n; const p = heroes[i];
    if (p.img) img.src = p.img; img.alt = p.name || "";
    if (link) link.href = "product?id=" + encodeURIComponent(p.id);
    if (dots) dots.querySelectorAll("span").forEach((d, k) => d.classList.toggle("on", k === i));
  }
  if (heroes.length > 1 && dots) {
    dots.innerHTML = heroes.map((_, k) => `<span data-i="${k}"></span>`).join("");
    dots.querySelectorAll("span").forEach(d => d.onclick = () => show(+d.dataset.i));
  }
  show(0);
  if (heroes.length > 1) setInterval(() => show((i + 1) % heroes.length), 4500);
}

/* ---------- section ---------- */
function sectionHTML(title, link, inner) {
  return `
  <section class="section" style="padding-top:0;">
    <div class="container">
      <div class="section-head"><h2>${title}</h2>${link ? `<a href="${link}" class="link">ดูทั้งหมด →</a>` : ""}</div>
      ${inner}
    </div>
  </section>`;
}
function grid(list) {
  return `<div class="hrow">
    <button class="hrow-nav prev" type="button" aria-label="เลื่อนซ้าย">‹</button>
    <div class="hscroll">${list.map(productCard).join("")}</div>
    <button class="hrow-nav next" type="button" aria-label="เลื่อนขวา">›</button>
  </div>`;
}

/* ผูกปุ่มลูกศรเลื่อนแถวสินค้า + ซ่อนปุ่มเมื่อสุดขอบ */
function bindHRows() {
  document.querySelectorAll(".hrow").forEach(row => {
    if (row._bound) return; row._bound = true;
    const sc = row.querySelector(".hscroll");
    const prev = row.querySelector(".prev"), next = row.querySelector(".next");
    if (!sc) return;
    const step = () => Math.max(sc.clientWidth * 0.85, 240);
    prev.onclick = () => sc.scrollBy({ left: -step(), behavior: "smooth" });
    next.onclick = () => sc.scrollBy({ left: step(), behavior: "smooth" });
    const update = () => {
      const max = sc.scrollWidth - sc.clientWidth - 2;
      prev.classList.toggle("hide", sc.scrollLeft <= 2);
      next.classList.toggle("hide", sc.scrollLeft >= max);
    };
    sc.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  });
}

function renderSection(key, all) {
  if (key === "new") { const l = [...all].sort(byDateDesc).slice(0, 10); return l.length ? sectionHTML("🆕 สินค้ามาใหม่", "products?sort=new", grid(l)) : ""; }
  if (key === "preorder") { const l = all.filter(p => p.status === "preorder").slice(0, 10); return l.length ? sectionHTML("📦 เปิดพรีออเดอร์", "products?status=preorder", grid(l)) : ""; }
  if (key === "recommended") { const l = recommended(all); return l.length ? sectionHTML("✨ แนะนำสำหรับคุณ", "products", grid(l)) : ""; }
  if (key === "series") { return seriesHTML(all); }
  return "";
}

/* ตามซีรีส์ (หลายแถว เลื่อนแนวนอน) */
function seriesHTML(all) {
  const by = {};
  all.forEach(p => { const s = (p.series || "").trim(); if (s && s !== "อื่นๆ") (by[s] = by[s] || []).push(p); });
  const pref = String((Storefront.settings || {}).seriesOrder || "").split(",").map(x => x.trim()).filter(Boolean);
  const top = Object.entries(by)
    .filter(([s, a]) => a.length >= 3)
    .map(([s, a]) => [s, [...a].sort(byDateDesc)])
    .sort((a, b) => {
      const ia = pref.indexOf(a[0]), ib = pref.indexOf(b[0]);
      if (ia >= 0 && ib >= 0) return ia - ib;   // ทั้งคู่ถูกจัดลำดับ → ตามที่ตั้ง
      if (ia >= 0) return -1;                    // a ถูกจัดลำดับ → มาก่อน
      if (ib >= 0) return 1;
      return new Date(b[1][0].addedAt) - new Date(a[1][0].addedAt);  // ที่เหลือเรียงตามวันที่
    })
    .slice(0, 8);
  return top.map(([s, a]) => sectionHTML(s, "products?series=" + encodeURIComponent(s), grid(a.slice(0, 12)))).join("");
}

/* แนะนำตามความสนใจ (จาก localStorage ที่บันทึกตอนดูสินค้า/ค้นหา) */
function recommended(all) {
  const pr = readPrefs(); const ser = pr.series || {}, cat = pr.cat || {};
  const topSer = Object.entries(ser).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
  const topCatEntry = Object.entries(cat).sort((a, b) => b[1] - a[1])[0];
  const topCat = topCatEntry ? topCatEntry[0] : null;
  if (!topSer.length && !topCat) return [];
  let l = all.filter(p => topSer.includes(p.series) || (topCat && p.category === topCat));
  l.sort((a, b) => (topSer.includes(b.series) - topSer.includes(a.series)) || (new Date(b.addedAt) - new Date(a.addedAt)));
  return l.slice(0, 10);
}

function viewAllHTML() {
  return `
  <section class="section" style="padding-top:0;">
    <div class="container" style="text-align:center;">
      <a href="products" class="btn btn--primary" style="padding:14px 30px;font-size:1.05rem;">ดูสินค้าทั้งหมด →</a>
    </div>
  </section>`;
}
