/* home.js — เติมสินค้าในหน้าแรก (โหลดจาก API ก่อน แล้วค่อย render) */
renderChrome("home");

function byDateDesc(a, b) { return new Date(b.addedAt) - new Date(a.addedAt); }

Storefront.boot(() => {
  const all = window.PRODUCTS;

  // มาใหม่: เรียงตามวันที่ล่าสุด 4 ชิ้น
  const newest = [...all].sort(byDateDesc).slice(0, 4);
  document.getElementById("grid-new").innerHTML = newest.map(productCard).join("");

  // Hero: โชว์รูปคอลเลคชั่นล่าสุด + ลิงก์ไปหน้าสินค้านั้น
  const latest = newest[0];
  if (latest) {
    const hi = document.getElementById("hero-img");
    if (hi && latest.img) { hi.src = latest.img; hi.alt = latest.name || "คอลเลคชั่นล่าสุด"; }
    const hl = document.getElementById("hero-link");
    if (hl) hl.href = "product?id=" + encodeURIComponent(latest.id);
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

  bindAddButtons();
});
