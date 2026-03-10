function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toNum(x) {
  const n = Number(String(x ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

async function fetchJson(url, options) {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({}));

  if (!r.ok) {
    const msg = data?.error || data?.message || `Erro ${r.status}`;
    const err = new Error(msg);
    err.status = r.status;
    err.data = data;
    throw err;
  }

  return data;
}

function getChildrenAgesFromQuery() {
  try {
    const raw = qs("childrenAges");
    if (!raw) return [];
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return [];
  }
}

let hotelCache = null;

function brlEstimate(eur, fx) {
  return eur * fx;
}

function setHeroImage(hotel) {
  const hero = document.getElementById("heroImg");
  if (!hero) return;

  const dest = (hotel?.destinationName || "").toLowerCase();

  let img = "";
  if (dest.includes("orlando")) img = "/img/orlando.jpg";
  else if (dest.includes("london")) img = "/img/london.jpg";
  else if (dest.includes("sao paulo") || dest.includes("são paulo")) img = "/img/saopaulo.jpg";
  else if (dest.includes("maceio") || dest.includes("maceió") || dest.includes("alagoas")) img = "/img/alagoas.jpg";
  else img = "/img/hotel-placeholder.jpg";

  hero.style.backgroundImage = `url('${img}')`;
}

function renderRates(hotel) {
  hotelCache = hotel;

  const wrap = document.getElementById("ratesWrap");
  const fxInput = document.getElementById("fx");
  const ratesHint = document.getElementById("ratesHint");

  const rooms = hotel?.rooms || [];
  if (!rooms.length) {
    wrap.innerHTML = `<p class="muted">Sem tarifas disponíveis nesse momento.</p>`;
    if (ratesHint) ratesHint.textContent = "";
    return;
  }

  const fx = toNum(fxInput?.value || 5);

  const items = [];
  for (const room of rooms) {
    for (const rate of (room.rates || [])) {
      items.push({
        roomName: room.name || "Quarto",
        board: rate.boardName || rate.boardCode || "—",
        refundable: rate.rateType !== "NON_REFUNDABLE",
        net: toNum(rate.net),
        currency: rate.currency || hotel.currency || "EUR",
        rateKey: rate.rateKey,
        cancellationPolicies: rate.cancellationPolicies || []
      });
    }
  }

  items.sort((a, b) => a.net - b.net);

  if (ratesHint) ratesHint.textContent = `${items.length} tarifas`;

  wrap.innerHTML = items.map((it, idx) => {
    const brl = fx ? brlEstimate(it.net, fx) : null;

    const cancelText = (it.cancellationPolicies?.length)
      ? `Cancelamento: a partir de ${escapeHtml(it.cancellationPolicies[0]?.from || "")} (multa ${escapeHtml(it.cancellationPolicies[0]?.amount || "")} ${escapeHtml(it.currency)})`
      : "Cancelamento: consultar no CheckRate";

    return `
      <div class="rate-card">
        <div class="rate-left">
          <b>${escapeHtml(it.roomName)}</b><br/>
          <div class="muted">Regime: ${escapeHtml(it.board)} • ${it.refundable ? "Reembolsável" : "Não reembolsável"}</div>
          <div class="muted">${escapeHtml(cancelText)}</div>
        </div>
        <div class="rate-right">
          <div class="price">${escapeHtml(it.currency)} ${it.net.toFixed(2)}</div>
          ${brl !== null ? `<div class="brl">≈ R$ ${brl.toFixed(2)}</div>` : ""}
          <button class="pick-btn" data-pick="${idx}">Escolher esta tarifa</button>
        </div>
      </div>
    `;
  }).join("");

  wrap.querySelectorAll("[data-pick]").forEach(btn => {
    btn.addEventListener("click", () => {
      const it = items[Number(btn.dataset.pick)];
      if (!it?.rateKey) {
        alert("Essa tarifa não retornou rateKey.");
        return;
      }

      const fxAtual = toNum(document.getElementById("fx")?.value || 5);
      const brlAtual = it.net * fxAtual;

      const roomUrl =
        `/room.html?hotelCode=${encodeURIComponent(qs("hotelCode"))}` +
        `&checkin=${encodeURIComponent(qs("checkin") || "")}` +
        `&checkout=${encodeURIComponent(qs("checkout") || "")}` +
        `&adults=${encodeURIComponent(qs("adults") || "2")}` +
        `&children=${encodeURIComponent(qs("children") || "0")}` +
        `&childrenAges=${encodeURIComponent(qs("childrenAges") || "[]")}` +
        `&hotelName=${encodeURIComponent(document.getElementById("hotelName")?.textContent || "")}` +
        `&hotelMeta=${encodeURIComponent(document.getElementById("hotelMeta")?.textContent || "")}` +
        `&roomName=${encodeURIComponent(it.roomName || "")}` +
        `&board=${encodeURIComponent(it.board || "")}` +
        `&currency=${encodeURIComponent(it.currency || "EUR")}` +
        `&net=${encodeURIComponent(it.net)}` +
        `&brl=${encodeURIComponent(brlAtual.toFixed(2))}` +
        `&rateKey=${encodeURIComponent(it.rateKey)}`;

      window.location.href = roomUrl;
    });
  });

  if (fxInput && !fxInput.dataset.bound) {
    fxInput.addEventListener("input", () => {
      renderRates(hotelCache);
    });
    fxInput.dataset.bound = "1";
  }
}

async function main() {
  const hotelCode = qs("hotelCode");
  const checkin = qs("checkin");
  const checkout = qs("checkout");
  const adults = qs("adults") || "2";
  const children = qs("children") || "0";
  const childrenAges = encodeURIComponent(JSON.stringify(getChildrenAgesFromQuery()));
  const name = qs("name") ? decodeURIComponent(qs("name")) : null;
  const zone = qs("zone") ? decodeURIComponent(qs("zone")) : "";
  const dest = qs("dest") ? decodeURIComponent(qs("dest")) : "";

  if (!hotelCode || !checkin || !checkout) {
    document.getElementById("ratesWrap").textContent = "Faltam parâmetros na URL.";
    return;
  }

  document.getElementById("hotelName").textContent = name || `Hotel ${hotelCode}`;
  document.getElementById("hotelMeta").textContent = [zone, dest].filter(Boolean).join(" • ");

  const url =
    `/api/hotelbeds-hotel-availability?hotelCode=${encodeURIComponent(hotelCode)}` +
    `&checkin=${encodeURIComponent(checkin)}` +
    `&checkout=${encodeURIComponent(checkout)}` +
    `&adults=${encodeURIComponent(adults)}` +
    `&children=${encodeURIComponent(children)}` +
    `&childrenAges=${childrenAges}`;

  const data = await fetchJson(url);
  const hotel = data?.hotel;

  if (!hotel) {
    document.getElementById("ratesWrap").textContent = "Não foi possível carregar as tarifas.";
    return;
  }

  if (hotel.name) document.getElementById("hotelName").textContent = hotel.name;
  document.getElementById("hotelMeta").textContent = [hotel.zoneName, hotel.destinationName].filter(Boolean).join(" • ");

  setHeroImage(hotel);
  renderRates(hotel);
}

main().catch(err => {
  console.error(err);
  document.getElementById("ratesWrap").textContent = `Erro: ${err.message}`;
});
