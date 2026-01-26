export default async function handler(req, res) {
  // CORS básico
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = process.env.PAGBANK_TOKEN;
    const baseUrl = process.env.PAGBANK_BASE_URL || "https://api.pagseguro.com";

    if (!token) {
      return res.status(500).json({ error: "PAGBANK_TOKEN não configurado na Vercel" });
    }

    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];

    if (!items.length) {
      return res.status(400).json({ error: "Carrinho vazio (items)" });
    }

    // PagBank ORDERS (Checkout)
    const url = `${baseUrl}/orders`;

    // PagBank trabalha com centavos (inteiro)
    const orderPayload = {
      reference_id: body.reference_id || `LETS-${Date.now()}`,
      customer: body.customer || {
        name: "Cliente",
        email: "cliente@email.com",
      },
      items: items.map((it, idx) => {
        const qty = Number(it.quantity || 1);
        const valueCents = Number(it.unit_amount); // já deve vir em centavos
        return {
          reference_id: String(it.reference_id || idx + 1),
          name: String(it.name || "Item"),
          quantity: qty,
          unit_amount: valueCents,
        };
      }),
      // URLs opcionais
      notification_urls: body.notification_urls || [],
      redirect_url: body.redirect_url || undefined,
    };

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      return res.status(r.status).json({
        error: "PagBank returned error",
        status: r.status,
        details: data,
      });
    }

    // PagBank normalmente retorna links; procuramos o link de pagamento
    const links = Array.isArray(data.links) ? data.links : [];
    const pay =
      links.find(l => (l.rel || "").toUpperCase() === "PAY") ||
      links.find(l => (l.rel || "").toUpperCase() === "SELF") ||
      links[0];

    const checkoutUrl = pay?.href;

    if (!checkoutUrl) {
      return res.status(500).json({
        error: "Checkout URL não retornada",
        details: data,
      });
    }

    return res.status(200).json({ checkoutUrl, raw: data });
  } catch (e) {
    return res.status(500).json({ error: "Server error", message: String(e?.message || e) });
  }
}
