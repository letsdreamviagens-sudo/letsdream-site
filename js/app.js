// ===== Let’s Dream: Busca Hotelbeds + Render (limpo) =====

function toNum(x){
  const n = Number(String(x ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

// ===== Map: Nome da cidade -> Código Hotelbeds =====
const DESTINATION_MAP = {
  "ORLANDO": { lat: 28.538336, lng: -81.379234, radius: 35 },
  "NEW YORK": "NYC",
  "NOVA YORK": "NYC",
  "NYC": "NYC",
  "MIAMI": "MIA",
  "CANCUN": "CUN",
  "CANCÚN": "CUN",
  "PUNTA CANA": "PUJ",
  "CARIBE": "PUJ", // por enquanto: Punta Cana (ajustamos depois)
  "PARIS": "PAR",
  "LONDRES": "LON",
  "LONDON": "LON",
  "RIO DE JANEIRO": "RIO",
  "SÃO PAULO": "SAO",
  "SAO PAULO": "SAO"
};

function renderHotels(data){
  const list = document.getElementById("hotelsList");
  if (!list) return;

  const hotels = data?.hotels?.hotels || [];
  const currency = data?.currency || hotels?.[0]?.currency || "EUR";

  if (!hotels.length) {
    list.innerHTML = `<p class="note">Não encontramos hotéis para essa busca.</p>`;
    const hint = document.getElementById("resultsHint");
    if (hint) hint.textContent = "0 hotéis";
    return;
  }

  hotels.sort((a,b)=> toNum(a.minRate) - toNum(b.minRate));

  const hint = document.getElementById("resultsHint");
  if (hint) hint.textContent = `${hotels.length} hotéis`;

  list.innerHTML = hotels.map(h => `
    <article class="hotel">
      <div class="img" style="background-image:url('img/orlando.jpg')"></div>

      <div class="top">
        <div>
          <h3>${h.name}</h3>
          <div class="meta">${h.zoneName || "-"} • ${h.destinationName || ""}</div>
        </div>

        <div class="price">
          <small>Menor preço</small>
          ${currency} ${toNum(h.minRate).toFixed(2)}
        </div>
      </div>

      <div class="actions">
        <button
          class="btn btn-primary"
          type="button"
          data-add-hotel="1"
          data-name="${escapeHtml(h.name)}"
          data-zone="${escapeHtml(h.zoneName || "-")}"
          data-dest="${escapeHtml(h.destinationName || "")}"
          data-currency="${escapeHtml(currency)}"
          data-price="${escapeHtml(String(h.minRate))}"
        >
          Selecionar
        </button>
      </div>
    </article>
  `).join("");

  // liga clique nos botões "Selecionar"
  list.querySelectorAll("[data-add-hotel]").forEach(btn => {
    btn.addEventListener("click", () => {
      addHotelToCart({
        name: btn.dataset.name,
        zone: btn.dataset.zone,
        dest: btn.dataset.dest,
        currency: btn.dataset.currency,
        price: btn.dataset.price
      });
    });
  });
}

  // Ordena por menor preço
  hotels.sort((a,b)=> toNum(a.minRate) - toNum(b.minRate));

  const hint = document.getElementById("resultsHint");
  if (hint) hint.textContent = `${hotels.length} hotéis`;

  list.innerHTML = hotels.map(h => `
    <article class="hotel">
      <div class="img" style="background-image:url('img/orlando.jpg')"></div>

      <div class="top">
        <div>
          <h3>${h.name}</h3>
          <div class="meta">${h.zoneName || "-"} • ${h.destinationName || ""}</div>
        </div>

        <div class="price">
          <small>Menor preço</small>
          ${currency} ${toNum(h.minRate).toFixed(2)}
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-primary" type="button">Selecionar</button>
      </div>
    </article>
  `).join("");
}

async function buscarHoteis(e){
  e?.preventDefault?.();

  const city = (document.getElementById("city")?.value || "").trim();
  const checkin = document.getElementById("checkin")?.value || "";
  const checkout = document.getElementById("checkout")?.value || "";
  const adults = document.getElementById("adults")?.value || "2";
  const children = document.getElementById("children")?.value || "0";

  if (!city || !checkin || !checkout){
    alert("Preencha cidade, check-in e check-out.");
    return;
  }

  // pega o container uma vez (aqui ele existe)
  const list = document.getElementById("hotelsList");
  if (list) list.innerHTML = `<p class="note">Buscando hotéis...</p>`;

  const hint = document.getElementById("resultsHint");
  if (hint) hint.textContent = "Buscando...";

  // converte nome -> código
  const cityKey = city.toUpperCase();
const mapped = DESTINATION_MAP[cityKey];

let url = "";

if (mapped && typeof mapped === "object") {
  url =
    `/api/hotelbeds-search?lat=${encodeURIComponent(mapped.lat)}` +
    `&lng=${encodeURIComponent(mapped.lng)}` +
    `&radius=${encodeURIComponent(mapped.radius || 35)}` +
    `&checkin=${encodeURIComponent(checkin)}` +
    `&checkout=${encodeURIComponent(checkout)}` +
    `&adults=${encodeURIComponent(adults)}` +
    `&children=${encodeURIComponent(children)}`;
} else {
  const destination = mapped || cityKey;
  url =
    `/api/hotelbeds-search?destination=${encodeURIComponent(destination)}` +
    `&checkin=${encodeURIComponent(checkin)}` +
    `&checkout=${encodeURIComponent(checkout)}` +
    `&adults=${encodeURIComponent(adults)}` +
    `&children=${encodeURIComponent(children)}`;
}
  const r = await fetch(url);
  const data = await r.json().catch(()=> ({}));

  console.log("HOTELBEDS:", data);

  if (!r.ok){
    console.error("Erro Hotelbeds:", data);
    if (list) list.innerHTML = `<p class="note">Erro ao buscar hotéis. Veja o console (F12).</p>`;
    if (hint) hint.textContent = "Erro";
    return;
  }

  // ✅ chama o render certo (só um render!)
  renderHotels(data);

  document.getElementById("resultados")?.scrollIntoView?.({ behavior:"smooth" });
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("searchForm")?.addEventListener("submit", buscarHoteis);
});
