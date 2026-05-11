const form = document.querySelector("#finderForm");
const results = document.querySelector("#results");
const jsonOutput = document.querySelector("#jsonOutput");
const copyButton = document.querySelector("#copyButton");

let lastSearchAt = 0;

function resultCard(item, municipalityName) {
  const lat = Number(item.lat);
  const lng = Number(item.lon);
  const centerName = item.name || item.display_name.split(",")[0];
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
  return `
    <article class="municipality-card">
      <div class="card-main">
        <div>
          <p class="meta">${item.type || "候補"}・${item.class || "place"}</p>
          <h2>${centerName}</h2>
        </div>
      </div>
      <div class="metric-row">
        <div class="metric"><span>緯度</span><strong>${lat.toFixed(6)}</strong></div>
        <div class="metric"><span>経度</span><strong>${lng.toFixed(6)}</strong></div>
        <div class="metric"><span>重要度</span><strong>${Number(item.importance || 0).toFixed(2)}</strong></div>
      </div>
      <p class="hint">${item.display_name}</p>
      <div class="card-actions">
        <button class="primary" type="button" data-center='${JSON.stringify({
          name: municipalityName ? `${municipalityName} ${centerName}` : centerName,
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6))
        })}'>この座標を使う</button>
        <a class="secondary" href="${mapUrl}" target="_blank" rel="noopener">地図で確認</a>
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
  if (!response.ok) throw new Error("検索に失敗しました。少し待って再試行してください。");
  return response.json();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const query = data.get("query").toString().trim();
  const municipality = data.get("municipality").toString().trim();
  if (!query) return;

  results.innerHTML = `<div class="empty">検索中です。</div>`;
  try {
    const items = await searchPlace(query);
    results.innerHTML = items.length
      ? items.map((item) => resultCard(item, municipality)).join("")
      : `<div class="empty">候補が見つかりませんでした。</div>`;
  } catch (error) {
    results.innerHTML = `<div class="empty">${error.message}</div>`;
  }
});

results.addEventListener("click", (event) => {
  const button = event.target.closest("[data-center]");
  if (!button) return;
  const center = JSON.parse(button.dataset.center);
  jsonOutput.value = JSON.stringify({ center }, null, 2);
});

copyButton.addEventListener("click", async () => {
  if (!jsonOutput.value) return;
  await navigator.clipboard.writeText(jsonOutput.value);
  copyButton.textContent = "コピーしました";
  setTimeout(() => {
    copyButton.textContent = "コピー";
  }, 1200);
});
