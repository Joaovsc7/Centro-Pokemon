const pool = require("../config/database");
async function aplicarMigracoes() {
  const [pokedexCol] = await pool.query("SHOW COLUMNS FROM pets LIKE 'pokedex_id'");
  if (!pokedexCol.length) await pool.query("ALTER TABLE pets ADD COLUMN pokedex_id INT NULL AFTER especie");
  const [spriteCol] = await pool.query("SHOW COLUMNS FROM pets LIKE 'sprite_url'");
  if (!spriteCol.length) await pool.query("ALTER TABLE pets ADD COLUMN sprite_url VARCHAR(500) NULL AFTER foto_url");
  const [cols] = await pool.query("SHOW COLUMNS FROM consultas LIKE 'duracao_minutos'");
  if (!cols.length) await pool.query("ALTER TABLE consultas ADD COLUMN duracao_minutos SMALLINT UNSIGNED NOT NULL DEFAULT 30 AFTER horario");
  const [indices] = await pool.query("SHOW INDEX FROM consultas WHERE Key_name = 'idx_consultas_vet_data_status'");
  if (!indices.length) await pool.query("CREATE INDEX idx_consultas_vet_data_status ON consultas (veterinario_id, data_consulta, status)");
  await pool.query(`CREATE TABLE IF NOT EXISTS prontuarios (
    id INT PRIMARY KEY AUTO_INCREMENT, pet_id INT NOT NULL, consulta_id INT NULL,
    usuario_id INT NULL, tipo VARCHAR(60) NOT NULL DEFAULT 'Evolução', titulo VARCHAR(160) NOT NULL,
    descricao TEXT NOT NULL, peso DECIMAL(6,2) NULL, criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_prontuario_pet_data (pet_id, criado_em),
    CONSTRAINT fk_prontuario_pet FOREIGN KEY (pet_id) REFERENCES pets(id),
    CONSTRAINT fk_prontuario_consulta FOREIGN KEY (consulta_id) REFERENCES consultas(id) ON DELETE SET NULL,
    CONSTRAINT fk_prontuario_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await pool.query(`CREATE TABLE IF NOT EXISTS vacinacoes (
    id INT PRIMARY KEY AUTO_INCREMENT, pet_id INT NOT NULL, vacina VARCHAR(120) NOT NULL,
    data_aplicacao DATE NOT NULL, proxima_dose DATE NULL, lote VARCHAR(80) NULL, observacoes TEXT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_vacina_pet_data (pet_id, data_aplicacao),
    CONSTRAINT fk_vacinacao_pet FOREIGN KEY (pet_id) REFERENCES pets(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}
module.exports = aplicarMigracoes;
