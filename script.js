document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("modal-verificare");
  const modalMesaj = document.getElementById("mesaj-verificare");
  const cosProduse = document.getElementById("cos-produse");
  const finalizeazaBtn = document.getElementById("finalizare-comanda");
  const cartCount = document.getElementById("nr-produse-cos");

  let cos = [];

  // Funcție afișare modal cu mesaj
  function showModal(mesaj) {
    modalMesaj.innerHTML = mesaj;
    modal.style.display = "flex";
  }
  // Închidere modal la click pe buton
  modal.querySelector("button").addEventListener("click", () => {
    modal.style.display = "none";
  });

  // Actualizare număr produse în coș (în iconiță)
  function updateCartCount() {
    cartCount.textContent = cos.length;
  }

  // Actualizare lista produse din coș
  function updateCartView() {
    if (cos.length === 0) {
      cosProduse.innerHTML = "<p>Momentan coșul este gol.</p>";
      return;
    }
    cosProduse.innerHTML = "";
    cos.forEach(item => {
      const p = document.createElement("p");
      p.textContent = `${item.name} - ${item.price} lei`;
      cosProduse.appendChild(p);
    });
  }

  // La click pe "Adaugă în coș"
  document.body.addEventListener("click", async (event) => {
    if (!event.target.classList.contains("adauga-cos")) return;

    // Verifică dacă s-a selectat locația
    const locatiiSelect = document.getElementById("locatii-select");
    if (!locatiiSelect || locatiiSelect.value === "" || locatiiSelect.value === "default") {
      alert("Te rugăm să selectezi o locație înainte de a adăuga produse în coș.");
      return;
    }

    const button = event.target;
    const produsCard = button.closest(".product-card");
    const id = produsCard.getAttribute("data-id");
    const name = produsCard.querySelector("h3").textContent;
    const priceText = produsCard.querySelectorAll("p")[1].textContent;
    const priceMatch = priceText.match(/(\d+(\.\d+)?)\s*lei/);
    const price = priceMatch ? parseFloat(priceMatch[1]) : 0;

    // Verific dacă produsul este deja în coș și cresc cantitatea dacă da
    const produsInCos = cos.find(p => p.id === id);
    let nouaCantitate = 1;
    if (produsInCos) {
      nouaCantitate = produsInCos.quantity + 1;
    }

    try {
      // Verific stocul pentru cantitatea cumulată
      const resp = await fetch("http://127.0.0.1:5002/verifica-stoc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: id, quantity: nouaCantitate }),
      });
      const data = await resp.json();

      if (!data.ok) {
        // Stoc insuficient
        showModal(`<strong>⚠️ Atenție!</strong><br>${data.mesaj}`);
        return;
      }

      // Stoc suficient, adaug sau actualizez cantitatea în coș
      if (produsInCos) {
        produsInCos.quantity = nouaCantitate;
      } else {
        cos.push({ id, name, price, quantity: 1 });
      }

      updateCartCount();
      updateCartView();
      showModal(`<strong>✔️ Succes!</strong><br>Produsul <em>${name}</em> a fost adăugat în coș.`);

    } catch (error) {
      showModal("❌ Eroare la verificarea stocului. Încearcă din nou.");
      console.error(error);
    }
  });

  finalizeazaBtn.addEventListener("click", () => {
    if (cos.length === 0) {
      alert("❌ Coșul este gol!");
      return;
    }
    alert(`✅ Ai finalizat comanda cu ${cos.length} produse.`);
    cos = [];
    updateCartCount();
    updateCartView();
  });

  updateCartCount();
  updateCartView();
});

// După login, afișăm punctele utilizatorului
const user = JSON.parse(localStorage.getItem("user"));

async function afiseazaPuncte() {
  try {
    const response = await fetch(`http://127.0.0.1:5002/fidelitate/${user.id}`);
    const data = await response.json();
    document.getElementById("puncte-fidelitate").textContent = data.puncte;
  } catch {
    console.error("Nu s-au putut încărca punctele.");
  }
}

afiseazaPuncte();

// Folosire puncte
document.getElementById("foloseste-puncte-btn").addEventListener("click", () => {
  const puncte = parseInt(document.getElementById("puncte-fidelitate").textContent, 10);
  if (puncte <= 0) {
    alert("Nu ai puncte de fidelitate disponibile.");
    return;
  }
  const puncteDeFolosit = prompt(`Ai ${puncte} puncte. Câte puncte dorești să folosești?`);
  const puncteNum = parseInt(puncteDeFolosit, 10);
  if (isNaN(puncteNum) || puncteNum <= 0 || puncteNum > puncte) {
    alert("Număr invalid de puncte.");
    return;
  }

  // Aici adaugi logica pentru a scădea punctele în backend la trimiterea comenzii.
  alert(`Veți folosi ${puncteNum} puncte pentru reducere.`);
  // TODO: actualizare backend cu folosirea punctelor (vezi pasul următor)
});

async function folosestePuncte(userId, puncte) {
  try {
    const response = await fetch("http://127.0.0.1:5002/foloseste-puncte", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, puncteFolosite: puncte }),
    });
    const data = await response.text();
    alert(data);
    // Reîmprospătează afișarea punctelor după folosire
    afiseazaPuncte();
  } catch {
    alert("Eroare la folosirea punctelor.");
  }
}

document.getElementById("foloseste-puncte-btn").addEventListener("click", async () => {
  const puncte = parseInt(document.getElementById("puncte-fidelitate").textContent, 10);
  if (puncte <= 0) {
    alert("Nu ai puncte de fidelitate disponibile.");
    return;
  }
  const puncteDeFolosit = prompt(`Ai ${puncte} puncte. Câte puncte dorești să folosești?`);
  const puncteNum = parseInt(puncteDeFolosit, 10);
  if (isNaN(puncteNum) || puncteNum <= 0 || puncteNum > puncte) {
    alert("Număr invalid de puncte.");
    return;
  }
  await folosestePuncte(user.id, puncteNum);
});

document.addEventListener("DOMContentLoaded", async () => {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) {
    // Dacă nu e user logat, redirecționează la login
    window.location.href = "login.html";
    return;
  }

  // Afișează profilul userului (exemplu simplu)
  const profilDiv = document.createElement("div");
  profilDiv.id = "profil-user";
  profilDiv.innerHTML = `
    <p>Bine ai venit, <strong>${user.name}</strong>! <button id="logout-btn">Deconectare</button></p>
    <p>Puncte fidelitate: <span id="puncte-fidelitate">...</span></p>
  `;
  document.body.prepend(profilDiv);

  // Încarcă punctele fidelitate de la backend
  async function afiseazaPuncte() {
    try {
      const response = await fetch(`http://127.0.0.1:5002/fidelitate/${user.id}`);
      const data = await response.json();
      document.getElementById("puncte-fidelitate").textContent = data.puncte;
    } catch {
      document.getElementById("puncte-fidelitate").textContent = "N/A";
    }
  }
  afiseazaPuncte();

  // Buton logout
  document.getElementById("logout-btn").addEventListener("click", () => {
    localStorage.removeItem("user");
    window.location.href = "login.html";
  });
});
