const bcrypt = require("bcryptjs");
const pool = require("../config/database");

async function prepararUsuarios() {
  const [tabelas] = await pool.query("SHOW TABLES LIKE 'usuarios'");
  if (!tabelas.length) return;
  const [[contagem]] = await pool.query("SELECT COUNT(*) AS total FROM usuarios");
  if (Number(contagem.total) > 0) return;

  const adminSenha = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const recepcaoSenha = process.env.BOOTSTRAP_RECEPTION_PASSWORD;
  if (!adminSenha || adminSenha.length < 12 || !recepcaoSenha || recepcaoSenha.length < 12) {
    console.warn("[AVISO] Nenhum usuário existe. Defina BOOTSTRAP_ADMIN_PASSWORD e BOOTSTRAP_RECEPTION_PASSWORD (mínimo 12 caracteres) no .env e reinicie.");
    return;
  }

  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();
    const [existentes] = await conexao.query("SELECT id FROM usuarios LIMIT 1 FOR UPDATE");
    if (!existentes.length) {
      await conexao.query("INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)", [
        "Administrador", process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@petcare.com", await bcrypt.hash(adminSenha, 12), "Administrador"
      ]);
      await conexao.query("INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)", [
        "Recepção", process.env.BOOTSTRAP_RECEPTION_EMAIL || "recepcao@petcare.com", await bcrypt.hash(recepcaoSenha, 12), "Recepcionista"
      ]);
      console.log("[OK] Usuários iniciais criados com senhas definidas no .env.");
    }
    await conexao.commit();
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
}
module.exports = prepararUsuarios;
