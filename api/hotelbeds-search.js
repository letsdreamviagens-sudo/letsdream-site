// netlify/functions/hotelbeds-search.js
import crypto from "crypto";

function makeSignature(apiKey, secret) {
  const ts = Math.floor(Date.now() / 1000);
  return crypto.createHash("sha256").update(`${apiKey}${secret}${ts}`).digest("hex");
}

export async function handler(event) {
  try {
    const apiKey = process.env.HOTELBEDS_API_KEY;
    const secret = process.env.HOTELBEDS_SECRET;
    const baseUrl = process.env.HOTELBEDS_BASE_URL || "https://api.test.hotelbeds.com";

    if (!apiKey || !secret) {
      return { statusCode: 500, body: JSON.stringify({ error: "Sem HOTELBEDS_API_KEY/HOTELBEDS_SECRET no Netlify" }) };
    }

    const q = event.queryStringParameters || {};
    const destination = (q.destination || "").toUpperCase(); // ex: ORL
    const checkin = q.checkin;   // YYYY-MM-DD
    const checkout = q.checkout; // YYYY-MM-DD
    const adults = Number(q.adults || 2);
    const children = Number(q.children || 0);

    const childrenAges = (q.childrenAges || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)
      .map(n => Number(n));

    if (!destination || !checkin || !checkout) {
      return { statusCode: 400, body: JSON.stringify({ error: "Faltou destination/checkin/checkout" }) };
    }

    const paxes = [];
    for (let i = 0; i < adults; i++) paxes.push({ type: "AD", age: 30 });
    for (let i = 0; i < children; i++) paxes.push({ type: "CH", age: childrenAges[i] ?? 7 });

    const body = {
      stay: { checkIn: checkin, checkOut: checkout },
      occupancies: [{ rooms: 1, adults, children, paxes }],
      destination: { code: destination },
      filter: { maxHotels: 25 }
    };

    const url = `${baseUrl}/hotel-api/1.0/hotels`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Api-key": apiKey,
        "X-Signature": makeSignature(apiKey, secret),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return { statusCode: res.status, body: JSON.stringify(data) };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
}
