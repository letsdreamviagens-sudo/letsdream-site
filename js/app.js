// app.js — Let’s Dream (B2B interno) — Página de BUSCA (index.html)
// Fluxo: Buscar -> listar -> Selecionar -> redireciona para /hotel.html
// Requer API:
// - /api/hotelbeds-search

function $(id) { return document.getElementById(id); }

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

function setHint(text) {
  const el = $("resultsHint");
  if (el) el.textContent = text;
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

// ===== Destination mapping (opcional) =====
// Se seu /api/hotelbeds-search aceita destination=CODE, mapeie nomes comuns:
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
  // Orlando via geolocalização (se ORL não existir)
  "ORLANDO": { lat: 28.538336, lng: -81.379234, radius: 35 },
};

function getFormParams() {
  return {
    city: ($("city")?.value || "").trim(),
    checkin: $("checkin")?.value || "",
    checkout: $("checkout")?.value || "",
    adults: $("adults")?.value || "2",
    children: $("children")?.value || "0",
  };
}

function buildHotelsApiUrl({ city, checkin, checkout, adults, children }) {
  const key = city.trim().toUpperCase();
  const mapped = DESTINATION_MAP[key];

  if (mapped && typeof mapped === "object") {
    return `/api/hotelbeds-search?lat=${encodeURIComponent(mapped.lat)}&lng=${encodeURIComponent(mapped.lng)}&radius=${encodeURIComponent(mapped.radius || 35)}&checkin=${encodeURIComponent(checkin)}&checkout=${encodeURIComponent(checkout)}&adults=${encodeURIComponent(adults)}&children=${encodeURIComponent(children)}`;
  }

  const destination = mapped || key;
  return `/api/hotelbeds-search?destination=${encodeURIComponent(destination)}&checkin=${encodeURIComponent(checkin)}&checkout=${encodeURIComponent(checkout)}&adults=${encodeURIComponent(adults)}&children=${encodeURIComponent(children)}`;
}

// ===== Render list =====
function renderHotels(data, params) {
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
    <article class="hotel" style="border:1px solid rgba(0,0,0,.12);border-radius:14px;padding:14px;margin:12px 0;">
      <div style="display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;">
        <div style="flex:1">
          <h3 style="margin:0 0 6px 0;">${escapeHtml(h.name)}</h3>
          <div style="opacity:.85">${escapeHtml(h.zoneName || "-")} • ${escapeHtml(h.destinationName || "")}</div>
        </div>

        <div style="text-align:right;min-width:180px;">
          <small style="opacity:.8">Menor preço</small>
          <div style="font-weight:700">${escapeHtml(currency)} ${toNum(h.minRate).toFixed(2)}</div>
          <button
            type="button"
            class="btn btn-primary"
            style="margin-top:10px;"
            data-select="1"
            data-code="${escapeHtml(h.code)}"
            data-name="${escapeHtml(h.name)}"
            data-zone="${escapeHtml(h.zoneName || '')}"
            data-dest="${escapeHtml(h.destinationName || '')}"
          >Selecionar</button>
        </div>
      </div>
    </article>
  `).join("");

  // Clique em Selecionar -> redireciona para hotel.html
  list.querySelectorAll("[data-select]").forEach(btn => {
    btn.addEventListener("click", () => {
      const hotelCode = btn.dataset.code;

      const url =
        `/hotel.html?hotelCode=${encodeURIComponent(hotelCode)}` +
        `&checkin=${encodeURIComponent(params.checkin)}` +
        `&checkout=${encodeURIComponent(params.checkout)}` +
        `&adults=${encodeURIComponent(params.adults)}` +
        `&children=${encodeURIComponent(params.children)}` +
        `&name=${encodeURIComponent(btn.dataset.name || "")}` +
        `&zone=${encodeURIComponent(btn.dataset.zone || "")}` +
        `&dest=${encodeURIComponent(btn.dataset.dest || "")}`;

      window.location.href = url;
    });
  });
}

// ===== Search handler =====
async function buscarHoteis(e) {
  e?.preventDefault?.();

  const params = getFormParams();
  if (!params.city || !params.checkin || !params.checkout) {
    alert("Preencha cidade, check-in e check-out.");
    return;
  }

  const list = $("hotelsList");
  if (list) list.innerHTML = `<p class="note">Buscando hotéis...</p>`;
  setHint("Buscando...");

  try {
    const url = buildHotelsApiUrl(params);
    const data = await fetchJson(url);
    console.log("SEARCH OK:", data);

    renderHotels(data, params);
    $("resultados")?.scrollIntoView?.({ behavior: "smooth" });
  } catch (err) {
    console.error("SEARCH ERRO:", err);
    if ($("hotelsList")) $("hotelsList").innerHTML = `<p class="note">Erro ao buscar hotéis. Veja o console (F12).</p>`;
    setHint("Erro");
    alert(`Erro ao buscar hotéis: ${err.message}`);
  }
}

// ===== Init =====
document.addEventListener("DOMContentLoaded", () => {
  // liga no form de busca
  $("searchForm")?.addEventListener("submit", buscarHoteis);

  // esconder botões antigos (se existirem)
  if ($("payBtn")) $("payBtn").style.display = "none";
  if ($("whatsappBtn")) $("whatsappBtn").style.display = "none";
  if ($("clearCartBtn")) $("clearCartBtn").style.display = "none";
});
