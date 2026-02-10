function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function toNum(x) {
  const n = Number(String(x ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

async function fetchJson(url, options) {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    // importantíssimo: isso deixa o erro claro no console
    const msg = data?.error || data?.message || `Erro ${r.status}`;
    const err = new Error(msg);
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return data;
}

let selectedRateKey = null;
let selectedCurrency = "EUR";
let selectedNet = 0;
let hotelCache = null;

function brlEstimate(eur, fx) {
  return eur * fx;
}

function setHeroImage(hotel) {
  const hero = document.getElementById("heroImg");
  if (!hero) return;

  const dest = (hotel?.destinationName || "").toLowerCase();

  // Se você criar imagens em /img, ele usa. Se não existir, fica no gradiente do CSS.
  let img = "";
  if (dest.includes("orlando")) img = "/img/orlando.jpg";
  else if (dest.includes("london")) img = "/img/london.jpg";
  else if (dest.includes("sao paulo") || dest.includes("são paulo")) img = "/img/saopaulo.jpg";
  else if (dest.includes("maceio") || dest.includes("maceió") || dest.includes("alagoas")) img = "/img/alagoas.jpg";

  if (img) hero.style.backgroundImage = `url('${img}')`;
}

function buildPaxesFromQuery(holderName, holderSurname) {
  const adults = Number(qs("adults") || "2");
  const children = Number(qs("children") || "0");

  const paxes = [];
  for (let i = 0; i < adults; i++) {
    paxes.push({ type: "AD", name: holderName, surname: holderSurname });
  }
  for (let i = 0; i < children; i++) {
    paxes.push({ type: "CH", name: holderName, surname: holderSurname, age: 7 });
  }
  return paxes;
}

function renderRates(hotel) {
  hotelCache = hotel;

  const wrap = document.getElementById("ratesWrap");
  const fxInput = document.getElementById("fx");
  const ratesHint = document.getElementById("ratesHint");
  const confirmBtn = document.getElementById("confirmBtn");

  const rooms = hotel?.rooms || [];
  if (!rooms.length) {
    wrap.innerHTML = `<p class="muted">Sem tarifas disponíveis nesse momento.</p>`;
    if (ratesHint) ratesHint.textContent = "";
    return;
  }

  const fx = toNum(fxInput.value) || 0;

  // Flatten
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

  items.sort((a,b) => a.net - b.net);
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

      selectedRateKey = it.rateKey;
      selectedCurrency = it.currency;
      selectedNet = it.net;

      document.getElementById("statusLine").textContent =
        `Tarifa selecionada: ${selectedCurrency} ${selectedNet.toFixed(2)} (rateKey salvo).`;

      // UI
      wrap.querySelectorAll(".pick-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");

      if (confirmBtn) confirmBtn.disabled = false;
    });
  });

  fxInput.addEventListener("input", () => {
    // rerender mantendo seleção (simples: limpa seleção ao mexer fx)
    renderRates(hotelCache);
  });
}

async function main() {
  const hotelCode = qs("hotelCode");
  const checkin = qs("checkin");
  const checkout = qs("checkout");
  const adults = qs("adults") || "2";
  const children = qs("children") || "0";
  const name = qs("name") ? decodeURIComponent(qs("name")) : null;
  const zone = qs("zone") ? decodeURIComponent(qs("zone")) : "";
  const dest = qs("dest") ? decodeURIComponent(qs("dest")) : "";

  if (!hotelCode || !checkin || !checkout) {
    document.getElementById("ratesWrap").textContent = "Faltam parâmetros na URL (hotelCode/checkin/checkout).";
    return;
  }

  document.getElementById("hotelName").textContent = name || `Hotel ${hotelCode}`;
  document.getElementById("hotelMeta").textContent = [zone, dest].filter(Boolean).join(" • ");

  // ✅ busca availability do hotel específico (rooms + rates + rateKey)
  const url = `/api/hotelbeds-hotel-availability?hotelCode=${encodeURIComponent(hotelCode)}&checkin=${encodeURIComponent(checkin)}&checkout=${encodeURIComponent(checkout)}&adults=${encodeURIComponent(adults)}&children=${encodeURIComponent(children)}`;

  const data = await fetchJson(url);
  const hotel = data?.hotel;

  if (!hotel) {
    document.getElementById("ratesWrap").textContent = "Não foi possível carregar as tarifas.";
    return;
  }

  // Atualiza título/meta se vier do backend
  if (hotel.name) document.getElementById("hotelName").textContent = hotel.name;
  document.getElementById("hotelMeta").textContent = [hotel.zoneName, hotel.destinationName].filter(Boolean).join(" • ");

  setHeroImage(hotel);
  renderRates(hotel);

  // Confirmar reserva
  document.getElementById("confirmBtn").addEventListener("click", async () => {
    try {
      if (!selectedRateKey) {
        alert("Escolha uma tarifa (quarto) antes de confirmar.");
        return;
      }

      const holderName = (document.getElementById("holderName").value || "").trim();
      const holderSurname = (document.getElementById("holderSurname").value || "").trim();
      if (!holderName || !holderSurname) {
        alert("Preencha nome e sobrenome do titular.");
        return;
      }

      document.getElementById("statusLine").textContent = "CheckRate...";
      await fetchJson("/api/hotelbeds-checkrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rateKey: selectedRateKey })
      });

      document.getElementById("statusLine").textContent = "Confirmando booking...";

      // ✅ paxes bate com adults/children da busca
      const booking = await fetchJson("/api/hotelbeds-booking-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientReference: `LD-${Date.now()}`,
          holder: { name: holderName, surname: holderSurname },
          rooms: [
            {
              rateKey: selectedRateKey,
              paxes: buildPaxesFromQuery(holderName, holderSurname)
            }
          ]
        })
      });

      const ref = booking?.booking?.reference || booking?.reference || "OK";
      document.getElementById("statusLine").textContent = `Reserva confirmada ✅ Ref: ${ref}`;
      alert(`Reserva CONFIRMADA!\nReferência: ${ref}`);
    } catch (e) {
      console.error("CONFIRM ERROR:", e);
      document.getElementById("statusLine").textContent = `Erro: ${e.message}`;
      alert(`Erro ao confirmar: ${e.message}\n\nAbra o Console (F12) para ver detalhes.`);
    }
  });
}

main().catch(err => {
  console.error(err);
  document.getElementById("ratesWrap").textContent = `Erro: ${err.message}`;
});
