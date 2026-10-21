const express = require("express");
const pool = require("../config/database");
const { autenticar } = require("../middlewares/auth");

const router = express.Router();
router.use(autenticar);

router.get("/", async (_req, res) => {
  try {
    const [[clientes]] = await pool.query("SELECT COUNT(*) total FROM clientes");
    const [[pets]] = await pool.query("SELECT COUNT(*) total FROM pets");
    const [[veterinarios]] = await pool.query("SELECT COUNT(*) total FROM veterinarios");
    const [[hoje]] = await pool.query(
      "SELECT COUNT(*) total FROM consultas WHERE data_consulta=CURDATE() AND status <> 'Cancelada'"
    );

    const [proximas] = await pool.query(`
      SELECT co.*, p.nome pet_nome, v.nome veterinario_nome
      FROM consultas co
      INNER JOIN pets p ON p.id=co.pet_id
      INNER JOIN veterinarios v ON v.id=co.veterinario_id
      WHERE co.data_consulta >= CURDATE() AND co.status='Agendada'
      ORDER BY co.data_consulta, co.horario
      LIMIT 6
    `);

    const [porMes] = await pool.query(`
      SELECT DATE_FORMAT(data_consulta, '%Y-%m') mes, COUNT(*) total
      FROM consultas
      WHERE data_consulta >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH) AND status <> 'Cancelada'
      GROUP BY DATE_FORMAT(data_consulta, '%Y-%m')
      ORDER BY mes
    `);

    const [porEspecie] = await pool.query(`
      SELECT especie, COUNT(*) total
      FROM pets
      GROUP BY especie
      ORDER BY total DESC
      LIMIT 6
    `);

    // Dados individuais para agrupar o gráfico pelo tipo real da Pokédex.
    // O tipo é resolvido no frontend pela PokéAPI usando pokedex_id.
    const [pokemonsGrafico] = await pool.query(`
      SELECT id, nome, especie, pokedex_id
      FROM pets
      ORDER BY id
    `);

    res.json({
      totais: {
        clientes: clientes.total,
        pets: pets.total,
        veterinarios: veterinarios.total,
        consultasHoje: hoje.total
      },
      proximas,
      porMes,
      porEspecie,
      pokemonsGrafico
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ mensagem: "Erro ao carregar o painel." });
  }
});

module.exports = router;
