import crypto from "crypto";

function sign(apiKey, secret) {
  const ts = Math.floor(Date.now() / 1000);
  return crypto.createHash("sha256").update(apiKey + secret + ts).digest("hex");
}

export default async function handler(req, res) {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.status(400).json({ error: "Faltou q (query)" });

    const API_KEY = process.env.HOTELBEDS_API_KEY;
    const SECRET = process.env.HOTELBEDS_SECRET;
    const BASE = process.env.HOTELBEDS_BASE_URL || "https://api.test.hotelbeds.com";

    // Content API: destinos (pode variar por conta, mas esse é o padrão)
    const url =
  `${BASE}/hotel-content-api/1.0/locations/destinations` +
  `?language=pt&fields=code,name,countryCode&from=1&to=1000`;

    const r = await fetch(url, {
      headers: {
        "Api-key": API_KEY,
        "X-Signature": sign(API_KEY, SECRET),
        "Accept": "application/json",
      }
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json({ error: "Erro Content API", details: data });

    const list = data?.destinations || [];
    const qUp = q.toUpperCase();

    // tenta achar o melhor match
    const matches = list
      .filter(d => (d?.name || "").toUpperCase().includes(qUp))
      .slice(0, 10);

    return res.status(200).json({ q, matches });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
