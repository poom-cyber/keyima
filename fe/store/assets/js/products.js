/* products.js — ค้นหา + กรอง + เรียงลำดับ */

/* อ่านพารามิเตอร์จาก URL */
const params = new URLSearchParams(location.search);
let activePage = "home";
if (params.get("cat") === "kuji") activePage = "kuji";
else if (params.get("cat") === "pokemon") activePage = "pokemon";
else if (params.get("status") === "preorder") activePage = "preorder";
renderChrome(activePage);

/* สถานะตัวกรอง */
const state = {
  cat: params.get("cat") || "all",
  search: "",
  statuses: params.get("status") ? [params.get("status")] : [],
  series: params.get("series") || "",
  price: "all",
  sort: params.get("sort") || "new"
};

/* ----- ตั้งค่าเริ่มต้นให้ตรง URL ----- */
function initControls() {
  // หมวด (radio)
  document.querySelectorAll('input[name="cat"]').forEach(r => {
    r.checked = r.value === state.cat;
    r.addEventListener("change", () => { state.cat = r.value; render(); syncTitle(); });
  });
  // สถานะ (checkbox)
  document.querySelectorAll('input[name="status"]').forEach(c => {
    c.checked = state.statuses.includes(c.value);
    c.addEventListener("change", () => {
      state.statuses = [...document.querySelectorAll('input[name="status"]:checked')].map(x => x.value);
      render();
    });
  });
  // ราคา
  document.querySelectorAll('input[name="price"]').forEach(r => {
    r.addEventListener("change", () => { state.price = r.value; render(); });
  });
  // ค้นหา
  const searchEl = document.getElementById("search");
  searchEl.addEventListener("input", () => { state.search = searchEl.value.trim().toLowerCase(); render(); });
  // เรียง
  const sortEl = document.getElementById("sort");
  sortEl.value = state.sort;
  sortEl.addEventListener("change", () => { state.sort = sortEl.value; render(); });

  // ซีรีส์ / อนิเมะ
  const serEl = document.getElementById("series-filter");
  if (serEl) {
    const counts = {};
    (window.PRODUCTS || []).forEach(p => { const s = p.series || "อื่นๆ"; counts[s] = (counts[s] || 0) + 1; });
    const opts = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    serEl.innerHTML = '<option value="">ทุกซีรีส์</option>' + opts.map(([s, n]) => `<option value="${s}">${s} (${n})</option>`).join("");
    serEl.value = state.series;
    serEl.addEventListener("change", () => { state.series = serEl.value; render(); syncTitle(); });
  }

  // chips มือถือ
  const chips = document.getElementById("cat-chips");
  chips.innerHTML = window.CATEGORIES.map(c =>
    `<button class="chip ${c.key === state.cat ? 'active' : ''}" data-cat="${c.key}">${c.label}</button>`
  ).join("");
  chips.querySelectorAll(".chip").forEach(ch => {
    ch.addEventListener("click", () => {
      state.cat = ch.getAttribute("data-cat");
      chips.querySelectorAll(".chip").forEach(x => x.classList.remove("active"));
      ch.classList.add("active");
      document.querySelectorAll('input[name="cat"]').forEach(r => r.checked = r.value === state.cat);
      render(); syncTitle();
    });
  });
}

function syncTitle() {
  const map = { all: "สินค้าทั้งหมด", kuji: "Ichiban Kuji — โมเดลรางวัลใหญ่", pokemon: "การ์ดโปเกม่อน" };
  let t = map[state.cat] || "สินค้าทั้งหมด";
  if (state.statuses.length === 1 && state.statuses[0] === "preorder") t = "สินค้าพรีออเดอร์";
  if (state.series) t = state.series;
  document.getElementById("page-title").textContent = t;
  document.title = t + " — KEYIMA";
}

/* ----- กรอง + เรียง ----- */
function applyFilters() {
  let list = [...window.PRODUCTS];

  if (state.cat !== "all") list = list.filter(p => p.category === state.cat);

  if (state.statuses.length) list = list.filter(p => state.statuses.includes(p.status));

  if (state.series) list = list.filter(p => (p.series || "อื่นๆ") === state.series);

  if (state.price !== "all") {
    const [min, max] = state.price.split("-").map(Number);
    list = list.filter(p => p.price >= min && p.price <= max);
  }

  if (state.search) {
    const q = state.search;
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.series.toLowerCase().includes(q) ||
      (p.grade || "").toLowerCase().includes(q)
    );
  }

  switch (state.sort) {
    case "price-asc": list.sort((a, b) => a.price - b.price); break;
    case "price-desc": list.sort((a, b) => b.price - a.price); break;
    case "name": list.sort((a, b) => a.name.localeCompare(b.name, "th")); break;
    case "series": list.sort((a, b) => (a.series || "อื่นๆ").localeCompare(b.series || "อื่นๆ", "th") || a.name.localeCompare(b.name, "th")); break;
    default: list.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
  }
  return list;
}

function render() {
  const list = applyFilters();
  const grid = document.getElementById("grid");
  const count = document.getElementById("result-count");
  count.textContent = `พบ ${list.length} รายการ`;

  if (!list.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1;">
      <div class="big">🔍</div>
      <h3>ไม่พบสินค้าที่ค้นหา</h3>
      <p>ลองเปลี่ยนคำค้นหรือล้างตัวกรองดูนะครับ</p>
    </div>`;
    return;
  }
  grid.innerHTML = list.map(productCard).join("");
  bindAddButtons();
}

Storefront.boot(() => {
  initControls();
  syncTitle();
  render();
});
