import crypto from "crypto";

function sign(apiKey, secret) {
  const ts = Math.floor(Date.now() / 1000);
  return crypto.createHash("sha256").update(apiKey + secret + ts).digest("hex");
}

export default async function handler(req, res) {
  try {
    // CORS básico
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();

    const {
  destination,
  lat,
  lng,
  radius = "35",
  checkin,
  checkout,
  adults = "2",
  children = "0",
  childrenAges = ""
} = req.query;

if (!checkin || !checkout || (!destination && !(lat && lng))) {
  return res.status(400).json({
    error: "Faltou destination OU lat/lng, e também checkin/checkout"
  });
}

    const HOTELBEDS_API_KEY = process.env.HOTELBEDS_API_KEY;
    const HOTELBEDS_SECRET = process.env.HOTELBEDS_SECRET;
    const HOTELBEDS_BASE = process.env.HOTELBEDS_BASE_URL || "https://api.test.hotelbeds.com";

    if (!HOTELBEDS_API_KEY || !HOTELBEDS_SECRET) {
      return res.status(500).json({ error: "Env vars HOTELBEDS_API_KEY / HOTELBEDS_SECRET não configuradas" });
    }

    // Monta occupancies (adultos/crianças/idades)
    const kids = parseInt(children || "0", 10);
    const ages = String(childrenAges || "")
      .split(",")
      .map(s => parseInt(s.trim(), 10))
      .filter(n => Number.isFinite(n));

    // Se tem crianças, precisa mandar as idades
    if (kids > 0 && ages.length !== kids) {
      return res.status(400).json({ error: "childrenAges deve ter a mesma quantidade de idades que children (ex: 7,10)" });
    }

    const occupancy = {
      rooms: 1,
      adults: parseInt(adults || "2", 10),
      children: kids,
      paxes: [
        ...Array.from({ length: parseInt(adults || "2", 10) }, () => ({ type: "AD" })),
        ...ages.map(a => ({ type: "CH", age: a }))
      ]
    };

    const payload = {
  stay: { checkIn: checkin, checkOut: checkout },
  occupancies: [{
    rooms: 1,
    adults: Number(adults || 2),
    children: Number(children || 0)
  }]
};

// destino por código OU por GPS
if (destination) {
  payload.destination = destination;
} else {
  payload.geolocation = {
    latitude: Number(lat),
    longitude: Number(lng),
    radius: Number(radius),
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
        Accept: "application/json"
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


