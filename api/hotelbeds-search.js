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

    if (!API_KEY || !SECRET) {
      return res.status(500).json({ error: "Faltam HOTELBEDS_API_KEY / HOTELBEDS_SECRET" });
    }

    const {
      destination,
      checkin,
      checkout,
      adults = "2",
      children = "0",
      childrenAges = "[]",
      lat,
      lng,
      radius
    } = req.query;

    if (!checkin || !checkout) {
      return res.status(400).json({ error: "checkin e checkout são obrigatórios" });
    }

    let parsedChildrenAges = [];
    try {
      parsedChildrenAges = JSON.parse(childrenAges || "[]");
    } catch {
      parsedChildrenAges = [];
    }

    const adultCount = Number(adults) || 2;
    const childCount = Number(children) || 0;

    const payload = {
      stay: { checkIn: checkin, checkOut: checkout },
      occupancies: [
        {
          rooms: 1,
          adults: adultCount,
          children: childCount,
          paxes: [
            ...Array.from({ length: adultCount }, () => ({ type: "AD", age: 30 })),
            ...Array.from({ length: childCount }, (_, i) => ({
              type: "CH",
              age: Number(parsedChildrenAges[i] ?? 7)
            }))
          ]
        }
      ]
    };

    if (lat && lng) {
      payload.geolocation = {
        latitude: Number(lat),
        longitude: Number(lng),
        radius: Number(radius || 35),
        unit: "km"
      };
    } else if (destination) {
      payload.destination = { code: String(destination), zone: 0 };
    } else {
      return res.status(400).json({ error: "destination ou (lat,lng) é obrigatório" });
    }

    const r = await fetch(`${BASE}/hotel-api/1.0/hotels`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-key": API_KEY,
        "X-Signature": sign(API_KEY, SECRET),
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      return res.status(r.status).json({
        error: "Hotelbeds erro",
        details: data,
        sentPayload: payload
      });
    }

    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({
      error: "Server error",
      message: String(e?.message || e)
    });
  }
}
