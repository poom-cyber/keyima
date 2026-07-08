/* product.js — หน้ารายละเอียด: เลือกรางวัลย่อย + เลื่อนภาพ + robust (โหลดจาก API ถ้าไม่มีในลิสต์) */
renderChrome("");

function prizeRank(v) {
  const l = ((v.label || "") + "").trim().toLowerCase();
  if (l.startsWith("last") || l === "lo" || l.includes("ラストワン") || l.includes("ลาส")) return 900;
  const a = l.match(/^([a-z])(?![a-z])/); if (a) return 100 + (a[1].charCodeAt(0) - 97);
  const n = l.match(/^(\d+)/); if (n) return 300 + parseInt(n[1], 10);
  if (!v.label) return 850;
  return 600;
}
function vlist(p) {
  return (p.variations && p.variations.length)
    ? p.variations : [{ label: "", opt: "", price: p.price, stock: p.stock, img: p.img }];
}
let selIdx = 0, selImg = "";

Storefront.boot(async () => {
  const pid = new URLSearchParams(location.search).get("id");
  let p = Store.findProduct(pid);
  if (!p) { try { const r = await fetch(Storefront.base() + "/api/products/" + encodeURIComponent(pid || "")); if (r.ok) p = await r.json(); } catch (e) {} }
  const root = document.getElementById("pdp-root");
  if (!p || !p.id) {
    document.getElementById("breadcrumb").innerHTML = `<a href="/">หน้าแรก</a> / ไม่พบสินค้า`;
    root.innerHTML = `<div class="empty"><div class="big">😕</div><h3>ไม่พบสินค้านี้</h3>
      <p><a class="link" href="products">กลับไปหน้าสินค้าทั้งหมด</a></p></div>`;
    return;
  }
  trackView(p);
  renderPDP(p);
});

/* บันทึกความสนใจ (ซีรีส์/หมวด) ลง browser เพื่อทำ section "แนะนำสำหรับคุณ" หน้าแรก */
function trackView(p) {
  try {
    const pr = JSON.parse(localStorage.getItem("kps_prefs") || "{}");
    pr.series = pr.series || {}; pr.cat = pr.cat || {};
    if (p.series) pr.series[p.series] = (pr.series[p.series] || 0) + 1;
    if (p.category) pr.cat[p.category] = (pr.cat[p.category] || 0) + 1;
    localStorage.setItem("kps_prefs", JSON.stringify(pr));
  } catch (e) {}
}

function renderPDP(p) {
  const vs = vlist(p), pre = p.status === "preorder", sold = p.status === "soldout";
  const catLabel = p.category === "kuji" ? "Ichiban Kuji" : "การ์ดโปเกม่อน";
  document.getElementById("breadcrumb").innerHTML =
    `<a href="/">หน้าแรก</a> / <a href="products?cat=${p.category}">${catLabel}</a> / ${p.name}`;
  const imgs = [p.img, ...(p.images || []), ...vs.map(v => v.img)].filter((u, i, a) => u && a.indexOf(u) === i);
  const order = vs.map((v, i) => i).sort((a, b) => prizeRank(vs[a]) - prizeRank(vs[b]) || a - b);
  selIdx = order.find(i => pre || vs[i].stock > 0); if (selIdx === undefined) selIdx = order[0];
  selImg = "";

  function draw() {
    const v = vs[selIdx] || vs[0];
    const main = selImg || v.img || p.img;
    const max = pre ? 99 : (v.stock > 0 ? v.stock : 99);
    document.getElementById("pdp-root").innerHTML = `
    <div class="pdp">
      <div><div class="pdp-media">${cornerBadge(p)}<img id="pdp-img" src="${main}" alt="${p.name}"></div>
        ${imgs.length > 1 ? `<div class="thumbs">${imgs.slice(0, 14).map(u => `<img src="${u}" class="${u === main ? "on" : ""}" data-img="${u}">`).join("")}</div>` : ""}
      </div>
      <div class="pdp-info">
        <div style="margin-bottom:10px;">${statusBadge(p)}</div>
        <h1>${p.name}</h1>
        <div class="pdp-series">${p.series} · ${p.grade || ""}</div>
        <div class="pdp-price"><span class="price">${formatTHB(v.price)}</span></div>
        ${vs.length > 1 ? `<div class="muted" style="font-weight:700;margin:16px 0 8px;">เลือกรางวัล (${vs.length})</div>
          <div class="vgrid">${order.map((i) => { const vv = vs[i];
            const out = !pre && vv.stock <= 0;
            return `<button class="vchip ${i === selIdx ? "on" : ""}" ${out ? "disabled" : ""} data-idx="${i}">
              <span>${prizeLabel(vv) || ("แบบ " + (i + 1))}${vv.opt ? " · " + vv.opt : ""}</span>
              <small>${formatTHB(vv.price)}${out ? " · หมด" : ""}</small></button>`; }).join("")}</div>` : ""}
        <div class="pdp-meta">
          <div class="row"><span>หมวดสินค้า</span><span>${catLabel}</span></div>
          <div class="row"><span>สถานะ</span><span>${pre ? "เปิดพรีออเดอร์" : sold ? "สินค้าหมด" : "พร้อมส่ง"}</span></div>
        </div>
        ${!sold ? `
        <div class="qty-row"><span class="muted">จำนวน</span>
          <div class="qty"><button id="q-minus">−</button><input id="q-input" value="1" inputmode="numeric" data-max="${max}"><button id="q-plus">+</button></div></div>
        <div class="pdp-actions"><button class="btn btn--primary" id="add-btn">ใส่ตะกร้า</button><button class="btn btn--dark" id="buy-btn">ซื้อทันที</button></div>`
        : `<div class="pdp-actions"><button class="btn btn--ghost btn--block" disabled>สินค้าหมด</button></div>`}
        <div class="pdp-desc"><h3>รายละเอียดสินค้า</h3><p>${p.desc || p.name}</p></div>
      </div>
    </div>`;

    const root = document.getElementById("pdp-root");
    root.querySelectorAll("[data-img]").forEach(t => t.onclick = () => { selImg = t.dataset.img; draw(); });
    root.querySelectorAll("[data-idx]").forEach(b => b.onclick = () => { selIdx = +b.dataset.idx; selImg = ""; draw(); });
    if (!sold) {
      const input = document.getElementById("q-input");
      const clamp = x => Math.max(1, Math.min(parseInt(x) || 1, max));
      document.getElementById("q-minus").onclick = () => input.value = clamp(+input.value - 1);
      document.getElementById("q-plus").onclick = () => input.value = clamp(+input.value + 1);
      input.onchange = () => input.value = clamp(input.value);
      document.getElementById("add-btn").onclick = () => { Store.addToCart(p.id, selIdx, +input.value); showToast(`เพิ่ม "${(prizeLabel(vs[selIdx]) || p.name).slice(0, 24)}" ลงตะกร้าแล้ว`); };
      document.getElementById("buy-btn").onclick = () => { Store.addToCart(p.id, selIdx, +input.value); location.href = "cart"; };
    }
  }
  draw();

  const related = (window.PRODUCTS || []).filter(x => x.category === p.category && x.id !== p.id).slice(0, 4);
  const rel = document.getElementById("related");
  if (rel) { rel.innerHTML = related.map(productCard).join(""); if (typeof bindCards === "function") bindCards(); }
}
