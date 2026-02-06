import crypto from "crypto";

function sign(apiKey, secret) {
  const ts = Math.floor(Date.now() / 1000);
  return crypto.createHash("sha256").update(apiKey + secret + ts).digest("hex");
}
function toNum(x) {
  const n = Number(String(x ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : Infinity;
}

function extractCheapestRateKey(hotel) {
  let best = null;
  const rooms = hotel?.rooms || [];
  for (const room of rooms) {
    const rates = room?.rates || [];
    for (const r of rates) {
      const net = toNum(r?.net);
      const rk = r?.rateKey;
      if (!rk) continue;
      if (!best || net < best.net) best = { net, rateKey: rk };
    }
  }
  return best?.rateKey || null;
}
// Injeta rateKey (da tarifa mais barata) em cada hotel, quando existir
try {
  const hotels = data?.hotels?.hotels || [];
  for (const h of hotels) {
    const rk = extractCheapestRateKey(h);
    if (rk) h.rateKey = rk;
  }
} catch {}


export default async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

    const { destination, checkin, checkout, adults="2", children="0", lat, lng, radius } = req.query || {};

    if (!checkin || !checkout) {
      return res.status(400).json({ error: "Faltou checkin/checkout" });
    }
    if (!destination && (!lat || !lng)) {
      return res.status(400).json({ error: "Faltou destination ou lat/lng" });
    }

    const HOTELBEDS_API_KEY = process.env.HOTELBEDS_API_KEY;
    const HOTELBEDS_SECRET = process.env.HOTELBEDS_SECRET;
    const HOTELBEDS_BASE = process.env.HOTELBEDS_BASE_URL || "https://api.test.hotelbeds.com"; // sandbox
    const HOTELBEDS_LANGUAGE = process.env.HOTELBEDS_LANGUAGE || "ENG";

    if (!HOTELBEDS_API_KEY || !HOTELBEDS_SECRET) {
      return res.status(500).json({ error: "Faltam variáveis HOTELBEDS_API_KEY / HOTELBEDS_SECRET" });
    }

    const payload = {
      stay: { checkIn: checkin, checkOut: checkout },
      occupancies: [
        {
          rooms: 1,
          adults: Number(adults) || 2,
          children: Number(children) || 0,
          paxes: buildPaxes(Number(adults)||2, Number(children)||0),
        }
      ],
      filter: { refundable: false },
      language: HOTELBEDS_LANGUAGE,
    };

    if (destination) {
      payload.destination = { code: String(destination).toUpperCase() };
    } else {
      payload.geolocation = {
        latitude: Number(lat),
        longitude: Number(lng),
        radius: Number(radius || 35),
        unit: "km"
      };
    }

    const url = `${HOTELBEDS_BASE}/hotel-api/1.0/hotels`;

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-key": HOTELBEDS_API_KEY,
        "X-Signature": sign(HOTELBEDS_API_KEY, HOTELBEDS_SECRET),
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      return res.status(r.status).json({
        error: "Hotelbeds retornou erro",
        status: r.status,
        details: data
      });
    }

    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: "Server error", message: String(e?.message || e) });
  }
}

function buildPaxes(adults, children){
  // Hotelbeds usa paxes para idades — aqui deixamos "ADT" e "CHD" sem idade (funciona para maioria dos casos).
  // Depois você pode adicionar idades pelo front.
  const p = [];
  for (let i=0;i<adults;i++) p.push({ type:"AD", age: 30 });
  for (let i=0;i<children;i++) p.push({ type:"CH", age: 8 });
  return p;
}
