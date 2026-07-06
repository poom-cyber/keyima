/* home.js — เติมสินค้าในหน้าแรก (โหลดจาก API ก่อน แล้วค่อย render) */
renderChrome("home");

function byDateDesc(a, b) { return new Date(b.addedAt) - new Date(a.addedAt); }

Storefront.boot(() => {
  const all = window.PRODUCTS;

  // มาใหม่: เรียงตามวันที่ล่าสุด 4 ชิ้น
  const newest = [...all].sort(byDateDesc).slice(0, 4);
  document.getElementById("grid-new").innerHTML = newest.map(productCard).join("");

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
