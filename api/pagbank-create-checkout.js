export default async function handler(req, res) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Use POST" };
    }

    const token = process.env.PAGBANK_TOKEN;
    if (!token) {
      return { statusCode: 500, body: "Token PagBank não configurado" };
    }

    const { items } = JSON.parse(event.body || "{}");

    const payload = {
      reference_id: "LETS-" + Date.now(),
      items: items.map(i => ({
        name: i.name,
        quantity: i.quantity,
        unit_amount: i.unit_amount // em centavos
      })),
      payment_methods_configs: [
        {
          type: "CREDIT_CARD",
          config_options: [
            { option: "INSTALLMENTS_LIMIT", value: "10" },
            { option: "INTEREST_FREE_INSTALLMENTS", value: "0" }
          ]
        }
      ],
      redirect_url: "https://super-crumble-455151.netlify.app/"
    };

    const resp = await fetch("https://api.pagseguro.com/checkouts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();

    const payLink = data.links?.find(l => l.rel === "PAY")?.href;

    return {
      statusCode: 200,
      body: JSON.stringify({ pay_url: payLink })
    };

  } catch (err) {
    return { statusCode: 500, body: String(err) };
  }
}

