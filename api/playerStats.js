const DEFAULT_BASE_URL = "https://v3.football.api-sports.io";
const REQUEST_TIMEOUT_MS = 10000;

function getSingleQueryValue(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue[0];
  }

  return rawValue;
}

function normalizeSeason(rawSeason) {
  const normalized = String(rawSeason || "").trim();
  const seasonPair = /^(\d{2})\/(\d{2})$/.exec(normalized);

  if (seasonPair) {
    const startYY = Number(seasonPair[1]);
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

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function toStatsShape(entry) {
  const statistics = entry && typeof entry === "object" ? entry : {};

  return {
    goals: toNumber(statistics.goals?.total, 0),
    assists: toNumber(statistics.goals?.assists, 0),
    appearances: toNumber(statistics.games?.appearances ?? statistics.games?.appearences, 0),
    minutes: toNumber(statistics.games?.minutes, 0),
    rating: toNumber(statistics.games?.rating, 0),
    keyPasses: toNumber(statistics.passes?.key, 0),
    dribbles: toNumber(statistics.dribbles?.success, 0)
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  const rawPlayerId = getSingleQueryValue(req.query?.playerId ?? req.query?.player);
  const playerId = Number(rawPlayerId);
  if (!Number.isFinite(playerId) || playerId <= 0) {
    return res.status(400).json({ error: "Missing or invalid query parameter: playerId" });
  }

  const rawSeason = getSingleQueryValue(req.query?.seasonLabel ?? req.query?.season);
  const season = normalizeSeason(rawSeason);
  if (!Number.isFinite(season.startYear)) {
    return res.status(400).json({ error: "Missing or invalid season. Use format like 23/24." });
  }

  const apiKey = process.env.APISPORTS_KEY;
  const rawBaseUrl = process.env.APISPORTS_BASE_URL;
  const envDebug = {
    APISPORTS_KEY: apiKey ? "present" : "undefined",
    APISPORTS_BASE_URL: rawBaseUrl === undefined ? "undefined" : rawBaseUrl,
    usingDefaultBaseUrl: rawBaseUrl === undefined || rawBaseUrl === ""
  };

  console.log("[playerStats] Environment values", envDebug);

  if (!apiKey) {
    return res.status(500).json({
      error: "Server configuration error: APISPORTS_KEY is not set.",
      debug: { env: envDebug }
    });
  }

  const baseUrl = (rawBaseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const upstreamUrl = `${baseUrl}/players?id=${encodeURIComponent(playerId)}&season=${encodeURIComponent(season.startYear)}`;
  const requestDebug = {
    method: "GET",
    url: upstreamUrl,
    headers: {
      "x-apisports-key": apiKey ? "present" : "undefined"
    }
  };

  console.log("[playerStats] API-Football request", requestDebug);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "x-apisports-key": apiKey
      },
      signal: controller.signal
    });

    const upstreamBodyText = await upstreamResponse.text();
    let upstreamBodyJson = null;
    if (upstreamBodyText) {
      try {
        upstreamBodyJson = JSON.parse(upstreamBodyText);
      } catch {
        upstreamBodyJson = null;
      }
    }

    if (!upstreamResponse.ok) {
      console.error("[playerStats] API-Football non-OK response", {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        body: upstreamBodyJson ?? upstreamBodyText
      });
      return res.status(upstreamResponse.status).json({
        error: "API-SPORTS stats request failed.",
        upstream: {
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText,
          body: upstreamBodyJson ?? upstreamBodyText
        },
        debug: {
          env: envDebug,
          request: requestDebug
        }
      });
    }

    let payload;
    try {
      payload = upstreamBodyJson ?? JSON.parse(upstreamBodyText);
    } catch {
      return res.status(502).json({
        error: "Invalid JSON received from API-SPORTS.",
        upstream: {
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText,
          body: upstreamBodyText
        },
        debug: {
          env: envDebug,
          request: requestDebug
        }
      });
    }

    const firstResponse = Array.isArray(payload?.response) ? payload.response[0] : null;
    const statistics = Array.isArray(firstResponse?.statistics) ? firstResponse.statistics : [];
    const primaryStats = statistics[0];

    if (!primaryStats) {
      return res.status(404).json({ error: "No stats found for this player and season." });
    }

    const stats = toStatsShape(primaryStats);

    return res.status(200).json({
      stats,
      meta: {
        playerId,
        season: season.startYear,
        seasonLabel: season.label
      }
    });
  } catch (error) {
    if (error && error.name === "AbortError") {
      console.error("[playerStats] API-Football request timed out", {
        message: error.message
      });
      return res.status(504).json({
        error: "API-SPORTS stats request timed out.",
        details: error.message || null,
        debug: {
          env: envDebug,
          request: requestDebug
        }
      });
    }

    console.error("[playerStats] API-Football request error", {
      name: error?.name || null,
      message: error?.message || null
    });

    return res.status(502).json({
      error: "Unable to reach API-SPORTS.",
      details: error?.message || null,
      debug: {
        env: envDebug,
        request: requestDebug
      }
    });
  } finally {
    clearTimeout(timeout);
  }
};
