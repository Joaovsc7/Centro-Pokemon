if (getToken()) {
  window.location.href = "/dashboard.html";
}

const form = document.querySelector("#login-form");
const mensagem = document.querySelector("#login-message");
const senha = document.querySelector("#senha");
const botaoSenha = document.querySelector("#mostrar-senha");

const ICONE_OLHO_ABERTO = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
const ICONE_OLHO_FECHADO = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.6 8.5 2 12 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.8-.8"/><path d="M9.5 9.8a3 3 0 0 0 4.2 4.2"/></svg>';

botaoSenha.addEventListener("click", () => {
  senha.type = senha.type === "password" ? "text" : "password";
  botaoSenha.innerHTML = senha.type === "password" ? ICONE_OLHO_ABERTO : ICONE_OLHO_FECHADO;
});

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mensagem.textContent = "";

  const botao = form.querySelector("button[type=submit]");
  const textoOriginal = botao.innerHTML;
  botao.disabled = true;
  botao.innerHTML = "<span>Entrando...</span>";

  try {
    const dados = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: form.email.value.trim(),
        senha: form.senha.value
      })
    });

    localStorage.setItem("petcare_token", dados.token);
    localStorage.setItem("petcare_usuario", JSON.stringify(dados.usuario));
    window.location.href = "/dashboard.html";
  } catch (erro) {
    mensagem.textContent = erro.message;
  } finally {
    botao.disabled = false;
    botao.innerHTML = textoOriginal;
  }
});
