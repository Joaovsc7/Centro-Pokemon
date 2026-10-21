# PetCare Modern — Centro Pokémon

Sistema didático de gestão de treinadores, Pokémon, equipe clínica e atendimentos, com tema inspirado no Centro Pokémon.

## Recursos
- Dashboard com indicadores e gráficos baseados nos dados reais.
- Cadastro, edição, pesquisa, filtros e paginação de treinadores, Pokémon, equipe e atendimentos.
- Calendário mensal e histórico por Pokémon.
- Duração de atendimento configurável e bloqueio de horários sobrepostos do mesmo veterinário.
- Exportação CSV dos atendimentos.
- APIs para prontuário e vacinação, com alertas de próximas doses via API.
- Login JWT, senha com bcrypt, limite de tentativas de login e permissões de exclusão.
- Tema claro/escuro, layout responsivo e avatar local do Ash.

## Instalação no Windows com XAMPP
1. Inicie MySQL no XAMPP. Apache é necessário apenas para phpMyAdmin.
2. Abra `http://localhost/phpmyadmin` e, se precisar criar a estrutura inicial, importe `database/petcare_modern.sql`. O arquivo não apaga tabelas nem insere registros de exemplo. Em um banco que já possui as sete tabelas, não é necessário importá-lo novamente; o backend aplica as migrações previstas ao iniciar.
3. Copie `.env.example` para `.env` e preencha a configuração do banco. Gere uma chave JWT aleatória com pelo menos 32 caracteres (por exemplo, no terminal: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) e defina senhas fortes (mínimo 12 caracteres) para os usuários iniciais. Não compartilhe o `.env`.
4. No terminal, dentro da pasta `petcare-modern`, execute:
   ```bash
   npm install
   npm start
   ```
5. Abra `http://localhost:3000`.

## Configuração do `.env`
Exemplo para XAMPP local com usuário `root` sem senha (ajuste conforme seu ambiente):
```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=petcare_modern
JWT_SECRET=COLOQUE_UMA_CHAVE_LONGA_E_ALEATORIA_AQUI
BOOTSTRAP_ADMIN_PASSWORD=DEFINA_UMA_SENHA_FORTE
BOOTSTRAP_RECEPTION_PASSWORD=DEFINA_UMA_SENHA_FORTE
BOOTSTRAP_ADMIN_EMAIL=admin@petcare.com
BOOTSTRAP_RECEPTION_EMAIL=recepcao@petcare.com
```

A primeira inicialização cria os usuários somente se a tabela `usuarios` estiver vazia. Os e-mails padrão são `admin@petcare.com` e `recepcao@petcare.com`; as senhas são as que você definiu no `.env`. Se o banco já tiver usuários, eles são preservados.

## APIs adicionais
- `GET /api/prontuarios/pet/:petId` e `POST /api/prontuarios`
- `GET /api/vacinacoes/pet/:petId`, `GET /api/vacinacoes/pendentes`, `POST /api/vacinacoes`
- `DELETE /api/vacinacoes/:id` (administrador)

Todas exigem token JWT. O perfil de cada Pokémon possui ações para abrir o prontuário e administrar vacinações; próximas doses em até 30 dias aparecem como alerta dentro da tela de vacinação.

## Migrações e dados
Ao iniciar, o backend acrescenta a coluna `duracao_minutos` se ela não existir e cria as tabelas de prontuário e vacinação. Recomenda-se backup antes de atualizar bancos com dados importantes. O SQL não inclui registros de exemplo e não contém comandos DROP. CREATE TABLE IF NOT EXISTS preserva tabelas existentes, mas não modifica colunas de tabelas já criadas; as migrações automáticas do backend cobrem apenas as alterações descritas acima.

## Segurança e limites
- Não publique `.env`, senhas, tokens nem dados reais de pacientes.
- Em produção, configure CORS para a origem permitida e use HTTPS.
- O limite de tentativas de login é mantido em memória; para implantação com múltiplas instâncias, use armazenamento compartilhado.
- O sistema é didático e não substitui avaliação profissional de segurança ou conformidade com regras de privacidade.
