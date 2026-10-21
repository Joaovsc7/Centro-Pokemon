const API = "/api";

function getToken() {
  return localStorage.getItem("petcare_token");
}

async function request(url, options = {}) {
  const headers = { ...(options.headers || {}) };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (getToken()) {
    headers.Authorization = `Bearer ${getToken()}`;
  }

  const resposta = await fetch(`${API}${url}`, { ...options, headers });
  const dados = await resposta.json().catch(() => ({}));

  if (resposta.status === 401) {
    // Credenciais inválidas no login devem ser mostradas no formulário,
    // não redirecionar de volta para a própria tela sem mensagem.
    if (url !== "/auth/login") {
      localStorage.removeItem("petcare_token");
      localStorage.removeItem("petcare_usuario");
      window.location.href = "/";
    }
    throw new Error(dados.mensagem || (url === "/auth/login" ? "E-mail ou senha inválidos." : "Sessão expirada."));
  }

  if (!resposta.ok) {
    throw new Error(dados.mensagem || "Erro na solicitação.");
  }

  return dados;
}
