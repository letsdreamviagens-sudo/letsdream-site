import crypto from "crypto";

function sign(apiKey, secret) {
  const ts = Math.floor(Date.now() / 1000);
  return crypto.createHash("sha256").update(apiKey + secret + ts).digest("hex");
}

export default async function handler(req, res) {

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { hotelCode } = req.query;

  if (!hotelCode) {
    return res.status(400).json({ error: "hotelCode obrigatório" });
  }

  try {

    const API_KEY = process.env.HOTELBEDS_API_KEY;
    const SECRET = process.env.HOTELBEDS_SECRET;
    const BASE = "https://api.test.hotelbeds.com";

    const url =
      `${BASE}/hotel-content-api/1.0/hotels/${hotelCode}/details`;

    const r = await fetch(url, {
      method: "GET",
      headers: {
        "Api-key": API_KEY,
        "X-Signature": sign(API_KEY, SECRET),
        "Accept": "application/json"
      }
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json(data);
    }

    return res.status(200).json(data);

  } catch (e) {

    return res.status(500).json({
      error: "Erro content API",
      message: e.message
    });

  }
}
