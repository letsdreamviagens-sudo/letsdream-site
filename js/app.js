/* Let’s Dream — app.js */
const SUPPORT_EMAIL = "atendimento@letsdreamviagens.com.br";
const SUPPORT_WA = "5511989811183"; // 11-98981-1183

const DEMO_HOTELS = [
  { id:"h1", city:"orlando", name:"Comfort Suites", neighborhood:"Lake Buena Vista", price: 980, img:"img/orlando.jpg", tags:["Família","Café da manhã"] },
  { id:"h2", city:"orlando", name:"Family Resort Orlando", neighborhood:"International Drive", price: 1290, img:"img/orlando.jpg", tags:["Piscina","Família","Perto de parque"] },
  { id:"h3", city:"orlando", name:"Premium Stay", neighborhood:"Celebration", price: 1650, img:"img/orlando.jpg", tags:["Piscina","Família"] },

  { id:"m1", city:"miami", name:"Beach Hotel Miami", neighborhood:"South Beach", price: 1420, img:"img/brasil.jpg", tags:["Praia","Bem localizado"] },
  { id:"g1", city:"gramado", name:"Pousada Charm", neighborhood:"Centro", price: 680, img:"img/brasil.jpg", tags:["Família","Café da manhã"] },
  { id:"c1", city:"cancun", name:"Resort All Inclusive", neighborhood:"Zona Hoteleira", price: 1890, img:"img/caribe.jpg", tags:["Resort","All Inclusive"] },
];

const EXTRAS = [
  { id:"t1", type:"Transfer", title:"Transfer Aeroporto ↔ Hotel (Orlando)", place:"Orlando", price: 420, unit:"por carro", img:"img/orlando.jpg" },
  { id:"t2", type:"Transfer", title:"Transfer Privativo (até 6 pessoas)", place:"Orlando", price: 690, unit:"por carro", img:"img/orlando.jpg" },
  { id:"i1", type:"Ingresso", title:"Ingresso Parque (1 dia) – estimativa", place:"Orlando", price: 650, unit:"por pessoa", img:"img/orlando.jpg" },
  { id:"i2", type:"Ingresso", title:"Universal/Islands (1 dia) – estimativa", place:"Orlando", price: 720, unit:"por pessoa", img:"img/orlando.jpg" },

  { id:"c2", type:"Transfer", title:"Transfer Aeroporto ↔ Resort – estimativa", place:"Caribe", price: 480, unit:"por carro", img:"img/caribe.jpg" },
  { id:"c3", type:"Passeio", title:"Passeio de Catamarã – estimativa", place:"Caribe", price: 520, unit:"por pessoa", img:"img/caribe.jpg" },

  { id:"b1", type:"Transfer", title:"Transfer Aeroporto ↔ Hotel – estimativa", place:"Brasil", price: 180, unit:"por carro", img:"img/brasil.jpg" },
  { id:"b2", type:"Passeio", title:"City Tour – estimativa", place:"Brasil", price: 220, unit:"por pessoa", img:"img/brasil.jpg" },
];

let selectedHotelId = null;
const cart = []; // {kind,id,title,meta,price,qty}

const $ = (id) => document.getElementById(id);

function brl(n){
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);
  return "R$ " + num.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}
function toKeyCity(name){
  return (name || "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/\s+/g, " ");
}

function showHome(){
  $("homePage").classList.add("show");
  $("quotePage").classList.remove("show");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function showQuote(){
  $("homePage").classList.remove("show");
  $("quotePage").classList.add("show");
  window.scrollTo({ top: 0, behavior: "smooth" });
  syncQuoteInputs();
  renderAddonsChecklist();
  renderQuoteSummary();
}

function renderChildrenAges(){
  const n = Number($("children").value || 0);
  const wrap = $("childrenAges");
  wrap.innerHTML = "";
  if (n <= 0) return;

  let html = `<div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:10px; margin-top:10px;">`;
  for (let i=1;i<=n;i++){
    html += `
      <div class="field">
        <label>Idade da criança ${i}</label>
        <select class="childAge" data-index="${i}">
          ${Array.from({length:18},(_,a)=>`<option value="${a}">${a} anos</option>`).join("")}
        </select>
      </div>`;
  }
  html += `</div>`;
  wrap.innerHTML = html;
}

function renderHotels(list){
  const host = $("hotelsList");
  if (!list.length){
    host.innerHTML = `<div class="card"><b>Nenhuma opção encontrada</b><p class="note">Tente outra cidade (no modo demo temos algumas cidades cadastradas).</p></div>`;
    return;
  }

  host.innerHTML = list.map(h => {
    const sel = (h.id === selectedHotelId) ? "selected" : "";
    const tags = (h.tags||[]).map(t => `<span class="tag ${t === "Perto de parque" ? "orange":""}">${t}</span>`).join("");
    return `
      <div class="hotel ${sel}">
        <div class="img" style="background-image:url('${h.img}')"></div>
        <div class="top">
          <div>
            <h3>${h.name}</h3>
            <div class="meta">${h.neighborhood} • ${h.city.toUpperCase()}</div>
          </div>
          <div class="price">
            <small>a partir de</small>
            ${brl(h.price)}
            <small>orçamento</small>
          </div>
        </div>
        <div class="tags">${tags}</div>
        <div class="actions">
          <button class="btn btn-primary" type="button" data-select="${h.id}">Selecionar</button>
          <button class="btn btn-ghost" type="button" data-addhotel="${h.id}">Adicionar ao carrinho</button>
        </div>
      </div>
    `;
  }).join("");

  host.querySelectorAll("[data-select]").forEach(btn=>{
    btn.addEventListener("click", () => {
      selectedHotelId = btn.getAttribute("data-select");
      renderHotels(list);
      upsertHotelInCart(selectedHotelId);
      toast("Hotel selecionado e adicionado ao carrinho.");
    });
  });

  host.querySelectorAll("[data-addhotel]").forEach(btn=>{
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-addhotel");
      upsertHotelInCart(id);
      toast("Hotel adicionado ao carrinho.");
    });
  });
}

function searchHotels(){
  const key = toKeyCity($("city").value);
  const list = DEMO_HOTELS.filter(h => h.city === key).sort((a,b)=>a.price-b.price);
  $("resultsHint").textContent = list.length ? `${list.length} opções encontradas` : "0 opções encontradas";
  renderHotels(list);
  document.querySelector("#resultados")?.scrollIntoView({ behavior: "smooth", block:"start" });
}
function clearSearch(){
  $("searchForm").reset();
  renderChildrenAges();
  $("hotelsList").innerHTML = "";
  $("resultsHint").textContent = "Pesquise acima para ver opções";
}

function renderExtras(){
  const host = $("extrasList");
  host.innerHTML = EXTRAS.slice().sort((a,b)=>a.price-b.price).map(x => `
    <div class="hotel">
      <div class="img" style="background-image:url('${x.img}')"></div>
      <div class="top">
        <div>
          <h3>${x.title}</h3>
          <div class="meta">${x.type} • ${x.place}</div>
        </div>
        <div class="price">
          <small>estimativa</small>
          ${brl(x.price)}
          <small>${x.unit}</small>
        </div>
      </div>
      <div class="tags">
        <span class="tag">${x.type}</span>
        <span class="tag orange">Orçamento</span>
      </div>
      <div class="actions">
        <button class="btn btn-primary" type="button" data-addextra="${x.id}">Adicionar</button>
      </div>
    </div>
  `).join("");

  host.querySelectorAll("[data-addextra]").forEach(btn=>{
    btn.addEventListener("click", () => {
      addExtraToCart(btn.getAttribute("data-addextra"));
      toast("Item adicionado ao carrinho.");
    });
  });
}

function cartCount(){ return cart.reduce((s,i)=> s+i.qty, 0); }
function cartTotal(){ return cart.reduce((s,i)=> s+i.price*i.qty, 0); }

function updateCartBadge(){
  $("cartCount").textContent = String(cartCount());
  $("cartTotal").textContent = brl(cartTotal());
}

function upsertHotelInCart(hotelId){
  const h = DEMO_HOTELS.find(x=>x.id===hotelId);
  if (!h) return;
  const existing = cart.find(i=>i.kind==="hotel");
  if (existing){
    existing.id = h.id;
    existing.title = h.name;
    existing.meta = `${h.neighborhood} • ${h.city.toUpperCase()}`;
    existing.price = h.price;
    existing.qty = 1;
  } else {
    cart.unshift({ kind:"hotel", id:h.id, title:h.name, meta:`${h.neighborhood} • ${h.city.toUpperCase()}`, price:h.price, qty:1 });
  }
  updateCartBadge();
  renderCartDrawer();
}

function addExtraToCart(extraId){
  const x = EXTRAS.find(e=>e.id===extraId);
  if (!x) return;
  const existing = cart.find(i=>i.kind==="extra" && i.id===x.id);
  if (existing) existing.qty += 1;
  else cart.push({ kind:"extra", id:x.id, title:x.title, meta:`${x.type} • ${x.place}`, price:x.price, qty:1 });
  updateCartBadge();
  renderCartDrawer();
  openCart();
}

function removeItem(idx){
  cart.splice(idx,1);
  updateCartBadge();
  renderCartDrawer();
}
function changeQty(idx, delta){
  const it = cart[idx];
  if (!it) return;
  it.qty = Math.max(1, it.qty + delta);
  updateCartBadge();
  renderCartDrawer();
}
function clearCart(){
  cart.length = 0;
  selectedHotelId = null;
  updateCartBadge();
  renderCartDrawer();
}

function renderCartDrawer(){
  const host = $("cartItems");
  if (cart.length === 0){
    host.innerHTML = `<p class="note">Seu carrinho está vazio.</p>`;
    updateCartBadge();
    return;
  }
  host.innerHTML = cart.map((it, idx) => `
    <div class="item">
      <b>${it.title}</b>
      <div class="small">${it.meta}</div>
      <div class="row">
        <div><b>${brl(it.price)}</b></div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn btn-outline" type="button" data-dec="${idx}" style="padding:10px 12px;">-</button>
          <b>${it.qty}</b>
          <button class="btn btn-outline" type="button" data-inc="${idx}" style="padding:10px 12px;">+</button>
          <button class="btn btn-outline" type="button" data-rem="${idx}" style="padding:10px 12px;">Remover</button>
        </div>
      </div>
    </div>
  `).join("");

  host.querySelectorAll("[data-dec]").forEach(b=>b.addEventListener("click", ()=>changeQty(Number(b.dataset.dec), -1)));
  host.querySelectorAll("[data-inc]").forEach(b=>b.addEventListener("click", ()=>changeQty(Number(b.dataset.inc),  1)));
  host.querySelectorAll("[data-rem]").forEach(b=>b.addEventListener("click", ()=>removeItem(Number(b.dataset.rem))));
  updateCartBadge();
}

function openCart(){
  $("cartBackdrop").classList.add("show");
  $("cartDrawer").classList.add("open");
  $("cartDrawer").setAttribute("aria-hidden", "false");
}
function closeCart(){
  $("cartBackdrop").classList.remove("show");
  $("cartDrawer").classList.remove("open");
  $("cartDrawer").setAttribute("aria-hidden", "true");
}

function syncQuoteInputs(){
  const n = ($("clienteNome").value || "").trim();
  const e = ($("clienteEmail").value || "").trim();
  if (n && !$("qName").value) $("qName").value = n;
  if (e && !$("qEmail").value) $("qEmail").value = e;
}

function renderAddonsChecklist(){
  const host = $("addonsArea");
  host.innerHTML = EXTRAS.map(x => `
    <label class="check">
      <input type="checkbox" data-addon="${x.id}">
      <div>
        <b>${x.title}</b>
        <span>${x.type} • ${x.place} • ${brl(x.price)} (${x.unit})</span>
      </div>
    </label>
  `).join("");

  host.querySelectorAll("[data-addon]").forEach(cb=>{
    const id = cb.getAttribute("data-addon");
    cb.checked = cart.some(i=>i.kind==="extra" && i.id===id);
    cb.addEventListener("change", () => {
      if (cb.checked) addExtraToCart(id);
      else {
        const idx = cart.findIndex(i=>i.kind==="extra" && i.id===id);
        if (idx >= 0) removeItem(idx);
      }
      renderQuoteSummary();
    });
  });
}

function renderQuoteSummary(){
  const host = $("quoteSummary");
  if (cart.length === 0){
    host.innerHTML = `<p class="note">Adicione um hotel e/ou extras para montar seu orçamento.</p>`;
    return;
  }
  const lines = cart.map(it => `
    <div style="border:1px solid rgba(15,23,42,.10); border-radius:16px; padding:12px; margin-bottom:10px;">
      <b>${it.title}</b><br/>
      <small style="color:#64748b;">${it.meta}</small>
      <div class="row">
        <span>Qtd: <b>${it.qty}</b></span>
        <span><b>${brl(it.price*it.qty)}</b></span>
      </div>
    </div>
  `).join("");
  host.innerHTML = `${lines}<div class="divider"></div><div class="row"><b>Total estimado</b><b>${brl(cartTotal())}</b></div>`;
}

function buildMessage(){
  const name = ($("qName").value || $("clienteNome").value || "Cliente").trim() || "Cliente";
  const email = ($("qEmail").value || $("clienteEmail").value || "(não informado)").trim() || "(não informado)";
  const phone = ($("qPhone").value || "").trim();
  const obs = ($("qObs").value || "").trim();

  const kidsAges = Array.from(document.querySelectorAll(".childAge")).map((sel,i)=>`Criança ${i+1}: ${sel.value} anos`).join(", ");
  const dates = `Check-in: ${$("checkin").value || "-"} | Check-out: ${$("checkout").value || "-"}`;
  const pax = `Adultos: ${$("adults").value || "-"} | Crianças: ${$("children").value || "0"}${kidsAges ? " ("+kidsAges+")" : ""}`;
  const city = $("city").value || "-";

  const items = cart.length ? cart.map(it=>`- ${it.title} x${it.qty} — ${brl(it.price)} (${it.meta})`).join("\n") : "- (sem itens)";

  return `Olá! Sou ${name}.
E-mail: ${email}${phone ? "\nTelefone: " + phone : ""}

Cidade: ${city}
${dates}
${pax}

Itens do orçamento:
${items}

Total estimado: ${brl(cartTotal())}

Observações: ${obs || "-"}

*Valores são apenas orçamentos e podem variar no momento da confirmação (disponibilidade, regras do fornecedor e câmbio/taxas).*
`;
}

function sendWhatsApp(){
  const msg = buildMessage();
  window.open(`https://wa.me/${SUPPORT_WA}?text=${encodeURIComponent(msg)}`, "_blank");
}
function sendEmail(){
  const msg = buildMessage();
  const subject = "Orçamento Let’s Dream Viagens";
  window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`;
}

// toast simples
let toastTimer = null;
function toast(text){
  let el = document.getElementById("toast");
  if (!el){
    el = document.createElement("div");
    el.id = "toast";
    el.style.position = "fixed";
    el.style.left = "50%";
    el.style.bottom = "18px";
    el.style.transform = "translateX(-50%)";
    el.style.background = "rgba(15,23,42,.92)";
    el.style.color = "#fff";
    el.style.padding = "10px 12px";
    el.style.borderRadius = "14px";
    el.style.fontWeight = "800";
    el.style.fontSize = "13px";
    el.style.zIndex = "99999";
    el.style.maxWidth = "92vw";
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ el.style.display="none"; }, 1800);
}

document.addEventListener("DOMContentLoaded", () => {
  $("children").addEventListener("change", renderChildrenAges);
  renderChildrenAges();

  $("searchForm").addEventListener("submit", (e)=>{ e.preventDefault(); searchHotels(); });
  $("btnClearSearch").addEventListener("click", clearSearch);

  renderExtras();
  renderCartDrawer();
  updateCartBadge();

  $("btnOpenCart").addEventListener("click", openCart);
  $("btnCloseCart").addEventListener("click", closeCart);
  $("cartBackdrop").addEventListener("click", closeCart);
  $("btnClearCart").addEventListener("click", clearCart);

  document.querySelectorAll(".nav-home").forEach(a=>a.addEventListener("click", ()=>showHome()));
  $("brandHome").addEventListener("click", ()=>showHome());

  const goQuote = () => { showQuote(); closeCart(); syncQuoteInputs(); renderAddonsChecklist(); renderQuoteSummary(); };
  $("btnGoQuote").addEventListener("click", goQuote);
  $("btnGoQuote2").addEventListener("click", goQuote);
  $("btnBackHome").addEventListener("click", ()=>{ showHome(); closeCart(); });

  $("btnWhatsAppQuick").addEventListener("click", () => { syncQuoteInputs(); sendWhatsApp(); });
  $("btnWhatsCart").addEventListener("click", () => { syncQuoteInputs(); sendWhatsApp(); });
  $("btnEmailQuote").addEventListener("click", sendEmail);
  $("btnWhatsQuote").addEventListener("click", sendWhatsApp);

  // top button
  const btnTopo = $("btnTopo");
  window.addEventListener("scroll", () => { btnTopo.style.display = (window.scrollY > 300) ? "block" : "none"; });
  btnTopo.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
});
// ===== PAGAMENTO PAGSEGURO =====
aasync function pagarPagSeguro() {
  try {
    const response = await fetch("/.netlify/functions/pagbank-create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!data.checkoutUrl) {
      throw new Error("Checkout URL não retornada");
    }

    window.location.href = data.checkoutUrl;

  } catch (error) {
    console.error("Erro PagSeguro:", error);
    alert("Erro ao iniciar pagamento. Tente novamente.");
  }
}

const checkoutUrl =
  data?.checkoutUrl ||
  data?.pay_url ||
  data?.links?.find(l => l.rel === "PAY")?.href ||
  data?.links?.find(l => l.rel === "REDIRECT")?.href;

if (!checkoutUrl) {
  console.log("Resposta do checkout (SEM URL):", data);
  throw new Error("Checkout URL não retornada");
}

window.location.href = checkoutUrl;
}
function toNumber(x){
  const n = parseFloat(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function formatPrice(v, currency){
  // Hotelbeds às vezes retorna como string
  const n = toNumber(v);
  return `${currency || "EUR"} ${n.toFixed(2)}`;
}

function renderHotels(hotelsResponse){
  const list = document.getElementById("hotelsList");
  if (!list) return;

  const hotels = hotelsResponse?.hotels?.hotels || [];

  if (!hotels.length){
    list.innerHTML = `<p class="note">Não encontramos hotéis para essa busca.</p>`;
    return;
  }
document.getElementById("searchForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const city = document.getElementById("city").value.trim();
  const checkin = document.getElementById("checkin").value;
  const checkout = document.getElementById("checkout").value;
  const adults = document.getElementById("adults").value;
  const children = document.getElementById("children").value;

  const destination = city.toUpperCase();

  const url = `/api/hotelbeds-search?destination=${destination}&checkin=${checkin}&checkout=${checkout}&adults=${adults}&children=${children}`;

  const r = await fetch(url);
  const data = await r.json();

  renderHotels(data); // 👈 AQUI chama a função certa
});

  hotels.sort((a, b) => Number(a.minRate) - Number(b.minRate));

  list.innerHTML = hotels.map(hotel => `
    <div class="hotel">
      <div class="img" style="background-image:url('img/orlando.jpg')"></div>

      <div class="top">
        <div>
          <h3>${hotel.name}</h3>
          <div class="meta">${hotel.categoryName || ""} • Bairro: ${hotel.zoneName || "-"}</div>
        </div>

        <div class="price">
          <small>Menor preço</small>
          EUR ${Number(hotel.minRate).toFixed(2)}
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-primary">Selecionar hotel</button>
      </div>
    </div>
  `).join("");
}

  const hotels = hotelsResponse?.hotels?.hotels || [];
  const currency = hotelsResponse?.hotels?.hotels?.[0]?.currency || hotelsResponse?.currency;

  // Ordena por minRate
  hotels.sort((a,b)=> toNumber(a.minRate) - toNumber(b.minRate));

  if (!hotels.length){
    list.innerHTML = `<p class="note">Não encontramos hotéis para essa busca.</p>`;
    return;}
  }

  list.innerHTML = hotels.map(h => {
    const bairro = h.zoneName ? h.zoneName : "—";
    const preco = formatPrice(h.minRate, h.currency || currency);

    // Imagem padrão por destino (você já tem)
    const dest = (h.destinationCode || "").toUpperCase();
    let img = "img/brasil.jpg";
    if (dest === "NYC" || dest === "MIA" || dest === "ORL") img = "img/orlando.jpg";
    if (dest === "CUN" || dest === "PUJ") img = "img/caribe.jpg";

    return `
      <div class="hotel">
        <div class="img" style="background-image:url('${img}')"></div>
        <div class="top">
          <div>
            <h3>${h.name}</h3>
            <div class="meta">${h.categoryName || ""} • Bairro: ${bairro}</div>
          </div>
          <div class="price">
            <small>Menor preço</small>
            ${preco}
          </div>
        </div>

        <div class="tags">
          <span class="tag">${h.boardName || "Orçamento"}</span>
          <span class="tag orange">Hotelbeds</span>
        </div>

        <div class="actions">
          <button class="btn btn-primary" type="button" onclick="selectHotel(${h.code}, '${escapeHtml(h.name)}', '${escapeHtml(bairro)}', '${h.minRate}', '${h.currency || ""}')">
            Selecionar hotel
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function escapeHtml(str){
  return String(str || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function selectHotel(code, name, bairro, minRate, currency){
  // Aqui você joga no carrinho / orçamento
  window.selectedHotel = {
    code, name, bairro,
    minRate: toNumber(minRate),
    currency
  };

  // Exemplo: adiciona no carrinho (se você já tiver carrinho)
  // addHotelToCart(window.selectedHotel);

  alert(`Hotel selecionado: ${name}\nBairro: ${bairro}\nPreço: ${currency} ${minRate}`);
}

