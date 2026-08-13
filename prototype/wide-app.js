const root = document.getElementById("wide-root");
const layout = root.dataset.layout;

const purposes = [
  ["work", "Làm việc"],
  ["study", "Học/đọc"],
  ["solo", "Một mình"],
  ["date", "Hẹn hò"],
  ["friends", "Gặp bạn"],
  ["business_meeting", "Họp việc"],
  ["relax", "Thư giãn"],
  ["late_night", "Đi khuya"],
];

const places = [
  { id: "cloud", name: "Góc Mây 01", area: "Quận 3", distance: "1,2 km", score: 92, confidence: "Trung bình", reports: 5, price: "50–90k", size: "Vừa", reasons: ["Khá yên vào sáng ngày thường", "Có Wi-Fi và ổ điện"], amenities: ["Wi-Fi", "Ổ điện", "Bàn laptop"] },
  { id: "floor", name: "Tầng Hai 08", area: "Bình Thạnh", distance: "2,4 km", score: 89, confidence: "Cao", reports: 9, price: "50–90k", size: "Rộng", reasons: ["Tầng hai yên và riêng tư", "Phù hợp ngồi lâu"], amenities: ["Wi-Fi", "Ổ điện", "Nhiều tầng"] },
  { id: "quiet", name: "Khoảng Lặng 09", area: "Bình Thạnh", distance: "2,8 km", score: 86, confidence: "Thấp", reports: 1, price: "Dưới 50k", size: "Nhỏ", reasons: ["Không quá đông", "Dữ liệu còn rất ít"], amenities: ["Ngoài trời", "Gửi xe"] },
  { id: "yellow", name: "Đèn Vàng 05", area: "Quận 1", distance: "3,1 km", score: 73, confidence: "Trung bình", reports: 6, price: "90–150k", size: "Vừa", reasons: ["Ánh sáng dịu", "Thường đông vào buổi tối"], amenities: ["Điều hòa", "Phòng riêng"] },
];

const state = { purpose: "work", selected: "cloud", modalStep: 1 };

function purposeChips(className) {
  return purposes.map(([key, label]) => `<button type="button" class="${className}${key === state.purpose ? " is-selected" : ""}" data-purpose="${key}" aria-pressed="${key === state.purpose}">${label}</button>`).join("");
}

root.innerHTML = `
  <main class="wide-app" aria-label="Chốn ${layout} prototype">
    <div class="prototype-banner">Prototype ${layout === "desktop" ? "desktop" : "tablet"} · dữ liệu hoàn toàn mô phỏng</div>
    <header class="global-header">
      <div class="brand"><span class="brand-mark">C</span><span>Chốn</span></div>
      <label class="global-search"><input type="search" placeholder="Tìm khu vực, tên quán hoặc một cảm giác…" aria-label="Tìm kiếm"><button type="button">Tìm</button></label>
      <div class="header-actions"><button class="header-button secondary-header" type="button">Bộ sưu tập</button><button class="header-button" id="header-contribute" type="button">+ Góp vibe</button></div>
    </header>
    <nav class="quick-bar" aria-label="Mục đích nhanh">
      <span class="quick-bar-label">Mục đích</span>
      ${purposeChips("purpose-chip")}
      <button class="filter-chip tablet-filter-trigger" id="tablet-filter-trigger" type="button">Bộ lọc</button>
    </nav>
    <div class="workspace">
      <aside class="filter-panel" id="filter-panel">
        <div class="panel-heading"><h2>Tìm một Chốn</h2><button class="icon-button close-filter" id="close-filter" type="button" aria-label="Đóng bộ lọc">×</button></div>
        <div class="filter-block field-stack">
          <label for="area-select">Khu vực</label>
          <input id="area-search" type="search" placeholder="Thảo Điền, Hồ Con Rùa…">
          <select id="area-select"><option>Vị trí hiện tại</option><option>Quận 1</option><option>Quận 3</option><option>Bình Thạnh</option><option>Chọn trên bản đồ…</option></select>
          <div class="field-row"><select aria-label="Bán kính"><option>500 m</option><option selected>1 km</option><option>3 km</option><option>5 km</option></select><button class="option-button" id="show-map-picker" type="button">Chọn trên bản đồ</button></div>
          <div class="filter-map-picker" id="filter-map-picker" hidden>Đặt tâm tìm kiếm · bán kính 1 km</div>
        </div>
        <div class="filter-block field-stack">
          <span class="filter-title">Thời gian</span>
          <select id="time-select"><option>Ngay bây giờ</option><option>Sáng nay · 09:00</option><option>Chiều nay · 15:00</option><option>Tối nay · 19:30</option><option>Khuya · 22:30</option><option value="custom">Chọn ngày và giờ…</option></select>
          <div class="field-row" id="date-time-fields" hidden><input type="date" value="2026-08-15" aria-label="Ngày"><input type="time" value="19:30" aria-label="Giờ"></div>
          <select aria-label="Thời lượng"><option>Không rõ thời lượng</option><option>Dưới 1 giờ</option><option selected>1–2 giờ</option><option>Trên 2 giờ</option></select>
        </div>
        <div class="filter-block"><span class="filter-title">Quy mô</span><div class="option-grid"><button class="option-button" type="button">Nhỏ</button><button class="option-button is-selected" type="button">Vừa</button><button class="option-button" type="button">Rộng</button></div></div>
        <div class="filter-block"><span class="filter-title">Tiện ích</span><div class="option-grid"><button class="option-button is-selected" type="button">Wi-Fi</button><button class="option-button is-selected" type="button">Ổ điện</button><button class="option-button" type="button">Bàn laptop</button><button class="option-button" type="button">Ngoài trời</button><button class="option-button" type="button">Gửi xe</button><button class="option-button" type="button">Phòng riêng</button></div></div>
        <div class="filter-block"><span class="filter-title">Giá/người</span><div class="option-grid"><button class="option-button" type="button">Dưới 50k</button><button class="option-button is-selected" type="button">50–90k</button><button class="option-button" type="button">90–150k</button><button class="option-button" type="button">Trên 150k</button></div></div>
        <button class="apply-button" id="apply-filters" type="button">Áp dụng bộ lọc</button>
      </aside>
      <section class="results-panel" aria-labelledby="wide-results-title">
        <div class="results-heading"><div><p class="eyebrow" id="result-purpose">Làm việc · Ngay bây giờ</p><h1 id="wide-results-title">Chốn phù hợp</h1></div><span class="result-count">4 kết quả</span></div>
        <div class="result-list" id="wide-result-list"></div>
      </section>
      <section class="map-panel" id="wide-map" aria-label="Bản đồ kết quả mô phỏng">
        <div class="map-canvas">
          <div class="map-road road-a"></div><div class="map-road road-b"></div><div class="map-road road-c"></div>
          <span class="map-label label-q3">Quận 3</span><span class="map-label label-bt">Bình Thạnh</span>
          ${places.map((place, index) => `<button class="map-marker marker-${index + 1}${place.id === state.selected ? " is-selected" : ""}" type="button" data-place="${place.id}" aria-label="Mở ${place.name}"><span>${index + 1}</span></button>`).join("")}
          <div class="map-toolbar"><button class="map-tool" type="button">◎ Vị trí tôi</button><button class="map-tool" id="expand-wide-map" type="button">Phóng to</button></div>
          <aside class="detail-drawer" id="detail-drawer"></aside>
        </div>
      </section>
    </div>
  </main>
  <div class="overlay" id="contribution-overlay" hidden>
    <section class="detail-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-heading"><div><p class="eyebrow">Góp vibe · bước <span id="modal-step-label">1</span>/3</p><h2 id="modal-title">Bạn vừa ghé để làm gì?</h2></div><button class="icon-button" id="close-modal" type="button" aria-label="Đóng">×</button></div>
      <div class="modal-progress"><span class="is-active"></span><span></span><span></span></div>
      <div class="modal-step is-active" data-modal-step="1"><div class="purpose-options">${purposeChips("option-button")}</div></div>
      <div class="modal-step" data-modal-step="2"><div class="modal-question-grid"><div class="modal-question"><strong>Độ ồn</strong><div class="scale">${[1,2,3,4,5].map(n => `<button type="button"${n === 2 ? ' class="is-selected"' : ""}>${n}</button>`).join("")}</div></div><div class="modal-question"><strong>Độ đông</strong><div class="scale">${[1,2,3,4,5].map(n => `<button type="button"${n === 2 ? ' class="is-selected"' : ""}>${n}</button>`).join("")}</div></div><div class="modal-question"><strong>Khả năng làm việc</strong><div class="scale">${[1,2,3,4,5].map(n => `<button type="button"${n === 4 ? ' class="is-selected"' : ""}>${n}</button>`).join("")}</div></div></div></div>
      <div class="modal-step" data-modal-step="3"><textarea rows="5" maxlength="140" placeholder="Ví dụ: tầng hai yên hơn khu dưới…"></textarea><div class="modal-notice">Đây là prototype. Report không được lưu hoặc gửi đi.</div></div>
      <div class="modal-actions"><button class="soft-button" id="modal-back" type="button" hidden>Quay lại</button><button class="primary-button" id="modal-next" type="button">Tiếp tục</button></div>
    </section>
  </div>`;

const resultList = document.getElementById("wide-result-list");
const drawer = document.getElementById("detail-drawer");

function renderResults() {
  resultList.innerHTML = places.map((place) => `
    <button class="result-card${place.id === state.selected ? " is-selected" : ""}" type="button" data-place="${place.id}">
      <span class="result-image"><span class="result-score">${place.score}%</span></span>
      <span class="result-copy"><span class="result-meta">${place.area} · ${place.distance} · ${place.price}</span><h3>${place.name}</h3><span class="result-reason">✓ ${place.reasons[0]}</span><span class="result-warning">${place.confidence === "Thấp" ? "!" : "○"} ${place.confidence} · ${place.reports} report</span></span>
    </button>`).join("");
  document.querySelectorAll(".result-card").forEach((button) => button.addEventListener("click", () => selectPlace(button.dataset.place)));
}

function renderDrawer() {
  const place = places.find((item) => item.id === state.selected) || places[0];
  drawer.innerHTML = `
    <button class="drawer-close" id="drawer-close" type="button" aria-label="Đóng chi tiết">×</button>
    <div class="detail-cover" id="wide-cover"></div>
    <div class="gallery-row">${[0,1,2,3,4].map(n => `<button class="gallery-thumb${n === 0 ? " is-selected" : ""}" type="button" data-image="${n}" aria-label="Ảnh ${n + 1}"></button>`).join("")}</div>
    <p class="media-source">Ảnh mô phỏng · synthetic · gallery tối đa 5 ảnh</p>
    <div class="detail-title"><div><p class="eyebrow">${place.area} · ${place.size}</p><h2>${place.name}</h2></div><span class="detail-score">${place.score}% phù hợp</span></div>
    <p class="detail-meta">${place.price}/người · Confidence ${place.confidence.toLowerCase()} · ${place.reports} report mô phỏng</p>
    <ul class="detail-reasons"><li>✓ ${place.reasons[0]}</li><li>✓ ${place.reasons[1]}</li></ul>
    <div class="amenity-row">${place.amenities.map(item => `<span class="amenity">${item}</span>`).join("")}</div>
    <div class="drawer-actions"><button class="soft-button" type="button">Mở chỉ đường</button><button class="primary-button contribute-button" type="button">Góp vibe</button></div>`;
  document.getElementById("drawer-close").addEventListener("click", () => { drawer.hidden = true; });
  drawer.querySelector(".contribute-button").addEventListener("click", openModal);
  drawer.querySelectorAll(".gallery-thumb").forEach((button) => button.addEventListener("click", () => {
    drawer.querySelectorAll(".gallery-thumb").forEach((candidate) => candidate.classList.toggle("is-selected", candidate === button));
    const palettes = ["linear-gradient(145deg,rgba(201,96,64,.7),transparent 58%),repeating-linear-gradient(45deg,#476f5b 0 25px,#7e9683 25px 50px)", "linear-gradient(35deg,#c6a279,#654b39)", "linear-gradient(145deg,#78907c,#e5d8c7)", "linear-gradient(35deg,#507760,#c7aa70)", "linear-gradient(145deg,#d6b28a,#80624a)"];
    document.getElementById("wide-cover").style.background = palettes[Number(button.dataset.image)];
  }));
}

function selectPlace(id) {
  state.selected = id;
  drawer.hidden = false;
  renderResults();
  renderDrawer();
  document.querySelectorAll(".map-marker").forEach((marker) => marker.classList.toggle("is-selected", marker.dataset.place === id));
}

document.querySelectorAll(".purpose-chip").forEach((button) => button.addEventListener("click", () => {
  state.purpose = button.dataset.purpose;
  document.querySelectorAll(".purpose-chip").forEach((candidate) => { const selected = candidate === button; candidate.classList.toggle("is-selected", selected); candidate.setAttribute("aria-pressed", selected); });
  document.getElementById("result-purpose").textContent = `${button.textContent} · Ngay bây giờ`;
}));

document.querySelectorAll(".option-button").forEach((button) => {
  if (!button.dataset.purpose) button.addEventListener("click", () => button.classList.toggle("is-selected"));
});

document.querySelectorAll(".map-marker").forEach((button) => button.addEventListener("click", () => selectPlace(button.dataset.place)));
document.getElementById("expand-wide-map").addEventListener("click", (event) => { const expanded = document.getElementById("wide-map").classList.toggle("is-expanded"); event.currentTarget.textContent = expanded ? "Thu nhỏ" : "Phóng to"; });
document.getElementById("show-map-picker").addEventListener("click", () => { const picker = document.getElementById("filter-map-picker"); picker.hidden = !picker.hidden; });
document.getElementById("time-select").addEventListener("change", (event) => { document.getElementById("date-time-fields").hidden = event.target.value !== "custom"; });
document.getElementById("apply-filters").addEventListener("click", () => { document.getElementById("filter-panel").classList.remove("is-open"); });

const filterTrigger = document.getElementById("tablet-filter-trigger");
if (filterTrigger) filterTrigger.addEventListener("click", () => document.getElementById("filter-panel").classList.add("is-open"));
document.getElementById("close-filter").addEventListener("click", () => document.getElementById("filter-panel").classList.remove("is-open"));

function openModal() { state.modalStep = 1; updateModal(); document.getElementById("contribution-overlay").hidden = false; }
function closeModal() { document.getElementById("contribution-overlay").hidden = true; }
function updateModal() {
  document.querySelectorAll(".modal-step").forEach((item) => item.classList.toggle("is-active", Number(item.dataset.modalStep) === state.modalStep));
  document.querySelectorAll(".modal-progress span").forEach((item, index) => item.classList.toggle("is-active", index < state.modalStep));
  document.getElementById("modal-step-label").textContent = state.modalStep;
  document.getElementById("modal-title").textContent = state.modalStep === 1 ? "Bạn vừa ghé để làm gì?" : state.modalStep === 2 ? "Không khí lúc đó thế nào?" : "Thêm một ghi chú";
  document.getElementById("modal-back").hidden = state.modalStep === 1;
  document.getElementById("modal-next").textContent = state.modalStep === 3 ? "Gửi report mô phỏng" : "Tiếp tục";
}

document.getElementById("header-contribute").addEventListener("click", openModal);
document.getElementById("close-modal").addEventListener("click", closeModal);
document.getElementById("modal-next").addEventListener("click", () => { if (state.modalStep < 3) { state.modalStep += 1; updateModal(); } else closeModal(); });
document.getElementById("modal-back").addEventListener("click", () => { state.modalStep -= 1; updateModal(); });
document.querySelectorAll(".purpose-options [data-purpose]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".purpose-options [data-purpose]").forEach((candidate) => candidate.classList.toggle("is-selected", candidate === button));
}));
document.querySelectorAll(".scale button").forEach((button) => button.addEventListener("click", () => { button.parentElement.querySelectorAll("button").forEach((candidate) => candidate.classList.toggle("is-selected", candidate === button)); }));

renderResults();
renderDrawer();
