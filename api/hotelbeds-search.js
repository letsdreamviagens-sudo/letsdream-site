// api/hotelbeds-search.js
import crypto from "crypto";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req, res) {
  setCors(res);

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Use GET" });
  }

  try {
    const apiKey = process.env.HOTELBEDS_API_KEY;
    const secret = process.env.HOTELBEDS_SECRET;
    const env = (process.env.HOTELBEDS_ENV || "test").toLowerCase(); // test | live

    if (!apiKey || !secret) {
      return res.status(500).json({
        error: "Variáveis de ambiente faltando: HOTELBEDS_API_KEY e/ou HOTELBEDS_SECRET",
      });
    }

    const { destination, checkin, checkout, adults, children, childrenAges } = req.query;

    if (!destination || !checkin || !checkout) {
      return res.status(400).json({ error: "Faltou destination/checkin/checkout" });
    }

    const baseURL =
      env === "live"
        ? "https://api.hotelbeds.com"
        : "https://api.test.hotelbeds.com";

    // Assinatura Hotelbeds: SHA256(apiKey + secret + timestamp)
    const ts = Math.floor(Date.now() / 1000).toString();
    const signature = crypto
      .createHash("sha256")
      .update(apiKey + secret + ts)
      .digest("hex");

    // Monta ocupação
    const a = parseInt(adults || "2", 10);
    const c = parseInt(children || "0", 10);
    const ages = (childrenAges || "")
      .toString()
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => parseInt(x, 10))
      .filter((n) => Number.isFinite(n));

    // Ex: se children=2 e ages veio vazio, cria [7,7] só pra não quebrar
    const finalAges =
      c > 0 ? (ages.length ? ages.slice(0, c) : Array(c).fill(7)) : [];

    const occupancies = [
      {
        adults: a,
        children: c,
        paxes: [
          ...Array.from({ length: a }, () => ({ type: "AD" })),
          ...finalAges.map((age) => ({ type: "CH", age })),
        ],
      },
    ];

    // ⚠️ Aqui destination é só DEMO. Hotelbeds usa destination codes reais (ex: MCO, etc).
    // Você pode trocar isso depois por um mapeamento.
    const payload = {
      stay: { checkIn: checkin, checkOut: checkout },
      occupancies,
      destination: { code: destination }, // exemplo: "ORL" (depende do seu catálogo)
      filter: { maxHotels: 20 },
    };

    const r = await fetch(`${baseURL}/hotel-api/1.0/hotels`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-key": apiKey,
        "X-Signature": signature,
      },
      body: JSON.stringify(payload),
    });

    const text = await r.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!r.ok) {
      return res.status(r.status).json({
        error: "Hotelbeds retornou erro",
        status: r.status,
        data,
      });
    }

    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({
      error: "Erro interno na função",
      message: e?.message || String(e),
    });
  }
}
