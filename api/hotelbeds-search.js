import crypto from "crypto";

function sign(apiKey, secret) {
  const ts = Math.floor(Date.now() / 1000);
  return crypto.createHash("sha256").update(apiKey + secret + ts).digest("hex");
}

export default async function handler(req, res) {
  try {
    // CORS básico (permite o seu site chamar essa API)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();

    const { destination, checkin, checkout, adults = "2", children = "0", childrenAges = "" } = req.query;

    if (!destination || !checkin || !checkout) {
      return res.status(400).json({ error: "Faltou destination/checkin/checkout" });
    }

    const HOTELBEDS_API_KEY = process.env.HOTELBEDS_API_KEY;
    const HOTELBEDS_SECRET = process.env.HOTELBEDS_SECRET;
    const HOTELBEDS_BASE = process.env.HOTELBEDS_BASE_URL || "https://api.test.hotelbeds.com";

    if (!HOTELBEDS_API_KEY || !HOTELBEDS_SECRET) {
      return res.status(500).json({ error: "Env vars ausentes: HOTELBEDS_API_KEY e/ou HOTELBEDS_SECRET" });
    }

    // Monta paxes (idades das crianças)
    const kids = parseInt(children, 10) || 0;
    const ages = String(childrenAges || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, kids)
      .map(a => parseInt(a, 10))
      .filter(n => Number.isFinite(n));

    const paxes = [];
    for (let i = 0; i < kids; i++) {
      paxes.push({ type: "CH", age: ages[i] ?? 7 }); // default 7 se não mandar
    }

    const payload = {
      stay: { checkIn: checkin, checkOut: checkout },
      occupancies: [
        {
          rooms: 1,
          adults: parseInt(adults, 10) || 2,
          children: kids,
          paxes
        }
      ],
      destination: { code: String(destination).toUpperCase() }
    };

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

