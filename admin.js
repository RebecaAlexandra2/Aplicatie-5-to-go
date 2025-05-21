document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("form-produs");
    const mesaj = document.getElementById("admin-message");
  
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nume = document.getElementById("nume").value;
      const pret = document.getElementById("pret").value;
      const gramaj = document.getElementById("gramaj").value;
  
      try {
        const res = await fetch("http://127.0.0.1:5002/admin/adauga-produs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: nume, price: pret, gramaj })
        });
        const data = await res.text();
        mesaj.textContent = data;
        form.reset();
        incarcaProduse();
      } catch {
        mesaj.textContent = "Eroare la adăugare.";
      }
    });
  
    async function incarcaProduse() {
      const res = await fetch("http://127.0.0.1:5002/meniu");
      const produse = await res.json();
      const container = document.getElementById("lista-produse");
      container.innerHTML = produse.map(p => `<p>${p.name} – ${p.price} lei</p>`).join("");
    }
  
    incarcaProduse();
  });
  