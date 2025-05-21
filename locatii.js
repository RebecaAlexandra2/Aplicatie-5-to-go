document.addEventListener("DOMContentLoaded", async () => {
    const selectLocatii = document.getElementById("select-locatii");
    try {
      const response = await fetch("http://127.0.0.1:5002/locatii");
      if (!response.ok) throw new Error("Răspuns invalid de la server");
      const locatii = await response.json();
  
      selectLocatii.innerHTML = locatii.map(loc => 
        `<option value="${loc.ID}">${loc.NAME} - ${loc.ADDRESS}</option>`
      ).join("");
    } catch (error) {
      selectLocatii.innerHTML = "<option>Nu s-au putut încărca locațiile</option>";
      console.error(error);
    }
  });
  