document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-produs");
  const mesaj = document.getElementById("admin-message");
  const listaProduseDiv = document.getElementById("lista-produse");

  // Verifică dacă userul este admin
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user || user.role !== "admin") {
    alert("Acces interzis! Trebuie să fii administrator.");
    window.location.href = "login.html";
    return;
  }

  // Funcție pentru afișare produse cu buton de ștergere
  async function incarcaProduse() {
    try {
      const resp = await fetch("http://127.0.0.1:5002/meniu");
      const produse = await resp.json();

      if (produse.length === 0) {
        listaProduseDiv.innerHTML = "<p>Nu există produse.</p>";
        return;
      }

      let html = "<ul>";
      produse.forEach(p => {
        html += `
          <li>
            ${p.name} — ${p.price} lei — ${p.gramaj} ml
            <button class="sterge-produs-btn" data-id="${p.id}" style="margin-left:10px;">Șterge</button>
          </li>`;
      });
      html += "</ul>";
      listaProduseDiv.innerHTML = html;

      // Adaugă event listener pe butoanele de ștergere
      document.querySelectorAll(".sterge-produs-btn").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          const idProdus = e.target.getAttribute("data-id");
          if (!confirm(`Sigur vrei să ștergi produsul cu ID ${idProdus}?`)) return;

          try {
            const response = await fetch(`http://127.0.0.1:5002/sterge-produs/${idProdus}`, {
              method: "DELETE",
            });
            if (response.ok) {
              alert("Produs șters cu succes!");
              await incarcaProduse();
            } else {
              alert("Eroare la ștergerea produsului.");
            }
          } catch (err) {
            alert("Eroare la conectarea cu serverul.");
            console.error(err);
          }
        });
      });
    } catch (err) {
      listaProduseDiv.innerHTML = "<p>Eroare la încărcarea produselor.</p>";
      console.error(err);
    }
  }

  // Încarcă produsele la start
  incarcaProduse();

  // Eveniment submit formular adăugare produs
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nume = document.getElementById("nume").value.trim();
    const pret = parseFloat(document.getElementById("pret").value);
    const gramaj = parseInt(document.getElementById("gramaj").value);

    if (!nume || isNaN(pret) || isNaN(gramaj)) {
      mesaj.textContent = "Completează toate câmpurile corect.";
      return;
    }

    try {
      const resp = await fetch("http://127.0.0.1:5002/adauga-produs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nume, price: pret, gramaj }),
      });

      if (resp.ok) {
        mesaj.textContent = "Produs adăugat cu succes!";
        form.reset();
        await incarcaProduse();
      } else {
        mesaj.textContent = "Eroare la adăugarea produsului.";
      }
    } catch (err) {
      mesaj.textContent = "Eroare la conectarea cu serverul.";
      console.error(err);
    }
  });
});
