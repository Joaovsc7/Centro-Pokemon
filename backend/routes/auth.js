const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/database");
const { autenticar } = require("../middlewares/auth");

const router = express.Router();
const tentativasLogin = new Map();
const LIMITE_TENTATIVAS = 8;
const JANELA_MS = 15 * 60 * 1000;

function excedeuTentativas(chave) {
  const agora = Date.now();
  const registro = tentativasLogin.get(chave);
  if (!registro || agora - registro.inicio > JANELA_MS) {
    tentativasLogin.set(chave, { inicio: agora, total: 1 });
    return false;
  }
  registro.total += 1;
  return registro.total > LIMITE_TENTATIVAS;
}

router.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body;
    const emailNormalizado = String(email || "").trim().toLowerCase();
    const chaveTentativas = `${req.ip}:${emailNormalizado}`;
    if (excedeuTentativas(chaveTentativas)) {
      return res.status(429).json({ mensagem: "Muitas tentativas. Aguarde 15 minutos e tente novamente." });
    }

    if (!emailNormalizado || !senha || typeof senha !== "string" || senha.length > 200) {
      return res.status(400).json({ mensagem: "Informe e-mail e senha." });
    }

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      return res.status(503).json({ mensagem: "Configure uma JWT_SECRET com pelo menos 32 caracteres no .env." });
    }

    const [usuarios] = await pool.query(
      `SELECT id, nome, email, senha, perfil, ativo
       FROM usuarios
       WHERE email = ?`,
      [emailNormalizado]
    );

    if (!usuarios.length || !usuarios[0].ativo) {
      return res.status(401).json({ mensagem: "Credenciais inválidas." });
    }

    const usuario = usuarios[0];
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

    if (!senhaCorreta) {
      return res.status(401).json({ mensagem: "Credenciais inválidas." });
    }

    tentativasLogin.delete(chaveTentativas);
    const payload = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "8h", issuer: "petcare-modern" }
    );

    res.json({ token, usuario: payload });
  } catch (erro) {
    console.error("ERRO NO LOGIN:", erro);
    res.status(500).json({ mensagem: "Não foi possível entrar no sistema." });
  }
});

router.get("/me", autenticar, async (req, res) => {
  const [rows] = await pool.query("SELECT id, nome, email, perfil, ativo FROM usuarios WHERE id = ? LIMIT 1", [req.usuario.id]);
  if (!rows.length || !rows[0].ativo) return res.status(401).json({ mensagem: "Usuário indisponível. Entre novamente." });
  res.json(rows[0]);
});

module.exports = router;
