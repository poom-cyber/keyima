/* home.js — เติมสินค้าในหน้าแรก (โหลดจาก API ก่อน แล้วค่อย render) */
renderChrome("home");

function byDateDesc(a, b) { return new Date(b.addedAt) - new Date(a.addedAt); }

Storefront.boot(() => {
  const all = window.PRODUCTS;

  // มาใหม่: เรียงตามวันที่ล่าสุด 4 ชิ้น
  const newest = [...all].sort(byDateDesc).slice(0, 4);
  document.getElementById("grid-new").innerHTML = newest.map(productCard).join("");

  // Hero: ใช้สินค้าที่แอดมินเลือก (settings.heroProductId) ถ้าไม่ได้ตั้ง → คอลเลคชั่นล่าสุด
  const heroId = (Storefront.settings && Storefront.settings.heroProductId) || "";
  const heroProd = (heroId && all.find(p => p.id === heroId)) || newest[0];
  if (heroProd) {
    const hi = document.getElementById("hero-img");
    if (hi && heroProd.img) { hi.src = heroProd.img; hi.alt = heroProd.name || "คอลเลคชั่นล่าสุด"; }
    const hl = document.getElementById("hero-link");
    if (hl) hl.href = "product?id=" + encodeURIComponent(heroProd.id);
  }

  // พรีออเดอร์
  const preorders = all.filter(p => p.status === "preorder").slice(0, 4);
  const poGrid = document.getElementById("grid-preorder");
  poGrid.innerHTML = preorders.length
    ? preorders.map(productCard).join("")
    : `<p class="muted">ยังไม่มีสินค้าพรีออเดอร์ในขณะนี้</p>`;

  // ยอดนิยม: badge = hot
  const hot = all.filter(p => p.badge === "hot").slice(0, 4);
  document.getElementById("grid-hot").innerHTML = hot.map(productCard).join("");

  // ตามซีรีส์: จัดกลุ่มตาม series แสดงซีรีส์ที่ของเยอะสุด (เลื่อนแนวนอนได้)
  const bySeries = {};
  all.forEach(p => { const s = (p.series || "").trim(); if (s && s !== "อื่นๆ") (bySeries[s] = bySeries[s] || []).push(p); });
  const topSeries = Object.entries(bySeries)
    .filter(([s, arr]) => arr.length >= 3)
    .map(([s, arr]) => [s, [...arr].sort(byDateDesc)])                          // เรียงสินค้าในซีรีส์: ใหม่/อัปเดตล่าสุดก่อน
    .sort((a, b) => new Date(b[1][0].addedAt) - new Date(a[1][0].addedAt))      // เรียงซีรีส์: ที่อัปเดตล่าสุดขึ้นก่อน
    .slice(0, 6);
  document.getElementById("series-sections").innerHTML = topSeries.map(([s, arr]) => `
    <section class="section" style="padding-top:0;">
      <div class="container">
        <div class="section-head">
          <h2>${s}</h2>
          <a href="products?series=${encodeURIComponent(s)}" class="link">ดูทั้งหมด →</a>
        </div>
        <div class="hscroll">${arr.slice(0, 12).map(productCard).join("")}</div>
      </div>
    </section>`).join("");

  bindAddButtons();
});
