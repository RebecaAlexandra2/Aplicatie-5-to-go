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

    const button = event.target;
    const produsCard = button.closest(".product-card");
    const id = produsCard.getAttribute("data-id");
    const name = produsCard.querySelector("h3").textContent;
    const priceText = produsCard.querySelectorAll("p")[1].textContent;
    const priceMatch = priceText.match(/(\d+(\.\d+)?)\s*lei/);
    const price = priceMatch ? parseFloat(priceMatch[1]) : 0;

    try {
      // Verific stocul la backend
      const resp = await fetch("http://127.0.0.1:5002/verifica-stoc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: id, quantity: 1 }),
      });
      const data = await resp.json();

      if (!data.ok) {
        // Stoc insuficient: arăt mesaj în modal și opresc adăugarea
        showModal(`<strong>⚠️ Atenție!</strong><br>${data.mesaj}`);
        return;
      }

      // Dacă stocul e OK: adaug produsul în coș și arăt mesaj succes
      cos.push({ id, name, price });
      updateCartCount();
      updateCartView();
      showModal(`<strong>✔️ Succes!</strong><br>Produsul <em>${name}</em> a fost adăugat în coș.`);

    } catch (error) {
      showModal("❌ Eroare la verificarea stocului. Încearcă din nou.");
      console.error(error);
    }
  });

  // Finalizare comandă (exemplu simplu)
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

  // Inițializare
  updateCartCount();
  updateCartView();
});
