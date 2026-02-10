export default async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

    const query = String(req.query.query || "").trim();
    if (!query) return res.status(400).json({ error: "query é obrigatório" });

    // Nominatim (OpenStreetMap). Para MVP interno funciona bem.
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;

    const r = await fetch(url, {
      headers: {
        // User-Agent ajuda a evitar bloqueio
        "User-Agent": "letsdream-internal/1.0 (contact: internal)"
      }
    });

    const data = await r.json().catch(() => []);
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(404).json({ error: "Local não encontrado para geocode" });
    }

    const first = data[0];
    return res.status(200).json({
      lat: Number(first.lat),
      lng: Number(first.lon),
      displayName: first.display_name
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error", message: String(e?.message || e) });
  }
}
