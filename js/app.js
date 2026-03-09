function $(id){
  return document.getElementById(id);
}

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function toNum(x){
  const n = Number(String(x ?? "").replace(",","."));
  return Number.isFinite(n) ? n : 0;
}

function setHint(text){
  const el = $("resultsHint");
  if(el) el.textContent = text;
}

async function fetchJson(url, options){
  const r = await fetch(url, options);
  const data = await r.json().catch(()=>({}));

  if(!r.ok){
    const msg = data?.error || data?.message || `Erro ${r.status}`;
    throw new Error(msg);
  }

  return data;
}

const DESTINATION_MAP = {
  "ORLANDO":{lat:28.538336,lng:-81.379234,radius:35},
  "MIAMI":"MIA",
  "NOVA YORK":"NYC",
  "NEW YORK":"NYC",
  "PARIS":"PAR",
  "LONDRES":"LON",
  "RIO DE JANEIRO":"RIO",
  "SAO PAULO":"SAO",
  "SÃO PAULO":"SAO"
};

function renderChildrenAgeFields(){
  const childrenEl = $("children");
  const wrap = $("childrenAgesWrap");

  if(!childrenEl || !wrap) return;

  const count = Number(childrenEl.value || 0);

  if(count === 0){
    wrap.innerHTML = "";
    return;
  }

  wrap.innerHTML = Array.from({length:count},(_,i)=>`
    <label class="search-field">
      <span>Idade criança ${i+1}</span>
      <select id="childAge${i}">
        ${Array.from({length:17},(_,age)=>`<option value="${age}">${age}</option>`).join("")}
      </select>
    </label>
  `).join("");
}

function getChildrenAges(){
  const children = Number($("children")?.value || 0);
  const ages = [];

  for(let i=0;i<children;i++){
    const el = $(`childAge${i}`);
    ages.push(Number(el?.value || 7));
  }

  return ages;
}

function getFormParams(){
  return{
    city:($("city")?.value || "").trim(),
    checkin:$("checkin")?.value || "",
    checkout:$("checkout")?.value || "",
    adults:$("adults")?.value || "2",
    children:$("children")?.value || "0",
    childrenAges:getChildrenAges()
  };
}

function buildHotelsApiUrl(params, resolved){

  if(resolved.mode === "destination"){
    return `/api/hotelbeds-search?destination=${encodeURIComponent(resolved.destination)}&checkin=${params.checkin}&checkout=${params.checkout}&adults=${params.adults}&children=${params.children}`;
  }

  return `/api/hotelbeds-search?lat=${resolved.lat}&lng=${resolved.lng}&radius=${resolved.radius}&checkin=${params.checkin}&checkout=${params.checkout}&adults=${params.adults}&children=${params.children}`;
}

async function resolveCityToSearch(city){

  const key = city.trim().toUpperCase();
  const mapped = DESTINATION_MAP[key];

  if(mapped && typeof mapped === "object"){
    return {mode:"latlng",lat:mapped.lat,lng:mapped.lng,radius:mapped.radius};
  }

  if(mapped && typeof mapped === "string"){
    return {mode:"destination",destination:mapped};
  }

  const geo = await fetchJson(`/api/geocode?query=${encodeURIComponent(city)}`);

  return {mode:"latlng",lat:geo.lat,lng:geo.lng,radius:35};
}

function renderHotels(data,params){

  const list = $("hotelsList");
  if(!list) return;

  const hotels = data?.hotels?.hotels || [];
  const currency = data?.currency || "EUR";
  const fx = toNum($("fxHome")?.value || 5);

  setHint(hotels.length ? `${hotels.length} hotéis` : "0 hotéis");

  if(!hotels.length){
    list.innerHTML = `<p class="note">Nenhum hotel encontrado.</p>`;
    return;
  }

  hotels.sort((a,b)=>toNum(a.minRate)-toNum(b.minRate));

  list.innerHTML = hotels.map(h=>{

    const eur = toNum(h.minRate);
    const brl = eur * fx;

    return`
    <article class="hotel-card">

      <div class="hotel-card__content">

        <div class="hotel-card__info">
          <h3>${escapeHtml(h.name)}</h3>
          <p>${escapeHtml(h.zoneName || "-")} • ${escapeHtml(h.destinationName || "")}</p>
        </div>

        <div class="hotel-card__price">
          <small>Menor preço</small>

          <div class="hotel-card__eur">
            ${currency} ${eur.toFixed(2)}
          </div>

          <div class="hotel-card__brl">
            ≈ R$ ${brl.toFixed(2)}
          </div>

          <button
            class="btn btn-primary hotel-select-btn"
            data-code="${h.code}"
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

  list.querySelectorAll(".hotel-select-btn").forEach(btn=>{

    btn.addEventListener("click",()=>{

      const url =
        `/hotel.html?hotelCode=${encodeURIComponent(btn.dataset.code)}` +
        `&checkin=${encodeURIComponent(params.checkin)}` +
        `&checkout=${encodeURIComponent(params.checkout)}` +
        `&adults=${encodeURIComponent(params.adults)}` +
        `&children=${encodeURIComponent(params.children)}` +
        `&name=${encodeURIComponent(btn.dataset.name)}` +
        `&zone=${encodeURIComponent(btn.dataset.zone)}` +
        `&dest=${encodeURIComponent(btn.dataset.dest)}`;

      window.location.href = url;

    });

  });

}

async function buscarHoteis(e){

  e?.preventDefault();

  const params = getFormParams();

  if(!params.city || !params.checkin || !params.checkout){
    alert("Preencha destino e datas.");
    return;
  }

  const list = $("hotelsList");
  if(list) list.innerHTML = `<p class="note">Buscando hotéis...</p>`;

  setHint("Buscando...");

  try{

    const resolved = await resolveCityToSearch(params.city);

    const url = buildHotelsApiUrl(params,resolved);

    console.log("URL BUSCA:",url);

    const data = await fetchJson(url);

    console.log("RESPOSTA:",data);

    renderHotels(data,params);

  }catch(err){

    console.error("ERRO BUSCA:",err);

    if($("hotelsList")){
      $("hotelsList").innerHTML = `<p class="note">Erro na busca.</p>`;
    }

    alert(err.message);

  }

}

document.addEventListener("DOMContentLoaded",()=>{

  $("searchForm")?.addEventListener("submit",buscarHoteis);

  $("children")?.addEventListener("change",renderChildrenAgeFields);

  renderChildrenAgeFields();

});
