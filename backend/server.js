const path = require("path");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./config/database");
const prepararUsuarios = require("./utils/bootstrap");
const aplicarMigracoes = require("./utils/migrations");

const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});
const origensPermitidas = (process.env.CORS_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000").split(",").map(x => x.trim()).filter(Boolean);
app.use(cors({ origin(origem, callback) { if (!origem || origensPermitidas.includes(origem)) return callback(null, true); return callback(new Error("Origem não permitida pelo CORS.")); } }));
app.use(express.json({ limit: "1mb" }));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/clientes", require("./routes/clientes"));
app.use("/api/pets", require("./routes/pets"));
app.use("/api/veterinarios", require("./routes/veterinarios"));
app.use("/api/consultas", require("./routes/consultas"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/prontuarios", require("./routes/prontuarios"));
app.use("/api/vacinacoes", require("./routes/vacinacoes"));

const frontend = path.join(__dirname, "..", "frontend");
app.use(express.static(frontend));

app.get("*", (_req, res) => {
  res.sendFile(path.join(frontend, "index.html"));
});

const porta = Number(process.env.PORT || 3000);

async function iniciar() {
  try {
    await pool.query("SELECT 1");
    console.log("[OK] Banco de dados conectado.");
    await aplicarMigracoes();
    await prepararUsuarios();

    app.listen(porta, () => {
      console.log(`[OK] PetCare Modern: http://localhost:${porta}`);
    });
  } catch (erro) {
    console.error("[ERRO] Não foi possível iniciar o sistema:");
    console.error(erro.message);
    console.error("Confira o MySQL, o banco e o arquivo .env.");
  }
}

iniciar();
