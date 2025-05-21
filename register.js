document.getElementById("register-form").addEventListener("submit", async function (e) {
    e.preventDefault();
  
    const nume = document.getElementById("nume").value.trim();
    const email = document.getElementById("email").value.trim();
    const parola = document.getElementById("parola").value;
  
    try {
      const response = await fetch("http://127.0.0.1:5002/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nume, email, parola }),
      });
  
      const data = await response.text();
      document.getElementById("register-message").textContent = data;
    } catch (error) {
      document.getElementById("register-message").textContent = "Eroare la înregistrare!";
    }
  });
  
  const bcrypt = require('bcrypt');

app.post("/register", async (req, res) => {
  const { nume, email, parola } = req.body;
  const connection = await connectDB();
  if (!connection) return res.status(500).send("Eroare conectare la BD");

  try {
    const hashedPassword = await bcrypt.hash(parola, 10);
    await connection.execute(
      `INSERT INTO users (name, email, password) VALUES (:nume, :email, :parola)`,
      { nume, email, parola: hashedPassword },
      { autoCommit: true }
    );
    res.send("Cont creat cu succes!");
  } catch (error) {
    console.error("❌ Eroare la /register:", error);
    res.status(500).send("Eroare la creare cont.");
  } finally {
    await connection.close();
  }
});
