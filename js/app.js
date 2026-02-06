// Let’s Dream Viagens — B2B Internal (Hotelbeds Search + CheckRate + Booking Confirm)
// Requires:
// - /api/hotelbeds-search  (must return hotel.rateKey)
// - /api/hotelbeds-checkrate
// - /api/hotelbeds-booking-confirm

// ===== Destination mapping =====
const DESTINATION_MAP = {
  "NYC": "NYC",
  "NEW YORK": "NYC",
  "NOVA YORK": "NYC",
  "MIAMI": "MIA",
  "CANCUN": "CUN",
  "CANCÚN": "CUN",
  "PUNTA CANA": "PUJ",
  "CARIBE": "PUJ",
  "PARIS": "PAR",
  "LONDRES": "LON",
  "LONDON": "LON",
  "RIO DE JANEIRO": "RIO",
  "SÃO PAULO": "SAO",
  "SAO PAULO": "SAO",

  // Orlando via lat/lng (se ORL não existir na conta)
  "ORLANDO": { lat: 28.538336, lng: -81.379234, radius: 35 },
};

function $(id) { return document.getElementById(id); }

function toNum(x) {
  const n = Number(String(x ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function buildHotelsApiUrl({ city, checkin, checkout, adults, children }) {
  const cityKey = city.trim().toUpperCase();
  const mapped = DESTINATION_MAP[cityKey];

  if (mapped && typeof mapped === "object") {
    return `/api/hotelbeds-search?lat=${encodeURIComponent(mapped.lat)}&lng=${encodeURIComponent(mapped.lng)}&radius=${encodeURIComponent(mapped.radius || 35)}&checkin=${encodeURIComponent(checkin)}&checkout=${encodeURIComponent(checkout)}&adults=${encodeURIComponent(adults)}&children=${encodeURIComponent(children)}`;
  }

  const destination = mapped || cityKey;
  return `/api/hotelbeds-search?destination=${encodeURIComponent(destination)}&checkin=${encodeURIComponent(checkin)}&checkout=${encodeURIComponent(checkout)}&adults=${encodeURIComponent(adults)}&children=${encodeURIComponent(children)}`;
}

// ===== State =====
let selected = null;
// selected = { code, name, zoneName, destinationName, currency, minRate, rateKey }

// ===== UI helpers =====
function setHint(text) {
  const hint = $("resultsHint");
  if (hint) hint.textContent = text;
}

function renderSelected() {
  // Reaproveita a área do “carrinho” se ela existir
  const wrap = $("cartItems");
  const totalEl = $("cartTotal");

  if (wrap) {
    if (!selected) {
      wrap.innerHTML = `<p class="note">Nenhum hotel selecionado.</p>`;
    } else {
      wrap.innerHTML = `
        <div class="cart-item" style="display:flex;gap:12px;align-items:center;justify-content:space-between;padding:10px;border:1px solid rgba(0,0,0,.12);border-radius:12px;margin:10px 0">
          <div style="flex:1">
            <b>${escapeHtml(selected.name)}</b><br>
            <small style="opacity:.85">${escapeHtml(selected.zoneName || "-")} • ${escapeHtml(selected.destinationName || "")}</small><br>
            <small style="opacity:.85">rateKey: <span style="word-break:break-all">${escapeHtml(selected.rateKey || "")}</span></small>
          </div>
          <div style="min-width:160px;text-align:right">
            <div><b>${escapeHtml(selected.currency || "EUR")}</b> ${toNum(selected.minRate).toFixed(2)}</div>
            <small style="opacity:.85;display:block;margin-top:6px">*Valor sujeito à confirmação</small>
          </div>
        </div>
      `;
    }
  }

  if (totalEl) {
    if (!selected) totalEl.textContent = "—";
    else totalEl.textContent = `${selected.currency || "EUR"} ${toNum(selected.minRate).toFixed(2)} (ref.)`;
  }

  // Repurpose botões antigos, se existirem:
  const payBtn = $("payBtn"); // no HTML antigo era PagBank
  if (payBtn) {
    payBtn.textContent = "Confirmar reserva";
    payBtn.classList.add("btn-primary");
  }

  const whatsappBtn = $("whatsappBtn");
  if (whatsappBtn) {
    whatsappBtn.style.display = "none"; // B2B interno: esconder
  }
}

function clearSelection() {
  selected = null;
  renderSelected();
  alert("Seleção limpa.");
}

// ===== Render hotels =====
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
      <div class="img" style="background-image:url('img/orlando.jpg')"></div>

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
          data-select-hotel="1"
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

  list.querySelectorAll("[data-select-hotel]").forEach(btn => {
    btn.addEventListener("click", () => {
      const rateKey = btn.dataset.ratekey;
      if (!rateKey) {
        alert("Esse resultado não veio com rateKey. Ajuste /api/hotelbeds-search para incluir hotel.rateKey.");
        return;
      }

      selected = {
        code: btn.dataset.code,
        name: btn.dataset.name,
        zoneName: btn.dataset.zone,
        destinationName: btn.dataset.dest,
        currency: btn.dataset.currency,
        minRate: btn.dataset.price,
        rateKey: rateKey
      };

      renderSelected();
      $("carrinho")?.scrollIntoView?.({ behavior: "smooth" });
    });
  });
}

// ===== Search =====
async function buscarHoteis(e) {
  e?.preventDefault?.();

  const city = ($("city")?.value || "").trim();
  const checkin = $("checkin")?.value || "";
  const checkout = $("checkout")?.value || "";
  const adults = $("adults")?.value || "2";
  const children = $("children")?.value || "0";

  if (!city || !checkin || !checkout) {
    alert("Preencha cidade, check-in e check-out.");
    return;
  }

  const list = $("hotelsList");
  if (list) list.innerHTML = `<p class="note">Buscando hotéis...</p>`;
  setHint("Buscando...");

  const url = buildHotelsApiUrl({ city, checkin, checkout, adults, children });

  const r = await fetch(url);
  const data = await r.json().catch(() => ({}));

  console.log("HOTELBEDS SEARCH:", data);

  if (!r.ok) {
    console.error("Erro Hotelbeds:", data);
    if (list) list.innerHTML = `<p class="note">Erro ao buscar hotéis. Veja o console (F12).</p>`;
    setHint("Erro");
    return;
  }

  renderHotels(data);
  $("resultados")?.scrollIntoView?.({ behavior: "smooth" });
}

// ===== Booking flow (CheckRate -> Booking Confirm) =====
function buildPaxesFromForm() {
  // Para B2B interno: se você não tiver tela de hóspedes ainda, vamos no mínimo com 1 AD.
  // Se existirem inputs de holder/paxes no HTML, usamos; senão, default.
  const holderName = ($("holderName")?.value || "AGENTE").trim();
  const holderSurname = ($("holderSurname")?.value || "LETS DREAM").trim();

  // Um pax AD mínimo
  const paxes = [{ type: "AD", name: holderName, surname: holderSurname }];

  return {
    holder: { name: holderName, surname: holderSurname },
    rooms: [{ rateKey: selected.rateKey, paxes }]
  };
}

async function confirmarReserva() {
  if (!selected?.rateKey) {
    alert("Selecione um hotel primeiro.");
    return;
  }

  // 1) CheckRate
  const r1 = await fetch("/api/hotelbeds-checkrate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rateKey: selected.rateKey })
  });

  const check = await r1.json().catch(() => ({}));
  console.log("CHECKRATE:", check);

  if (!r1.ok) {
    alert("CheckRate falhou (tarifa pode ter mudado ou ficado indisponível). Veja o console (F12).");
    return;
  }

  // Opcional: comparar preços e pedir aceite
  // (mantendo simples: B2B interno)
  const confirmedNet = toNum(check?.hotel?.rooms?.[0]?.rates?.[0]?.net || check?.rate?.net);
  if (confirmedNet && toNum(selected.minRate) && Math.abs(confirmedNet - toNum(selected.minRate)) > 0.01) {
    const ok = confirm(
      `Preço mudou.\nAntes: ${selected.currency} ${toNum(selected.minRate).toFixed(2)}\nAgora: ${selected.currency} ${confirmedNet.toFixed(2)}\n\nDeseja confirmar mesmo assim?`
    );
    if (!ok) return;
  }

  // 2) Booking Confirm
  const { holder, rooms } = buildPaxesFromForm();

  const payload = {
    clientReference: `LD-${Date.now()}`,
    holder,
    rooms
  };

  const r2 = await fetch("/api/hotelbeds-booking-confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const booking = await r2.json().catch(() => ({}));
  console.log("BOOKING:", booking);

  if (!r2.ok) {
    alert("Booking falhou. Veja o console (F12).");
    return;
  }

  const ref =
    booking?.booking?.reference ||
    booking?.booking?.bookingReference ||
    booking?.reference ||
    "OK";

  alert(`Reserva CONFIRMADA!\nReferência: ${ref}`);
}

// ===== Init =====
document.addEventListener("DOMContentLoaded", () => {
  $("searchForm")?.addEventListener("submit", buscarHoteis);

  // Reaproveita botões existentes, se existirem
  $("clearCartBtn")?.addEventListener("click", clearSelection);

  // Se você criar um botão novo no HTML com id confirmBookingBtn, ele funciona.
  // Se não criar, ele reaproveita o antigo payBtn (que antes era PagBank).
  $("confirmBookingBtn")?.addEventListener("click", confirmarReserva);
  $("payBtn")?.addEventListener("click", confirmarReserva);

  renderSelected();
});
