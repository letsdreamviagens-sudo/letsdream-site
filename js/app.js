// Let’s Dream Viagens — Frontend (Hotelbeds + Carrinho + PagBank Opção C)
(() => {
  "use strict";

  // =====================
  // CONFIG
  // =====================
  const STORAGE_KEY = "letsdream_cart_v1";

  // Email recebedor (o mesmo do PagBank / PagSeguro)
  const PAGBANK_RECEIVER_EMAIL = (window.__PAGBANK_RECEIVER_EMAIL || "atendimento@letsdreamviagens.com.br").trim();

  // Opção C (Formulário HTML)
 const PAGBANK_FORM_ACTION = "https://pagseguro.uol.com.br/v2/checkout/payment.html";
  // =====================
  // UTIL
  // =====================
  function $(id) { return document.getElementById(id); }

  function onAny(ids, evt, fn) {
    ids.forEach(id => $(id)?.addEventListener(evt, fn));
  }

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

  function getFxRate() {
    // se existir <input id="fxRate" value="6.00" />
    const el = $("fxRate");
    const v = el ? toNum(el.value) : 0;
    return (Number.isFinite(v) && v > 0) ? v : 6.0;
  }

  function convertToBRL(price, currency) {
    const p = toNum(price);
    const cur = String(currency || "").toUpperCase();
    if (!p) return 0;
    if (cur === "BRL") return p;
    if (cur === "EUR") return p * getFxRate();
    return p; // fallback
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

  let cart = loadCart(); // { key, code, name, place, priceBRL, qty, meta }

  function cartCount() {
    return cart.reduce((s, it) => s + Number(it.qty || 0), 0);
  }
  function cartTotalBRL() {
    return cart.reduce((s, it) => s + toNum(it.priceBRL) * Number(it.qty || 1), 0);
  }

  function updateCartBadge() {
    const el = $("cartCount");
    if (el) el.textContent = String(cartCount());
  }

  function renderCart() {
    const wrap = $("cartItems");
    const totalEl = $("cartTotal");
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
  // Drawer Carrinho
  // =====================
  function openCart() {
    $("backdrop")?.classList.add("show");
    $("drawer")?.classList.add("open");
  }
  function closeCart() {
    $("drawer")?.classList.remove("open");
    $("backdrop")?.classList.remove("show");
  }

  // =====================
  // Hotelbeds
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
    "ORLANDO": { lat: 28.538336, lng: -81.379234, radius: 35 },
  };

  let lastSearchCityKey = "ORLANDO";

  function buildHotelsApiUrl({ city, checkin, checkout, adults, children }) {
    const cityKey = city.trim().toUpperCase();
    lastSearchCityKey = cityKey || lastSearchCityKey;

    const mapped = DESTINATION_MAP[cityKey];
    if (mapped && typeof mapped === "object") {
      return `/api/hotelbeds-search?lat=${encodeURIComponent(mapped.lat)}&lng=${encodeURIComponent(mapped.lng)}&radius=${encodeURIComponent(mapped.radius || 35)}&checkin=${encodeURIComponent(checkin)}&checkout=${encodeURIComponent(checkout)}&adults=${encodeURIComponent(adults)}&children=${encodeURIComponent(children)}`;
    }

    const destination = mapped || cityKey;
    return `/api/hotelbeds-search?destination=${encodeURIComponent(destination)}&checkin=${encodeURIComponent(checkin)}&checkout=${encodeURIComponent(checkout)}&adults=${encodeURIComponent(adults)}&children=${encodeURIComponent(children)}`;
  }

  function pickHeroImage() {
    const key = (lastSearchCityKey || "").toUpperCase();
    // mantém suas fotos antigas:
    if (key.includes("ORL") || key.includes("ORLANDO")) return "img/orlando.jpg";
    if (key.includes("CARIBE") || key.includes("PUJ") || key.includes("PUNTA")) return "img/caribe.jpg";
    if (key.includes("BR") || key.includes("RIO") || key.includes("SAO")) return "img/brasil.jpg";
    return "img/brasil.jpg";
  }

  function renderHotels(data) {
    const list = $("hotelsList");
    if (!list) return;

    const hotels = data?.hotels?.hotels || [];
    const currency = (data?.currency || hotels?.[0]?.currency || "EUR").toUpperCase();

    const hint = $("resultsHint");
    if (hint) hint.textContent = hotels.length ? `${hotels.length} hotéis` : "0 hotéis";

    if (!hotels.length) {
      list.innerHTML = `<p class="note">Não encontramos hotéis para essa busca.</p>`;
      return;
    }

    hotels.sort((a, b) => toNum(a.minRate) - toNum(b.minRate));

    const heroImg = pickHeroImage();
    const fx = getFxRate();

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
              <small style="opacity:.7">${escapeHtml(currency)} ${toNum(h.minRate).toFixed(2)} • câmbio ${fx}</small>
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

    const hint = $("resultsHint");
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
    $("resultados")?.scrollIntoView?.({ behavior: "smooth" });
  }

  // =====================
  // WhatsApp Orçamento
  // =====================
  function solicitarOrcamentoWhatsApp() {
    const numero = "5511989811183";
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
  // PagBank Opção C (FORMULÁRIO) — À prova de erro
  // =====================
  function pagarComPagBankFormulario() {
    if (!cart.length) {
      alert("Seu carrinho está vazio.");
      return;
    }

    if (!PAGBANK_RECEIVER_EMAIL || !PAGBANK_RECEIVER_EMAIL.includes("@")) {
      alert("receiverEmail do PagBank inválido. Confira o e-mail no app.js.");
      return;
    }

    const form = document.createElement("form");
    form.method = "POST";
    form.action = PAGBANK_FORM_ACTION;
    form.acceptCharset = "UTF-8";
    form.style.display = "none";

    // obrigatórios
    form.appendChild(hidden("receiverEmail", PAGBANK_RECEIVER_EMAIL));
    form.appendChild(hidden("currency", "BRL"));

    // itens obrigatórios (Evita Erro 130/140/155/165)
    cart.forEach((item, i) => {
      const idx = i + 1;
      const qty = String(Number(item.qty || 1));
      const amount = String(toNum(item.priceBRL).toFixed(2)); // "199.27"
      const desc = String(item.name || "Item").slice(0, 100);

      form.appendChild(hidden(`itemId${idx}`, String(item.code || idx)));
      form.appendChild(hidden(`itemDescription${idx}`, desc));
      form.appendChild(hidden(`itemAmount${idx}`, amount));
      form.appendChild(hidden(`itemQuantity${idx}`, qty));
    });

    document.body.appendChild(form);
    form.submit();
  }

  function hidden(name, value) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = String(value ?? "");
    return input;
  }

  // =====================
  // BOOT
  // =====================
  document.addEventListener("DOMContentLoaded", () => {
    // Busca
    $("searchForm")?.addEventListener("submit", buscarHoteis);

    // Drawer carrinho
    onAny(["openCartBtn"], "click", openCart);
    onAny(["closeDrawer"], "click", closeCart);
    $("backdrop")?.addEventListener("click", closeCart);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCart(); });

    // Botões (aceita vários IDs, porque seu index pode ter nomes diferentes)
    onAny(["clearCartBtn", "btnLimpar"], "click", clearCart);
    onAny(["whatsBtn", "btnOrcamento", "whatsappBtn"], "click", solicitarOrcamentoWhatsApp);
    onAny(["payBtn", "btnPagar"], "click", pagarComPagBankFormulario);

    // Se você tiver o input fxRate, ao mudar ele recalcula os preços e re-renderiza
    $("fxRate")?.addEventListener("change", () => {
      // recalcula carrinho a partir do preço original se tiver meta
      cart = cart.map(it => {
        const cur = it.meta?.originalCurrency || "EUR";
        const p = it.meta?.originalPrice ?? it.priceBRL;
        return { ...it, priceBRL: convertToBRL(p, cur) };
      });
      saveCart(cart);
      renderCart();
    });

    renderCart();
  });

})();
