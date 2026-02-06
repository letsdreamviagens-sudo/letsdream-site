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
    throw new Error(data?.error || data?.message || `Erro ${r.status}`);
  }
  return data;
}

let selectedRateKey = null;
let selectedCurrency = "EUR";
let selectedNet = 0;

function brlEstimate(eur, fx) {
  return eur * fx;
}

function renderRates(hotel) {
  const wrap = document.getElementById("ratesWrap");
  const fxInput = document.getElementById("fx");

  const rooms = hotel?.rooms || [];
  if (!rooms.length) {
    wrap.innerHTML = `<p style="opacity:.85">Sem tarifas disponíveis nesse momento.</p>`;
    return;
  }

  const fx = toNum(fxInput.value) || 0;

  // Flatten room/rates
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

  // Ordenar por menor net
  items.sort((a,b) => a.net - b.net);

  wrap.innerHTML = items.map((it, idx) => {
    const brl = fx ? brlEstimate(it.net, fx) : null;

    const cancelText = (it.cancellationPolicies?.length)
      ? `Cancelamento: a partir de ${escapeHtml(it.cancellationPolicies[0]?.from || "")} (multa ${escapeHtml(it.cancellationPolicies[0]?.amount || "")} ${escapeHtml(it.currency)})`
      : "Cancelamento: consultar no CheckRate";

    return `
      <div style="border:1px solid rgba(0,0,0,.12);border-radius:14px;padding:14px;margin:12px 0;">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div>
            <b>${escapeHtml(it.roomName)}</b><br/>
            <small style="opacity:.85">Regime: ${escapeHtml(it.board)} • ${it.refundable ? "Reembolsável" : "Não reembolsável"}</small><br/>
            <small style="opacity:.85">${escapeHtml(cancelText)}</small>
          </div>
          <div style="text-align:right;min-width:180px;">
            <div><b>${escapeHtml(it.currency)}</b> ${it.net.toFixed(2)}</div>
            ${brl !== null ? `<div style="opacity:.85">≈ R$ ${brl.toFixed(2)}</div>` : ""}
            <button data-pick="${idx}" style="margin-top:8px;padding:10px 12px;border-radius:10px;border:1px solid rgba(0,0,0,.2);cursor:pointer;">
              Escolher esta tarifa
            </button>
          </div>
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

      // destaque visual simples
      wrap.querySelectorAll("button[data-pick]").forEach(b => b.style.background = "");
      btn.style.background = "rgba(0,0,0,.06)";
    });
  });

  fxInput.addEventListener("input", () => renderRates(hotel));
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

  // 🔥 Busca disponibilidade do hotel específico (rooms + rates + rateKey)
  const url = `/api/hotelbeds-hotel-availability?hotelCode=${encodeURIComponent(hotelCode)}&checkin=${encodeURIComponent(checkin)}&checkout=${encodeURIComponent(checkout)}&adults=${encodeURIComponent(adults)}&children=${encodeURIComponent(children)}`;

  const data = await fetchJson(url);
  const hotel = data?.hotel;

  if (!hotel) {
    document.getElementById("ratesWrap").textContent = "Não foi possível carregar as tarifas.";
    return;
  }

  // Atualiza título/meta se o retorno vier com nome
  if (hotel.name) document.getElementById("hotelName").textContent = hotel.name;
  document.getElementById("hotelMeta").textContent = [hotel.zoneName, hotel.destinationName].filter(Boolean).join(" • ");

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

      const booking = await fetchJson("/api/hotelbeds-booking-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientReference: `LD-${Date.now()}`,
          holder: { name: holderName, surname: holderSurname },
          rooms: [
            {
              rateKey: selectedRateKey,
              paxes: [{ type: "AD", name: holderName, surname: holderSurname }]
            }
          ]
        })
      });

      const ref = booking?.booking?.reference || booking?.reference || "OK";
      document.getElementById("statusLine").textContent = `Reserva confirmada ✅ Ref: ${ref}`;
      alert(`Reserva CONFIRMADA!\nReferência: ${ref}`);
    } catch (e) {
      console.error(e);
      document.getElementById("statusLine").textContent = `Erro: ${e.message}`;
      alert(`Erro ao confirmar: ${e.message}`);
    }
  });
}

main().catch(err => {
  console.error(err);
  document.getElementById("ratesWrap").textContent = `Erro: ${err.message}`;
});
