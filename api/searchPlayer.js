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
  if (!apiKey) {
    return res.status(500).json({ error: "Server configuration error: APISPORTS_KEY is not set." });
  }

  const baseUrl = (process.env.APISPORTS_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const upstreamUrl = `${baseUrl}/players?search=${encodeURIComponent(normalizedQuery)}`;

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

    if (!upstreamResponse.ok) {
      return res.status(upstreamResponse.status).json({
        error: "API-SPORTS request failed."
      });
    }

    let payload;
    try {
      payload = await upstreamResponse.json();
    } catch {
      return res.status(502).json({ error: "Invalid JSON received from API-SPORTS." });
    }

    const responseRows = Array.isArray(payload?.response) ? payload.response : [];
    const players = responseRows.slice(0, 10).map(mapPlayer);

    return res.status(200).json({ players });
  } catch (error) {
    if (error && error.name === "AbortError") {
      return res.status(504).json({ error: "API-SPORTS request timed out." });
    }

    return res.status(502).json({ error: "Unable to reach API-SPORTS." });
  } finally {
    clearTimeout(timeout);
  }
};
