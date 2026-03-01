const SEARCH_DEBOUNCE_MS = 300;
const EMPTY_PHOTO_DATA_URI = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
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
const STAT_DEFINITIONS = [
  { key: "goals", label: "Goals" },
  { key: "assists", label: "Assists" },
  { key: "appearances", label: "Appearances" },
  { key: "minutes", label: "Minutes" },
  { key: "rating", label: "Rating" },
  { key: "keyPasses", label: "Key Passes" },
  { key: "dribbles", label: "Dribbles" }
];

const appState = {
  playerA: null,
  playerB: null,
  comparison: null
};

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function parseSeasonForApi(seasonLabel) {
  const normalized = String(seasonLabel || "").trim();
  const pairMatch = /^(\d{2})\/(\d{2})$/.exec(normalized);

  if (pairMatch) {
    const startYY = Number(pairMatch[1]);
    const startYear = startYY >= 90 ? 1900 + startYY : 2000 + startYY;
    return {
      label: normalized,
      startYear
    };
  }

  if (/^\d{4}$/.test(normalized)) {
    return {
      label: normalized,
      startYear: Number(normalized)
    };
  }

  return {
    label: normalized,
    startYear: NaN
  };
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

function openDropdown(controller) {
  if (!controller.suggestions.length) {
    closeDropdown(controller);
    return;
  }

  controller.dropdown.classList.remove("is-hidden");
  controller.input.setAttribute("aria-expanded", "true");
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
  const age = toNumber(player.age, NaN);
  const ageText = Number.isFinite(age) ? `Age ${Math.round(age)}` : "Age n/a";
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
      throw new Error("Search request failed.");
    }

    const payload = await response.json();
    if (requestId !== controller.requestId) {
      return;
    }

    const players = Array.isArray(payload?.players) ? payload.players : [];
    renderSuggestions(controller, players);
  } catch {
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
    if (Array.isArray(firstResponse.statistics) && firstResponse.statistics[0]) {
      return firstResponse.statistics[0];
    }

    if (firstResponse.stats && typeof firstResponse.stats === "object") {
      return firstResponse.stats;
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

function ensureResultsUI() {
  return {
    section: document.getElementById("results"),
    status: document.getElementById("results-status"),
    winnerPanel: document.getElementById("winner-panel"),
    board: document.getElementById("h2h-board")
  };
}

function setResultsStatus(ui, variant, message) {
  ui.status.className = `results-status results-status-${variant}`;
  ui.status.textContent = message;
}

function setCompareButtonLoading(button, isLoading) {
  if (!button.dataset.defaultText) {
    button.dataset.defaultText = button.textContent.trim();
  }

  button.disabled = isLoading;
  button.textContent = isLoading ? "Running comparison..." : button.dataset.defaultText;
}

function scrollResultsIntoView(section) {
  const rect = section.getBoundingClientRect();
  const alreadyVisible = rect.top >= 0 && rect.top <= window.innerHeight * 0.3;
  if (alreadyVisible) {
    return;
  }

  section.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start"
  });
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

function renderPlayerChip(sideLabel, player, sideClass) {
  const name = escapeHtml(player?.name || sideLabel);
  const photo = player?.photo ? escapeHtml(player.photo) : "";

  if (!photo) {
    return `
      <div class="board-player ${sideClass}">
        <span class="board-avatar board-avatar-fallback">${escapeHtml(sideLabel)}</span>
        <span class="board-player-name">${name}</span>
      </div>
    `;
  }

  return `
    <div class="board-player ${sideClass}">
      <img class="board-avatar" src="${photo}" alt="" loading="lazy" referrerpolicy="no-referrer" />
      <span class="board-player-name">${name}</span>
    </div>
  `;
}

function renderLoadingBoard(ui, playerA, playerB, seasonLabel) {
  const loadingRows = STAT_DEFINITIONS.map(
    () => `
      <article class="metric-row metric-row-loading">
        <span class="metric-loading"></span>
      </article>
    `
  ).join("");

  ui.board.innerHTML = `
    <div class="board-head">
      ${renderPlayerChip("A", playerA, "board-player-a")}
      <span class="board-season">${escapeHtml(seasonLabel)}</span>
      ${renderPlayerChip("B", playerB, "board-player-b")}
    </div>
    <div class="metrics-wrap">
      ${loadingRows}
    </div>
  `;

  ui.board.classList.remove("is-hidden");
  ui.winnerPanel.classList.add("is-hidden");
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

function computeDifferencePercent(a, b) {
  const baseline = Math.max(Math.abs(a), Math.abs(b), 1);
  return (Math.abs(a - b) / baseline) * 100;
}

function buildInterpretation(diffPercent, winnerName, isTie) {
  if (isTie) {
    return "Both profiles are balanced across this season.";
  }

  if (diffPercent < 5) {
    return `${winnerName} edges this matchup by a very small margin.`;
  }

  if (diffPercent < 15) {
    return `${winnerName} has a clear statistical advantage in key actions.`;
  }

  return `${winnerName} dominates this comparison based on current metrics.`;
}

function renderWinnerPanel(ui, playerA, playerB, statsA, statsB) {
  const scoreA = computeCompareScore(statsA);
  const scoreB = computeCompareScore(statsB);
  const isTie = Math.abs(scoreA - scoreB) < 0.0001;
  const diffPercent = computeDifferencePercent(scoreA, scoreB);

  let badgeClass = "winner-badge winner-badge-tie";
  let badgeText = "Draw";
  let winnerName = "Neither player";

  if (!isTie && scoreA > scoreB) {
    winnerName = playerA?.name || "Player A";
    badgeText = `${escapeHtml(winnerName)} wins`;
    badgeClass = "winner-badge winner-badge-a";
  } else if (!isTie && scoreB > scoreA) {
    winnerName = playerB?.name || "Player B";
    badgeText = `${escapeHtml(winnerName)} wins`;
    badgeClass = "winner-badge winner-badge-b";
  }

  const interpretation = buildInterpretation(diffPercent, winnerName, isTie);

  ui.winnerPanel.innerHTML = `
    <div class="${badgeClass}">${badgeText}</div>
    <p class="winner-score-line">Compare Score: ${escapeHtml(scoreA.toFixed(1))} | ${escapeHtml(scoreB.toFixed(1))}</p>
    <p class="winner-diff-line">Difference: ${escapeHtml(isTie ? "0.0%" : `${diffPercent.toFixed(1)}%`)}</p>
    <p class="winner-note">${escapeHtml(interpretation)}</p>
  `;

  ui.winnerPanel.classList.remove("is-hidden");

  return {
    scoreA,
    scoreB,
    diffPercent,
    winner: isTie ? "tie" : scoreA > scoreB ? "playerA" : "playerB"
  };
}

function renderHeadToHeadBoard(ui, seasonLabel, playerA, playerB, statsA, statsB) {
  const rows = STAT_DEFINITIONS.map((metric) => {
    const valueA = statsA[metric.key];
    const valueB = statsB[metric.key];
    const maxValue = Math.max(valueA, valueB, 1);
    const percentA = (valueA / maxValue) * 100;
    const percentB = (valueB / maxValue) * 100;
    const classA = valueA > valueB ? "is-leading" : "";
    const classB = valueB > valueA ? "is-leading" : "";

    return `
      <article class="metric-row">
        <span class="metric-value metric-value-a ${classA}">${escapeHtml(formatStatValue(metric.key, valueA))}</span>
        <div class="metric-core">
          <p class="metric-label">${escapeHtml(metric.label)}</p>
          <div class="metric-bars">
            <span class="metric-bar metric-bar-a" style="--bar-width:${percentA.toFixed(2)}%"></span>
            <span class="metric-bar metric-bar-b" style="--bar-width:${percentB.toFixed(2)}%"></span>
          </div>
        </div>
        <span class="metric-value metric-value-b ${classB}">${escapeHtml(formatStatValue(metric.key, valueB))}</span>
      </article>
    `;
  }).join("");

  ui.board.innerHTML = `
    <div class="board-head">
      ${renderPlayerChip("A", playerA, "board-player-a")}
      <span class="board-season">${escapeHtml(seasonLabel)}</span>
      ${renderPlayerChip("B", playerB, "board-player-b")}
    </div>
    <div class="metrics-wrap">
      ${rows}
    </div>
  `;

  ui.board.classList.remove("is-hidden");
}

function animateIntro() {
  if (prefersReducedMotion() || typeof window.gsap === "undefined") {
    return;
  }

  window.gsap.from(".hero", {
    opacity: 0,
    y: 24,
    duration: 0.6,
    ease: "power2.out"
  });

  window.gsap.from(".compare-card", {
    opacity: 0,
    y: 20,
    duration: 0.55,
    ease: "power2.out",
    delay: 0.08
  });

  window.gsap.from(".about-inner", {
    opacity: 0,
    y: 16,
    duration: 0.5,
    ease: "power2.out",
    delay: 0.18
  });
}

function animateResults() {
  if (prefersReducedMotion() || typeof window.gsap === "undefined") {
    return;
  }

  window.gsap.fromTo(
    "#winner-panel",
    { opacity: 0, y: 14 },
    { opacity: 1, y: 0, duration: 0.42, ease: "power2.out" }
  );

  window.gsap.fromTo(
    ".metric-row",
    { opacity: 0, y: 12 },
    { opacity: 1, y: 0, duration: 0.35, stagger: 0.05, ease: "power2.out", delay: 0.05 }
  );
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchPlayerStats(playerId, seasonLabel) {
  const season = parseSeasonForApi(seasonLabel);
  if (!Number.isFinite(season.startYear)) {
    throw new Error("Invalid season selected.");
  }

  const query = new URLSearchParams({
    playerId: String(playerId),
    season: String(season.startYear),
    seasonLabel: season.label
  });

  const response = await fetch(`/api/playerStats?${query.toString()}`);
  const payload = await parseJsonSafe(response);

  if (!response.ok) {
    const message =
      payload?.error ||
      payload?.message ||
      `Unable to load player stats (HTTP ${response.status}).`;
    throw new Error(message);
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

  if (appState.playerA.id === appState.playerB.id) {
    return "Pick two different players for a valid head-to-head.";
  }

  if (!seasonValue) {
    return "Choose a season before comparing.";
  }

  if (!Number.isFinite(parseSeasonForApi(seasonValue).startYear)) {
    return "Season format should be like 23/24.";
  }

  return "";
}

async function handleCompareSubmit(event, context) {
  event.preventDefault();

  const { seasonSelect, compareButton, resultsUi } = context;
  const seasonValue = (seasonSelect?.value || "").trim();

  resultsUi.section.classList.remove("is-hidden");
  scrollResultsIntoView(resultsUi.section);

  const validationMessage = validateCompareInput(seasonValue);
  if (validationMessage) {
    setResultsStatus(resultsUi, "error", validationMessage);
    resultsUi.winnerPanel.classList.add("is-hidden");
    resultsUi.board.classList.add("is-hidden");
    return;
  }

  setCompareButtonLoading(compareButton, true);
  setResultsStatus(
    resultsUi,
    "loading",
    `Comparing ${appState.playerA.name} vs ${appState.playerB.name} for ${seasonValue}...`
  );
  renderLoadingBoard(resultsUi, appState.playerA, appState.playerB, seasonValue);

  try {
    const [statsA, statsB] = await Promise.all([
      fetchPlayerStats(appState.playerA.id, seasonValue),
      fetchPlayerStats(appState.playerB.id, seasonValue)
    ]);

    renderHeadToHeadBoard(resultsUi, seasonValue, appState.playerA, appState.playerB, statsA, statsB);
    const summary = renderWinnerPanel(resultsUi, appState.playerA, appState.playerB, statsA, statsB);

    appState.comparison = {
      season: seasonValue,
      statsA,
      statsB,
      summary
    };

    setResultsStatus(resultsUi, "success", "Head-to-head complete.");
    animateResults();
  } catch (error) {
    resultsUi.winnerPanel.classList.add("is-hidden");
    resultsUi.board.classList.add("is-hidden");
    setResultsStatus(
      resultsUi,
      "error",
      error instanceof Error ? error.message : "Comparison failed. Try again."
    );
  } finally {
    setCompareButtonLoading(compareButton, false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  animateIntro();

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
