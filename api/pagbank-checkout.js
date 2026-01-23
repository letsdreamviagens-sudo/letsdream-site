
// Vercel Serverless Function: PagBank Checkout (PagBank / PagSeguro)
// Env vars required:
// - PAGBANK_TOKEN : Bearer token
// - PAGBANK_API_URL : optional (default sandbox)

// This implementation uses PagBank Checkout API (create checkout).
// If your token is for production, set PAGBANK_API_URL to https://api.pagbank.com.br

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const token = process.env.PAGBANK_TOKEN;
    if (!token) return res.status(500).json({ error: "Missing PAGBANK_TOKEN env var" });

    const apiBase = (process.env.PAGBANK_API_URL || "https://sandbox.api.pagseguro.com").replace(/\/$/, "");
    const url = `${apiBase}/checkouts`;

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const itemsIn = Array.isArray(body.items) ? body.items : [];

    if (!itemsIn.length) {
      return res.status(400).json({ error: "Missing items" });
    }

    // Normalize items
    const items = itemsIn.map((it, idx) => {
      const unit = Number(it.unit_amount);
      // If user passed a float value, convert to cents (assume 2 decimals)
      const unit_amount = Number.isFinite(unit) ? Math.round(unit * 100) : 100;
      return {
        reference_id: String(it.reference_id || idx + 1),
        name: String(it.name || "Item"),
        quantity: Math.max(1, Number(it.quantity) || 1),
        unit_amount,
      };
    });

    const payload = {
      reference_id: String(body.reference_id || `LETS-${Date.now()}`),
      customer: body.customer || { name: "Cliente", email: "cliente@email.com" },
      items,
      // Redirect back to your site after payment (optional)
      redirect_url: body.redirect_url || "",
      // notification_urls: ["https://..."] // optional webhook
    };

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      return res.status(r.status).json({ error: "PagBank returned error", details: data });
    }

    const checkoutUrl =
      data?.links?.find(l => l?.rel === "pay")?.href ||
      data?.checkout_url ||
      data?.url ||
      null;

    return res.status(200).json({ checkoutUrl, raw: data });
  } catch (e) {
    return res.status(500).json({ error: "Server error", message: String(e?.message || e) });
  }
}
