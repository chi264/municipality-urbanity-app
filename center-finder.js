const STORAGE_KEY_CENTERS = "urbanity:userCenters:v1";

const form = document.querySelector("#finderForm");
const municipalitySelect = document.querySelector("#municipalitySelect");
const queryInput = document.querySelector("#queryInput");
const results = document.querySelector("#results");
const jsonOutput = document.querySelector("#jsonOutput");
const copyButton = document.querySelector("#copyButton");
const downloadButton = document.querySelector("#downloadButton");

let municipalities = [];
let userCenters = JSON.parse(localStorage.getItem(STORAGE_KEY_CENTERS) || "{}");
let lastSearchAt = 0;

const text = {
  loadingData: "\u5e02\u753a\u6751\u30c7\u30fc\u30bf\u3092\u8aad\u307f\u8fbc\u307f\u4e2d\u3067\u3059\u3002",
  loadFailed: "\u5e02\u753a\u6751\u30c7\u30fc\u30bf\u3092\u8aad\u307f\u8fbc\u3081\u307e\u305b\u3093\u3067\u3057\u305f\u3002",
  searching: "\u691c\u7d22\u4e2d\u3067\u3059\u3002",
  noResults: "\u5019\u88dc\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3067\u3057\u305f\u3002",
  searchFailed: "\u691c\u7d22\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002\u5c11\u3057\u5f85\u3063\u3066\u518d\u8a66\u884c\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  saved: "\u3053\u306e\u2427\u6a19\u3092\u4fdd\u5b58\u3057\u307e\u3057\u305f\u3002\u672c\u30a2\u30d7\u30ea\u306e\u8a73\u7d30\u753b\u9762\u306b\u53cd\u6620\u3055\u308c\u307e\u3059\u3002",
  copied: "\u30b3\u30d4\u30fc\u3057\u307e\u3057\u305f",
  copy: "\u30b3\u30d4\u30fc"
};

function selectedMunicipality() {
  return municipalities.find((m) => m.id === municipalitySelect.value);
}

function centerForMunicipality(m) {
  return { ...(m.center || {}), ...(userCenters[m.id] || {}) };
}

function populateMunicipalitySelect() {
  municipalitySelect.innerHTML = municipalities
    .map((m) => {
      const center = centerForMunicipality(m);
      const suffix = center.lat && center.lng ? " / \u2427\u6a19\u3042\u308a" : "";
      return `<option value="${m.id}">${m.prefecture} ${m.name}${suffix}</option>`;
    })
    .join("");
  updateQueryFromSelection();
}

function updateQueryFromSelection() {
  const m = selectedMunicipality();
  if (!m) return;
  const center = centerForMunicipality(m);
  queryInput.value = `${m.prefecture} ${m.name} ${center.name || ""}`.trim();
}

function saveCenter(m, center) {
  userCenters[m.id] = center;
  localStorage.setItem(STORAGE_KEY_CENTERS, JSON.stringify(userCenters));
}

function mergedMunicipalities() {
  return municipalities.map((m) => {
    const center = userCenters[m.id];
    return center ? { ...m, center: { ...(m.center || {}), ...center } } : m;
  });
}

function outputFor(m, center) {
  const merged = { ...m, center: { ...(m.center || {}), ...center } };
  return {
    id: m.id,
    name: m.name,
    center: merged.center,
    municipalitiesJsonItem: merged
  };
}

function resultCard(item, m) {
  const lat = Number(item.lat);
  const lng = Number(item.lon);
  const placeName = item.name || item.display_name.split(",")[0];
  const centerName = `${placeName}`;
  const center = {
    name: centerName,
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6))
  };
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
  return `
    <article class="municipality-card">
      <div class="card-main">
        <div>
          <p class="meta">${item.type || "\u5019\u88dc"}\u30fb${item.class || "place"}</p>
          <h2>${centerName}</h2>
        </div>
      </div>
      <div class="metric-row">
        <div class="metric"><span>\u7def\u5ea6</span><strong>${center.lat}</strong></div>
        <div class="metric"><span>\u7d4c\u5ea6</span><strong>${center.lng}</strong></div>
        <div class="metric"><span>\u91cd\u8981\u5ea6</span><strong>${Number(item.importance || 0).toFixed(2)}</strong></div>
      </div>
      <p class="hint">${item.display_name}</p>
      <div class="card-actions">
        <button class="primary" type="button" data-center='${JSON.stringify(center)}'>\u3053\u306e\u2427\u6a19\u3092\u4fdd\u5b58</button>
        <a class="secondary" href="${mapUrl}" target="_blank" rel="noopener">\u5730\u56f3\u3067\u78ba\u8a8d</a>
      </div>
    </article>
  `;
}

async function searchPlace(query) {
  const now = Date.now();
  const wait = Math.max(0, 1100 - (now - lastSearchAt));
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  lastSearchAt = Date.now();

  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    limit: "8",
    countrycodes: "jp",
    "accept-language": "ja"
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
  if (!response.ok) throw new Error(text.searchFailed);
  return response.json();
}

async function init() {
  results.innerHTML = `<div class="empty">${text.loadingData}</div>`;
  try {
    const response = await fetch("data/municipalities.json", { cache: "no-store" });
    municipalities = await response.json();
    municipalities.sort((a, b) => `${a.prefecture}${a.name}`.localeCompare(`${b.prefecture}${b.name}`, "ja"));
    populateMunicipalitySelect();
    results.innerHTML = `<div class="empty">\u691c\u7d22\u3059\u308b\u3068\u5019\u88dc\u304c\u8868\u793a\u3055\u308c\u307e\u3059\u3002</div>`;
  } catch {
    results.innerHTML = `<div class="empty">${text.loadFailed}</div>`;
  }
}

municipalitySelect.addEventListener("change", updateQueryFromSelection);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const m = selectedMunicipality();
  const query = new FormData(form).get("query").toString().trim();
  if (!m || !query) return;

  results.innerHTML = `<div class="empty">${text.searching}</div>`;
  try {
    const items = await searchPlace(query);
    results.innerHTML = items.length
      ? items.map((item) => resultCard(item, m)).join("")
      : `<div class="empty">${text.noResults}</div>`;
  } catch (error) {
    results.innerHTML = `<div class="empty">${error.message}</div>`;
  }
});

results.addEventListener("click", (event) => {
  const button = event.target.closest("[data-center]");
  if (!button) return;
  const m = selectedMunicipality();
  if (!m) return;
  const center = JSON.parse(button.dataset.center);
  saveCenter(m, center);
  jsonOutput.value = JSON.stringify(outputFor(m, center), null, 2);
  populateMunicipalitySelect();
  results.insertAdjacentHTML("afterbegin", `<div class="empty">${text.saved}</div>`);
});

copyButton.addEventListener("click", async () => {
  if (!jsonOutput.value) return;
  await navigator.clipboard.writeText(jsonOutput.value);
  copyButton.textContent = text.copied;
  setTimeout(() => {
    copyButton.textContent = text.copy;
  }, 1200);
});

downloadButton.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(mergedMunicipalities(), null, 2) + "\n"], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "municipalities.updated.json";
  a.click();
  URL.revokeObjectURL(url);
});

init();
