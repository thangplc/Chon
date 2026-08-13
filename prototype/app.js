const state = {
  purpose: "work",
  time: "morning",
  district: "all",
  selectedPlaceId: "syn_place_001",
  resultIds: [],
  contributionStep: 1,
  visitMode: "work",
};

const purposeCopy = {
  work: { label: "Làm việc", intent: "nơi yên, dễ tập trung", questions: ["noise", "crowd", "workability"] },
  study: { label: "Học/đọc", intent: "nơi sáng và ít phân tâm", questions: ["noise", "lighting", "workability"] },
  solo: { label: "Đi một mình", intent: "nơi thoải mái, không quá đông", questions: ["crowd", "privacy", "social_energy"] },
  date: { label: "Hẹn hò", intent: "nơi dễ trò chuyện và đủ riêng tư", questions: ["noise", "privacy", "lighting"] },
  friends: { label: "Gặp bạn bè", intent: "nơi có bàn nhóm và sức sống", questions: ["crowd", "social_energy", "noise"] },
  business_meeting: { label: "Họp công việc", intent: "nơi yên, riêng tư và có Wi-Fi", questions: ["noise", "privacy", "workability"] },
  relax: { label: "Thư giãn", intent: "nơi thoáng và có nhịp chậm", questions: ["noise", "crowd", "social_energy"] },
  late_night: { label: "Đi khuya", intent: "nơi mở muộn và còn chỗ", questions: ["crowd", "noise", "privacy"] },
};

const timeCopy = {
  now: { label: "Ngay bây giờ", hour: "Hiện tại" },
  morning: { label: "Sáng nay", hour: "09:00" },
  afternoon: { label: "Chiều nay", hour: "15:00" },
  evening: { label: "Tối nay", hour: "19:30" },
  late: { label: "Khuya", hour: "22:30" },
  custom: { label: "Thời gian đã chọn", hour: "19:30" },
};

const dimensionMeta = {
  noise: { label: "Độ ồn", question: "Không gian ồn đến mức nào?", ends: ["Rất yên", "Rất ồn"] },
  crowd: { label: "Độ đông", question: "Quán đông đến mức nào?", ends: ["Rất vắng", "Rất đông"] },
  lighting: { label: "Ánh sáng", question: "Ánh sáng mang cảm giác nào?", ends: ["Sáng rõ", "Tối ấm"] },
  privacy: { label: "Riêng tư", question: "Bạn cảm thấy riêng tư đến mức nào?", ends: ["Rất mở", "Rất riêng"] },
  workability: { label: "Làm việc", question: "Nơi này phù hợp làm việc đến mức nào?", ends: ["Không hợp", "Rất hợp"] },
  social_energy: { label: "Nhịp không gian", question: "Không khí trầm hay sôi động?", ends: ["Trầm", "Sôi động"] },
};

const places = [
  {
    id: "syn_place_001",
    name: "Góc Mây 01",
    district: "Quận 3",
    distance: "1,2 km",
    confidence: "medium",
    reports: 5,
    purposes: { work: 92, solo: 83, date: 68 },
    available: ["morning", "evening"],
    vibe: { noise: 1, crowd: 1, lighting: 2, privacy: 4, workability: 5, social_energy: 1 },
    reasons: {
      work: ["Khá yên vào sáng ngày thường", "Phù hợp làm việc lâu"],
      solo: ["Không quá đông", "Có nhiều góc riêng"],
      date: ["Đủ riêng tư", "Buổi sáng hơi sáng cho một buổi hẹn"],
    },
  },
  {
    id: "syn_place_008",
    name: "Tầng Hai 08",
    district: "Bình Thạnh",
    distance: "2,4 km",
    confidence: "high",
    reports: 9,
    purposes: { work: 89, solo: 88, date: 79 },
    available: ["morning", "afternoon", "evening"],
    vibe: { noise: 1, crowd: 2, lighting: 2, privacy: 5, workability: 5, social_energy: 1 },
    reasons: {
      work: ["Tầng hai rất yên", "Riêng tư và phù hợp tập trung"],
      solo: ["Ngồi một mình tự nhiên", "Nhiều góc riêng"],
      date: ["Riêng tư", "Không khí khá trầm"],
    },
  },
  {
    id: "syn_place_005",
    name: "Đèn Vàng 05",
    district: "Quận 1",
    distance: "3,1 km",
    confidence: "medium",
    reports: 6,
    purposes: { work: 42, solo: 65, date: 91 },
    available: ["afternoon", "evening"],
    vibe: { noise: 3, crowd: 5, lighting: 5, privacy: 4, workability: 1, social_energy: 4 },
    reasons: {
      work: ["Ánh sáng khá tối", "Thường đông vào buổi tối"],
      solo: ["Không khí có sức sống", "Có thể khó tìm chỗ"],
      date: ["Ánh sáng dịu và ấm", "Dễ trò chuyện nhưng thường đông"],
    },
  },
  {
    id: "syn_place_009",
    name: "Khoảng Lặng 09",
    district: "Bình Thạnh",
    distance: "2,8 km",
    confidence: "low",
    reports: 1,
    purposes: { work: 86, solo: 90, date: 74 },
    available: ["morning", "afternoon"],
    vibe: { noise: 1, crowd: 1, lighting: 2, privacy: 5, workability: 4, social_energy: 1 },
    reasons: {
      work: ["Yên và dễ tập trung", "Dữ liệu còn rất ít"],
      solo: ["Rất vắng và riêng tư", "Dữ liệu còn rất ít"],
      date: ["Riêng tư", "Không khí có thể quá trầm"],
    },
  },
  {
    id: "syn_place_010",
    name: "Nhịp Phố 10",
    district: "Bình Thạnh",
    distance: "2,0 km",
    confidence: "high",
    reports: 10,
    purposes: { work: 25, solo: 48, date: 58 },
    available: ["evening", "late"],
    vibe: { noise: 5, crowd: 5, lighting: 4, privacy: 1, workability: 1, social_energy: 5 },
    reasons: {
      work: ["Rất ồn", "Không phù hợp tập trung"],
      solo: ["Rất sôi động", "Có thể gây áp lực khi đi một mình"],
      date: ["Ánh sáng dịu", "Khó trò chuyện riêng tư"],
    },
  },
];

const extraPurposeScores = {
  study: { syn_place_001: 90, syn_place_008: 94, syn_place_005: 35, syn_place_009: 84, syn_place_010: 20 },
  friends: { syn_place_001: 55, syn_place_008: 52, syn_place_005: 88, syn_place_009: 40, syn_place_010: 96 },
  business_meeting: { syn_place_001: 88, syn_place_008: 93, syn_place_005: 38, syn_place_009: 78, syn_place_010: 18 },
  relax: { syn_place_001: 86, syn_place_008: 89, syn_place_005: 62, syn_place_009: 92, syn_place_010: 35 },
  late_night: { syn_place_001: 58, syn_place_008: 50, syn_place_005: 82, syn_place_009: 45, syn_place_010: 90 },
};

const extraPurposeReasons = {
  study: ["Yên, sáng và phù hợp đọc lâu", "Có bàn phù hợp học tập"],
  friends: ["Có sức sống và phù hợp trò chuyện nhóm", "Nên kiểm tra chỗ ngồi nhóm"],
  business_meeting: ["Đủ yên và riêng tư để trao đổi", "Wi-Fi là tiện ích ưu tiên"],
  relax: ["Nhịp không gian chậm và dễ chịu", "Không quá đông trong khung giờ này"],
  late_night: ["Mở trong khung giờ đã chọn", "Cần kiểm tra giờ đóng cửa theo thời lượng"],
};

function getPurposeScore(place) {
  return place.purposes[state.purpose] ?? extraPurposeScores[state.purpose]?.[place.id] ?? place.purposes.solo;
}

function getPurposeReasons(place) {
  return place.reasons[state.purpose] ?? extraPurposeReasons[state.purpose] ?? place.reasons.solo;
}

const screens = [...document.querySelectorAll("[data-screen]")];
const purposeButtons = [...document.querySelectorAll("[data-purpose]")];
const visitTime = document.getElementById("visit-time");
const district = document.getElementById("district");
const intentCopy = document.getElementById("intent-copy");
const resultList = document.getElementById("result-list");
const mapView = document.getElementById("map-view");
const emptyState = document.getElementById("empty-state");

function showScreen(name) {
  screens.forEach((screen) => screen.classList.toggle("is-active", screen.dataset.screen === name));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateIntent() {
  state.time = visitTime.value;
  state.district = district.value;
  intentCopy.textContent = `Tìm ${purposeCopy[state.purpose].intent} vào ${timeCopy[state.time].label.toLowerCase()}`;
}

function selectPurpose(purpose) {
  state.purpose = purpose;
  purposeButtons.forEach((button) => {
    const selected = button.dataset.purpose === purpose;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  updateIntent();
}

function filteredPlaces() {
  const selectedTime = state.time === "now" ? "morning" : state.time === "custom" ? "evening" : state.time;
  const selectedDistrict = state.district === "map" ? "all" : state.district;
  return places
    .filter((place) => selectedDistrict === "all" || place.district === selectedDistrict)
    .filter((place) => place.available.includes(selectedTime))
    .sort((a, b) => getPurposeScore(b) - getPurposeScore(a));
}

function renderResults() {
  const results = filteredPlaces();
  state.resultIds = results.map((place) => place.id);
  document.getElementById("results-context").textContent = `${purposeCopy[state.purpose].label} · ${timeCopy[state.time].label}`;
  resultList.innerHTML = "";
  const isEmpty = results.length === 0;
  resultList.hidden = isEmpty;
  mapView.hidden = false;
  emptyState.hidden = !isEmpty;
  document.getElementById("sheet-count").textContent = `${results.length} Chốn phù hợp`;

  results.forEach((place) => {
    const score = getPurposeScore(place);
    const reasons = getPurposeReasons(place);
    const warning = place.confidence === "low" ? `Dữ liệu còn ít · ${place.reports} report` : `${place.reports} report mô phỏng`;
    const card = document.createElement("button");
    card.type = "button";
    card.className = "result-card";
    card.dataset.place = place.id;
    card.innerHTML = `
      <span class="place-art" data-match="${score}%"></span>
      <span class="result-copy">
        <span class="result-meta">${place.district} · ${place.distance}</span>
        <h3>${place.name}</h3>
        <span class="result-reason">✓ ${reasons[0]}</span>
        <span class="result-warning">${place.confidence === "low" ? "!" : "○"} ${warning}</span>
      </span>`;
    card.addEventListener("click", () => openDetail(place.id));
    resultList.appendChild(card);
  });
}

function vibeLabel(key, value) {
  const labels = {
    noise: ["Rất yên", "Khá yên", "Vừa phải", "Khá ồn", "Rất ồn"],
    crowd: ["Rất vắng", "Khá vắng", "Vừa phải", "Khá đông", "Rất đông"],
    lighting: ["Rất sáng", "Khá sáng", "Cân bằng", "Khá dịu", "Tối ấm"],
    privacy: ["Rất mở", "Khá mở", "Vừa đủ", "Khá riêng", "Rất riêng"],
    workability: ["Không hợp", "Hạn chế", "Ngắn hạn", "Khá hợp", "Rất hợp"],
    social_energy: ["Rất trầm", "Khá trầm", "Có sức sống", "Sôi động", "Rất sôi động"],
  };
  return labels[key][value - 1];
}

function openDetail(id) {
  const place = places.find((item) => item.id === id) || places[0];
  state.selectedPlaceId = place.id;
  const score = getPurposeScore(place);
  const reasons = getPurposeReasons(place);
  document.getElementById("detail-match").textContent = `${score}% phù hợp`;
  document.getElementById("detail-district").textContent = `${place.district} · ${place.distance}`;
  document.getElementById("detail-title").textContent = place.name;
  document.getElementById("detail-time").textContent = timeCopy[state.time].hour;
  document.getElementById("contribution-place").textContent = place.name;
  document.getElementById("contribution-place-meta").textContent = place.district;

  const confidenceBox = document.getElementById("confidence-box");
  confidenceBox.classList.toggle("is-low", place.confidence === "low");
  document.getElementById("confidence-title").textContent = `Confidence ${place.confidence === "high" ? "cao" : place.confidence === "medium" ? "trung bình" : "thấp"}`;
  document.getElementById("confidence-copy").textContent = `Dựa trên ${place.reports} report mô phỏng cùng khung giờ`;

  const reasonList = document.getElementById("detail-reasons");
  reasonList.innerHTML = "";
  reasons.forEach((reason, index) => {
    const item = document.createElement("li");
    item.textContent = reason;
    if (index > 0 && (reason.includes("ít") || reason.includes("khó") || reason.includes("quá"))) item.classList.add("is-warning");
    reasonList.appendChild(item);
  });

  const vibeList = document.getElementById("vibe-list");
  vibeList.innerHTML = "";
  Object.entries(place.vibe).forEach(([key, value]) => {
    const row = document.createElement("div");
    row.className = "vibe-row";
    row.innerHTML = `
      <span>${dimensionMeta[key].label}</span>
      <span class="vibe-track"><span style="width:${value * 20}%"></span></span>
      <span class="vibe-value">${vibeLabel(key, value)}</span>`;
    vibeList.appendChild(row);
  });
  showScreen("detail");
}

function renderQuestions() {
  const keys = purposeCopy[state.visitMode].questions;
  const list = document.getElementById("question-list");
  list.innerHTML = "";
  keys.forEach((key) => {
    const meta = dimensionMeta[key];
    const wrapper = document.createElement("fieldset");
    wrapper.className = "vibe-question";
    wrapper.innerHTML = `<p>${meta.question}</p>`;
    const options = document.createElement("div");
    options.className = "scale-options";
    for (let value = 1; value <= 5; value += 1) {
      const label = document.createElement("label");
      const text = value === 1 ? meta.ends[0] : value === 5 ? meta.ends[1] : String(value);
      label.innerHTML = `<input type="radio" name="${key}" value="${value}" ${value === 3 ? "checked" : ""}><span>${text}</span>`;
      options.appendChild(label);
    }
    wrapper.appendChild(options);
    list.appendChild(wrapper);
  });
}

function setContributionStep(step) {
  state.contributionStep = step;
  document.querySelectorAll(".contribution-step").forEach((item) => item.classList.toggle("is-active", Number(item.dataset.step) === step));
  document.getElementById("step-number").textContent = String(step);
  document.getElementById("progress-value").style.width = `${step * 33.333}%`;
  document.getElementById("previous-step").hidden = step === 1;
  document.getElementById("next-step").textContent = step === 3 ? "Gửi report mô phỏng" : "Tiếp tục";
  const titles = { 1: "Bạn vừa ghé khi nào?", 2: "Không khí lúc đó thế nào?", 3: "Thêm một ghi chú" };
  document.getElementById("contribution-title").textContent = titles[step];
  if (step === 2) renderQuestions();
}

purposeButtons.forEach((button) => button.addEventListener("click", () => selectPurpose(button.dataset.purpose)));
visitTime.addEventListener("change", updateIntent);
district.addEventListener("change", updateIntent);
visitTime.addEventListener("change", () => {
  document.getElementById("custom-datetime").hidden = visitTime.value !== "custom";
});
district.addEventListener("change", () => {
  document.getElementById("map-picker").hidden = district.value !== "map";
});
document.getElementById("confirm-map-point").addEventListener("click", () => {
  district.value = "all";
  document.getElementById("map-picker").hidden = true;
  updateIntent();
});

document.getElementById("find-places").addEventListener("click", () => {
  updateIntent();
  renderResults();
  showScreen("results");
});

document.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => showScreen(button.dataset.go)));

document.getElementById("expand-map").addEventListener("click", (event) => {
  const expanded = mapView.classList.toggle("is-expanded");
  event.currentTarget.textContent = expanded ? "Thu nhỏ bản đồ" : "Phóng to bản đồ";
});

document.querySelectorAll(".advanced-filters .choice-chip").forEach((button) => {
  button.addEventListener("click", () => {
    const selected = button.getAttribute("aria-pressed") === "true";
    button.setAttribute("aria-pressed", String(!selected));
    button.classList.toggle("is-selected", !selected);
  });
});

document.querySelectorAll(".gallery-thumb").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".gallery-thumb").forEach((candidate) => candidate.classList.toggle("is-selected", candidate === button));
    const palettes = [
      "linear-gradient(155deg, rgba(201,95,63,.7), transparent 58%), repeating-linear-gradient(45deg,#456d59 0 32px,#78907c 32px 64px)",
      "linear-gradient(145deg,#c5a176,#6b4d38)",
      "linear-gradient(145deg,#78907c,#e4d7c6)",
      "linear-gradient(35deg,#507760,#c6a96e)",
      "linear-gradient(145deg,#d6b28a,#80624a)",
    ];
    document.getElementById("gallery-cover").style.background = palettes[Number(button.dataset.image)];
  });
});

document.querySelectorAll(".map-pin").forEach((button) => button.addEventListener("click", () => openDetail(button.dataset.place)));

document.querySelector(".save-button").addEventListener("click", (event) => {
  const button = event.currentTarget;
  const saved = button.getAttribute("aria-pressed") !== "true";
  button.setAttribute("aria-pressed", String(saved));
  button.classList.toggle("is-saved", saved);
  button.textContent = saved ? "♥" : "♡";
});

document.getElementById("start-contribution").addEventListener("click", () => {
  state.visitMode = state.purpose;
  document.querySelectorAll("[data-mode]").forEach((button) => {
    const selected = button.dataset.mode === state.visitMode;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  setContributionStep(1);
  showScreen("contribution");
});

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    state.visitMode = button.dataset.mode;
    document.querySelectorAll("[data-mode]").forEach((candidate) => {
      const selected = candidate === button;
      candidate.classList.toggle("is-selected", selected);
      candidate.setAttribute("aria-pressed", String(selected));
    });
  });
});

document.getElementById("next-step").addEventListener("click", () => {
  if (state.contributionStep < 3) setContributionStep(state.contributionStep + 1);
  else showScreen("success");
});

document.getElementById("previous-step").addEventListener("click", () => setContributionStep(Math.max(1, state.contributionStep - 1)));

document.getElementById("contribution-note").addEventListener("input", (event) => {
  document.getElementById("note-count").textContent = `${event.target.value.length}/140`;
});

selectPurpose("work");
