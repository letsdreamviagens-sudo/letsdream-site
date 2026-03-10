function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

async function fetchJson(url, options) {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({}));

  if (!r.ok) {
    const msg = data?.error || data?.message || `Erro ${r.status}`;
    const err = new Error(msg);
    err.status = r.status;
    err.data = data;
    throw err;
  }

  return data;
}

function getChildrenAgesFromQuery() {
  try {
    const raw = qs("childrenAges");
    if (!raw) return [];
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return [];
  }
}

function buildPaxesFromQuery(holderName, holderSurname) {
  const adults = Math.max(1, Number(qs("adults") || "2"));
  const children = Math.max(0, Number(qs("children") || "0"));
  const childrenAges = getChildrenAgesFromQuery();

  const paxes = [];

  for (let i = 0; i < adults; i++) {
    paxes.push({ type: "AD", name: holderName, surname: holderSurname });
  }

  for (let i = 0; i < children; i++) {
    paxes.push({
      type: "CH",
      name: holderName,
      surname: holderSurname,
      age: Number(childrenAges[i] ?? 7)
    });
  }

  return paxes;
}

function setRoomImage() {
  const hero = document.getElementById("roomHeroImg");
  if (!hero) return;

  const hotelName = (qs("hotelName") || "").toLowerCase();
  const hotelMeta = (qs("hotelMeta") || "").toLowerCase();

  let img = "";
  if (hotelMeta.includes("orlando")) img = "/img/orlando.jpg";
  else if (hotelMeta.includes("london")) img = "/img/london.jpg";
  else if (hotelMeta.includes("maceio") || hotelMeta.includes("maceió") || hotelMeta.includes("alagoas")) img = "/img/alagoas.jpg";
  else if (hotelMeta.includes("sao paulo") || hotelMeta.includes("são paulo")) img = "/img/saopaulo.jpg";
  else if (hotelName.includes("resort")) img = "/img/hotel-placeholder.jpg";

  if (img) hero.style.backgroundImage = `url('${img}')`;
}

function renderRoomDetails() {
  const roomName = decodeURIComponent(qs("roomName") || "");
  const hotelName = decodeURIComponent(qs("hotelName") || "");
  const hotelMeta = decodeURIComponent(qs("hotelMeta") || "");
  const board = decodeURIComponent(qs("board") || "");
  const currency = decodeURIComponent(qs("currency") || "EUR");
  const net = Number(qs("net") || 0);
  const brl = Number(qs("brl") || 0);

  document.getElementById("roomTitle").textContent = roomName || "Detalhes do quarto";
  document.getElementById("roomHotelMeta").textContent = `${hotelName} • ${hotelMeta}`;

  document.getElementById("roomDetails").innerHTML = `
    <div class="rate-card">
      <div class="rate-left">
        <b>${roomName}</b><br/>
        <div class="muted">Regime: ${board || "—"}</div>
        <div class="muted">Hotel: ${hotelName}</div>
      </div>
      <div class="rate-right">
        <div class="price">${currency} ${net.toFixed(2)}</div>
        <div class="brl">≈ R$ ${brl.toFixed(2)}</div>
      </div>
    </div>
  `;
}

async function confirmRoomBooking() {
  const rateKey = qs("rateKey");
  if (!rateKey) {
    alert("rateKey não encontrado.");
    return;
  }

  const holderName = (document.getElementById("holderName").value || "").trim();
  const holderSurname = (document.getElementById("holderSurname").value || "").trim();

  if (!holderName || !holderSurname) {
    alert("Preencha nome e sobrenome do titular.");
    return;
  }

  try {
    document.getElementById("roomStatusLine").textContent = "CheckRate...";

    await fetchJson("/api/hotelbeds-checkrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rateKey })
    });

    document.getElementById("roomStatusLine").textContent = "Confirmando booking...";

    const booking = await fetchJson("/api/hotelbeds-booking-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientReference: `LD-${Date.now()}`,
        holder: { name: holderName, surname: holderSurname },
        rooms: [
          {
            rateKey,
            paxes: buildPaxesFromQuery(holderName, holderSurname)
          }
        ]
      })
    });

    const ref = booking?.booking?.reference || booking?.reference || "OK";
    document.getElementById("roomStatusLine").textContent = `Reserva confirmada ✅ Ref: ${ref}`;
    alert(`Reserva CONFIRMADA!\nReferência: ${ref}`);
  } catch (e) {
    console.error("ROOM CONFIRM ERROR:", e);
    const detailsTxt = JSON.stringify(e?.data?.details || e?.data || {}, null, 2);
    document.getElementById("roomStatusLine").textContent = `Erro: ${e.message}`;
    alert(`Erro ao confirmar: ${e.message}\n\nDETALHES:\n${detailsTxt.slice(0, 1800)}`);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderRoomDetails();
  setRoomImage();
  document.getElementById("confirmRoomBtn")?.addEventListener("click", confirmRoomBooking);
});
