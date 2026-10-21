const express = require("express");
const pool = require("../config/database");
const { autenticar, apenasAdmin } = require("../middlewares/auth");

const router = express.Router();
router.use(autenticar);

router.get("/", async (_req, res) => {
  try {
    const [dados] = await pool.query(`
      SELECT c.*,
             COUNT(p.id) AS total_pets
      FROM clientes c
      LEFT JOIN pets p ON p.cliente_id = c.id
      GROUP BY c.id
      ORDER BY c.nome
    `);
    res.json(dados);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ mensagem: "Erro ao listar clientes." });
  }
});

router.post("/", async (req, res) => {
  try {
    const { nome, telefone, email, endereco, cidade } = req.body;

    const nomeLimpo = String(nome || "").trim();
    const telefoneLimpo = String(telefone || "").trim();
    if (!nomeLimpo || nomeLimpo.length > 120 || !telefoneLimpo || telefoneLimpo.length > 20) {
      return res.status(400).json({ mensagem: "Informe nome (até 120 caracteres) e telefone válido (até 20 caracteres)." });
    }
    if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email)) || String(email).length > 120)) return res.status(400).json({ mensagem: "E-mail inválido." });
    if ([endereco, cidade].some(v => v && String(v).length > 200)) return res.status(400).json({ mensagem: "Endereço ou cidade excede o limite permitido." });

    const [resultado] = await pool.query(
      `INSERT INTO clientes (nome, telefone, email, endereco, cidade)
       VALUES (?, ?, ?, ?, ?)`,
      [nomeLimpo, telefoneLimpo, email ? String(email).trim().toLowerCase() : null, endereco || null, cidade || null]
    );

    res.status(201).json({ id: resultado.insertId, mensagem: "Cliente cadastrado." });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ mensagem: "Erro ao cadastrar cliente." });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { nome, telefone, email, endereco, cidade } = req.body;
    if (!/^\d+$/.test(req.params.id) || Number(req.params.id) < 1) return res.status(400).json({ mensagem: "Identificador inválido." });
    const nomeLimpo = String(nome || "").trim(), telefoneLimpo = String(telefone || "").trim();
    if (!nomeLimpo || nomeLimpo.length > 120 || !telefoneLimpo || telefoneLimpo.length > 20) return res.status(400).json({ mensagem: "Informe nome (até 120 caracteres) e telefone válido (até 20 caracteres)." });
    if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email)) || String(email).length > 120)) return res.status(400).json({ mensagem: "E-mail inválido." });
    const [resultado] = await pool.query(
      `UPDATE clientes SET nome=?, telefone=?, email=?, endereco=?, cidade=?
       WHERE id=?`,
      [nomeLimpo, telefoneLimpo, email ? String(email).trim().toLowerCase() : null, endereco || null, cidade || null, req.params.id]
    );

    if (!resultado.affectedRows) {
      return res.status(404).json({ mensagem: "Cliente não encontrado." });
    }

    res.json({ mensagem: "Cliente atualizado." });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ mensagem: "Erro ao atualizar cliente." });
  }
});

router.delete("/:id", apenasAdmin, async (req, res) => {
  try {
    const [resultado] = await pool.query("DELETE FROM clientes WHERE id=?", [req.params.id]);

    if (!resultado.affectedRows) {
      return res.status(404).json({ mensagem: "Cliente não encontrado." });
    }

    res.json({ mensagem: "Cliente excluído." });
  } catch {
    res.status(409).json({ mensagem: "Este cliente possui pets vinculados." });
  }
});

module.exports = router;
