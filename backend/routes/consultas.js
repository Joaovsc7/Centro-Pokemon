const express = require("express");
const pool = require("../config/database");
const { autenticar, apenasAdmin } = require("../middlewares/auth");
const router = express.Router();
router.use(autenticar);
const STATUS = new Set(["Agendada", "Concluída", "Cancelada"]);

function validar(payload) {
  const p = payload || {};
  const dataValida = valor => { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor || ""))) return false; const d = new Date(`${valor}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === valor; };
  const idOk = v => Number.isInteger(Number(v)) && Number(v) > 0;
  if (!idOk(p.pet_id) || !idOk(p.veterinario_id) || !dataValida(p.data_consulta) || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(String(p.horario || "")) || !String(p.motivo || "").trim()) {
    return "Informe Pokémon, veterinário, data, horário e motivo válidos.";
  }
  const duracao = p.duracao_minutos === undefined || p.duracao_minutos === "" ? 30 : Number(p.duracao_minutos);
  if (!Number.isInteger(duracao) || duracao < 10 || duracao > 240) return "A duração deve ficar entre 10 e 240 minutos.";
  const partesHorario = String(p.horario).split(":").map(Number);
  if ((partesHorario[0] * 60 + partesHorario[1] + duracao) > 1440) return "O atendimento precisa terminar antes da meia-noite.";
  if (p.status && !STATUS.has(p.status)) return "Status de atendimento inválido.";
  if (String(p.motivo).trim().length > 200) return "O motivo deve ter até 200 caracteres.";
  if (String(p.observacoes || "").length > 10000) return "As observações ultrapassam o limite permitido.";
  return null;
}

async function adquirirBloqueioAgenda(conn, veterinarioId, data) {
  const chave = `petcare_${Number(veterinarioId)}_${String(data).replace(/-/g, "")}`;
  const [[lock]] = await conn.query("SELECT GET_LOCK(?, 5) AS obtido", [chave]);
  if (Number(lock.obtido) !== 1) throw Object.assign(new Error("Não foi possível verificar a agenda agora. Tente novamente."), { statusCode: 503 });
  return chave;
}
async function checarConflito(conn, { veterinario_id, data_consulta, horario, duracao_minutos }, ignorarId = 0) {
  const [conflitos] = await conn.query(`
    SELECT id FROM consultas
    WHERE veterinario_id=? AND data_consulta=? AND status <> 'Cancelada' AND id <> ?
      AND TIMESTAMP(data_consulta, horario) < TIMESTAMP(?, ?) + INTERVAL ? MINUTE
      AND TIMESTAMP(data_consulta, horario) + INTERVAL duracao_minutos MINUTE > TIMESTAMP(?, ?)
    LIMIT 1`, [veterinario_id, data_consulta, ignorarId, data_consulta, horario, duracao_minutos, data_consulta, horario]);
  return conflitos.length > 0;
}

router.get("/", async (_req, res) => {
  try {
    const [dados] = await pool.query(`
      SELECT co.*, p.nome AS pet_nome, p.especie, c.nome AS cliente_nome, v.nome AS veterinario_nome
      FROM consultas co INNER JOIN pets p ON p.id=co.pet_id
      INNER JOIN clientes c ON c.id=p.cliente_id INNER JOIN veterinarios v ON v.id=co.veterinario_id
      ORDER BY co.data_consulta DESC, co.horario DESC`);
    res.json(dados);
  } catch (erro) { console.error(erro); res.status(500).json({ mensagem: "Erro ao listar atendimentos." }); }
});

router.post("/", async (req, res) => {
  const erroValidacao = validar(req.body);
  if (erroValidacao) return res.status(400).json({ mensagem: erroValidacao });
  const p = req.body, duracao = Number(p.duracao_minutos || 30);
  const conn = await pool.getConnection();
  let chaveAgenda;
  try {
    chaveAgenda = await adquirirBloqueioAgenda(conn, p.veterinario_id, p.data_consulta);
    const [[refs]] = await conn.query(`SELECT (SELECT COUNT(*) FROM pets WHERE id=?) pet_ok, (SELECT COUNT(*) FROM veterinarios WHERE id=?) vet_ok`, [p.pet_id, p.veterinario_id]);
    if (!Number(refs.pet_ok) || !Number(refs.vet_ok)) return res.status(400).json({ mensagem: "O Pokémon ou veterinário selecionado não existe." });
    if ((p.status || "Agendada") !== "Cancelada" && await checarConflito(conn, { ...p, duracao_minutos: duracao })) return res.status(409).json({ mensagem: "O veterinário já possui um atendimento sobreposto nesse intervalo." });
    const [r] = await conn.query(`INSERT INTO consultas (pet_id,veterinario_id,data_consulta,horario,duracao_minutos,motivo,status,observacoes) VALUES (?,?,?,?,?,?,?,?)`, [Number(p.pet_id), Number(p.veterinario_id), p.data_consulta, p.horario, duracao, String(p.motivo).trim(), p.status || "Agendada", String(p.observacoes || "").trim() || null]);
    res.status(201).json({ id: r.insertId, mensagem: "Atendimento agendado." });
  } catch (erro) { console.error(erro); res.status(erro.statusCode || 500).json({ mensagem: erro.statusCode ? erro.message : "Erro ao agendar atendimento." }); }
  finally { if (chaveAgenda) await conn.query("SELECT RELEASE_LOCK(?)", [chaveAgenda]).catch(() => {}); conn.release(); }
});

router.put("/:id", async (req, res) => {
  if (!/^\d+$/.test(req.params.id) || Number(req.params.id) < 1) return res.status(400).json({ mensagem: "Identificador inválido." });
  const erroValidacao = validar(req.body);
  if (erroValidacao) return res.status(400).json({ mensagem: erroValidacao });
  const p = req.body, duracao = Number(p.duracao_minutos || 30), id = Number(req.params.id);
  const conn = await pool.getConnection();
  let chaveAgenda;
  try {
    chaveAgenda = await adquirirBloqueioAgenda(conn, p.veterinario_id, p.data_consulta);
    const [[existe]] = await conn.query("SELECT id FROM consultas WHERE id=?", [id]);
    if (!existe) return res.status(404).json({ mensagem: "Atendimento não encontrado." });
    const [[refs]] = await conn.query(`SELECT (SELECT COUNT(*) FROM pets WHERE id=?) pet_ok, (SELECT COUNT(*) FROM veterinarios WHERE id=?) vet_ok`, [p.pet_id, p.veterinario_id]);
    if (!Number(refs.pet_ok) || !Number(refs.vet_ok)) return res.status(400).json({ mensagem: "O Pokémon ou veterinário selecionado não existe." });
    if ((p.status || "Agendada") !== "Cancelada" && await checarConflito(conn, { ...p, duracao_minutos: duracao }, id)) return res.status(409).json({ mensagem: "O veterinário já possui outro atendimento sobreposto nesse intervalo." });
    await conn.query(`UPDATE consultas SET pet_id=?,veterinario_id=?,data_consulta=?,horario=?,duracao_minutos=?,motivo=?,status=?,observacoes=? WHERE id=?`, [Number(p.pet_id), Number(p.veterinario_id), p.data_consulta, p.horario, duracao, String(p.motivo).trim(), p.status || "Agendada", String(p.observacoes || "").trim() || null, id]);
    res.json({ mensagem: "Atendimento atualizado." });
  } catch (erro) { console.error(erro); res.status(erro.statusCode || 500).json({ mensagem: erro.statusCode ? erro.message : "Erro ao atualizar atendimento." }); }
  finally { if (chaveAgenda) await conn.query("SELECT RELEASE_LOCK(?)", [chaveAgenda]).catch(() => {}); conn.release(); }
});

router.delete("/:id", apenasAdmin, async (req, res) => {
  try {
    const [r] = await pool.query("DELETE FROM consultas WHERE id=?", [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ mensagem: "Atendimento não encontrado." });
    res.json({ mensagem: "Atendimento excluído." });
  } catch (erro) { console.error(erro); res.status(500).json({ mensagem: "Erro ao excluir atendimento." }); }
});
module.exports = router;
