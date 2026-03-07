function $(id) {
  return document.getElementById(id);
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
  "ORLANDO": { lat: 28.538336, lng: -81.379234, radius: 35 }
};

function renderChildrenAgeFields() {
  const childrenEl = document.getElementById("children");
  const wrap = document.getElementById("childrenAgesWrap");
  if (!childrenEl || !wrap) return;

  const count = Number(childrenEl.value || 0);

  if (count <= 0) {
    wrap.innerHTML = "";
    return;
  }

  wrap.innerHTML = Array.from({ length: count }, (_, i) => `
    <label class="search-field">
      <span>Idade criança ${i + 1}</span>
      <select id="childAge${i}" class="child-age-select">
        ${Array.from({ length: 17 }, (_, age) => `<option value="${age}">${age}</option>`).join("")}
      </select>
    </label>
  `).join("");
}

function getChildrenAges() {
  const children = Number(document.getElementById("children")?.value || 0);
  const ages = [];
  for (let i = 0; i < children; i++) {
    const el = document.getElementById(`childAge${i}`);
    ages.push(Number(el?.value || 7));
  }
  return ages;
}

function getFormParams() {
  return {
    city: ($("city")?.value || "").trim(),
    checkin: $("checkin")?.value || "",
    checkout: $("checkout")?.value || "",
    adults: $("adults")?.value || "2",
    children: $("children")?.value || "0",
    childrenAges: getChildrenAges()
  };
}

function buildHotelsApiUrlByLatLng({ lat, lng, radiusKm, checkin, checkout, adults, children, childrenAges }) {
  return `/api/hotelbeds-search?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radius=${encodeURIComponent(radiusKm || 35)}&checkin=${encodeURIComponent(checkin)}&checkout=${encodeURIComponent(checkout)}&adults=${encodeURIComponent(adults)}&children=${encodeURIComponent(children)}&childrenAges=${encodeURIComponent(JSON.stringify(childrenAges || []))}`;
}

function buildHotelsApiUrlByDestination({ destination, checkin, checkout, adults, children, childrenAges }) {
  return `/api/hotelbeds-search?destination=${encodeURIComponent(destination)}&checkin=${encodeURIComponent(checkin)}&checkout=${encodeURIComponent(checkout)}&adults=${encodeURIComponent(adults)}&children=${encodeURIComponent(children)}&childrenAges=${encodeURIComponent(JSON.stringify(childrenAges || []))}`;
}

async function resolveCityToSearch(city) {
  const key = city.trim().toUpperCase();
  const mapped = DESTINATION_MAP[key];

  if (mapped && typeof mapped === "object") {
    return { mode: "latlng", lat: mapped.lat, lng: mapped.lng, radius: mapped.radius || 35 };
  }

  if (mapped && typeof mapped === "string") {
    return { mode: "destination", destination: mapped };
  }

  const geo = await fetchJson(`/api/geocode?query=${encodeURIComponent(city)}`);
  return { mode: "latlng", lat: geo.lat, lng: geo.lng, radius: 35 };
}

function renderHotels(data, params) {
  const list = $("hotelsList");
  if (!list) return;

  const hotels = data?.hotels?.hotels || [];
  const currency = data?.currency || hotels?.[0]?.currency || "EUR";
  const fx = toNum($("fxHome")?.value || 5);

  setHint(hotels.length ? `${hotels.length} hotéis` : "0 hotéis");

  if (!hotels.length) {
    list.innerHTML = `<p class="note">Não encontramos hotéis para essa busca.</p>`;
    return;
  }

  hotels.sort((a, b) => toNum(a.minRate) - toNum(b.minRate));

  list.innerHTML = hotels.map((h) => {
    const eur = toNum(h.minRate);
    const brl = eur * fx;

    return `
      <article class="hotel-card">
        <div class="hotel-card__content">
          <div class="hotel-card__info">
            <h3>${escapeHtml(h.name)}</h3>
            <p>${escapeHtml(h.zoneName || "-")} • ${escapeHtml(h.destinationName || "")}</p>
          </div>

          <div class="hotel-card__price">
            <small>Menor preço</small>
            <div class="hotel-card__eur">${escapeHtml(currency)} ${eur.toFixed(2)}</div>
            ${currency === "EUR" ? `<div class="hotel-card__brl">≈ R$ ${brl.toFixed(2)}</div>` : ""}
            <button
              type="button"
              class="btn btn-primary hotel-select-btn"
              data-code="${escapeHtml(h.code)}"
              data-name="${escapeHtml(h.name)}"
              data-zone="${escapeHtml(h.zoneName || "")}"
              data-dest="${escapeHtml(h.destinationName || "")}"
            >
              Selecionar
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  list.querySelectorAll(".hotel-select-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const childrenAges = encodeURIComponent(JSON.stringify(params.childrenAges || []));

      const url =
        `/hotel.html?hotelCode=${encodeURIComponent(btn.dataset.code)}` +
        `&checkin=${encodeURIComponent(params.checkin)}` +
        `&checkout=${encodeURIComponent(params.checkout)}` +
        `&adults=${encodeURIComponent(params.adults)}` +
        `&children=${encodeURIComponent(params.children)}` +
        `&childrenAges=${childrenAges}` +
        `&name=${encodeURIComponent(btn.dataset.name || "")}` +
        `&zone=${encodeURIComponent(btn.dataset.zone || "")}` +
        `&dest=${encodeURIComponent(btn.dataset.dest || "")}`;

      window.location.href = url;
    });
  });
}

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
    const resolved = await resolveCityToSearch(params.city);

    let url;
    if (resolved.mode === "destination") {
      url = buildHotelsApiUrlByDestination({
        destination: resolved.destination,
        ...params
      });
    } else {
      url = buildHotelsApiUrlByLatLng({
        lat: resolved.lat,
        lng: resolved.lng,
        radiusKm: resolved.radius,
        ...params
      });
    }

    const data = await fetchJson(url);
    renderHotels(data, params);
    $("resultados")?.scrollIntoView?.({ behavior: "smooth" });
  } catch (err) {
    console.error("SEARCH ERRO:", err);
    if ($("hotelsList")) {
      $("hotelsList").innerHTML = `<p class="note">Erro ao buscar hotéis. Veja o console (F12).</p>`;
    }
    setHint("Erro");
    alert(`Erro ao buscar hotéis: ${err.message}`);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  $("searchForm")?.addEventListener("submit", buscarHoteis);
  $("children")?.addEventListener("change", renderChildrenAgeFields);
  renderChildrenAgeFields();
});
