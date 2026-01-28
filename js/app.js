// Let’s Dream Viagens — Frontend (Hotelbeds + Carrinho + PagBank Opção C)
// Este arquivo assume estes IDs existem no index.html:
// searchForm, city, checkin, checkout, adults, children, hotelsList, resultsHint,
// openCartBtn, backdrop, drawer, closeDrawer,
// cartItems, cartTotal, cartCount, clearCartBtn, whatsBtn, payBtn
//
// Importante:
// - Para Hotelbeds funcionar, /api/hotelbeds-search precisa estar OK na Vercel.
// - Para PagBank (Opção C - Formulário HTML) NÃO usa token. Usa receiverEmail.
//   Você habilitou "Pagamento via Formulário HTML" no painel do PagBank.

(() => {
  "use strict";

  // =====================
  // CONFIG
  // =====================
  // Câmbio simples para exibir e pagar em BRL quando o Hotelbeds retornar EUR.
  // Ajuste quando quiser (ex.: 5.40).
  const FX_EUR_TO_BRL = Number(window.__FX_EUR_TO_BRL) || 5.50;

  // Email recebedor (o mesmo cadastrado no PagBank / PagSeguro)
  const PAGBANK_RECEIVER_EMAIL = (window.__PAGBANK_RECEIVER_EMAIL || "atendimento@letsdreamviagens.com.br").trim();

  // Endpoint do checkout “carrinho” (Opção C). Esse é o mais usado em exemplos oficiais/legados.
  // Se o PagBank mudar o endpoint, você troca aqui.
  const PAGBANK_FORM_ACTION = "https://pagseguro.uol.com.br/checkout/v2/cart.html?action=add";

  // =====================
  // UTIL
  // =====================
  const STORAGE_KEY = "letsdream_cart_v1";

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

  function moneyBRL(value) {
    const n = toNum(value);
    try { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n); }
    catch { return `R$ ${n.toFixed(2)}`; }
  }

  function convertToBRL(price, currency) {
    const p = toNum(price);
    const cur = String(currency || "").toUpperCase();
    if (!p) return 0;

    // Se já vier BRL, não converte.
    if (cur === "BRL") return p;

    // Hotelbeds normalmente vem EUR em muitos casos.
    if (cur === "EUR") return p * FX_EUR_TO_BRL;

    // Se vier outra moeda, por segurança, mostra como “BRL aproximado” igual ao valor numérico (sem conversão).
    // (Melhor do que travar o pagamento.)
    return p;
  }

  // =====================
  // STATE: Carrinho
  // =====================
  function loadCart() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
    catch { return []; }
  }
  function saveCart(cart) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }

  let cart = loadCart(); // itens: { key, code, name, place, priceBRL, qty, meta? }
  let lastSearchCityKey = "ORLANDO";

  function cartCount() {
    return cart.reduce((s, it) => s + (Number(it.qty || 0)), 0);
  }
  function cartTotalBRL() {
    return cart.reduce((s, it) => s + toNum(it.priceBRL) * (Number(it.qty || 1)), 0);
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
      totalEl.textContent = moneyBRL(0);
      updateCartBadge();
      return;
    }

    wrap.innerHTML = cart.map((it, idx) => `
      <div class="cart-item" style="display:flex;gap:12px;align-items:center;justify-content:space-between;padding:10px;border:1px solid rgba(0,0,0,.12);border-radius:12px;margin:10px 0">
        <div style="flex:1">
          <b>${escapeHtml(it.name)}</b><br>
          <small style="opacity:.85">${escapeHtml(it.place || "")}</small>
        </div>
        <div style="min-width:170px;text-align:right">
          <div><b>${moneyBRL(it.priceBRL)}</b></div>
          <div style="display:flex;gap:6px;align-items:center;justify-content:flex-end;margin-top:6px;flex-wrap:wrap">
            <button type="button" class="btn" data-dec="${idx}">-</button>
            <b>${Number(it.qty || 1)}</b>
            <button type="button" class="btn" data-inc="${idx}">+</button>
            <button type="button" class="btn" data-rem="${idx}">Remover</button>
          </div>
        </div>
      </div>
    `).join("");

    wrap.querySelectorAll("[data-dec]").forEach(btn => btn.addEventListener("click", () => {
      const i = Number(btn.dataset.dec);
      if (!cart[i]) return;
      cart[i].qty = Math.max(1, Number(cart[i].qty || 1) - 1);
      saveCart(cart); renderCart();
    }));
    wrap.querySelectorAll("[data-inc]").forEach(btn => btn.addEventListener("click", () => {
      const i = Number(btn.dataset.inc);
      if (!cart[i]) return;
      cart[i].qty = Number(cart[i].qty || 1) + 1;
      saveCart(cart); renderCart();
    }));
    wrap.querySelectorAll("[data-rem]").forEach(btn => btn.addEventListener("click", () => {
      const i = Number(btn.dataset.rem);
      if (!cart[i]) return;
      cart.splice(i, 1);
      saveCart(cart); renderCart();
    }));

    totalEl.textContent = moneyBRL(cartTotalBRL());
    updateCartBadge();
  }

  function addHotelToCart(h) {
    // h: { code, name, minRate, currency, zoneName, destinationName }
    const code = String(h.code ?? h.name ?? "");
    const key = `HOTEL|${code}`;
    const existing = cart.find(it => it.key === key);

    const priceBRL = convertToBRL(h.minRate, h.currency);
    const item = {
      key,
      code,
      name: h.name || "Hotel",
      place: `${h.zoneName || "-"} • ${h.destinationName || ""}`.trim(),
      priceBRL,
      qty: 1,
      meta: {
        originalCurrency: h.currency || "EUR",
        originalPrice: toNum(h.minRate),
      },
    };

    if (existing) existing.qty = Number(existing.qty || 1) + 1;
    else cart.push(item);

    saveCart(cart);
    renderCart();
    openCart();
  }

  function clearCart() {
    cart = [];
    saveCart(cart);
    renderCart();
  }

  // =====================
  // Hotelbeds: destinos + render
  // =====================
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
    // Orlando por lat/lng
    "ORLANDO": { lat: 28.538336, lng: -81.379234, radius: 35 },
  };

  function buildHotelsApiUrl({ city, checkin, checkout, adults, children }) {
    const cityKey = city.trim().toUpperCase();
    lastSearchCityKey = cityKey || lastSearchCityKey;

    const mapped = DESTINATION_MAP[cityKey];

    if (mapped && typeof mapped === "object") {
      return `/api/hotelbeds-search?lat=${encodeURIComponent(mapped.lat)}&lng=${encodeURIComponent(mapped.lng)}&radius=${encodeURIComponent(mapped.radius || 35)}&checkin=${encodeURIComponent(checkin)}&checkout=${encodeURIComponent(checkout)}&adults=${encodeURIComponent(adults)}&children=${encodeURIComponent(children)}`;
    }

    const destination = mapped || cityKey; // fallback: usuário pode digitar o código destino
    return `/api/hotelbeds-search?destination=${encodeURIComponent(destination)}&checkin=${encodeURIComponent(checkin)}&checkout=${encodeURIComponent(checkout)}&adults=${encodeURIComponent(adults)}&children=${encodeURIComponent(children)}`;
  }

  function pickHeroImage() {
    // Usa suas fotos existentes sem mudar o design
    const key = (lastSearchCityKey || "").toUpperCase();
    if (key.includes("ORL") || key.includes("ORLANDO")) return "img/orlando.jpg";
    if (key.includes("CARIBE") || key.includes("PUJ") || key.includes("PUNTA")) return "img/caribe.jpg";
    if (key.includes("BR") || key.includes("RIO") || key.includes("SAO")) return "img/brasil.jpg";
    return "img/brasil.jpg";
  }

  function renderHotels(data) {
    const list = document.getElementById("hotelsList");
    if (!list) return;

    const hotels = data?.hotels?.hotels || [];
    const currency = (data?.currency || hotels?.[0]?.currency || "EUR").toUpperCase();

    const hint = document.getElementById("resultsHint");
    if (hint) hint.textContent = hotels.length ? `${hotels.length} hotéis` : "0 hotéis";

    if (!hotels.length) {
      list.innerHTML = `<p class="note">Não encontramos hotéis para essa busca.</p>`;
      return;
    }

    hotels.sort((a, b) => toNum(a.minRate) - toNum(b.minRate));

    const heroImg = pickHeroImage();

    list.innerHTML = hotels.map(h => {
      const brl = convertToBRL(h.minRate, currency);
      return `
        <article class="hotel">
          <div class="img" style="background-image:url('${heroImg}')"></div>

          <div class="top">
            <div>
              <h3>${escapeHtml(h.name)}</h3>
              <div class="meta">${escapeHtml(h.zoneName || "-")} • ${escapeHtml(h.destinationName || "")}</div>
            </div>

            <div class="price">
              <small>Menor preço</small>
              <div><b>${moneyBRL(brl)}</b></div>
              <small style="opacity:.7">${escapeHtml(currency)} ${toNum(h.minRate).toFixed(2)} • câmbio ${FX_EUR_TO_BRL}</small>
            </div>
          </div>

          <div class="actions">
            <button
              class="btn btn-primary"
              type="button"
              data-add-hotel="1"
              data-code="${escapeHtml(h.code)}"
              data-name="${escapeHtml(h.name)}"
              data-zone="${escapeHtml(h.zoneName || "")}"
              data-dest="${escapeHtml(h.destinationName || "")}"
              data-currency="${escapeHtml(currency)}"
              data-price="${escapeHtml(h.minRate)}"
            >Selecionar</button>
          </div>
        </article>
      `;
    }).join("");

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

  // =====================
  // WhatsApp (Orçamento)
  // =====================
  function solicitarOrcamentoWhatsApp() {
    const numero = "5511989811183"; // atendimento
    const linhas = cart.length
      ? cart.map(it => `- Hotel: ${it.name} (${it.place}) x${it.qty} — ${moneyBRL(toNum(it.priceBRL) * Number(it.qty || 1))}`).join("\n")
      : "- (sem itens)";

    const msg =
`Olá! Gostaria de solicitar um orçamento.

Itens selecionados:
${linhas}

Total estimado: ${moneyBRL(cartTotalBRL())}

*Valores são apenas orçamentos e podem variar no momento da confirmação.*
E-mail de contato: atendimento@letsdreamviagens.com.br
`;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  // =====================
  // PagBank Opção C (Formulário HTML)
  // =====================
  function pagarComPagBankFormulario() {
    if (!cart.length) {
      alert("Seu carrinho está vazio.");
      return;
    }

    // Cria um form e envia
    const form = document.createElement("form");
    form.method = "POST";
    form.action = PAGBANK_FORM_ACTION;
    form.acceptCharset = "UTF-8";

    const inputs = [];

    // Campos básicos
    inputs.push(`<input type="hidden" name="receiverEmail" value="${escapeHtml(PAGBANK_RECEIVER_EMAIL)}">`);
    inputs.push(`<input type="hidden" name="currency" value="BRL">`);

    // Itens
    cart.forEach((item, i) => {
      const idx = i + 1;
      const qty = Number(item.qty || 1);
      const amount = toNum(item.priceBRL).toFixed(2); // BRL

      inputs.push(`<input type="hidden" name="itemId${idx}" value="${idx}">`);
      inputs.push(`<input type="hidden" name="itemDescription${idx}" value="${escapeHtml(item.name || "Item")}">`);
      inputs.push(`<input type="hidden" name="itemAmount${idx}" value="${escapeHtml(amount)}">`);
      inputs.push(`<input type="hidden" name="itemQuantity${idx}" value="${escapeHtml(String(qty))}">`);
    });

    form.innerHTML = inputs.join("\n");
    document.body.appendChild(form);
    form.submit();
  }

  // =====================
  // Drawer (abrir/fechar carrinho)
  // =====================
  function openCart() {
    document.getElementById("backdrop")?.classList.add("show");
    document.getElementById("drawer")?.classList.add("open");
  }
  function closeCart() {
    document.getElementById("drawer")?.classList.remove("open");
    document.getElementById("backdrop")?.classList.remove("show");
  }

  // =====================
  // BOOT
  // =====================
  document.addEventListener("DOMContentLoaded", () => {
    // Busca
    document.getElementById("searchForm")?.addEventListener("submit", buscarHoteis);

    // Carrinho drawer
    document.getElementById("openCartBtn")?.addEventListener("click", openCart);
    document.getElementById("closeDrawer")?.addEventListener("click", closeCart);
    document.getElementById("backdrop")?.addEventListener("click", closeCart);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCart(); });

    // Botões
    document.getElementById("clearCartBtn")?.addEventListener("click", clearCart);
    document.getElementById("whatsBtn")?.addEventListener("click", solicitarOrcamentoWhatsApp);
    document.getElementById("payBtn")?.addEventListener("click", pagarComPagBankFormulario);

    renderCart();
  });

})();
