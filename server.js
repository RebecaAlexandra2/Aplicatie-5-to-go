const express = require("express");
const oracledb = require("oracledb");
const cors = require("cors");
const bcrypt = require("bcrypt");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5002;

app.use(express.json());
app.use(cors());

console.log("Serverul încearcă să pornească...");

// Endpoint test simplu
app.get("/", (req, res) => {
  res.send("Server funcționează!");
});

// 🔌 Conectare la baza de date Oracle
async function connectDB() {
  try {
    console.log("🔐 User:", process.env.DB_USER);
    console.log("🔐 Password:", process.env.DB_PASSWORD);
    console.log("🔐 Connection:", process.env.DB_CONNECTION);

    return await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectionString: process.env.DB_CONNECTION,
    });
  } catch (error) {
    console.error("❌ Eroare conectare BD:", error);
    throw error; // Aruncă eroarea pentru a opri procesul dacă nu se poate conecta
  }
}

// Ruta pentru meniul produselor
app.get("/meniu", async (req, res) => {
  let connection;
  try {
    connection = await connectDB();

    const result = await connection.execute(
      `SELECT 
        p.id, p.name, p.price, p.gramaj,
        COALESCE(
          LISTAGG(i.name || ' (' || r.quantity || ' ' || i.unit || ')', ', ') 
          WITHIN GROUP (ORDER BY i.name),
          'Nu sunt disponibile'
        ) AS ingredients
      FROM products p
      LEFT JOIN recipes r ON p.id = r.product_id
      LEFT JOIN ingredients i ON r.ingredient_id = i.id
      GROUP BY p.id, p.name, p.price, p.gramaj`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json(
      result.rows.map(row => ({
        id: row.ID,
        name: row.NAME,
        price: row.PRICE,
        gramaj: row.GRAMAJ,
        ingredients: row.INGREDIENTS,
      }))
    );
  } catch (error) {
    console.error("❌ Eroare la /meniu:", error);
    res.status(500).send("Eroare la interogare meniului.");
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { console.error(e); }
    }
  }
});

// Ruta pentru locații
app.get("/locatii", async (req, res) => {
  let connection;
  try {
    connection = await connectDB();

    const result = await connection.execute(
      `SELECT id, name, address, phone FROM locations`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Eroare la /locatii:", error);
    res.status(500).send("Eroare la interogare locațiilor.");
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { console.error(e); }
    }
  }
});

// Înregistrare cont nou cu parolă criptată
app.post("/register", async (req, res) => {
  let connection;
  const { nume, email, parola } = req.body;
  try {
    connection = await connectDB();

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
    if (connection) {
      try { await connection.close(); } catch (e) { console.error(e); }
    }
  }
});

// Autentificare utilizator
app.post("/login", async (req, res) => {
  let connection;
  const { email, password } = req.body;
  try {
    connection = await connectDB();

    const result = await connection.execute(
      `SELECT * FROM users WHERE email = :email`,
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
    console.error("❌ Eroare la /login:", error);
    res.status(500).send("Eroare la autentificare");
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { console.error(e); }
    }
  }
});
app.post("/verifica-stoc", async (req, res) => {
  const { productId, quantity } = req.body;
  
  const connection = await connectDB();
  if (!connection) {
    return res.status(500).send("Eroare la conectare BD");
  }

  try {
    const maxResult = await connection.execute(
      `SELECT FLOOR(MIN(i.stock_quantity / r.quantity)) AS max_produse_posibile
       FROM ingredients i
       JOIN recipes r ON i.id = r.ingredient_id
       WHERE r.product_id = :productId`,
      { productId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const maxProduse = maxResult.rows[0]?.MAX_PRODUSE_POSIBILE ?? 0;

    if (quantity > maxProduse) {
      return res.json({
        ok: false,
        mesaj: `Nu se poate comanda ${quantity} bucăți. Maxim disponibile: ${maxProduse}.`
      });
    }

    return res.json({ ok: true, mesaj: "Stoc suficient." });

  } catch (error) {
    console.error("❌ Eroare la verificare stoc:", error);
    return res.status(500).send("Eroare la verificare stoc.");
  } finally {
    await connection.close();
  }
});


// Pornire server
app.listen(PORT, () => {
  console.log(`✅ Serverul rulează pe portul ${PORT}`);
});

