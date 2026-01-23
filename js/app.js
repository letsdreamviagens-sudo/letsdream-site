// Let’s Dream — app.js (Busca Hotelbeds + Carrinho + PagBank)
// Regras: este arquivo é completo (não misturar com versões antigas).

// =====================
// Helpers
// =====================
function toNum(x){
  const n = Number(String(x ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function moneyBRL(value){
  const n = Number(value) || 0;
  return new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(n);
}

// =====================
// Hotelbeds Destinations (simplificado)
// NYC funciona sempre. Orlando vamos por geolocalização (lat/lng/radius) para evitar depender de código.
// =====================
const DESTINATION_MAP = {
  "NYC": { type:"destination", value:"NYC" },
  "NEW YORK": { type:"destination", value:"NYC" },
  "NOVA YORK": { type:"destination", value:"NYC" },
  "MIAMI": { type:"destination", value:"MIA" },
  "CANCUN": { type:"destination", value:"CUN" },
  "CANCÚN": { type:"destination", value:"CUN" },
  "PUNTA CANA": { type:"destination", value:"PUJ" },
  "PARIS": { type:"destination", value:"PAR" },
  "LONDRES": { type:"destination", value:"LON" },
  "LONDON": { type:"destination", value:"LON" },

  // Orlando via geo (mais robusto)
  "ORLANDO": { type:"geo", lat:28.538336, lng:-81.379234, radius:35 },
};

// =====================
// Estado — carrinho
// =====================
let cart = JSON.parse(localStorage.getItem("lets_cart") || "[]"); // [{code,name,place,currency,price,qty}]
function saveCart(){ localStorage.setItem("lets_cart", JSON.stringify(cart)); }
function cartCount(){ return cart.reduce((s,i)=> s + (i.qty||1), 0); }
function cartTotalEUR(){ return cart.reduce((s,i)=> s + (Number(i.price)||0) * (i.qty||1), 0); }

function updateCartBadge(){
  const el = document.getElementById("cartCount");
  if (el) el.textContent = String(cartCount());
}

function renderCart(){
  const wrap = document.getElementById("cartItems");
  const totalEl = document.getElementById("cartTotal");
  if (!wrap || !totalEl) return;

  if (!cart.length){
    wrap.innerHTML = `<p class="note">Seu carrinho está vazio.</p>`;
    totalEl.textContent = moneyBRL(0);
    updateCartBadge();
    return;
  }

  wrap.innerHTML = cart.map((it, idx) => `
    <div style="border:1px solid rgba(15,23,42,.10); border-radius:14px; padding:12px; margin:10px 0;">
      <b>${escapeHtml(it.name)}</b><br/>
      <small style="color:#64748b;">${escapeHtml(it.place || "")}</small>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:10px;">
        <div><small style="color:#64748b;">${escapeHtml(it.currency)} ${toNum(it.price).toFixed(2)}</small></div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn btn-outline" type="button" data-cart="dec" data-idx="${idx}" style="padding:10px 12px;">-</button>
          <b>${it.qty || 1}</b>
          <button class="btn btn-outline" type="button" data-cart="inc" data-idx="${idx}" style="padding:10px 12px;">+</button>
          <button class="btn btn-outline" type="button" data-cart="rm" data-idx="${idx}" style="padding:10px 12px;">Remover</button>
        </div>
      </div>
    </div>
  `).join("");

  // total BRL baseado em cotação
  const eurBrl = toNum(document.getElementById("eurBrl")?.value || 0) || 6.0;
  const totalBRL = cartTotalEUR() * eurBrl;
  totalEl.textContent = moneyBRL(totalBRL);
  updateCartBadge();
}

function addHotelToCart(h){
  const code = String(h.code);
  const existing = cart.find(x => x.code === code);
  if (existing) existing.qty = (existing.qty||1) + 1;
  else cart.push({
    code,
    name: h.name,
    place: `${h.zoneName || "-"} • ${h.destinationName || ""}`,
    currency: h.currency || "EUR",
    price: toNum(h.minRate),
    qty: 1
  });

  saveCart();
  renderCart();
}

// =====================
// UI — drawer carrinho
// =====================
function openCart(){
  document.getElementById("drawer")?.classList.add("open");
  document.getElementById("backdrop")?.classList.add("show");
  document.getElementById("drawer")?.setAttribute("aria-hidden","false");
}
function closeCart(){
  document.getElementById("drawer")?.classList.remove("open");
  document.getElementById("backdrop")?.classList.remove("show");
  document.getElementById("drawer")?.setAttribute("aria-hidden","true");
}

// =====================
// Render hotéis
// =====================
function renderHotels(data){
  const list = document.getElementById("hotelsList");
  if (!list) return;

  const hotels = data?.hotels?.hotels || [];
  const currency = data?.currency || hotels?.[0]?.currency || "EUR";

  // guardamos para clique "Selecionar"
  window.__lastHotels = hotels;

  if (!hotels.length){
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
      <div class="img" style="background-image:url('img/orlando.svg')"></div>

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
        <button class="btn btn-primary" type="button" data-add="${escapeHtml(h.code)}">Selecionar</button>
        <button class="btn btn-ghost" type="button" onclick="openCart()">Ver carrinho</button>
      </div>
    </article>
  `).join("");

  list.querySelectorAll("[data-add]").forEach(btn => {
    btn.addEventListener("click", () => {
      const code = btn.getAttribute("data-add");
      const hotel = hotels.find(x => String(x.code) === String(code));
      if (!hotel) return;
      hotel.currency = currency; // garante
      addHotelToCart(hotel);
      openCart();
    });
  });
}

// =====================
// Buscar hotéis (Hotelbeds via /api/hotelbeds-search)
// =====================
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

  const key = city.toUpperCase();
  const mapped = DESTINATION_MAP[key];
  let url = "";

  if (mapped?.type === "geo"){
    url = `/api/hotelbeds-search?lat=${encodeURIComponent(mapped.lat)}&lng=${encodeURIComponent(mapped.lng)}&radius=${encodeURIComponent(mapped.radius||35)}&checkin=${encodeURIComponent(checkin)}&checkout=${encodeURIComponent(checkout)}&adults=${encodeURIComponent(adults)}&children=${encodeURIComponent(children)}`;
  } else {
    const destination = mapped?.value || key; // fallback: se você digitar "NYC" funciona
    url = `/api/hotelbeds-search?destination=${encodeURIComponent(destination)}&checkin=${encodeURIComponent(checkin)}&checkout=${encodeURIComponent(checkout)}&adults=${encodeURIComponent(adults)}&children=${encodeURIComponent(children)}`;
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

  renderHotels(data);
  document.getElementById("resultados")?.scrollIntoView?.({ behavior:"smooth" });
}

// =====================
// PagBank — criar checkout e redirecionar
// =====================
async function pagarPagBank(){
  if (!cart.length){
    alert("Seu carrinho está vazio.");
    return;
  }

  const eurBrl = toNum(document.getElementById("eurBrl")?.value || 0) || 6.0;

  const payload = {
    items: cart.map(it => ({
      reference_id: `HOTEL-${it.code}`,
      name: it.name,
      description: it.place || "Hotel",
      quantity: it.qty || 1,
      // PagBank usa centavos (inteiro)
      unit_amount: Math.max(1, Math.round((toNum(it.price) * eurBrl) * 100)),
    })),
    customer: null,
    eur_brl: eurBrl,
  };

  // botão "travado" durante o request
  const btn = document.getElementById("payBtn");
  const old = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = "Abrindo PagBank..."; }

  try{
    const r = await fetch("/api/pagbank-checkout", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    const data = await r.json().catch(()=> ({}));
    console.log("PAGBANK:", data);

    if (!r.ok){
      alert("Não foi possível abrir o PagBank. Veja o console (F12).");
      return;
    }

    const payUrl = data?.payUrl;
    if (!payUrl){
      alert("PagBank não retornou link de pagamento.");
      return;
    }

    window.location.href = payUrl;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = old || "Pagar com PagBank"; }
  }
}

// =====================
// WhatsApp orçamento
// =====================
function enviarWhatsApp(){
  const numero = "5511989811183";
  const eurBrl = toNum(document.getElementById("eurBrl")?.value || 0) || 6.0;

  const linhas = cart.map(it => `- ${it.name} (${it.place}) x${it.qty||1} — ${it.currency} ${toNum(it.price).toFixed(2)}`).join("\n") || "- (sem itens)";
  const totalBRL = cartTotalEUR() * eurBrl;

  const msg =
`Olá! Gostaria de solicitar um orçamento.

Itens:
${linhas}

Total estimado em BRL (cotação ${eurBrl}): ${moneyBRL(totalBRL)}

*Valores são apenas orçamentos e podem variar no momento da confirmação.*
E-mail: atendimento@letsdreamviagens.com.br
`;

  window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, "_blank");
}

// =====================
// Init
// =====================
function clearSearch(){
  ["city","checkin","checkout"].forEach(id => { const el = document.getElementById(id); if(el) el.value=""; });
  const list = document.getElementById("hotelsList");
  if (list) list.innerHTML = "";
  const hint = document.getElementById("resultsHint");
  if (hint) hint.textContent = "Pesquise acima para ver opções";
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("searchForm")?.addEventListener("submit", buscarHoteis);
  document.getElementById("clearBtn")?.addEventListener("click", clearSearch);

  document.getElementById("openCartBtn")?.addEventListener("click", openCart);
  document.getElementById("closeCartBtn")?.addEventListener("click", closeCart);
  document.getElementById("backdrop")?.addEventListener("click", closeCart);

  document.getElementById("clearCartBtn")?.addEventListener("click", () => {
    cart = [];
    saveCart();
    renderCart();
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cart]");
    if (!btn) return;
    const idx = Number(btn.getAttribute("data-idx"));
    const action = btn.getAttribute("data-cart");
    if (!Number.isFinite(idx) || !cart[idx]) return;

    if (action === "inc") cart[idx].qty = (cart[idx].qty||1) + 1;
    if (action === "dec") cart[idx].qty = Math.max(1, (cart[idx].qty||1) - 1);
    if (action === "rm") cart.splice(idx, 1);

    saveCart();
    renderCart();
  });

  document.getElementById("eurBrl")?.addEventListener("input", renderCart);
  document.getElementById("whatsBtn")?.addEventListener("click", enviarWhatsApp);
  document.getElementById("payBtn")?.addEventListener("click", pagarPagBank);

  renderCart();
  updateCartBadge();
});

// expõe para onclick no HTML
window.openCart = openCart;
window.closeCart = closeCart;
