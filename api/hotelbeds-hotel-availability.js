import crypto from "crypto";

function sign(apiKey, secret) {
  const ts = Math.floor(Date.now() / 1000);
  return crypto.createHash("sha256").update(apiKey + secret + ts).digest("hex");
}

export default async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

    const API_KEY = process.env.HOTELBEDS_API_KEY;
    const SECRET = process.env.HOTELBEDS_SECRET;
    const BASE = process.env.HOTELBEDS_BASE_URL || "https://api.test.hotelbeds.com";

    const { hotelCode, checkin, checkout, adults = "2", children = "0" } = req.query;

    if (!API_KEY || !SECRET) return res.status(500).json({ error: "Faltam HOTELBEDS_API_KEY / HOTELBEDS_SECRET" });
    if (!hotelCode || !checkin || !checkout) return res.status(400).json({ error: "hotelCode, checkin e checkout são obrigatórios" });

    const payload = {
      stay: { checkIn: checkin, checkOut: checkout },
      occupancies: [
        {
          rooms: 1,
          adults: Number(adults) || 2,
          children: Number(children) || 0,
          paxes: [
            { type: "AD", age: 30 },
            ...(Number(children) > 0 ? [{ type: "CH", age: 7 }] : []),
          ],
        },
      ],
      hotels: { hotel: [Number(hotelCode)] }
    };

    const url = `${BASE}/hotel-api/1.0/hotels`;

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-key": API_KEY,
        "X-Signature": sign(API_KEY, SECRET),
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json({ error: "Hotelbeds erro", details: data });

    const hotel = data?.hotels?.hotels?.[0] || null;

    return res.status(200).json({
      hotel: hotel ? {
        code: hotel.code,
        name: hotel.name,
        zoneName: hotel.zoneName,
        destinationName: hotel.destinationName,
        currency: data?.currency || hotel.currency || "EUR",
        rooms: hotel.rooms || []
      } : null
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error", message: String(e?.message || e) });
  }
}
