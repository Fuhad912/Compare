const DEFAULT_BASE_URL = "https://v3.football.api-sports.io";
const REQUEST_TIMEOUT_MS = 10000;

function getQueryValue(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue[0];
  }

  return rawValue;
}

function mapPlayer(entry) {
  const player = entry && typeof entry === "object" ? entry.player : null;

  return {
    id: player?.id ?? null,
    name: player?.name ?? null,
    age: player?.age ?? null,
    nationality: player?.nationality ?? null,
    photo: player?.photo ?? null
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  const query = getQueryValue(req.query?.q);
  const normalizedQuery = typeof query === "string" ? query.trim() : "";

  if (!normalizedQuery) {
    return res.status(400).json({ error: "Missing required query parameter: q" });
  }

  const apiKey = process.env.APISPORTS_KEY;
  const rawBaseUrl = process.env.APISPORTS_BASE_URL;
  const envDebug = {
    APISPORTS_KEY: apiKey ? "present" : "undefined",
    APISPORTS_BASE_URL: rawBaseUrl === undefined ? "undefined" : rawBaseUrl,
    usingDefaultBaseUrl: rawBaseUrl === undefined || rawBaseUrl === ""
  };

  console.log("[searchPlayer] Environment values", envDebug);

  if (!apiKey) {
    return res.status(500).json({
      error: "Server configuration error: APISPORTS_KEY is not set.",
      debug: { env: envDebug }
    });
  }

  const baseUrl = (rawBaseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const upstreamUrl = `${baseUrl}/players?search=${encodeURIComponent(normalizedQuery)}`;
  const requestDebug = {
    method: "GET",
    url: upstreamUrl,
    headers: {
      "x-apisports-key": apiKey ? "present" : "undefined"
    }
  };

  console.log("[searchPlayer] API-Football request", requestDebug);

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
      console.error("[searchPlayer] API-Football non-OK response", {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        body: upstreamBodyJson ?? upstreamBodyText
      });

      return res.status(upstreamResponse.status).json({
        error: "API-SPORTS request failed.",
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

    const responseRows = Array.isArray(payload?.response) ? payload.response : [];
    const players = responseRows.slice(0, 10).map(mapPlayer);

    return res.status(200).json({ players });
  } catch (error) {
    if (error && error.name === "AbortError") {
      console.error("[searchPlayer] API-Football request timed out", {
        message: error.message
      });
      return res.status(504).json({
        error: "API-SPORTS request timed out.",
        details: error.message || null,
        debug: {
          env: envDebug,
          request: requestDebug
        }
      });
    }

    console.error("[searchPlayer] API-Football request error", {
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
