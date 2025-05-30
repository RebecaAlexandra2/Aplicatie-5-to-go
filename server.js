const express = require("express");
const oracledb = require("oracledb");
const cors = require("cors");
const bcrypt = require("bcrypt");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5002;

app.use(express.static('public'));
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


async function genHash() {
  const hash = await bcrypt.hash('test123', 10);
  console.log(hash);
}

genHash();

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
  const connection = await connectDB();
  if (!connection) return res.status(500).send("Eroare la conectare la BD");

  try {
    const result = await connection.execute(
      `SELECT id, name, address, phone FROM locations`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Eroare la /locatii:", error);
    res.status(500).send("Eroare la interogare locații.");
  } finally {
    await connection.close();
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

app.post("/verifica-stoc", async (req, res) => {
  const { productId, quantity } = req.body;

  const connection = await connectDB();
  if (!connection) {
    return res.status(500).send("Eroare la conectare BD");
  }

  try {
    const result = await connection.execute(
      `SELECT 
         FLOOR(MIN((i.stock_quantity - i.minimum_stock) / r.quantity)) AS max_produse_posibile
       FROM ingredients i
       JOIN recipes r ON i.id = r.ingredient_id
       WHERE r.product_id = :productId`,
      { productId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const maxDisponibil = result.rows[0]?.MAX_PRODUSE_POSIBILE ?? 0;

    if (quantity > maxDisponibil) {
      return res.json({
        ok: false,
        mesaj: `Nu se poate comanda ${quantity} bucăți. Maxim disponibile: ${maxDisponibil}.`,
        maxDisponibil,
      });
    }

    let mesaj = "Stoc suficient.";
    // Avertisment dacă se apropie de minim (ex: sub 2 produse)
    if (maxDisponibil <= 2) {
      mesaj = "⚠️ Atenție! Te apropii de stocul minim. Următoarea comandă nu va fi posibilă.";
    }

    return res.json({ ok: true, mesaj, maxDisponibil });

  } catch (error) {
    console.error("❌ Eroare la verificare stoc:", error);
    return res.status(500).send("Eroare la verificare stoc.");
  } finally {
    await connection.close();
  }
});


app.listen(PORT, () => {
  console.log(`✅ Serverul rulează pe portul ${PORT}`);
});

app.post("/finalizeaza-comanda", async (req, res) => {
  const { userId, produse } = req.body;

  let connection;

  try {
    connection = await connectDB();

    // Verifică rolul userului
    const userResult = await connection.execute(
      `SELECT role FROM users WHERE id = :userId`,
      { userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const role = userResult.rows[0]?.ROLE;
    if (role === "admin") {
      return res.status(403).json({
        ok: false,
        mesaj: "Administratorii nu pot finaliza comenzi."
      });
    }

    // Verifică stocul pentru fiecare produs
    for (const prod of produse) {
      const stocResult = await connection.execute(
        `SELECT FLOOR(MIN((i.stock_quantity - NVL(i.minimum_stock, 0)) / r.quantity)) AS max_produse_posibile
         FROM ingredients i
         JOIN recipes r ON i.id = r.ingredient_id
         WHERE r.product_id = :prodId`,
        { prodId: prod.id },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const maxDisponibil = stocResult.rows[0]?.MAX_PRODUSE_POSIBILE ?? 0;

      if (prod.quantity > maxDisponibil) {
        return res.status(400).json({
          ok: false,
          mesaj: `Nu se poate comanda ${prod.quantity} bucăți din produsul ID ${prod.id}. Maxim disponibile: ${maxDisponibil}.`
        });
      }
    }

    // Calculează totalul comenzii
    const totalComanda = produse.reduce((acc, p) => acc + Number(p.price) * Number(p.quantity), 0);

    // Inserare comandă și obținere ID
    const orderResult = await connection.execute(
      `INSERT INTO orders (user_id, total_price, status, created_at)
       VALUES (:userId, :totalPrice, 'completed', CURRENT_TIMESTAMP)
       RETURNING id INTO :orderId`,
      {
        userId,
        totalPrice: totalComanda,
        orderId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      },
      { autoCommit: false }
    );
    
    const newOrderId = orderResult.outBinds.orderId[0];
    console.log("ID-ul noii comenzi:", newOrderId);
    
    // Inserare itemi comandă
    for (const prod of produse) {
      await connection.execute(
        `INSERT INTO order_items (order_id, product_id, quantity) VALUES (:orderId, :prodId, :cantitate)`,
        { orderId: newOrderId, prodId: prod.id, cantitate: prod.quantity },
        { autoCommit: false }
      );
    }

    // Scădere stoc pentru fiecare produs comandat
    for (const prod of produse) {
      await connection.execute(
        `BEGIN scade_stoc_produs(:prodId, :cantitate); END;`,
        { prodId: prod.id, cantitate: prod.quantity },
        { autoCommit: false }
      );
    }

    // Calculează punctele fidelitate câștigate
    const puncteCastigate = Math.floor(totalComanda);

    // Actualizează punctele fidelitate ale utilizatorului
    await connection.execute(
      `UPDATE users SET fidelitate_puncte = NVL(fidelitate_puncte, 0) + :puncte WHERE id = :userId`,
      { puncte: puncteCastigate, userId },
      { autoCommit: false }
    );

    // Înregistrează tranzacția fidelitate
    await connection.execute(
      `INSERT INTO fidelitate_tranzactii (user_id, puncte, descriere) VALUES (:userId, :puncte, :descriere)`,
      { userId, puncte: puncteCastigate, descriere: "Puncte câștigate la comandă" },
      { autoCommit: false }
    );

    // Commit toate operațiunile
    await connection.commit();

    res.json({ ok: true, mesaj: `Comandă finalizată cu succes! Ai câștigat ${puncteCastigate} puncte fidelitate.` });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("❌ Eroare la finalizarea comenzii:", error.stack);
    res.status(500).send("Eroare la finalizarea comenzii.");
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { console.error(e); }
    }
  }
});




app.get("/fidelitate/:userId", async (req, res) => {
  const userId = req.params.userId;
  let connection;
  try {
    connection = await connectDB();

    const result = await connection.execute(
      `SELECT NVL(fidelitate_puncte, 0) AS puncte FROM users WHERE id = :userId`,
      { userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const puncte = result.rows[0]?.PUNCTE || 0;
    res.json({ puncte });
  } catch (error) {
    console.error("❌ Eroare la obținerea punctelor:", error);
    res.status(500).send("Eroare la obținerea punctelor.");
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { console.error(e); }
    }
  }
});
app.post("/foloseste-puncte", async (req, res) => {
  const { userId, puncteFolosite } = req.body;
  let connection;
  try {
    connection = await connectDB();

    // Verifică punctele disponibile
    const result = await connection.execute(
      `SELECT NVL(fidelitate_puncte, 0) AS puncte FROM users WHERE id = :userId`,
      { userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const puncteDisponibile = result.rows[0]?.PUNCTE || 0;

    if (puncteFolosite > puncteDisponibile) {
      return res.status(400).json({ mesaj: "Nu ai suficiente puncte." });
    }

    // Scade punctele
    await connection.execute(
      `UPDATE users SET fidelitate_puncte = fidelitate_puncte - :puncte WHERE id = :userId`,
      { puncte: puncteFolosite, userId },
      { autoCommit: false }
    );

    // Inserează tranzacția negativă în istoric
    await connection.execute(
      `INSERT INTO fidelitate_tranzactii (user_id, puncte, descriere) VALUES (:userId, -:puncte, :descriere)`,
      { userId, puncte: puncteFolosite, descriere: "Folosire puncte fidelitate" },
      { autoCommit: true }
    );

    res.send(`Ai folosit ${puncteFolosite} puncte fidelitate.`);
  } catch (error) {
    console.error("❌ Eroare la folosirea punctelor:", error);
    res.status(500).send("Eroare la folosirea punctelor.");
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { console.error(e); }
    }
  }
});

// Login endpoint (presupunem că ai rolul în coloana ROLE)
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

    res.json({ 
      user: { 
        id: user.ID, 
        name: user.NAME, 
        email: user.EMAIL, 
        role: user.ROLE  // asigură-te că ai coloana ROLE în BD
      } 
    });
  } catch (error) {
    console.error("❌ Eroare la /login:", error);
    res.status(500).send("Eroare la autentificare");
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { console.error(e); }
    }
  }
});
app.get("/raport-vanzari-zi", async (req, res) => {
  let connection;
  try {
    connection = await connectDB();

    const result = await connection.execute(
      `SELECT 
          TO_CHAR(created_at, 'YYYY-MM-DD') AS data,
          COUNT(*) AS numar_comenzi,
          NVL(SUM(total_price), 0) AS valoare_totala
       FROM orders
       WHERE created_at >= SYSDATE - 30 -- ultimele 30 zile
       GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
       ORDER BY data DESC`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    

    res.json(result.rows);
  } catch (error) {
    console.error("❌ Eroare la raport:", error);
    res.status(500).send("Eroare la generarea raportului");
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { console.error(e); }
    }
  }
});

app.post("/adauga-produs", async (req, res) => {
  const { name, price, gramaj } = req.body;

  let connection;
  try {
    connection = await connectDB();

    await connection.execute(
      `INSERT INTO products (name, price, gramaj) VALUES (:name, :price, :gramaj)`,
      { name, price, gramaj },
      { autoCommit: true }
    );

    res.send("Produs adăugat cu succes!");
  } catch (error) {
    console.error("❌ Eroare la adăugarea produsului:", error);
    res.status(500).send("Eroare la adăugarea produsului.");
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { console.error(e); }
    }
  }
});
// Ruta pentru listarea produselor (poți adapta din ce ai deja)
app.get("/produse", async (req, res) => {
  let connection;
  try {
    connection = await connectDB();
    const result = await connection.execute(
      `SELECT id, name, price, gramaj FROM products`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Eroare la listarea produselor:", error);
    res.status(500).send("Eroare la listarea produselor.");
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { console.error(e); }
    }
  }
});

// Ruta pentru ștergerea produsului după ID
app.delete("/sterge-produs/:id", async (req, res) => {
  const productId = req.params.id;
  let connection;
  try {
    connection = await connectDB();
    await connection.execute(
      `DELETE FROM products WHERE id = :id`,
      { id: productId },
      { autoCommit: true }
    );
    res.sendStatus(204); // No Content - șters cu succes
  } catch (error) {
    console.error("❌ Eroare la ștergerea produsului:", error);
    res.status(500).send("Eroare la ștergerea produsului.");
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { console.error(e); }
    }
  }
});

