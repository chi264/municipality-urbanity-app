const DATA_FILES = {
  municipalities: "data/municipalities.json",
  travelTimes: "data/travel_times.json"
};

const DEFAULT_WEIGHTS = {
  population: 25,
  density: 25,
  transport: 20,
  commerce: 15,
  administration: 10,
  subjective: 5
};

const STORAGE_KEYS = {
  scores: "urbanity:userScores:v1",
  weights: "urbanity:weights:v1",
  selected: "urbanity:selectedCompare:v1",
  centers: "urbanity:userCenters:v1"
};

const state = {
  municipalities: [],
  travelTimes: [],
  userScores: {},
  userCenters: {},
  weights: { ...DEFAULT_WEIGHTS },
  selected: [],
  filters: {
    query: "",
    prefecture: "all",
    type: "all",
    sort: "urbanity"
  }
};

const app = document.querySelector("#app");
const navLinks = [...document.querySelectorAll("[data-nav]")];

function normalizeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function optionalNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatNumber(value, digits = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "未入力";
  return n.toLocaleString("ja-JP", { maximumFractionDigits: digits });
}

function formatScore(value) {
  return normalizeNumber(value).toFixed(1);
}

function loadJSON(key) {
  return fetch(DATA_FILES[key], { cache: "no-store" }).then((res) => {
    if (!res.ok) throw new Error(`${DATA_FILES[key]} を読み込めませんでした`);
    return res.json();
  });
}

function loadLocalState() {
  state.userScores = JSON.parse(localStorage.getItem(STORAGE_KEYS.scores) || "{}");
  state.userCenters = JSON.parse(localStorage.getItem(STORAGE_KEYS.centers) || "{}");
  state.weights = { ...DEFAULT_WEIGHTS, ...JSON.parse(localStorage.getItem(STORAGE_KEYS.weights) || "{}") };
  state.selected = JSON.parse(localStorage.getItem(STORAGE_KEYS.selected) || "[]");
}

function saveUserScores() {
  localStorage.setItem(STORAGE_KEYS.scores, JSON.stringify(state.userScores));
}

function saveWeights() {
  localStorage.setItem(STORAGE_KEYS.weights, JSON.stringify(state.weights));
}

function saveSelected() {
  localStorage.setItem(STORAGE_KEYS.selected, JSON.stringify(state.selected));
}

function saveUserCenters() {
  localStorage.setItem(STORAGE_KEYS.centers, JSON.stringify(state.userCenters));
}

function getUserScore(id) {
  return state.userScores[id] || {};
}

function getMunicipalityCenter(m) {
  return { ...(m.center || {}), ...(state.userCenters[m.id] || {}) };
}

function subjectiveScore(id) {
  const score = getUserScore(id);
  const values = [
    score.feltUrbanity,
    score.centerBustle,
    score.stationStrength,
    score.commercialFacilities
  ].map(normalizeNumber).filter(Boolean);
  if (!values.length) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length * 10;
}

function baseScores(m) {
  const population = Math.min(100, Math.log10(Math.max(m.population || 1, 1)) / 6.4 * 100);
  const density = Math.min(100, Math.log10(Math.max(m.populationDensity || 1, 1)) / 4.4 * 100);
  return {
    population,
    density,
    transport: optionalNumber(m.scores?.transport),
    commerce: optionalNumber(m.scores?.commerce),
    administration: optionalNumber(m.scores?.administration),
    subjective: subjectiveScore(m.id)
  };
}

function urbanityScore(m) {
  const scores = baseScores(m);
  const totalWeight = Object.values(state.weights).reduce((sum, v) => sum + normalizeNumber(v), 0) || 1;
  return Object.entries(state.weights).reduce((sum, [key, weight]) => {
    return sum + (scores[key] || 0) * normalizeNumber(weight) / totalWeight;
  }, 0);
}

function enrichedMunicipalities() {
  return state.municipalities.map((m) => ({
    ...m,
    center: getMunicipalityCenter(m),
    calculatedScores: baseScores(m),
    urbanity: urbanityScore(m)
  }));
}

const ROUTE_ORIGINS = [
  { id: "mito-station", name: "水戸駅" },
  { id: "omiya-station", name: "大宮駅" },
  { id: "sapporo-station", name: "札幌駅" },
  { id: "asahikawa-station", name: "旭川駅" },
  { id: "hakodate-station", name: "函館駅" },
  { id: "obihiro-station", name: "帯広駅" },
  { id: "kushiro-station", name: "釧路駅" }
];

function centerDestination(m) {
  if (m.center?.lat && m.center?.lng) return `${m.center.lat},${m.center.lng}`;
  return `${m.prefecture} ${m.name} ${m.center?.name || ""}`.trim();
}

function googleMapsTransitUrl(origin, m) {
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination: centerDestination(m),
    travelmode: "transit"
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function metric(label, value) {
  return `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`;
}

function scoreBar(label, value) {
  if (value === null || value === undefined) {
    return `
      <div class="score-bar">
        <span>${label}</span>
        <div class="bar-track"><div class="bar-fill" style="width:0%"></div></div>
        <strong>未入力</strong>
      </div>
    `;
  }
  const safe = Math.max(0, Math.min(100, normalizeNumber(value)));
  return `
    <div class="score-bar">
      <span>${label}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${safe}%"></div></div>
      <strong>${formatScore(safe)}</strong>
    </div>
  `;
}

function prefectures() {
  return [...new Set(state.municipalities.map((m) => m.prefecture))].sort((a, b) => a.localeCompare(b, "ja"));
}

function types() {
  return [...new Set(state.municipalities.map((m) => m.type))].sort((a, b) => a.localeCompare(b, "ja"));
}

function filteredMunicipalities() {
  const query = state.filters.query.trim().toLowerCase();
  return enrichedMunicipalities()
    .filter((m) => state.filters.prefecture === "all" || m.prefecture === state.filters.prefecture)
    .filter((m) => state.filters.type === "all" || m.type === state.filters.type)
    .filter((m) => !query || `${m.prefecture}${m.name}${m.region}${m.center?.name || ""}`.toLowerCase().includes(query))
    .sort((a, b) => {
      if (state.filters.sort === "population") return normalizeNumber(b.population) - normalizeNumber(a.population);
      if (state.filters.sort === "density") return normalizeNumber(b.populationDensity) - normalizeNumber(a.populationDensity);
      if (state.filters.sort === "subjective") return subjectiveScore(b.id) - subjectiveScore(a.id);
      return b.urbanity - a.urbanity;
    });
}

function renderCard(m) {
  const selected = state.selected.includes(m.id);
  return `
    <article class="municipality-card">
      <div class="card-main">
        <div>
          <p class="meta">${m.prefecture}・${m.region || "地域未設定"}・${m.type}</p>
          <h2>${m.name}</h2>
        </div>
        <strong class="score-pill">${formatScore(m.urbanity)}</strong>
      </div>
      <div class="metric-row">
        ${metric("人口", `${formatNumber(m.population)}人`)}
        ${metric("密度", `${formatNumber(m.populationDensity, 1)}人/km²`)}
        ${metric("中心地", m.center?.name || "未入力")}
      </div>
      <div class="card-actions">
        <button type="button" class="secondary compare-toggle ${selected ? "is-selected" : ""}" data-compare="${m.id}">
          ${selected ? "比較中" : "比較に追加"}
        </button>
        <a class="primary details-link" href="#/detail/${m.id}">詳細</a>
      </div>
    </article>
  `;
}

function renderHome() {
  const list = enrichedMunicipalities();
  const top = [...list].sort((a, b) => b.urbanity - a.urbanity).slice(0, 3);
  app.innerHTML = `
    <section class="hero">
      <div>
        <h2>都会度を、人口だけで終わらせない。</h2>
        <p>人口・密度・交通・商業・行政・あなたの体感を重ねて、市町村の「都会っぽさ」を比較します。今はMVPの仮データ版です。</p>
        <a class="primary" href="#/list">市町村を探す</a>
      </div>
      <div class="panel">
        <h3>データ状態</h3>
        <div class="stat-grid">
          <div class="kpi"><span>登録自治体</span><strong>${list.length}</strong></div>
          <div class="kpi"><span>比較選択</span><strong>${state.selected.length}</strong></div>
          <div class="kpi"><span>主観入力</span><strong>${Object.keys(state.userScores).length}</strong></div>
          <div class="kpi"><span>地域時間</span><strong>${state.travelTimes.length}</strong></div>
        </div>
      </div>
    </section>
    <section class="section-head">
      <h3>都会度上位</h3>
      <a href="#/ranking">ランキング</a>
    </section>
    <div class="list-stack">${top.map(renderCard).join("")}</div>
  `;
}

function renderList() {
  const list = filteredMunicipalities();
  app.innerHTML = `
    <section class="toolbar" aria-label="絞り込み">
      <input id="searchInput" type="search" value="${state.filters.query}" placeholder="市町村・中心地で検索">
      <select id="prefectureFilter">
        <option value="all">全都道府県</option>
        ${prefectures().map((p) => `<option value="${p}" ${state.filters.prefecture === p ? "selected" : ""}>${p}</option>`).join("")}
      </select>
      <select id="typeFilter">
        <option value="all">全種別</option>
        ${types().map((t) => `<option value="${t}" ${state.filters.type === t ? "selected" : ""}>${t}</option>`).join("")}
      </select>
      <select id="sortFilter">
        <option value="urbanity" ${state.filters.sort === "urbanity" ? "selected" : ""}>都会度順</option>
        <option value="population" ${state.filters.sort === "population" ? "selected" : ""}>人口順</option>
        <option value="density" ${state.filters.sort === "density" ? "selected" : ""}>人口密度順</option>
        <option value="subjective" ${state.filters.sort === "subjective" ? "selected" : ""}>主観評価順</option>
      </select>
    </section>
    <div class="list-stack">${list.length ? list.map(renderCard).join("") : `<div class="empty">該当する市町村がありません。</div>`}</div>
  `;

  document.querySelector("#searchInput").addEventListener("input", (e) => {
    state.filters.query = e.target.value;
    renderList();
  });
  document.querySelector("#prefectureFilter").addEventListener("change", (e) => {
    state.filters.prefecture = e.target.value;
    renderList();
  });
  document.querySelector("#typeFilter").addEventListener("change", (e) => {
    state.filters.type = e.target.value;
    renderList();
  });
  document.querySelector("#sortFilter").addEventListener("change", (e) => {
    state.filters.sort = e.target.value;
    renderList();
  });
}

function renderDetail(id) {
  const m = enrichedMunicipalities().find((item) => item.id === id);
  if (!m) {
    app.innerHTML = `<div class="empty">\u5e02\u753a\u6751\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3002</div>`;
    return;
  }
  const user = getUserScore(id);
  const selected = state.selected.includes(id);
  const times = state.travelTimes.filter((t) => t.toMunicipalityId === id);
  const center = m.center || {};
  app.innerHTML = `
    <section class="detail-head">
      <div class="detail-title">
        <p class="meta">${m.prefecture}\u30fb${m.region || "\u5730\u57df\u672a\u8a2d\u5b9a"}\u30fb${m.type}</p>
        <h2>${m.name}</h2>
        <p class="hint">${center.name || "\u4e2d\u5fc3\u5730\u672a\u5165\u529b"} / ${center.lat ?? "\u7def\u5ea6\u672a\u5165\u529b"}, ${center.lng ?? "\u7d4c\u5ea6\u672a\u5165\u529b"}</p>
      </div>
      <strong class="score-pill">${formatScore(m.urbanity)}</strong>
    </section>
    <div class="detail-grid">
      <section class="detail-section">
        <h3>\u57fa\u672c\u60c5\u5831</h3>
        <div class="metric-row">
          ${metric("\u4eba\u53e3", `${formatNumber(m.population)}\u4eba`)}
          ${metric("\u9762\u7a4d", `${formatNumber(m.area, 2)}km\u00b2`)}
          ${metric("\u5bc6\u5ea6", `${formatNumber(m.populationDensity, 1)}\u4eba/km\u00b2`)}
        </div>
        <p class="hint">${m.notes || "\u30e1\u30e2\u306f\u672a\u5165\u529b\u3067\u3059\u3002"}</p>
        <button type="button" class="secondary compare-toggle ${selected ? "is-selected" : ""}" data-compare="${m.id}">
          ${selected ? "\u6bd4\u8f03\u304b\u3089\u5916\u3059" : "\u6bd4\u8f03\u306b\u8ffd\u52a0"}
        </button>
      </section>
      <section class="detail-section">
        <h3>\u4e2d\u5fc3\u5730\u7de8\u96c6</h3>
        <form class="form-stack" id="centerForm">
          <label><span>\u4e2d\u5fc3\u5730\u540d</span><input name="centerName" value="${center.name || ""}" placeholder="\u4f8b\uff1a\u672d\u5e4c\u99c5\u30fb\u5927\u901a\u5468\u8fba"></label>
          <label><span>\u7def\u5ea6</span><input name="centerLat" inputmode="decimal" value="${center.lat ?? ""}" placeholder="\u4f8b\uff1a43.0687"></label>
          <label><span>\u7d4c\u5ea6</span><input name="centerLng" inputmode="decimal" value="${center.lng ?? ""}" placeholder="\u4f8b\uff1a141.3508"></label>
          <button class="primary" type="submit">\u4e2d\u5fc3\u5730\u3092\u4fdd\u5b58</button>
          <button class="secondary" type="button" id="resetCenter">\u521d\u671f\u5024\u306b\u623b\u3059</button>
        </form>
        <p class="hint">\u4fdd\u5b58\u3057\u305f\u4e2d\u5fc3\u5730\u306f\u3053\u306e\u7aef\u672b\u306elocalStorage\u306b\u5165\u308a\u307e\u3059\u3002\u78ba\u5b9a\u3057\u305f\u3089JSON\u3078\u53cd\u6620\u3067\u304d\u307e\u3059\u3002</p>
      </section>
      <section class="detail-section">
        <h3>\u5206\u91ce\u5225\u30b9\u30b3\u30a2</h3>
        ${scoreBar("\u4eba\u53e3", m.calculatedScores.population)}
        ${scoreBar("\u5bc6\u5ea6", m.calculatedScores.density)}
        ${scoreBar("\u4ea4\u901a", m.calculatedScores.transport)}
        ${scoreBar("\u5546\u696d", m.calculatedScores.commerce)}
        ${scoreBar("\u884c\u653f", m.calculatedScores.administration)}
        ${scoreBar("\u4e3b\u89b3", m.calculatedScores.subjective)}
      </section>
      <section class="detail-section">
        <h3>\u4e3b\u89b3\u8a55\u4fa1</h3>
        <form class="form-stack" id="subjectiveForm">
          ${rangeInput("feltUrbanity", "\u4f53\u611f\u90fd\u4f1a\u5ea6", user.feltUrbanity)}
          ${rangeInput("centerBustle", "\u4e2d\u5fc3\u5730\u306e\u8cd1\u308f\u3044", user.centerBustle)}
          ${rangeInput("stationStrength", "\u99c5\u524d\u306e\u5f37\u3055", user.stationStrength)}
          ${rangeInput("commercialFacilities", "\u5546\u696d\u65bd\u8a2d\u306e\u5145\u5b9f\u5ea6", user.commercialFacilities)}
          <label><span>\u30e1\u30e2</span><textarea name="memo" placeholder="\u6b69\u3044\u305f\u5370\u8c61\u3001\u99c5\u524d\u306e\u5f37\u3055\u3001\u5546\u696d\u65bd\u8a2d\u306a\u3069">${user.memo || ""}</textarea></label>
          <button class="primary" type="submit">\u4fdd\u5b58</button>
        </form>
      </section>
      <section class="detail-section">
        <h3>\u4e2d\u5fc3\u5730\u307e\u3067\u306e\u6642\u9593</h3>
        ${times.length ? times.map((t) => `<p><strong>${t.fromName}</strong> \u2192 ${center.name || m.name}: ${t.minutes}\u5206 <span class="hint">${t.mode}</span></p>`).join("") : `<p class="hint">\u6240\u8981\u6642\u9593\u30c7\u30fc\u30bf\u306f\u672a\u5165\u529b\u3067\u3059\u3002</p>`}
        <div class="route-links">
          ${ROUTE_ORIGINS.map((origin) => `<a class="secondary" href="${googleMapsTransitUrl(origin.name, m)}" target="_blank" rel="noopener">${origin.name}\u304b\u3089\u516c\u5171\u4ea4\u901a\u691c\u7d22</a>`).join("")}
        </div>
        <p class="hint">Google Maps\u3092\u958b\u3044\u3066\u516c\u5171\u4ea4\u901a\u7d4c\u8def\u3092\u78ba\u8a8d\u3057\u307e\u3059\u3002\u6240\u8981\u6642\u9593\u306e\u81ea\u52d5\u53d6\u308a\u8fbc\u307f\u306f\u3001API\u30ad\u30fc\u3068\u30b5\u30fc\u30d0\u30fc\u5074\u51e6\u7406\u3092\u7528\u610f\u3059\u308b\u6bb5\u968e\u3067\u5bfe\u5fdc\u3067\u304d\u307e\u3059\u3002</p>
      </section>
    </div>
  `;

  document.querySelector("#subjectiveForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    state.userScores[id] = {
      feltUrbanity: Number(form.get("feltUrbanity")),
      centerBustle: Number(form.get("centerBustle")),
      stationStrength: Number(form.get("stationStrength")),
      commercialFacilities: Number(form.get("commercialFacilities")),
      memo: form.get("memo").toString()
    };
    saveUserScores();
    renderDetail(id);
  });

  document.querySelector("#centerForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    state.userCenters[id] = {
      name: form.get("centerName").toString().trim(),
      lat: optionalNumber(form.get("centerLat")),
      lng: optionalNumber(form.get("centerLng"))
    };
    saveUserCenters();
    renderDetail(id);
  });

  document.querySelector("#resetCenter").addEventListener("click", () => {
    delete state.userCenters[id];
    saveUserCenters();
    renderDetail(id);
  });
}

function rangeInput(name, label, value = 5) {
  const safe = normalizeNumber(value) || 5;
  return `
    <label>
      <span>${label}</span>
      <div class="range-row">
        <input name="${name}" type="range" min="1" max="10" value="${safe}" oninput="this.nextElementSibling.value=this.value">
        <output>${safe}</output>
      </div>
    </label>
  `;
}

function renderCompare() {
  const selectedItems = enrichedMunicipalities().filter((m) => state.selected.includes(m.id));
  const candidates = enrichedMunicipalities().sort((a, b) => b.urbanity - a.urbanity);
  app.innerHTML = `
    <section class="compare-panel">
      <h2>比較</h2>
      <p class="hint">2件以上を選ぶと、主要指標の棒グラフで差を見られます。</p>
      <select id="compareAdd">
        <option value="">市町村を追加</option>
        ${candidates.map((m) => `<option value="${m.id}">${m.prefecture} ${m.name}</option>`).join("")}
      </select>
      <div class="comparison-list">
        ${selectedItems.length ? selectedItems.map((m) => `<div class="compare-chip"><span>${m.prefecture} ${m.name}</span><button class="secondary" type="button" data-compare="${m.id}">外す</button></div>`).join("") : `<div class="empty">比較する市町村を追加してください。</div>`}
      </div>
    </section>
    ${selectedItems.length >= 2 ? comparisonCharts(selectedItems) : ""}
  `;
  document.querySelector("#compareAdd").addEventListener("change", (e) => {
    if (e.target.value && !state.selected.includes(e.target.value)) {
      state.selected.push(e.target.value);
      saveSelected();
      renderCompare();
    }
  });
}

function comparisonCharts(items) {
  const fields = [
    ["population", "人口", (m) => m.population, "人"],
    ["density", "人口密度", (m) => m.populationDensity, "人/km²"],
    ["urbanity", "都会度", (m) => m.urbanity, ""],
    ["transport", "交通", (m) => m.calculatedScores.transport, ""],
    ["commerce", "商業", (m) => m.calculatedScores.commerce, ""],
    ["administration", "行政", (m) => m.calculatedScores.administration, ""],
    ["subjective", "主観", (m) => m.calculatedScores.subjective, ""]
  ];
  return fields.map(([key, label, getter, unit]) => {
    const max = Math.max(...items.map(getter), 1);
    return `
      <section class="detail-section">
        <h3>${label}</h3>
        <div class="chart-wrap">
          <div class="bar-chart">
            ${items.map((m) => {
              const value = getter(m);
              return `
                <div class="chart-line">
                  <span>${m.name}</span>
                  <div class="bar-track"><div class="bar-fill" style="width:${Math.max(3, value / max * 100)}%"></div></div>
                  <strong>${key === "urbanity" || !unit ? formatScore(value) : formatNumber(value, 1)}</strong>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      </section>
    `;
  }).join("");
}

function renderRanking() {
  const current = state.filters.prefecture;
  const prefFiltered = current === "all" ? enrichedMunicipalities() : enrichedMunicipalities().filter((m) => m.prefecture === current);
  const rankings = [
    ["都会度", [...prefFiltered].sort((a, b) => b.urbanity - a.urbanity), (m) => formatScore(m.urbanity)],
    ["人口", [...prefFiltered].sort((a, b) => normalizeNumber(b.population) - normalizeNumber(a.population)), (m) => `${formatNumber(m.population)}人`],
    ["人口密度", [...prefFiltered].sort((a, b) => normalizeNumber(b.populationDensity) - normalizeNumber(a.populationDensity)), (m) => `${formatNumber(m.populationDensity, 1)}人/km²`],
    ["主観評価", [...prefFiltered].sort((a, b) => subjectiveScore(b.id) - subjectiveScore(a.id)), (m) => formatScore(subjectiveScore(m.id))]
  ];
  app.innerHTML = `
    <section class="toolbar">
      <select id="rankingPrefecture">
        <option value="all">全国ランキング</option>
        ${prefectures().map((p) => `<option value="${p}" ${current === p ? "selected" : ""}>${p}</option>`).join("")}
      </select>
    </section>
    ${rankings.map(([title, list, value]) => `
      <section class="detail-section">
        <h3>${current === "all" ? "全国" : current}${title}ランキング</h3>
        <div class="ranking-list">
          ${list.slice(0, 10).map((m, i) => `<a class="rank-row" href="#/detail/${m.id}"><b>${i + 1}</b><span>${m.prefecture} ${m.name}</span><strong>${value(m)}</strong></a>`).join("")}
        </div>
      </section>
    `).join("")}
  `;
  document.querySelector("#rankingPrefecture").addEventListener("change", (e) => {
    state.filters.prefecture = e.target.value;
    renderRanking();
  });
}

function correlation(items, getX, getY) {
  const pairs = items.map((m) => [getX(m), getY(m)]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x > 0 && y > 0);
  if (pairs.length < 2) return 0;
  const avgX = pairs.reduce((s, [x]) => s + x, 0) / pairs.length;
  const avgY = pairs.reduce((s, [, y]) => s + y, 0) / pairs.length;
  const numerator = pairs.reduce((s, [x, y]) => s + (x - avgX) * (y - avgY), 0);
  const denomX = Math.sqrt(pairs.reduce((s, [x]) => s + (x - avgX) ** 2, 0));
  const denomY = Math.sqrt(pairs.reduce((s, [, y]) => s + (y - avgY) ** 2, 0));
  return denomX && denomY ? numerator / (denomX * denomY) : 0;
}

function renderStats() {
  const list = enrichedMunicipalities();
  const byPref = prefectures().map((prefecture) => {
    const items = list.filter((m) => m.prefecture === prefecture);
    const avg = items.reduce((sum, m) => sum + m.urbanity, 0) / items.length;
    return { prefecture, avg, count: items.length };
  }).sort((a, b) => b.avg - a.avg);
  const popCorr = correlation(list, (m) => Math.log10(m.population || 1), (m) => m.urbanity);
  const densityCorr = correlation(list, (m) => Math.log10(m.populationDensity || 1), (m) => m.urbanity);
  const gap = [...list].map((m) => ({
    ...m,
    popAdjusted: m.urbanity - (Math.log10(m.population || 1) / 6.4 * 100)
  })).sort((a, b) => b.popAdjusted - a.popAdjusted);

  app.innerHTML = `
    <section class="stat-grid">
      <div class="panel kpi"><span>人口と都会度の相関</span><strong>${popCorr.toFixed(2)}</strong></div>
      <div class="panel kpi"><span>密度と都会度の相関</span><strong>${densityCorr.toFixed(2)}</strong></div>
    </section>
    <section class="detail-section">
      <h3>都道府県ごとの平均都会度</h3>
      <div class="ranking-list">
        ${byPref.map((p) => `<div class="rank-row"><b>${p.count}</b><span>${p.prefecture}</span><strong>${formatScore(p.avg)}</strong></div>`).join("")}
      </div>
    </section>
    <section class="detail-section">
      <h3>人口の割に都会</h3>
      <div class="ranking-list">${gap.slice(0, 5).map((m, i) => `<a class="rank-row" href="#/detail/${m.id}"><b>${i + 1}</b><span>${m.prefecture} ${m.name}</span><strong>${formatScore(m.popAdjusted)}</strong></a>`).join("")}</div>
    </section>
    <section class="detail-section">
      <h3>人口の割に都会でない</h3>
      <div class="ranking-list">${gap.slice(-5).reverse().map((m, i) => `<a class="rank-row" href="#/detail/${m.id}"><b>${i + 1}</b><span>${m.prefecture} ${m.name}</span><strong>${formatScore(m.popAdjusted)}</strong></a>`).join("")}</div>
    </section>
  `;
}

function renderSettings() {
  const total = Object.values(state.weights).reduce((s, v) => s + normalizeNumber(v), 0);
  app.innerHTML = `
    <section class="detail-section">
      <h2>設定</h2>
      <p class="hint">重みは合計が100でなくても、自動的に比率として扱います。CSV追加時もJSONの項目名に合わせれば拡張できます。</p>
      <form id="weightsForm" class="settings-grid">
        ${Object.entries({
          population: "人口",
          density: "人口密度",
          transport: "交通",
          commerce: "商業",
          administration: "行政",
          subjective: "主観"
        }).map(([key, label]) => `
          <label><span>${label}</span><input name="${key}" type="number" min="0" max="100" value="${state.weights[key]}"></label>
        `).join("")}
        <button class="primary" type="submit">重みを保存</button>
        <button class="secondary" type="button" id="resetWeights">初期値へ</button>
      </form>
      <p class="hint">現在の合計: ${total}</p>
    </section>
    <section class="detail-section danger-zone">
      <h3>ユーザーデータ</h3>
      <p class="hint">主観評価と比較選択はこの端末のlocalStorageに保存されています。</p>
      <button class="secondary" id="clearUserData" type="button">主観評価を削除</button>
    </section>
    <section class="detail-section">
      <h3>データファイル</h3>
      <p class="hint">自治体: data/municipalities.json<br>中心地時間: data/travel_times.json<br>ユーザー入力: localStorage</p>
    </section>
  `;
  document.querySelector("#weightsForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    Object.keys(DEFAULT_WEIGHTS).forEach((key) => {
      state.weights[key] = Number(form.get(key));
    });
    saveWeights();
    renderSettings();
  });
  document.querySelector("#resetWeights").addEventListener("click", () => {
    state.weights = { ...DEFAULT_WEIGHTS };
    saveWeights();
    renderSettings();
  });
  document.querySelector("#clearUserData").addEventListener("click", () => {
    state.userScores = {};
    saveUserScores();
    renderSettings();
  });
}

function toggleCompare(id) {
  if (state.selected.includes(id)) {
    state.selected = state.selected.filter((item) => item !== id);
  } else {
    state.selected.push(id);
  }
  saveSelected();
  route();
}

function updateActiveNav(path) {
  const section = path.split("/")[1] || "home";
  navLinks.forEach((link) => link.classList.toggle("is-active", link.dataset.nav === section || (section === "" && link.dataset.nav === "home")));
}

function route() {
  const path = location.hash.replace(/^#/, "") || "/";
  updateActiveNav(path);
  if (path.startsWith("/detail/")) renderDetail(decodeURIComponent(path.split("/")[2]));
  else if (path.startsWith("/list")) renderList();
  else if (path.startsWith("/compare")) renderCompare();
  else if (path.startsWith("/ranking")) renderRanking();
  else if (path.startsWith("/stats")) renderStats();
  else if (path.startsWith("/settings")) renderSettings();
  else renderHome();
  app.focus({ preventScroll: true });
}

document.addEventListener("click", (e) => {
  const button = e.target.closest("[data-compare]");
  if (button) toggleCompare(button.dataset.compare);
});

let deferredPrompt = null;
const installButton = document.querySelector("#installButton");
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installButton.hidden = false;
});
installButton.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installButton.hidden = true;
});

async function init() {
  loadLocalState();
  const [municipalities, travelTimes] = await Promise.all([
    loadJSON("municipalities"),
    loadJSON("travelTimes")
  ]);
  state.municipalities = municipalities;
  state.travelTimes = travelTimes;
  window.addEventListener("hashchange", route);
  route();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
  }
}

init().catch((error) => {
  app.innerHTML = `<div class="empty">起動に失敗しました。${error.message}</div>`;
});
