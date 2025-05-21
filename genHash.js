const bcrypt = require('bcrypt');

async function genHash() {
  const password = "test123"; // parola pe care vrei să o hash-uiești
  const hash = await bcrypt.hash(password, 10);
  console.log("Hash-ul generat este:", hash);
}

genHash();
