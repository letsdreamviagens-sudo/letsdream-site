import crypto from "crypto";

function sign(apiKey, secret) {
  const ts = Math.floor(Date.now() / 1000);
  return crypto.createHash("sha256").update(apiKey + secret + ts).digest("hex");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const body = req.body || {};
  const rateKey = body?.rooms?.[0]?.rateKey;

  if (!rateKey) return res.status(400).json({ error: "rooms[0].rateKey é obrigatório" });
  if (!body?.holder?.name || !body?.holder?.surname) {
    return res.status(400).json({ error: "holder.name e holder.surname são obrigatórios" });
  }
  if (!Array.isArray(body?.rooms?.[0]?.paxes) || body.rooms[0].paxes.length === 0) {
    return res.status(400).json({ error: "rooms[0].paxes deve ter pelo menos 1 hóspede" });
  }

  const API_KEY = process.env.HOTELBEDS_API_KEY;
  const SECRET = process.env.HOTELBEDS_SECRET;
  const BASE = process.env.HOTELBEDS_BASE_URL || "https://api.test.hotelbeds.com";
  const LANG = process.env.HOTELBEDS_LANGUAGE || "ENG";

  if (!API_KEY || !SECRET) {
    return res.status(500).json({ error: "Faltam HOTELBEDS_API_KEY / HOTELBEDS_SECRET" });
  }

  const url = `${BASE}/hotel-api/1.0/bookings`;

  const payload = {
    language: LANG,
    clientReference: body.clientReference || `LD-${Date.now()}`,
    holder: {
      name: String(body.holder.name).toUpperCase(),
      surname: String(body.holder.surname).toUpperCase(),
    },
    rooms: body.rooms.map((room) => ({
      rateKey: room.rateKey,
      paxes: room.paxes.map((p) => ({
        type: p.type, // "AD" | "CH"
        name: String(p.name || body.holder.name).toUpperCase(),
        surname: String(p.surname || body.holder.surname).toUpperCase(),
        ...(p.age ? { age: Number(p.age) } : {}),
      })),
    })),
  };

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
  if (!r.ok) return res.status(r.status).json({ error: "Booking falhou", details: data });

  return res.status(200).json(data);
}
