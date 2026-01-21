export default async function handler(req, res) {
  try {
    // Permite chamar pelo navegador
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Preflight (às vezes o browser manda)
    if (req.method === "OPTIONS") return res.status(200).end();

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Use GET" });
    }

    const { destination, checkin, checkout, adults, children, childrenAges } = req.query;

    if (!destination || !checkin || !checkout) {
      return res.status(400).json({ error: "Faltou destination/checkin/checkout" });
    }

    // 🔑 Variáveis do ambiente (coloque na Vercel depois)
    const API_KEY = process.env.HOTELBEDS_API_KEY;
    const SECRET = process.env.HOTELBEDS_SECRET;
    const BASE_URL = process.env.HOTELBEDS_BASE_URL || "https://api.test.hotelbeds.com";

    if (!API_KEY || !SECRET) {
      return res.status(500).json({ error: "Faltou HOTELBEDS_API_KEY ou HOTELBEDS_SECRET na Vercel" });
    }

    // ====== Assinatura Hotelbeds (X-Signature) ======
    const ts = Math.floor(Date.now() / 1000).toString();

    const crypto = await import("crypto");
    const signature = crypto.createHash("sha256").update(API_KEY + SECRET + ts).digest("hex");

    // ====== Exemplo de chamada (ajuste se seu endpoint for diferente) ======
    // Obs: aqui eu deixo “genérico” porque Hotelbeds pode variar conforme produto/endpoint.
    // Se seu código anterior já chamava um endpoint específico, me diga qual e eu ajusto.
    const url = `${BASE_URL}/hotel-api/1.0/hotels`;

    const body = {
      stay: { checkIn: checkin, checkOut: checkout },
      occupancies: [
        {
          rooms: 1,
          adults: Number(adults || 2),
          children: Number(children || 0),
          paxes: buildPaxes(Number(adults || 2), Number(children || 0), childrenAges),
        },
      ],
      destination: { code: destination }, // se você usa ORL etc
    };

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-key": API_KEY,
        "X-Signature": signature,
      },
      body: JSON.stringify(body),
    });

    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    return res.status(r.status).json(data);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e?.message || e) });
  }
}

function buildPaxes(adults, children, childrenAges) {
  const paxes = [];
  for (let i = 0; i < adults; i++) paxes.push({ type: "AD" });

  // childrenAges pode vir "7" ou "7,5"
  const ages = String(childrenAges || "")
    .split(",")
    .map(s => Number(s.trim()))
    .filter(n => !Number.isNaN(n));

  for (let i = 0; i < children; i++) {
    paxes.push({ type: "CH", age: ages[i] || 7 });
  }
  return paxes;
}
