document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("modal-verificare");
  const modalMesaj = document.getElementById("mesaj-verificare");
  const cosProduse = document.getElementById("cos-produse");
  const finalizeazaBtn = document.getElementById("finalizare-comanda");
  const cartCount = document.getElementById("nr-produse-cos");

  // Încarcă coșul din localStorage sau initializează gol
  let cos = JSON.parse(localStorage.getItem("cos")) || [];

  // Verificare sesiune user
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  
  // Ascunde linkuri login/register, afișează profil + logout
  const nav = document.querySelector("nav");
  if (nav) {
    nav.querySelectorAll("a").forEach(a => {
      if (a.textContent === "Autentificare" || a.textContent === "Creează cont") {
        a.style.display = "none";
      }
    });
    const profilSpan = document.createElement("span");
    profilSpan.innerHTML = `
      Salut, <strong>${user.name}</strong>! 
      <button id="logout-btn" style="margin-left:15px; cursor:pointer;">Deconectare</button>
    `;
    nav.appendChild(profilSpan);
  }

  // Funcție afișare modal
  function showModal(mesaj) {
    modalMesaj.innerHTML = mesaj;
    modal.style.display = "flex";
  }

  modal.querySelector("button").addEventListener("click", () => {
    modal.style.display = "none";
  });

  // Salvează coșul în localStorage
  function saveCos() {
    localStorage.setItem("cos", JSON.stringify(cos));
  }

  // Actualizare contor produse în coș (total cantități)
  function updateCartCount() {
    cartCount.textContent = cos.reduce((acc, item) => acc + (item.quantity || 1), 0);
  }

  // Actualizare afișare coș
  function updateCartView() {
    if (cos.length === 0) {
      cosProduse.innerHTML = "<p>Momentan coșul este gol.</p>";
      return;
    }
    cosProduse.innerHTML = "";
    cos.forEach(item => {
      const p = document.createElement("p");
      p.textContent = `${item.name} - ${item.price} lei (x${item.quantity || 1})`;
      cosProduse.appendChild(p);
    });
  }

  // Afișare puncte fidelitate
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
  const folosesteBtn = document.getElementById("foloseste-puncte-btn");
  if (folosesteBtn) {
    folosesteBtn.addEventListener("click", async () => {
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
      try {
        const response = await fetch("http://127.0.0.1:5002/foloseste-puncte", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, puncteFolosite: puncteNum }),
        });
        const data = await response.text();
        alert(data);
        afiseazaPuncte();
      } catch {
        alert("Eroare la folosirea punctelor.");
      }
    });
  }

  // Eveniment click adaugare produs in cos
  document.body.addEventListener("click", async (event) => {
    if (!event.target.classList.contains("adauga-cos")) return;

    const locatiiSelect = document.getElementById("locatii-select");
    if (!locatiiSelect || locatiiSelect.value === "" || locatiiSelect.value === "default") {
      alert("Te rugăm să selectezi o locație înainte de a adăuga produse în coș.");
      return;
    }

    const button = event.target;
    const produsCard = button.closest(".product-card");
    if (!produsCard) return;

    const id = produsCard.getAttribute("data-id");
    const name = produsCard.querySelector("h3").textContent;
    const priceText = produsCard.querySelectorAll("p")[1].textContent;
    const priceMatch = priceText.match(/(\d+(\.\d+)?)\s*lei/);
    const price = priceMatch ? parseFloat(priceMatch[1]) : 0;

    const produsInCos = cos.find(p => p.id === id);
    let nouaCantitate = 1;
    if (produsInCos) {
      nouaCantitate = produsInCos.quantity + 1;
    }

    try {
      const resp = await fetch("http://127.0.0.1:5002/verifica-stoc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: id, quantity: nouaCantitate }),
      });
      const data = await resp.json();

      if (!data.ok) {
        showModal(`<strong>⚠️ Atenție!</strong><br>${data.mesaj}`);
        return;
      }

      if (produsInCos) {
        produsInCos.quantity = nouaCantitate;
      } else {
        cos.push({ id, name, price, quantity: 1 });
      }
      saveCos();

      updateCartCount();
      updateCartView();
      showModal(`<strong>✔️ Succes!</strong><br>Produsul <em>${name}</em> a fost adăugat în coș.`);
    } catch (error) {
      showModal("❌ Eroare la verificarea stocului. Încearcă din nou.");
      console.error(error);
    }
  });


  finalizeazaBtn.addEventListener("click", async () => {
    if (cos.length === 0) {
      alert("❌ Coșul este gol!");
      return;
    }
  
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) {
      alert("❌ Trebuie să te autentifici.");
      window.location.href = "login.html";
      return;
    }
  
    try {
      const response = await fetch("http://127.0.0.1:5002/finalizeaza-comanda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          produse: cos.map(item => ({
            id: Number(item.id),
            quantity: item.quantity,
            price: item.price,
            name: item.name
          }))
        }),
      });
  
      const data = await response.json();
  
      if (response.ok && data.ok) {
        alert(data.mesaj);
        cos = [];
        saveCos();
        updateCartCount();
        updateCartView();
        afiseazaPuncte(); // reîncarcă punctele fidelitate actualizate
      } else {
        alert(data.mesaj || "Eroare la finalizarea comenzii.");
      }
    } catch (error) {
      alert("Eroare la conectarea cu serverul.");
      console.error(error);
    }
  });
  

  // Logout
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("user");
      localStorage.removeItem("cos");
      window.location.href = "login.html";
    });
  }

  updateCartCount();
  updateCartView();
});
