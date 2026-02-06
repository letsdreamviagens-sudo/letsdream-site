// Let’s Dream — B2B interno (Hotelbeds)
// Fluxo: Search -> Select 1 hotel -> Get rateKey (fallback) -> CheckRate -> Booking Confirm
// Requer APIs:
// - /api/hotelbeds-search      (sua busca atual)
// - /api/hotelbeds-ratekey     (novo: pega rateKey pelo hotelCode)
// - /api/hotelbeds-checkrate   (novo: revalida rateKey)
// - /api/hotelbeds-booking-confirm (novo: confirma reserva)

function $(id) { return document.getElementById(id); }

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

function setHint(text) {
  const el = $("resultsHint");
  if (el) el.textContent = text;
}

// ======= STATE =======
let selected = null;
// selected = { code, name, zoneName, destinationName, currency, minRate, rateKey }

// ======= HELPERS =======
const DESTINATION_MAP = {
  "NYC": "NYC",
  "NEW YORK": "NYC",
  "NOVA YORK": "NYC",
  "MIAMI": "MIA",
  "CANCUN": "CUN",
  "CANCÚN": "CUN",
  "PUNTA CANA": "PUJ",
  "PARIS": "PAR",
  "LONDRES": "LON",
  "LONDON": "LON",
  "RIO DE JANEIRO": "RIO",
  "SÃO PAULO": "SAO",
  "SAO PAULO": "SAO",
  // Orlando pode ser via geolocalização (se ORL não existir)
  "ORLANDO": { lat: 28.538336, lng: -81.379234, radius: 35 },
};

function buildHotelsApiUrl({ city, checkin, checkout, adults, children }) {
  const key = city.trim().toUpperCase();
  const mapped = DESTINATION_MAP[key];

  if (mapped && typeof mapped === "object") {
    return `/api/hotelbeds-search?lat=${encodeURIComponent(mapped.lat)}&lng=${encodeURIComponent(mapped.lng)}&radius=${encodeURIComponent(mapped.radius || 35)}&checkin=${encodeURIComponent(checkin)}&checkout=${encodeURIComponent(checkout)}&adults=${encodeURIComponent(adults)}&children=${encodeURIComponent(children)}`;
  }

  const destination = mapped || key;
  return `/api/hotelbeds-search?destination=${encodeURIComponent(destination)}&checkin=${encodeURIComponent(checkin)}&checkout=${encodeURIComponent(checkout)}&adults=${encodeURIComponent(adults)}&children=${encodeURIComponent(children)}`;
}

async function fetchJson(url, options) {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error || data?.message || `Erro HTTP ${r.status}`;
    const err = new Error(msg);
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return data;
}

function renderSelected() {
  const wrap = $("cartItems");
  const totalEl = $("cartTotal");

  if (wrap) {
    if (!selected) {
      wrap.innerHTML = `<p class="note">Nenhum hotel selecionado.</p>`;
    } else {
      wrap.innerHTML = `
        <div style="display:flex;gap:12px;align-items:flex-start;justify-content:space-between;padding:12px;border:1px solid rgba(0,0,0,.12);border-radius:12px;margin:10px 0">
          <div style="flex:1">
            <b>${escapeHtml(selected.name)}</b><br>
            <small style="opacity:.85">${escapeHtml(selected.zoneName || "-")} • ${escapeHtml(selected.destinationName || "")}</small><br>
            <small style="opacity:.85">rateKey: <span style="word-break:break-all">${escapeHtml(selected.rateKey || "")}</span></small>
            <div style="margin-top:8px;font-size:12px;opacity:.85">
              *Valor sujeito à confirmação no fornecedor (CheckRate).
            </div>
          </div>
          <div style="min-width:160px;text-align:right">
            <div><b>${escapeHtml(selected.currency || "EUR")}</b> ${toNum(selected.minRate).toFixed(2)}</div>
          </div>
        </div>
      `;
    }
  }

  if (totalEl) {
    totalEl.textContent = selected
      ? `${selected.currency || "EUR"} ${toNum(selected.minRate).toFixed(2)} (ref.)`
      : "—";
  }

  // Reaproveita botão antigo do PagBank como "Confirmar reserva"
  const payBtn = $("payBtn");
  if (payBtn) {
    payBtn.textContent = "Confirmar reserva";
    payBtn.disabled = !selected;
  }

  // Esconde WhatsApp no B2B interno (se existir)
  const whatsappBtn = $("whatsappBtn");
  if (whatsappBtn) whatsappBtn.style.display = "none";
}

function clearSelection() {
  selected = null;
  renderSelected();
}

function getFormParams() {
  return {
    city: ($("city")?.value || "").trim(),
    checkin: $("checkin")?.value || "",
    checkout: $("checkout")?.value || "",
    adults: $("adults")?.value || "2",
    children: $("children")?.value || "0",
  };
}

// ======= SEARCH =======
async function buscarHoteis(e) {
  e?.preventDefault?.();

  const { city, checkin, checkout, adults, children } = getFormParams();
  if (!city || !checkin || !checkout) {
    alert("Preencha cidade, check-in e check-out.");
    return;
  }

  const list = $("hotelsList");
  if (list) list.innerHTML = `<p class="note">Buscando hotéis...</p>`;
  setHint("Buscando...");

  try {
    const url = buildHotelsApiUrl({ city, checkin, checkout, adults, children });
    const data = await fetchJson(url);
    console.log("SEARCH OK:", data);
    renderHotels(data);
    $("resultados")?.scrollIntoView?.({ behavior: "smooth" });
  } catch (err) {
    console.error("SEARCH ERRO:", err);
    if ($("hotelsList")) $("hotelsList").innerHTML = `<p class="note">Erro ao buscar hotéis. Veja o console (F12).</p>`;
    setHint("Erro");
    alert(`Erro ao buscar hotéis: ${err.message}`);
  }
}

function renderHotels(data) {
  const list = $("hotelsList");
  if (!list) return;

  const hotels = data?.hotels?.hotels || [];
  const currency = data?.currency || hotels?.[0]?.currency || "EUR";

  setHint(hotels.length ? `${hotels.length} hotéis` : "0 hotéis");

  if (!hotels.length) {
    list.innerHTML = `<p class="note">Não encontramos hotéis para essa busca.</p>`;
    return;
  }

  hotels.sort((a, b) => toNum(a.minRate) - toNum(b.minRate));

  list.innerHTML = hotels.map(h => `
    <article class="hotel">
      <div class="top">
        <div>
          <h3>${escapeHtml(h.name)}</h3>
          <div class="meta">${escapeHtml(h.zoneName || "-")} • ${escapeHtml(h.destinationName || "")}</div>
        </div>
        <div class="price">
          <small>Menor preço</small>
          ${escapeHtml(currency)} ${toNum(h.minRate).toFixed(2)}
        </div>
      </div>

      <div class="actions">
        <button
          class="btn btn-primary"
          type="button"
          data-select="1"
          data-code="${escapeHtml(h.code)}"
          data-name="${escapeHtml(h.name)}"
          data-zone="${escapeHtml(h.zoneName || '')}"
          data-dest="${escapeHtml(h.destinationName || '')}"
          data-currency="${escapeHtml(currency)}"
          data-price="${escapeHtml(h.minRate)}"
          data-ratekey="${escapeHtml(h.rateKey || '')}"
        >Selecionar</button>
      </div>
    </article>
  `).join("");

  list.querySelectorAll("[data-select]").forEach(btn => {
    btn.addEventListener("click", () => onSelectHotel(btn));
  });
}

// ======= SELEÇÃO + RATEKEY FALLBACK =======
async function getRateKeyByHotelCode(hotelCode) {
  const { checkin, checkout, adults, children } = getFormParams();
  const url = `/api/hotelbeds-ratekey?hotelCode=${encodeURIComponent(hotelCode)}&checkin=${encodeURIComponent(checkin)}&checkout=${encodeURIComponent(checkout)}&adults=${encodeURIComponent(adults)}&children=${encodeURIComponent(children)}`;
  const data = await fetchJson(url);
  return data.rateKey;
}

async function onSelectHotel(btn) {
  try {
    const hotelCode = btn.dataset.code;
    let rateKey = btn.dataset.ratekey;

    // ✅ Se a listagem não trouxe rateKey, busca via endpoint específico
    if (!rateKey) {
      setHint("Obtendo rateKey...");
      rateKey = await getRateKeyByHotelCode(hotelCode);
    }

    selected = {
      code: hotelCode,
      name: btn.dataset.name,
      zoneName: btn.dataset.zone,
      destinationName: btn.dataset.dest,
      currency: btn.dataset.currency,
      minRate: btn.dataset.price,
      rateKey
    };

    console.log("SELECTED:", selected);
    renderSelected();
    $("carrinho")?.scrollIntoView?.({ behavior: "smooth" });
    setHint("Hotel selecionado");
  } catch (err) {
    console.error("RATEKEY ERRO:", err);
    alert(`Não consegui obter rateKey desse hotel.\n${err.message}\n\nVeja o console (F12).`);
    setHint("Erro rateKey");
  }
}

// ======= BOOKING FLOW =======
function buildBookingPayload() {
  // Para começar, usamos dados fixos (uso interno).
  // Se você quiser, depois colocamos inputs holderName/holderSurname na tela.
  const holder = {
    name: "AGENTE",
    surname: "LETS DREAM"
  };

  return {
    clientReference: `LD-${Date.now()}`,
    holder,
    rooms: [
      {
        rateKey: selected.rateKey,
        paxes: [
          { type: "AD", name: holder.name, surname: holder.surname }
        ]
      }
    ]
  };
}

async function confirmarReserva() {
  try {
    if (!selected?.rateKey) {
      alert("Selecione um hotel primeiro.");
      return;
    }

    setHint("CheckRate...");
    const check = await fetchJson("/api/hotelbeds-checkrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rateKey: selected.rateKey })
    });
    console.log("CHECKRATE OK:", check);

    // (opcional) se quiser comparar preço e pedir aceite:
    // Muitos retornos vem em check.hotel.rooms[0].rates[0].net, mas varia.
    const netGuess =
      toNum(check?.hotel?.rooms?.[0]?.rates?.[0]?.net) ||
      toNum(check?.rate?.net);

    if (netGuess && toNum(selected.minRate) && Math.abs(netGuess - toNum(selected.minRate)) > 0.01) {
      const ok = confirm(
        `Preço mudou.\nAntes: ${selected.currency} ${toNum(selected.minRate).toFixed(2)}\nAgora: ${selected.currency} ${netGuess.toFixed(2)}\n\nConfirmar mesmo assim?`
      );
      if (!ok) return;
    }

    setHint("Confirmando booking...");
    const payload = buildBookingPayload();

    const booking = await fetchJson("/api/hotelbeds-booking-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    console.log("BOOKING OK:", booking);

    const ref =
      booking?.booking?.reference ||
      booking?.booking?.bookingReference ||
      booking?.reference ||
      "OK";

    setHint("Reserva confirmada ✅");
    alert(`Reserva CONFIRMADA!\nReferência: ${ref}`);
  } catch (err) {
    console.error("CONFIRM ERRO:", err);
    setHint("Erro");
    alert(`Erro ao confirmar reserva: ${err.message}\n\nVeja o console (F12).`);
  }
}

// ======= INIT =======
document.addEventListener("DOMContentLoaded", () => {
  $("searchForm")?.addEventListener("submit", buscarHoteis);

  // Botão antigo (PagBank) vira Confirmar reserva
  $("payBtn")?.addEventListener("click", confirmarReserva);

  // Botão opcional, se existir no HTML
  $("confirmBookingBtn")?.addEventListener("click", confirmarReserva);

  // Botão opcional, se existir no HTML
  $("clearCartBtn")?.addEventListener("click", clearSelection);

  renderSelected();
});
