// ===== Let’s Dream: Busca Hotelbeds + Render (limpo) =====
// =====================
// CARRINHO (STATE)
// =====================
let cart = JSON.parse(localStorage.getItem("cart") || "[]");

function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
}

function money(currency, value) {
  const n = Number(value) || 0;
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function cartTotal() {
  return cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
}

function updateCartBadge() {
  const el = document.getElementById("cartCount");
  if (!el) return;
  const count = cart.reduce((s, i) => s + i.qty, 0);
  el.textContent = String(count);
}

function renderCart() {
  const list = document.getElementById("cartItems");
  const totalEl = document.getElementById("cartTotal");
  if (!list || !totalEl) return;

  if (!cart.length) {
    list.innerHTML = `<p class="note">Seu carrinho está vazio.</p>`;
    totalEl.textContent = money("BRL", 0);
    updateCartBadge();
    return;
  }

  list.innerHTML = cart.map((item, idx) => `
    <div class="cart-item" style="display:flex;gap:12px;align-items:center;justify-content:space-between;padding:10px;border:1px solid #eee;border-radius:12px;margin:10px 0">
      <div style="flex:1">
        <b>${item.name}</b><br>
        <small>${item.place || ""}</small>
      </div>

      <div style="min-width:140px;text-align:right">
        <div>${money(item.currency, item.price)}</div>
        <div style="display:flex;gap:6px;align-items:center;justify-content:flex-end;margin-top:6px">
          <button type="button" class="btn" data-cart-action="dec" data-idx="${idx}">-</button>
          <b>${item.qty}</b>
          <button type="button" class="btn" data-cart-action="inc" data-idx="${idx}">+</button>
          <button type="button" class="btn" data-cart-action="remove" data-idx="${idx}">Remover</button>
        </div>
      </div>
    </div>
  `).join("");

  totalEl.textContent = money(cart[0]?.currency || "BRL", cartTotal());
  updateCartBadge();
}

function addToCart(hotel) {
  // hotel: {code, name, minRate, currency, zoneName, destinationName}
  const code = String(hotel.code);
  const price = Number(String(hotel.minRate).replace(",", ".")) || 0;
  const currency = hotel.currency || "EUR";

  const existing = cart.find(i => i.code === code);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      code,
      name: hotel.name,
      price,
      currency,
      place: `${hotel.zoneName || "-"} • ${hotel.destinationName || ""}`,
      qty: 1
    });
  }

  saveCart();
  renderCart();
}


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
  data-name="${h.name}"
  data-zone="${h.zoneName || ''}"
  data-dest="${h.destinationName || ''}"
  data-currency="${currency}"
  data-price="${h.minRate}"
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
// ===== Carrinho (Hotel) + Orçamento WhatsApp =====

const cart = []; // itens: {type, name, zone, dest, currency, price, qty}

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function addHotelToCart(hotel){
  const key = `HOTEL|${hotel.name}|${hotel.zone}`;
  const existing = cart.find(x => x.key === key);
  if (existing) existing.qty += 1;
  else cart.push({ key, type:"Hotel", ...hotel, qty: 1 });

  renderCart();
  document.getElementById("carrinho")?.scrollIntoView?.({ behavior:"smooth" });
}

function clearCart(){
  cart.length = 0;
  renderCart();
}

function cartTotal(){
  // Hotelbeds retorna "minRate" como texto; vamos tratar como número
  const toN = (v) => Number(String(v ?? "").replace(",", "."));
  return cart.reduce((sum, it) => sum + (toN(it.price) * it.qty), 0);
}

function renderCart(){
  const wrap = document.getElementById("cartItems");
  const totalEl = document.getElementById("cartTotal");

  if (!wrap || !totalEl) return;

  if (!cart.length){
    wrap.innerHTML = `<p class="note">Seu carrinho está vazio.</p>`;
    totalEl.textContent = "R$ 0";
    return;
  }

  wrap.innerHTML = cart.map((it, idx) => `
    <div style="border:1px solid rgba(0,0,0,.12); border-radius:12px; padding:10px; margin:10px 0;">
      <b>${escapeHtml(it.type)}:</b> ${escapeHtml(it.name)}<br>
      <small style="opacity:.8;">${escapeHtml(it.zone)} • ${escapeHtml(it.dest)}</small><br>
      <small><b>${escapeHtml(it.currency)}</b> ${escapeHtml(it.price)} (x${it.qty})</small>
      <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
        <button type="button" data-dec="${idx}">-</button>
        <button type="button" data-inc="${idx}">+</button>
        <button type="button" data-rem="${idx}">Remover</button>
      </div>
    </div>
  `).join("");

  wrap.querySelectorAll("[data-dec]").forEach(b => b.addEventListener("click", () => {
    const i = Number(b.dataset.dec);
    cart[i].qty = Math.max(1, cart[i].qty - 1);
    renderCart();
  }));
  wrap.querySelectorAll("[data-inc]").forEach(b => b.addEventListener("click", () => {
    const i = Number(b.dataset.inc);
    cart[i].qty += 1;
    renderCart();
  }));
  wrap.querySelectorAll("[data-rem]").forEach(b => b.addEventListener("click", () => {
    const i = Number(b.dataset.rem);
    cart.splice(i, 1);
    renderCart();
  }));

  totalEl.textContent = `R$ ${cartTotal().toLocaleString("pt-BR")}`;
}

function solicitarOrcamentoWhatsApp(){
  const numero = "5511989811183"; // atendimento

  const linhas = cart.length
    ? cart.map(it => `- ${it.type}: ${it.name} (${it.zone} • ${it.dest}) x${it.qty} — ${it.currency} ${it.price}`).join("\n")
    : "- (sem itens)";

  const msg =
`Olá! Gostaria de solicitar um orçamento.

Itens selecionados:
${linhas}

Total estimado (referência): R$ ${cartTotal().toLocaleString("pt-BR")}

*Valores são apenas orçamentos e podem variar no momento da confirmação.*
E-mail de contato: atendimento@letsdreamviagens.com.br
`;

  window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, "_blank");
}

// liga botões do carrinho (se existirem)
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnLimpar")?.addEventListener("click", clearCart);
  document.getElementById("btnOrcamento")?.addEventListener("click", solicitarOrcamentoWhatsApp);
  renderCart();
});

