document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const loginMessage = document.getElementById("login-message");

  loginMessage.innerText = ""; // reset mesaj

  try {
    const response = await fetch("http://127.0.0.1:5002/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem("user", JSON.stringify(data.user));
      loginMessage.innerText = `✅ Bine ai venit, ${data.user.name}!`;
      setTimeout(() => {
        window.location.href = "index.html";
      }, 2000);
    } else {
      loginMessage.innerText = `❌ ${data.message}`;
    }
    
  } catch (error) {
    console.error("❌ Eroare la autentificare:", error);
    loginMessage.innerText = "Eroare la conectare la server!";
  }
});
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const connection = await connectDB();
  if (!connection) return res.status(500).send("Eroare conectare la BD");

  try {
    const result = await connection.execute(
      "SELECT * FROM users WHERE email = :email",
      [email],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Email inexistent" });
    }

    const user = result.rows[0];

    const match = await bcrypt.compare(password, user.PASSWORD);

    if (!match) {
      return res.status(401).json({ message: "Parolă incorectă" });
    }

    res.json({ user: { id: user.ID, name: user.NAME, email: user.EMAIL, role: user.ROLE } });
  } catch (error) {
    console.error("❌ Eroare la autentificare:", error);
    res.status(500).send("Eroare la autentificare");
  } finally {
    await connection.close();
  }
});
