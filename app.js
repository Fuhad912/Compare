const radarLabels = [
  "Goals",
  "Assists",
  "Appearances",
  "Minutes",
  "Rating",
  "Key Passes",
  "Dribbles"
];

const SEARCH_DEBOUNCE_MS = 300;
const PLAYER_SEARCH_CONFIG = [
  {
    inputId: "player-a",
    stateKey: "playerA",
    dropdownId: "player-a-dropdown"
  },
  {
    inputId: "player-b",
    stateKey: "playerB",
    dropdownId: "player-b-dropdown"
  }
];
const EMPTY_PHOTO_DATA_URI = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const STAT_DEFINITIONS = [
  { key: "goals", label: "Goals", radarKey: "Goals" },
  { key: "assists", label: "Assists", radarKey: "Assists" },
  { key: "appearances", label: "Appearances", radarKey: "Appearances" },
  { key: "minutes", label: "Minutes", radarKey: "Minutes" },
  { key: "rating", label: "Rating", radarKey: "Rating" },
  { key: "keyPasses", label: "Key Passes", radarKey: "Key Passes" },
  { key: "dribbles", label: "Dribbles", radarKey: "Dribbles" }
];

let radarChartInstance = null;
const appState = {
  playerA: null,
  playerB: null,
  comparison: null
};

function normalizeRadarData(data = {}) {
  return radarLabels.map((label) => Number(data[label]) || 0);
}

function initRadarChart() {
  const radarCanvas = document.getElementById("radarChart");

  if (!radarCanvas || typeof Chart === "undefined") {
    return;
  }

  const context = radarCanvas.getContext("2d");
  if (!context) {
    return;
  }

  if (radarChartInstance) {
    radarChartInstance.destroy();
  }

  radarChartInstance = new Chart(context, {
    type: "radar",
    data: {
      labels: radarLabels,
      datasets: [
        {
          label: "Player A",
          data: normalizeRadarData(),
          borderColor: "#763948",
          backgroundColor: "rgba(118, 57, 72, 0.18)",
          pointBackgroundColor: "#763948",
          pointBorderColor: "#D6CCD0",
          pointRadius: 3
        },
        {
          label: "Player B",
          data: normalizeRadarData(),
          borderColor: "rgba(118, 57, 72, 0.7)",
          backgroundColor: "rgba(118, 57, 72, 0.08)",
          pointBackgroundColor: "rgba(118, 57, 72, 0.7)",
          pointBorderColor: "#D6CCD0",
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        r: {
          angleLines: {
            color: "rgba(118, 57, 72, 0.2)"
          },
          grid: {
            color: "rgba(118, 57, 72, 0.2)"
          },
          pointLabels: {
            color: "#763948",
            font: {
              family: "Avenir Next, Segoe UI, Helvetica Neue, sans-serif",
              size: 12
            }
          },
          ticks: {
            backdropColor: "rgba(214, 204, 208, 0.75)",
            color: "#763948"
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: "#763948",
            font: {
              family: "Avenir Next, Segoe UI, Helvetica Neue, sans-serif"
            }
          }
        }
      }
    }
  });
}

function updateRadarChart(playerAData, playerBData) {
  if (!radarChartInstance) {
    initRadarChart();
  }

  if (!radarChartInstance) {
    return;
  }

  radarChartInstance.data.datasets[0].data = normalizeRadarData(playerAData);
  radarChartInstance.data.datasets[1].data = normalizeRadarData(playerBData);
  radarChartInstance.update();
}

function createDropdown(controller) {
  const dropdown = document.createElement("ul");
  dropdown.id = controller.dropdownId;
  dropdown.className = "search-dropdown is-hidden";
  dropdown.setAttribute("role", "listbox");

  controller.input.insertAdjacentElement("afterend", dropdown);
  controller.dropdown = dropdown;

  controller.input.setAttribute("autocomplete", "off");
  controller.input.setAttribute("role", "combobox");
  controller.input.setAttribute("aria-haspopup", "listbox");
  controller.input.setAttribute("aria-autocomplete", "list");
  controller.input.setAttribute("aria-expanded", "false");
  controller.input.setAttribute("aria-controls", controller.dropdownId);
}

function clearDropdown(controller) {
  controller.dropdown.innerHTML = "";
  controller.suggestions = [];
  controller.activeIndex = -1;
  controller.input.removeAttribute("aria-activedescendant");
}

function openDropdown(controller) {
  if (!controller.suggestions.length) {
    closeDropdown(controller);
    return;
  }

  controller.dropdown.classList.remove("is-hidden");
  controller.input.setAttribute("aria-expanded", "true");
}

function closeDropdown(controller) {
  controller.dropdown.classList.add("is-hidden");
  controller.input.setAttribute("aria-expanded", "false");
  controller.activeIndex = -1;
  controller.input.removeAttribute("aria-activedescendant");

  const items = controller.dropdown.querySelectorAll(".search-item");
  items.forEach((item) => {
    item.classList.remove("is-active");
    item.setAttribute("aria-selected", "false");
  });
}

function setActiveOption(controller, index) {
  const items = controller.dropdown.querySelectorAll(".search-item");
  if (!items.length || index < 0 || index >= items.length) {
    controller.activeIndex = -1;
    controller.input.removeAttribute("aria-activedescendant");
    return;
  }

  controller.activeIndex = index;
  items.forEach((item, itemIndex) => {
    const isActive = itemIndex === index;
    item.classList.toggle("is-active", isActive);
    item.setAttribute("aria-selected", isActive ? "true" : "false");

    if (isActive) {
      controller.input.setAttribute("aria-activedescendant", item.id);
      item.scrollIntoView({ block: "nearest" });
    }
  });
}

function moveActiveOption(controller, direction) {
  if (!controller.suggestions.length) {
    return;
  }

  if (controller.dropdown.classList.contains("is-hidden")) {
    openDropdown(controller);
  }

  const maxIndex = controller.suggestions.length - 1;
  let nextIndex = controller.activeIndex + direction;

  if (controller.activeIndex === -1) {
    nextIndex = direction > 0 ? 0 : maxIndex;
  } else if (nextIndex > maxIndex) {
    nextIndex = 0;
  } else if (nextIndex < 0) {
    nextIndex = maxIndex;
  }

  setActiveOption(controller, nextIndex);
}

function selectPlayer(controller, index) {
  const player = controller.suggestions[index];
  if (!player) {
    return;
  }

  appState[controller.stateKey] = {
    id: player.id ?? null,
    name: player.name ?? "",
    photo: player.photo ?? null
  };

  controller.input.value = player.name ?? "";
  controller.input.dataset.playerId = String(player.id ?? "");
  closeDropdown(controller);
}

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function buildPlayerOption(player, index, controller) {
  const item = document.createElement("li");
  item.className = "search-item";
  item.id = `${controller.dropdownId}-option-${index}`;
  item.setAttribute("role", "option");
  item.setAttribute("aria-selected", "false");

  const photo = document.createElement("img");
  photo.className = "search-photo";
  photo.src = player.photo || EMPTY_PHOTO_DATA_URI;
  photo.alt = "";
  photo.width = 36;
  photo.height = 36;
  photo.loading = "lazy";
  photo.referrerPolicy = "no-referrer";

  const textWrap = document.createElement("span");
  textWrap.className = "search-text";

  const name = document.createElement("span");
  name.className = "search-name";
  name.textContent = player.name || "Unknown player";

  const meta = document.createElement("span");
  meta.className = "search-meta";
  const parsedAge = toNumber(player.age, NaN);
  const ageText = Number.isFinite(parsedAge) ? `Age ${Math.round(parsedAge)}` : "Age n/a";
  meta.textContent = `${player.nationality || "Unknown nationality"} | ${ageText}`;

  textWrap.append(name, meta);
  item.append(photo, textWrap);

  item.addEventListener("mouseenter", () => {
    setActiveOption(controller, index);
  });

  item.addEventListener("mousedown", (event) => {
    event.preventDefault();
    selectPlayer(controller, index);
  });

  return item;
}

function renderSuggestions(controller, players) {
  clearDropdown(controller);

  if (!players.length) {
    closeDropdown(controller);
    return;
  }

  controller.suggestions = players;
  const fragment = document.createDocumentFragment();

  players.forEach((player, index) => {
    fragment.appendChild(buildPlayerOption(player, index, controller));
  });

  controller.dropdown.appendChild(fragment);
  openDropdown(controller);
}

async function searchPlayers(controller, query) {
  const requestId = ++controller.requestId;

  try {
    const response = await fetch(`/api/searchPlayer?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error(`Search failed with status ${response.status}`);
    }

    const payload = await response.json();
    if (requestId !== controller.requestId) {
      return;
    }

    const players = Array.isArray(payload?.players) ? payload.players : [];
    renderSuggestions(controller, players);
  } catch (error) {
    if (requestId !== controller.requestId) {
      return;
    }

    renderSuggestions(controller, []);
  }
}

function queueSearch(controller, query) {
  clearTimeout(controller.debounceId);
  controller.debounceId = setTimeout(() => {
    searchPlayers(controller, query);
  }, SEARCH_DEBOUNCE_MS);
}

function setupSearchInput(config) {
  const input = document.getElementById(config.inputId);
  if (!input) {
    return null;
  }

  const controller = {
    input,
    stateKey: config.stateKey,
    dropdownId: config.dropdownId,
    dropdown: null,
    suggestions: [],
    activeIndex: -1,
    requestId: 0,
    debounceId: null
  };

  createDropdown(controller);

  input.addEventListener("input", (event) => {
    const query = event.target.value.trim();
    appState[controller.stateKey] = null;
    input.dataset.playerId = "";

    if (!query) {
      clearTimeout(controller.debounceId);
      controller.requestId += 1;
      clearDropdown(controller);
      closeDropdown(controller);
      return;
    }

    queueSearch(controller, query);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActiveOption(controller, 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActiveOption(controller, -1);
      return;
    }

    if (event.key === "Enter") {
      const dropdownOpen = !controller.dropdown.classList.contains("is-hidden");
      if (dropdownOpen && controller.activeIndex >= 0) {
        event.preventDefault();
        selectPlayer(controller, controller.activeIndex);
      }
      return;
    }

    if (event.key === "Escape") {
      if (!controller.dropdown.classList.contains("is-hidden")) {
        event.preventDefault();
        closeDropdown(controller);
      }
    }
  });

  input.addEventListener("blur", () => {
    setTimeout(() => {
      closeDropdown(controller);
    }, 100);
  });

  return controller;
}

function setupOutsideClickClose(controllers) {
  document.addEventListener("click", (event) => {
    controllers.forEach((controller) => {
      if (!controller) {
        return;
      }

      const clickedInput = controller.input.contains(event.target);
      const clickedDropdown = controller.dropdown.contains(event.target);

      if (!clickedInput && !clickedDropdown) {
        closeDropdown(controller);
      }
    });
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function ensureResultsUI() {
  const section = document.getElementById("results");
  const chartCanvas = document.getElementById("radarChart");

  if (!section || !chartCanvas) {
    return null;
  }

  let statusText = section.querySelector(".results-status");
  if (!statusText) {
    statusText = section.querySelector("p") || document.createElement("p");
    statusText.classList.add("results-status");
    if (!statusText.parentElement) {
      section.insertBefore(statusText, chartCanvas);
    }
  }

  let scoreBlock = section.querySelector(".compare-score");
  if (!scoreBlock) {
    scoreBlock = document.createElement("div");
    scoreBlock.className = "compare-score is-hidden";
    section.insertBefore(scoreBlock, chartCanvas);
  }

  let comparisonPanel = section.querySelector(".comparison-panel");
  if (!comparisonPanel) {
    comparisonPanel = document.createElement("div");
    comparisonPanel.className = "comparison-panel is-hidden";
    section.insertBefore(comparisonPanel, chartCanvas);
  }

  return {
    section,
    statusText,
    scoreBlock,
    comparisonPanel
  };
}

function setResultsStatus(ui, variant, message) {
  ui.statusText.className = `results-status results-status-${variant}`;
  ui.statusText.textContent = message;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scrollResultsIntoView(resultsSection) {
  if (!resultsSection) {
    return;
  }

  const rect = resultsSection.getBoundingClientRect();
  const topThreshold = window.innerHeight * 0.28;
  const alreadyNearTop = rect.top >= 0 && rect.top <= topThreshold;

  if (alreadyNearTop) {
    return;
  }

  resultsSection.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start"
  });
}

function setCompareButtonLoading(button, isLoading) {
  if (!button) {
    return;
  }

  if (!button.dataset.defaultText) {
    button.dataset.defaultText = button.textContent.trim();
  }

  button.disabled = isLoading;
  button.textContent = isLoading ? "Comparing..." : button.dataset.defaultText;
}

function renderLoadingPanel(ui, playerA, playerB) {
  const playerAName = escapeHtml(playerA?.name || "Player A");
  const playerBName = escapeHtml(playerB?.name || "Player B");
  const loadingCards = STAT_DEFINITIONS.map(
    () => `
      <article class="stat-card stat-card-loading" aria-hidden="true">
        <span class="skeleton-line skeleton-line-label"></span>
        <span class="skeleton-line skeleton-line-value"></span>
      </article>
    `
  ).join("");

  ui.comparisonPanel.innerHTML = `
    <div class="comparison-heading-row">
      <div class="comparison-player comparison-player-a">
        <span class="comparison-player-tag">Player A</span>
        <span class="comparison-player-name">${playerAName}</span>
      </div>
      <span class="comparison-versus">vs</span>
      <div class="comparison-player comparison-player-b">
        <span class="comparison-player-tag">Player B</span>
        <span class="comparison-player-name">${playerBName}</span>
      </div>
    </div>
    <div class="stats-grid">
      ${loadingCards}
    </div>
  `;

  ui.comparisonPanel.classList.remove("is-hidden");
  ui.scoreBlock.classList.add("is-hidden");
}

function getValueByPath(source, path) {
  return path.split(".").reduce((accumulator, key) => {
    if (accumulator && typeof accumulator === "object" && key in accumulator) {
      return accumulator[key];
    }

    return undefined;
  }, source);
}

function pickNumericValue(source, paths, fallback = 0) {
  for (const path of paths) {
    const value = getValueByPath(source, path);
    const parsed = toNumber(value, NaN);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function extractStatsSource(payload) {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  if (payload.stats && typeof payload.stats === "object") {
    return payload.stats;
  }

  if (payload.playerStats && typeof payload.playerStats === "object") {
    return payload.playerStats;
  }

  if (payload.data && typeof payload.data === "object") {
    return payload.data;
  }

  const firstResponse = Array.isArray(payload.response) ? payload.response[0] : null;
  if (firstResponse && typeof firstResponse === "object") {
    if (firstResponse.stats && typeof firstResponse.stats === "object") {
      return firstResponse.stats;
    }

    if (Array.isArray(firstResponse.statistics) && firstResponse.statistics[0]) {
      return firstResponse.statistics[0];
    }

    return firstResponse;
  }

  return payload;
}

function normalizeStats(rawStats) {
  const source = rawStats && typeof rawStats === "object" ? rawStats : {};

  return {
    goals: pickNumericValue(source, ["goals", "goals.total"], 0),
    assists: pickNumericValue(source, ["assists", "goals.assists"], 0),
    appearances: pickNumericValue(source, ["appearances", "games.appearances", "games.appearences"], 0),
    minutes: pickNumericValue(source, ["minutes", "games.minutes"], 0),
    rating: pickNumericValue(source, ["rating", "games.rating"], 0),
    keyPasses: pickNumericValue(source, ["keyPasses", "passes.key"], 0),
    dribbles: pickNumericValue(source, ["dribbles", "dribbles.success"], 0)
  };
}

function toRadarDataset(stats) {
  return {
    Goals: stats.goals,
    Assists: stats.assists,
    Appearances: stats.appearances,
    Minutes: stats.minutes,
    Rating: stats.rating,
    "Key Passes": stats.keyPasses,
    Dribbles: stats.dribbles
  };
}

function formatStatValue(metricKey, value) {
  if (metricKey === "rating") {
    return value.toFixed(2);
  }

  if (Math.abs(value - Math.round(value)) < 0.001) {
    return String(Math.round(value));
  }

  return value.toFixed(1);
}

function renderPlayerBlock(sideLabel, player, sideClass) {
  const name = escapeHtml(player?.name || sideLabel);
  const photoSrc = player?.photo ? escapeHtml(player.photo) : null;

  if (!photoSrc) {
    return `
      <div class="comparison-player ${sideClass}">
        <span class="comparison-avatar comparison-avatar-fallback" aria-hidden="true">${escapeHtml(sideLabel)}</span>
        <span class="comparison-player-name">${name}</span>
      </div>
    `;
  }

  return `
    <div class="comparison-player ${sideClass}">
      <img class="comparison-avatar" src="${photoSrc}" alt="" loading="lazy" referrerpolicy="no-referrer" />
      <span class="comparison-player-name">${name}</span>
    </div>
  `;
}

function renderComparisonPanel(ui, playerA, playerB, statsA, statsB) {
  const statCards = STAT_DEFINITIONS.map((metric) => {
    const valueA = statsA[metric.key];
    const valueB = statsB[metric.key];
    const leadClassA = valueA > valueB ? "is-leading" : "";
    const leadClassB = valueB > valueA ? "is-leading" : "";

    return `
      <article class="stat-card">
        <p class="stat-label">${escapeHtml(metric.label)}</p>
        <div class="stat-values">
          <span class="stat-value ${leadClassA}">${escapeHtml(formatStatValue(metric.key, valueA))}</span>
          <span class="stat-divider">|</span>
          <span class="stat-value ${leadClassB}">${escapeHtml(formatStatValue(metric.key, valueB))}</span>
        </div>
      </article>
    `;
  }).join("");

  ui.comparisonPanel.innerHTML = `
    <div class="comparison-heading-row">
      ${renderPlayerBlock("A", playerA, "comparison-player-a")}
      <span class="comparison-versus">vs</span>
      ${renderPlayerBlock("B", playerB, "comparison-player-b")}
    </div>
    <div class="stats-grid">
      ${statCards}
    </div>
  `;

  ui.comparisonPanel.classList.remove("is-hidden");
}

function computeCompareScore(stats) {
  return (
    (stats.goals * 4) +
    (stats.assists * 3) +
    (stats.rating * 5) +
    (stats.keyPasses * 1.5) +
    (stats.dribbles * 1) +
    Math.floor(stats.minutes / 90)
  );
}

function computePercentDifference(a, b) {
  const baseline = Math.max(Math.abs(a), Math.abs(b), 1);
  return (Math.abs(a - b) / baseline) * 100;
}

function buildScoreInterpretation(diffPercent, winnerName, isTie) {
  if (isTie) {
    return "Both players are level on this season profile.";
  }

  if (diffPercent < 5) {
    return `${winnerName} holds a narrow edge across key outputs.`;
  }

  if (diffPercent < 15) {
    return `${winnerName} shows a clear all-round advantage in this comparison.`;
  }

  return `${winnerName} is decisively ahead based on the selected metrics.`;
}

function renderScoreSummary(ui, playerA, playerB, statsA, statsB) {
  const scoreA = computeCompareScore(statsA);
  const scoreB = computeCompareScore(statsB);
  const isTie = Math.abs(scoreA - scoreB) < 0.0001;
  const diffPercent = computePercentDifference(scoreA, scoreB);

  let badgeClass = "winner-badge winner-badge-tie";
  let badgeText = "Draw";
  let winnerName = "Neither player";

  if (!isTie && scoreA > scoreB) {
    badgeClass = "winner-badge winner-badge-a";
    winnerName = playerA?.name || "Player A";
    badgeText = `${escapeHtml(winnerName)} leads`;
  } else if (!isTie && scoreB > scoreA) {
    badgeClass = "winner-badge winner-badge-b";
    winnerName = playerB?.name || "Player B";
    badgeText = `${escapeHtml(winnerName)} leads`;
  }

  const interpretation = buildScoreInterpretation(diffPercent, winnerName, isTie);
  const diffLabel = isTie ? "0.0%" : `${diffPercent.toFixed(1)}%`;
  const scoreLine = `${scoreA.toFixed(1)} | ${scoreB.toFixed(1)}`;

  ui.scoreBlock.innerHTML = `
    <div class="${badgeClass}">${badgeText}</div>
    <p class="score-line">Compare Score: ${escapeHtml(scoreLine)}</p>
    <p class="score-diff">Difference: ${escapeHtml(diffLabel)}</p>
    <p class="score-interpretation">${escapeHtml(interpretation)}</p>
  `;

  ui.scoreBlock.classList.remove("is-hidden");

  return {
    scoreA,
    scoreB,
    diffPercent,
    winner: isTie ? "tie" : scoreA > scoreB ? "playerA" : "playerB"
  };
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchPlayerStats(playerId, season) {
  const query = new URLSearchParams({
    playerId: String(playerId),
    player: String(playerId),
    season: String(season)
  });

  const response = await fetch(`/api/playerStats?${query.toString()}`);
  const payload = await parseJsonSafe(response);

  if (!response.ok) {
    const errorMessage =
      payload?.error ||
      payload?.message ||
      `Unable to load player stats (HTTP ${response.status}).`;
    throw new Error(errorMessage);
  }

  const statsSource = extractStatsSource(payload);
  return normalizeStats(statsSource);
}

function validateCompareInput(seasonValue) {
  if (!appState.playerA || !appState.playerA.id) {
    return "Select Player A from the dropdown before comparing.";
  }

  if (!appState.playerB || !appState.playerB.id) {
    return "Select Player B from the dropdown before comparing.";
  }

  if (!seasonValue) {
    return "Choose a season before running a comparison.";
  }

  return "";
}

async function handleCompareSubmit(event, context) {
  event.preventDefault();

  const { seasonSelect, compareButton, resultsUi } = context;
  if (!resultsUi) {
    return;
  }

  resultsUi.section.classList.remove("is-hidden");
  scrollResultsIntoView(resultsUi.section);
  if (radarChartInstance) {
    radarChartInstance.resize();
  }

  const seasonValue = (seasonSelect?.value || "").trim();
  const validationMessage = validateCompareInput(seasonValue);

  if (validationMessage) {
    setResultsStatus(resultsUi, "error", validationMessage);
    resultsUi.comparisonPanel.classList.add("is-hidden");
    resultsUi.scoreBlock.classList.add("is-hidden");
    return;
  }

  setCompareButtonLoading(compareButton, true);
  setResultsStatus(
    resultsUi,
    "loading",
    `Comparing ${appState.playerA.name} and ${appState.playerB.name} in ${seasonValue}...`
  );
  renderLoadingPanel(resultsUi, appState.playerA, appState.playerB);

  try {
    const [statsA, statsB] = await Promise.all([
      fetchPlayerStats(appState.playerA.id, seasonValue),
      fetchPlayerStats(appState.playerB.id, seasonValue)
    ]);

    renderComparisonPanel(resultsUi, appState.playerA, appState.playerB, statsA, statsB);
    const scoreMeta = renderScoreSummary(resultsUi, appState.playerA, appState.playerB, statsA, statsB);

    appState.comparison = {
      season: seasonValue,
      statsA,
      statsB,
      score: scoreMeta
    };

    updateRadarChart(toRadarDataset(statsA), toRadarDataset(statsB));
    if (radarChartInstance) {
      radarChartInstance.resize();
    }

    setResultsStatus(resultsUi, "success", "Comparison complete.");
  } catch (error) {
    resultsUi.comparisonPanel.classList.add("is-hidden");
    resultsUi.scoreBlock.classList.add("is-hidden");
    setResultsStatus(
      resultsUi,
      "error",
      error instanceof Error ? error.message : "Comparison failed. Please try again."
    );
    updateRadarChart({}, {});
  } finally {
    setCompareButtonLoading(compareButton, false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initRadarChart();

  const searchControllers = PLAYER_SEARCH_CONFIG.map(setupSearchInput).filter(Boolean);
  setupOutsideClickClose(searchControllers);

  const compareForm = document.getElementById("compare-form");
  if (!compareForm) {
    return;
  }

  const seasonSelect = document.getElementById("season");
  const compareButton = compareForm.querySelector('button[type="submit"]');
  const resultsUi = ensureResultsUI();

  compareForm.addEventListener("submit", (event) => {
    handleCompareSubmit(event, {
      seasonSelect,
      compareButton,
      resultsUi
    });
  });
});
