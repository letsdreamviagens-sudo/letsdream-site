// ===== Let’s Dream: Busca Hotelbeds + Render (arquivo LIMPO) =====

function toNum(x){
  const n = Number(String(x ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

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

  const list = document.getElementById("hotelsList");
  if (list) list.innerHTML = `<p class="note">Buscando hotéis...</p>`;

  const hint = document.getElementById("resultsHint");
  if (hint) hint.textContent = "Buscando...";

  // TESTE: NYC funciona (código destino). Depois mapeamos nomes.
  // ===== Map: Nome da cidade -> Código Hotelbeds =====
const DESTINATION_MAP = {
  "ORLANDO": "ORL",
  "NEW YORK": "NYC",
  "NOVA YORK": "NYC",
  "NYC": "NYC",
  "MIAMI": "MIA",
  "CANCUN": "CUN",
  "CANCÚN": "CUN",
  "CARIBE": "PUJ",     // exemplo: Punta Cana (ajustamos depois)
  "PUNTA CANA": "PUJ",
  "PARIS": "PAR",
  "LONDRES": "LON",
  "LONDON": "LON",
  "RIO DE JANEIRO": "RIO",
  "SÃO PAULO": "SAO",
  "SAO PAULO": "SAO"
};

const cityKey = city.trim().toUpperCase();
const destination = DESTINATION_MAP[cityKey] || cityKey;

  const url =
    `/api/hotelbeds-search?destination=${encodeURIComponent(destination)}` +
    `&checkin=${encodeURIComponent(checkin)}` +
    `&checkout=${encodeURIComponent(checkout)}` +
    `&adults=${encodeURIComponent(adults)}` +
    `&children=${encodeURIComponent(children)}`;

  const r = await fetch(url);
  const data = await r.json().catch(()=> ({}));

  console.log("HOTELBEDS:", data);
  const list = document.getElementById("hotelsList");
const hotels = data?.hotels?.hotels || [];

list.innerHTML = hotels.length
  ? hotels.map(h => `<div style="padding:10px;border:1px solid #ddd;margin:8px 0;border-radius:12px"><b>${h.name}</b><br>${h.zoneName || "-"}<br>${h.minRate}</div>`).join("")
  : "<p>Nenhum hotel encontrado</p>";

  if (!r.ok){
    console.error("Erro Hotelbeds:", data);
    if (list) list.innerHTML = `<p class="note">Erro na busca. Veja o Console (F12).</p>`;
    if (hint) hint.textContent = "Erro";
    return;
  }

  renderHotels(data);
  document.getElementById("resultados")?.scrollIntoView?.({ behavior:"smooth" });
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("searchForm")?.addEventListener("submit", buscarHoteis);
});
