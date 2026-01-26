
// Let’s Dream Viagens — Frontend (Hotels + Cart + PagBank) for Vercel
// Requires:
// - /api/hotelbeds-search (serverless function)
// - /api/pagbank-checkout (serverless function)

const STORAGE_KEY = "letsdream_cart_v1";

function loadCart() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveCart(cart) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
}
let cart = loadCart(); // items: { key, code, name, place, currency, price, qty }

function toNum(x) {
  const n = Number(String(x ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function money(currency, value) {
  const n = toNum(value);
  try { return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(n); }
  catch { return `${currency} ${n.toFixed(2)}`; }
}

function cartCount() {
  return cart.reduce((s, it) => s + (it.qty || 0), 0);
}
function cartTotal() {
  return cart.reduce((s, it) => s + toNum(it.price) * (it.qty || 1), 0);
}
function updateCartBadge() {
  const el = document.getElementById("cartCount");
  if (el) el.textContent = String(cartCount());
}

function renderCart() {
  const wrap = document.getElementById("cartItems");
  const totalEl = document.getElementById("cartTotal");
  if (!wrap || !totalEl) return;

  if (!cart.length) {
    wrap.innerHTML = `<p class="note">Seu carrinho está vazio.</p>`;
    totalEl.textContent = money("BRL", 0);
    updateCartBadge();
    return;
  }

  wrap.innerHTML = cart.map((it, idx) => `
    <div class="cart-item" style="display:flex;gap:12px;align-items:center;justify-content:space-between;padding:10px;border:1px solid rgba(0,0,0,.12);border-radius:12px;margin:10px 0">
      <div style="flex:1">
        <b>${escapeHtml(it.name)}</b><br>
        <small style="opacity:.85">${escapeHtml(it.place || "")}</small>
      </div>
      <div style="min-width:160px;text-align:right">
        <div><b>${escapeHtml(it.currency || "EUR")}</b> ${toNum(it.price).toFixed(2)}</div>
        <div style="display:flex;gap:6px;align-items:center;justify-content:flex-end;margin-top:6px;flex-wrap:wrap">
          <button type="button" class="btn" data-dec="${idx}">-</button>
          <b>${it.qty || 1}</b>
          <button type="button" class="btn" data-inc="${idx}">+</button>
          <button type="button" class="btn" data-rem="${idx}">Remover</button>
        </div>
      </div>
    </div>
  `).join("");

  wrap.querySelectorAll("[data-dec]").forEach(btn => btn.addEventListener("click", () => {
    const i = Number(btn.dataset.dec);
    cart[i].qty = Math.max(1, (cart[i].qty || 1) - 1);
    saveCart(cart); renderCart();
  }));
  wrap.querySelectorAll("[data-inc]").forEach(btn => btn.addEventListener("click", () => {
    const i = Number(btn.dataset.inc);
    cart[i].qty = (cart[i].qty || 1) + 1;
    saveCart(cart); renderCart();
  }));
  wrap.querySelectorAll("[data-rem]").forEach(btn => btn.addEventListener("click", () => {
    const i = Number(btn.dataset.rem);
    cart.splice(i, 1);
    saveCart(cart); renderCart();
  }));

  // The cart can be in EUR; total in the cart currency is shown for reference
  totalEl.textContent = money(cart[0]?.currency || "EUR", cartTotal());
  updateCartBadge();
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function addHotelToCart(h) {
  // h: { code, name, minRate, currency, zoneName, destinationName }
  const code = String(h.code ?? h.name ?? "");
  const key = `HOTEL|${code}`;
  const existing = cart.find(it => it.key === key);

  const item = {
    key,
    code,
    name: h.name || "Hotel",
    place: `${h.zoneName || "-"} • ${h.destinationName || ""}`.trim(),
    currency: h.currency || "EUR",
    price: toNum(h.minRate),
    qty: 1,
  };

  if (existing) existing.qty += 1;
  else cart.push(item);

  saveCart(cart);
  renderCart();
  document.getElementById("carrinho")?.scrollIntoView?.({ behavior: "smooth" });
}

// ===== Destination mapping (name -> Hotelbeds destination code or lat/lng search) =====
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

  // Orlando: use lat/lng (because "ORL" may not be a valid destination code in your Hotelbeds setup)
  "ORLANDO": { lat: 28.538336, lng: -81.379234, radius: 35 },
};

function buildHotelsApiUrl({ city, checkin, checkout, adults, children }) {
  const cityKey = city.trim().toUpperCase();
  const mapped = DESTINATION_MAP[cityKey];

  if (mapped && typeof mapped === "object") {
    return `/api/hotelbeds-search?lat=${encodeURIComponent(mapped.lat)}&lng=${encodeURIComponent(mapped.lng)}&radius=${encodeURIComponent(mapped.radius || 35)}&checkin=${encodeURIComponent(checkin)}&checkout=${encodeURIComponent(checkout)}&adults=${encodeURIComponent(adults)}&children=${encodeURIComponent(children)}`;
  }

  const destination = mapped || cityKey; // fallback: let user type destination code
  return `/api/hotelbeds-search?destination=${encodeURIComponent(destination)}&checkin=${encodeURIComponent(checkin)}&checkout=${encodeURIComponent(checkout)}&adults=${encodeURIComponent(adults)}&children=${encodeURIComponent(children)}`;
}

function renderHotels(data) {
  const list = document.getElementById("hotelsList");
  if (!list) return;

  const hotels = data?.hotels?.hotels || [];
  const currency = data?.currency || hotels?.[0]?.currency || "EUR";

  const hint = document.getElementById("resultsHint");
  if (hint) hint.textContent = hotels.length ? `${hotels.length} hotéis` : "0 hotéis";

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
          data-add-hotel="1"
          data-code="${escapeHtml(h.code)}"
          data-name="${escapeHtml(h.name)}"
          data-zone="${escapeHtml(h.zoneName || '')}"
          data-dest="${escapeHtml(h.destinationName || '')}"
          data-currency="${escapeHtml(currency)}"
          data-price="${escapeHtml(h.minRate)}"
        >Selecionar</button>
      </div>
    </article>
  `).join("");

  list.querySelectorAll("[data-add-hotel]").forEach(btn => {
    btn.addEventListener("click", () => {
      addHotelToCart({
        code: btn.dataset.code,
        name: btn.dataset.name,
        zoneName: btn.dataset.zone,
        destinationName: btn.dataset.dest,
        currency: btn.dataset.currency,
        minRate: btn.dataset.price,
      });
    });
  });
}

async function buscarHoteis(e) {
  e?.preventDefault?.();

  const city = (document.getElementById("city")?.value || "").trim();
  const checkin = document.getElementById("checkin")?.value || "";
  const checkout = document.getElementById("checkout")?.value || "";
  const adults = document.getElementById("adults")?.value || "2";
  const children = document.getElementById("children")?.value || "0";

  if (!city || !checkin || !checkout) {
    alert("Preencha cidade, check-in e check-out.");
    return;
  }

  const list = document.getElementById("hotelsList");
  if (list) list.innerHTML = `<p class="note">Buscando hotéis...</p>`;

  const hint = document.getElementById("resultsHint");
  if (hint) hint.textContent = "Buscando...";

  const url = buildHotelsApiUrl({ city, checkin, checkout, adults, children });

  const r = await fetch(url);
  const data = await r.json().catch(() => ({}));

  console.log("HOTELBEDS:", data);

  if (!r.ok) {
    console.error("Erro Hotelbeds:", data);
    if (list) list.innerHTML = `<p class="note">Erro ao buscar hotéis. Veja o console (F12).</p>`;
    if (hint) hint.textContent = "Erro";
    return;
  }

  renderHotels(data);
  document.getElementById("resultados")?.scrollIntoView?.({ behavior: "smooth" });
}

// ===== WhatsApp quote =====
function solicitarOrcamentoWhatsApp() {
  const numero = "5511989811183"; // atendimento (troque se quiser)

  const linhas = cart.length
    ? cart.map(it => `- Hotel: ${it.name} (${it.place}) x${it.qty} — ${it.currency} ${toNum(it.price).toFixed(2)}`).join("\n")
    : "- (sem itens)";

  const msg =
`Olá! Gostaria de solicitar um orçamento.

Itens selecionados:
${linhas}

Total estimado (referência): ${cart.length ? (cart[0].currency + " " + cartTotal().toFixed(2)) : "0"}

*Valores são apenas orçamentos e podem variar no momento da confirmação.*
E-mail de contato: atendimento@letsdreamviagens.com.br
`;

  window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, "_blank");
}

// ===== PagBank checkout (server will return checkoutUrl) =====
async function pagarComPagBank() {
  if (!cart.length) {
    alert("Seu carrinho está vazio.");
    return;
  }

  // Minimal customer data (you can add fields later)
  const payload = {
    reference_id: `LETS-${Date.now()}`,
    customer: {
      name: "Cliente",
      email: "cliente@email.com"
    },
    items: cart.map((it, idx) => ({
      reference_id: it.code || String(idx + 1),
      name: it.name,
      quantity: it.qty || 1,
      // PagBank expects integer in cents in many APIs; our server function will normalize
      unit_amount: toNum(it.price),
      currency: it.currency || "EUR",
    })),
    // optional metadata
    meta: {
      total: cartTotal(),
      currency: cart[0]?.currency || "EUR",
    }
  };

  const r = await fetch("/api/pagbank-checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await r.json().catch(() => ({}));
  console.log("PAGBANK:", data);

  if (!r.ok) {
    alert("Erro ao iniciar pagamento. Veja o console (F12).");
    return;
  }

  if (!data.checkoutUrl) {
    alert("Checkout URL não retornada. Veja o console (F12).");
    return;
  }

  window.location.href = data.checkoutUrl;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("searchForm")?.addEventListener("submit", buscarHoteis);
  document.getElementById("whatsappBtn")?.addEventListener("click", solicitarOrcamentoWhatsApp);
  document.getElementById("clearCartBtn")?.addEventListener("click", () => {
    cart = [];
    saveCart(cart);
    renderCart();
  });
  document.getElementById("payBtn")?.addEventListener("click", pagarComPagBank);

  renderCart();
});
// =====================
// ABRIR / FECHAR CARRINHO (DRAWER)
// =====================
function openCart() {
  document.getElementById("backdrop")?.classList.add("show");
  document.getElementById("drawer")?.classList.add("open");
}

function closeCart() {
  document.getElementById("drawer")?.classList.remove("open");
  document.getElementById("backdrop")?.classList.remove("show");
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("openCartBtn")?.addEventListener("click", openCart);
  document.getElementById("closeDrawer")?.addEventListener("click", closeCart);

  // clicar no fundo fecha
  document.getElementById("backdrop")?.addEventListener("click", closeCart);

  // ESC fecha
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeCart();
  });
});

