const express = require("express");
const pool = require("../config/database");
const { autenticar, apenasAdmin } = require("../middlewares/auth");

const router = express.Router();
router.use(autenticar);

router.get("/", async (_req, res) => {
  try {
    const [dados] = await pool.query(`
      SELECT p.*, c.nome AS cliente_nome,
             COUNT(co.id) AS total_consultas
      FROM pets p
      INNER JOIN clientes c ON c.id = p.cliente_id
      LEFT JOIN consultas co ON co.pet_id = p.id
      GROUP BY p.id
      ORDER BY p.nome
    `);
    res.json(dados);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ mensagem: "Erro ao listar pets." });
  }
});

router.get("/:id/historico", async (req, res) => {
  try {
    const [dados] = await pool.query(`
      SELECT co.*, v.nome AS veterinario_nome
      FROM consultas co
      INNER JOIN veterinarios v ON v.id = co.veterinario_id
      WHERE co.pet_id=?
      ORDER BY co.data_consulta DESC, co.horario DESC
    `, [req.params.id]);
    res.json(dados);
  } catch {
    res.status(500).json({ mensagem: "Erro ao carregar histórico." });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      nome, especie, pokedex_id, sprite_url, raca, nascimento, sexo, peso,
      cor, observacoes, foto_url, cliente_id
    } = req.body;

    const nomeLimpo = String(nome || "").trim();
    const especieLimpa = String(especie || "").trim();
    if (!nomeLimpo || nomeLimpo.length > 100 || !especieLimpa || especieLimpa.length > 60 || !Number.isInteger(Number(cliente_id)) || Number(cliente_id) < 1) {
      return res.status(400).json({ mensagem: "Nome (até 100 caracteres), espécie e treinador responsável válidos são obrigatórios." });
    }
    if (peso !== undefined && peso !== null && peso !== "" && (!Number.isFinite(Number(peso)) || Number(peso) <= 0 || Number(peso) > 999.99)) return res.status(400).json({ mensagem: "Peso deve ser maior que zero e menor que 1000 kg." });
    if (nascimento && !/^\d{4}-\d{2}-\d{2}$/.test(String(nascimento))) return res.status(400).json({ mensagem: "Data de nascimento inválida." });

    const [resultado] = await pool.query(
      `INSERT INTO pets
       (nome, especie, pokedex_id, sprite_url, raca, nascimento, sexo, peso, cor, observacoes, foto_url, cliente_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nomeLimpo, especieLimpa, pokedex_id ? Number(pokedex_id) : null, sprite_url || null, raca || null, nascimento || null, sexo || null,
        peso || null, cor || null, observacoes || null, foto_url || null, Number(cliente_id)
      ]
    );

    res.status(201).json({ id: resultado.insertId, mensagem: "Pet cadastrado." });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ mensagem: "Erro ao cadastrar pet." });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const {
      nome, especie, pokedex_id, sprite_url, raca, nascimento, sexo, peso,
      cor, observacoes, foto_url, cliente_id
    } = req.body;
    if (!/^\d+$/.test(req.params.id) || Number(req.params.id) < 1) return res.status(400).json({ mensagem: "Identificador inválido." });
    const nomeLimpo = String(nome || "").trim(), especieLimpa = String(especie || "").trim();
    if (!nomeLimpo || nomeLimpo.length > 100 || !especieLimpa || especieLimpa.length > 60 || !Number.isInteger(Number(cliente_id)) || Number(cliente_id) < 1) return res.status(400).json({ mensagem: "Nome, espécie e treinador responsável válidos são obrigatórios." });
    if (peso !== undefined && peso !== null && peso !== "" && (!Number.isFinite(Number(peso)) || Number(peso) <= 0 || Number(peso) > 999.99)) return res.status(400).json({ mensagem: "Peso deve ser maior que zero e menor que 1000 kg." });

    const [resultado] = await pool.query(
      `UPDATE pets SET
       nome=?, especie=?, pokedex_id=?, sprite_url=?, raca=?, nascimento=?, sexo=?, peso=?,
       cor=?, observacoes=?, foto_url=?, cliente_id=?
       WHERE id=?`,
      [
        nomeLimpo, especieLimpa, pokedex_id ? Number(pokedex_id) : null, sprite_url || null, raca || null, nascimento || null, sexo || null,
        peso || null, cor || null, observacoes || null, foto_url || null,
        Number(cliente_id), req.params.id
      ]
    );

    if (!resultado.affectedRows) {
      return res.status(404).json({ mensagem: "Pet não encontrado." });
    }

    res.json({ mensagem: "Pet atualizado." });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ mensagem: "Erro ao atualizar pet." });
  }
});

router.delete("/:id", apenasAdmin, async (req, res) => {
  try {
    const [resultado] = await pool.query("DELETE FROM pets WHERE id=?", [req.params.id]);

    if (!resultado.affectedRows) {
      return res.status(404).json({ mensagem: "Pet não encontrado." });
    }

    res.json({ mensagem: "Pet excluído." });
  } catch {
    res.status(409).json({ mensagem: "Este pet possui consultas vinculadas." });
  }
});

module.exports = router;
