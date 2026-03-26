// ==========================
// ROOM.JS - LETS DREAM
// ==========================

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
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
    paxes.push({
      type: "AD",
      name: holderName,
      surname: holderSurname,
      nationality: "BR"
    });
  }

  for (let i = 0; i < children; i++) {
    paxes.push({
      type: "CH",
      name: holderName,
      surname: holderSurname,
      age: Number(childrenAges[i] ?? 7),
      nationality: "BR"
    });
  }

  return paxes;
}

function renderRoomDetails() {
  const roomName = decodeURIComponent(qs("roomName") || "");
  const hotelName = decodeURIComponent(qs("hotelName") || "");
  const board = decodeURIComponent(qs("board") || "");
  const currency = decodeURIComponent(qs("currency") || "EUR");
  const net = Number(qs("net") || 0);
  const brl = Number(qs("brl") || 0);

  document.getElementById("roomTitle").textContent = roomName;
  document.getElementById("roomPrice").textContent =
    `${currency} ${net.toFixed(2)} | R$ ${brl.toFixed(2)}`;

  document.getElementById("roomBoard").textContent = board;
  document.getElementById("roomHotel").textContent = hotelName;
}

} catch (e) {
  console.error("ROOM CONFIRM ERROR:", e);
  console.error("ROOM CONFIRM ERROR DATA:", e?.data || null);
  console.error("ROOM CONFIRM ERROR DETAILS:", e?.data?.details || null);
  console.error("ROOM CONFIRM SENT PAYLOAD:", e?.data?.sentPayload || null);

  const detailsTxt = JSON.stringify(
    e?.data?.details || e?.data || {},
    null,
    2
  );

  document.getElementById("status").innerText = `Erro: ${e.message}`;

  alert(
    `Erro ao confirmar booking: ${e.message}\n\nDETALHES:\n${detailsTxt.slice(0, 1800)}`
  );
}

  try {
    const bookingPayload = {
      clientReference: `LD-${Date.now()}`,
      holder: {
        name: holderName,
        surname: holderSurname
      },
      rooms: [
        {
          rateKey,
          paxes: buildPaxesFromQuery(holderName, holderSurname)
        }
      ]
    };

    document.getElementById("status").innerText = "CheckRate...";

    await fetch("/api/hotelbeds-checkrate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ rateKey })
    });

    document.getElementById("status").innerText = "Confirmando reserva...";

    const r = await fetch("/api/hotelbeds-booking-confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(bookingPayload)
    });

    const data = await r.json();

    console.log("BOOKING RESPONSE", data);

    if (data.booking && data.booking.reference) {
      document.getElementById("status").innerText =
        "Reserva confirmada: " + data.booking.reference;
      alert("Reserva confirmada! Ref: " + data.booking.reference);
    } else {
      alert("Booking falhou");
      console.log(data);
    }

  } catch (e) {
    console.error(e);
    alert("Erro ao confirmar booking");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderRoomDetails();

  document
    .getElementById("confirmRoomBtn")
    .addEventListener("click", confirmRoomBooking);
});
