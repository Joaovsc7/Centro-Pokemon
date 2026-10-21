-- PetCare Modern / Centro Pokemon
-- Esquema sem dados de exemplo. Seguro para importar sobre um banco existente: nao apaga tabelas nem registros.
-- CREATE TABLE IF NOT EXISTS nao altera colunas de tabelas que ja existem; o backend aplica as migracoes suportadas.

CREATE DATABASE IF NOT EXISTS petcare_modern
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE petcare_modern;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  senha VARCHAR(255) NOT NULL,
  perfil ENUM('Administrador','Recepcionista') NOT NULL DEFAULT 'Recepcionista',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clientes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nome VARCHAR(120) NOT NULL,
  telefone VARCHAR(20) NOT NULL,
  email VARCHAR(120),
  endereco VARCHAR(200),
  cidade VARCHAR(100),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS veterinarios (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nome VARCHAR(120) NOT NULL,
  crmv VARCHAR(30) NOT NULL UNIQUE,
  especialidade VARCHAR(100),
  telefone VARCHAR(20),
  email VARCHAR(120),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nome VARCHAR(100) NOT NULL,
  especie VARCHAR(60) NOT NULL,
  raca VARCHAR(80),
  nascimento DATE,
  sexo ENUM('Macho','Fêmea'),
  peso DECIMAL(6,2),
  cor VARCHAR(60),
  observacoes TEXT,
  foto_url VARCHAR(500),
  cliente_id INT NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pet_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

CREATE TABLE IF NOT EXISTS consultas (
  id INT PRIMARY KEY AUTO_INCREMENT,
  pet_id INT NOT NULL,
  veterinario_id INT NOT NULL,
  data_consulta DATE NOT NULL,
  horario TIME NOT NULL,
  duracao_minutos SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  motivo VARCHAR(200) NOT NULL,
  status ENUM('Agendada','Concluída','Cancelada') DEFAULT 'Agendada',
  observacoes TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_consultas_vet_data_status (veterinario_id, data_consulta, status),
  CONSTRAINT fk_consulta_pet
    FOREIGN KEY (pet_id) REFERENCES pets(id),
  CONSTRAINT fk_consulta_veterinario
    FOREIGN KEY (veterinario_id) REFERENCES veterinarios(id)
);

CREATE TABLE IF NOT EXISTS prontuarios (
  id INT PRIMARY KEY AUTO_INCREMENT, pet_id INT NOT NULL, consulta_id INT NULL, usuario_id INT NULL,
  tipo VARCHAR(60) NOT NULL DEFAULT 'Evolução', titulo VARCHAR(160) NOT NULL, descricao TEXT NOT NULL,
  peso DECIMAL(6,2) NULL, criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_prontuario_pet_data (pet_id, criado_em),
  CONSTRAINT fk_prontuario_pet FOREIGN KEY (pet_id) REFERENCES pets(id),
  CONSTRAINT fk_prontuario_consulta FOREIGN KEY (consulta_id) REFERENCES consultas(id) ON DELETE SET NULL,
  CONSTRAINT fk_prontuario_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vacinacoes (
  id INT PRIMARY KEY AUTO_INCREMENT, pet_id INT NOT NULL, vacina VARCHAR(120) NOT NULL,
  data_aplicacao DATE NOT NULL, proxima_dose DATE NULL, lote VARCHAR(80) NULL, observacoes TEXT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_vacina_pet_data (pet_id, data_aplicacao),
  CONSTRAINT fk_vacinacao_pet FOREIGN KEY (pet_id) REFERENCES pets(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
