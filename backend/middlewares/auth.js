const jwt = require("jsonwebtoken");

function autenticar(req, res, next) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    return res.status(503).json({ mensagem: "O sistema não está configurado com uma chave JWT segura." });
  }
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ mensagem: "Sessão não encontrada." });
  }

  try {
    req.usuario = jwt.verify(
      header.split(" ")[1],
      process.env.JWT_SECRET
    );
    next();
  } catch {
    return res.status(401).json({ mensagem: "Sessão expirada. Entre novamente." });
  }
}

function apenasAdmin(req, res, next) {
  if (req.usuario?.perfil !== "Administrador") {
    return res.status(403).json({
      mensagem: "Somente administradores podem realizar esta ação."
    });
  }
  next();
}

module.exports = { autenticar, apenasAdmin };
