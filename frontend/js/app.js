if (!getToken()) window.location.href = "/";

const usuario = JSON.parse(localStorage.getItem("petcare_usuario") || "{}");
const state = {
  clientes: [], pets: [], veterinarios: [], consultas: [],
  dashboard: null,
  page: { clientes: 1, pets: 1, veterinarios: 1, consultas: 1 },
  perPage: 6,
  calendarDate: new Date(),
  agendamentoRascunho: null,
  pokemonRascunho: null,
  cadastroTreinadorParaPokemon: false
};

const sectionTitles = {
  dashboard: "Visão geral",
  clientes: "Treinadores",
  pets: "Pokémon",
  veterinarios: "Equipe",
  consultas: "Atendimentos",
  calendario: "Calendário",
  pokedex: "Pokédex"
};

document.documentElement.dataset.theme =
  localStorage.getItem("petcare_theme") || "light";

setupLayout();
carregarTudo();
inicializarPokedex();

function setupLayout() {
  document.querySelector("#sidebar-name").textContent = usuario.nome || "Usuário";
  document.querySelector("#sidebar-role").textContent = usuario.perfil || "Perfil";
  // O avatar do Ash é um arquivo local do projeto; não substitua a imagem pela inicial do usuário.
  const sidebarAvatar = document.querySelector("#sidebar-avatar");
  if (sidebarAvatar && !sidebarAvatar.querySelector("img")) {
    sidebarAvatar.innerHTML = '<img src="assets/images/avatar-ash.png" alt="Ash Ketchum" title="Ash Ketchum">';
  }

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  // O banner do Centro Pokémon é uma imagem pronta e não possui #welcome-title.
  // Atualiza a saudação apenas se o elemento existir, evitando interromper a inicialização do menu.
  const welcomeTitle = document.querySelector("#welcome-title");
  if (welcomeTitle) {
    welcomeTitle.textContent = `${saudacao}, ${(usuario.nome || "usuário").split(" ")[0]}!`;
  }

  document.querySelectorAll("[data-section]").forEach(btn => {
    btn.addEventListener("click", () => trocarSecao(btn.dataset.section));
  });

  document.querySelectorAll("[data-go]").forEach(btn => {
    btn.addEventListener("click", () => trocarSecao(btn.dataset.go));
    // Os cards do dashboard também são navegáveis pelo teclado.
    if (btn.getAttribute("role") === "link") {
      btn.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          trocarSecao(btn.dataset.go);
        }
      });
    }
  });

  document.querySelector("#mobile-menu").onclick = abrirSidebar;
  document.querySelector("#sidebar-close").onclick = fecharSidebar;
  document.querySelector("#mobile-overlay").onclick = fecharSidebar;
  document.querySelector("#logout").onclick = () => {
    localStorage.removeItem("petcare_token");
    localStorage.removeItem("petcare_usuario");
    window.location.href = "/";
  };

  document.querySelector("#theme-toggle").onclick = alternarTema;
  document.querySelector("#quick-new").onclick = () => abrirConsulta();

  document.querySelector("#busca-clientes").addEventListener("input", () => resetRender("clientes"));
  document.querySelector("#limpar-busca-treinadores").addEventListener("click", () => { document.querySelector("#busca-clientes").value = ""; document.querySelector("#global-search").value = ""; resetRender("clientes"); });
  document.querySelector("#busca-pets").addEventListener("input", () => resetRender("pets"));
  document.querySelector("#busca-veterinarios").addEventListener("input", () => resetRender("veterinarios"));
  document.querySelector("#filtro-especialidade-equipe").addEventListener("change", () => resetRender("veterinarios"));
  document.querySelector("#limpar-filtro-equipe").addEventListener("click", () => {
    document.querySelector("#busca-veterinarios").value = "";
    document.querySelector("#filtro-especialidade-equipe").value = "";
    resetRender("veterinarios");
  });
  document.querySelector("#busca-consultas").addEventListener("input", () => resetRender("consultas"));
  document.querySelector("#filtro-especie").addEventListener("change", () => resetRender("pets"));
  document.querySelector("#filtro-status").addEventListener("change", () => resetRender("consultas"));
  document.querySelector("#filtro-periodo").addEventListener("change", () => resetRender("consultas"));

  document.querySelector("#pokedex-search-button").addEventListener("click", pesquisarPokedex);
  document.querySelector("#pokedex-search-input").addEventListener("keydown", event => {
    if (event.key === "Enter") pesquisarPokedex();
  });
  document.querySelector("#pokedex-prev").addEventListener("click", () => carregarPaginaPokedex(Math.max(0, pokedexOffset - 24)));
  document.querySelector("#pokedex-next").addEventListener("click", () => carregarPaginaPokedex(pokedexOffset + 24));
  document.querySelector("#pokedex-type-filter").addEventListener("change", () => carregarPaginaPokedex(0));

  document.querySelector("#global-search").addEventListener("input", e => {
    const ativa = document.querySelector(".page-section.active")?.id;
    const mapa = {
      clientes: "#busca-clientes",
      pets: "#busca-pets",
      veterinarios: "#busca-veterinarios",
      consultas: "#busca-consultas"
    };
    if (mapa[ativa]) {
      document.querySelector(mapa[ativa]).value = e.target.value;
      resetRender(ativa);
    } else if (ativa === "dashboard" && e.target.value.trim().length >= 2) {
      const termo = e.target.value.trim().toLocaleLowerCase("pt-BR");
      const destinos = [
        ["clientes", state.clientes.some(x => `${x.nome} ${x.telefone} ${x.email||""}`.toLocaleLowerCase("pt-BR").includes(termo))],
        ["pets", state.pets.some(x => `${x.nome} ${x.especie} ${x.cliente_nome}`.toLocaleLowerCase("pt-BR").includes(termo))],
        ["veterinarios", state.veterinarios.some(x => `${x.nome} ${x.especialidade||""}`.toLocaleLowerCase("pt-BR").includes(termo))],
        ["consultas", state.consultas.some(x => `${x.pet_nome} ${x.cliente_nome} ${x.veterinario_nome} ${x.motivo}`.toLocaleLowerCase("pt-BR").includes(termo))]
      ];
      const destino = destinos.find(x => x[1]);
      if (destino) { const valor = e.target.value; trocarSecao(destino[0]); document.querySelector(mapa[destino[0]]).value = valor; resetRender(destino[0]); }
    }
  });

  document.querySelector("#prev-month").onclick = () => {
    state.calendarDate.setMonth(state.calendarDate.getMonth() - 1);
    renderCalendario();
  };
  document.querySelector("#next-month").onclick = () => {
    state.calendarDate.setMonth(state.calendarDate.getMonth() + 1);
    renderCalendario();
  };
}

async function carregarTudo() {
  try {
    const [dashboard, clientes, pets, veterinarios, consultas] = await Promise.all([
      request("/dashboard"), request("/clientes"), request("/pets"),
      request("/veterinarios"), request("/consultas")
    ]);

    Object.assign(state, { dashboard, clientes, pets, veterinarios, consultas });

    popularEspecies();
    renderDashboard();
    renderClientes();
    renderPets();
    renderVeterinarios();
    renderConsultas();
    renderCalendario();
  } catch (erro) {
    toast(erro.message, "error");
  }
}

function trocarSecao(id) {
  document.querySelectorAll(".page-section").forEach(s => s.classList.remove("active"));
  document.querySelector(`#${id}`)?.classList.add("active");

  document.querySelectorAll("[data-section]").forEach(b =>
    b.classList.toggle("active", b.dataset.section === id)
  );

  document.querySelector("#page-title").textContent = sectionTitles[id] || "Visão geral";
  document.querySelector("#breadcrumb-page").textContent = sectionTitles[id] || "Visão geral";
  const buscaGlobal = document.querySelector("#global-search");
  const placeholders = { dashboard: "Pesquise uma seção para navegar", clientes: "Pesquisar treinadores", pets: "Pesquisar Pokémon", veterinarios: "Pesquisar equipe", consultas: "Pesquisar atendimentos", calendario: "Pesquisar atendimentos", pokedex: "Pesquisar na Pokédex" };
  buscaGlobal.placeholder = placeholders[id] || "Pesquisar";
  document.querySelector("#global-search").value = "";
  fecharSidebar();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function abrirSidebar() {
  document.querySelector("#sidebar").classList.add("open");
  document.querySelector("#mobile-overlay").classList.add("open");
}
function fecharSidebar() {
  document.querySelector("#sidebar").classList.remove("open");
  document.querySelector("#mobile-overlay").classList.remove("open");
}

function alternarTema() {
  const novo = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = novo;
  localStorage.setItem("petcare_theme", novo);
  renderDashboard();
}

function renderDashboard() {
  const d = state.dashboard;
  if (!d) return;

  document.querySelector("#total-clientes").textContent = d.totais.clientes;
  document.querySelector("#total-pets").textContent = d.totais.pets;
  document.querySelector("#total-veterinarios").textContent = d.totais.veterinarios;
  document.querySelector("#total-consultas-hoje").textContent = d.totais.consultasHoje;

  document.querySelector("#upcoming-list").innerHTML = d.proximas.length
    ? d.proximas.map(c => {
        const dt = new Date(`${c.data_consulta}T12:00:00`);
        return `
          <div class="appointment-item">
            <div class="date-box">
              <strong>${String(dt.getDate()).padStart(2, "0")}</strong>
              <small>${dt.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</small>
            </div>
            <div class="appointment-main">
              <strong>${esc(c.pet_nome)} — ${c.horario.slice(0,5)}</strong>
              <span>${esc(c.veterinario_nome)} · ${esc(c.motivo)}</span>
            </div>
            <span class="status status-${slug(c.status)}">${esc(c.status)}</span>
          </div>`;
      }).join("")
    : vazio("Nenhum atendimento futuro encontrado.");

  requestAnimationFrame(() => {
    drawBarChart("monthly-chart", d.porMes.map(x => ({
      label: formatarMes(x.mes), value: Number(x.total)
    })));
  });

  renderizarGraficoTiposPokemon(d);
}

const cacheTiposPokemon = new Map();

async function obterTipoPokemon(pokemon) {
  const id = Number(pokemon.pokedex_id);
  if (!id) return null; // Registros antigos sem vínculo com a Pokédex.
  if (cacheTiposPokemon.has(id)) return cacheTiposPokemon.get(id);

  try {
    const resposta = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    if (!resposta.ok) throw new Error("Pokémon não encontrado na PokéAPI");
    const dados = await resposta.json();
    const tipo = dados.types?.[0]?.type?.name;
    const tiposPt = {
      normal: "Normal", fire: "Fogo", water: "Água", electric: "Elétrico",
      grass: "Planta", ice: "Gelo", fighting: "Lutador", poison: "Veneno",
      ground: "Terra", flying: "Voador", psychic: "Psíquico", bug: "Inseto",
      rock: "Pedra", ghost: "Fantasma", dragon: "Dragão", dark: "Sombrio",
      steel: "Aço", fairy: "Fada"
    };
    const traduzido = tiposPt[tipo] || tipo;
    cacheTiposPokemon.set(id, traduzido || null);
    return traduzido || null;
  } catch (erro) {
    console.warn("Não foi possível consultar o tipo do Pokémon:", pokemon.nome, erro);
    return null;
  }
}

async function renderizarGraficoTiposPokemon(dashboard) {
  const pokemons = dashboard.pokemonsGrafico || [];
  if (!pokemons.length) {
    drawDonutChart("species-chart", dashboard.porEspecie.map(x => ({
      label: x.especie, value: Number(x.total)
    })));
    return;
  }

  const resultados = await Promise.all(pokemons.map(async pokemon => ({
    pokemon,
    tipo: await obterTipoPokemon(pokemon)
  })));

  const contagem = new Map();
  resultados.forEach(({ pokemon, tipo }) => {
    // Se for um registro antigo sem pokedex_id ou a API falhar, mantém uma
    // categoria identificável em vez de ocultar esse Pokémon do total.
    const categoria = tipo || "Tipo não identificado";
    contagem.set(categoria, (contagem.get(categoria) || 0) + 1);
  });

  const dados = [...contagem.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  drawDonutChart("species-chart", dados);
}

function renderClientes() {
  const busca = document.querySelector("#busca-clientes");
  const termo = (busca?.value || "").toLocaleLowerCase("pt-BR");
  const dados = state.clientes.filter(c =>
    `${c.nome} ${c.telefone} ${c.email || ""} ${c.cidade || ""}`.toLocaleLowerCase("pt-BR").includes(termo)
  );
  const pag = paginar(dados, "clientes");
  const totalPets = state.pets.length;
  const totalConsultas = state.consultas.length;
  const regioes = new Set(state.clientes.map(c => c.cidade).filter(Boolean));
  const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  setText("trainer-total", state.clientes.length);
  setText("trainer-pokemon-total", totalPets);
  setText("trainer-region-total", regioes.size);
  setText("trainer-appointments-total", totalConsultas);
  setText("trainer-result-count", `${dados.length} ${dados.length === 1 ? "treinador" : "treinadores"}`);

  document.querySelector("#lista-clientes").innerHTML = pag.items.length
    ? pag.items.map((c, i) => {
      const petsDoTreinador = state.pets.filter(p => Number(p.cliente_id) === Number(c.id));
      const consultasDoTreinador = state.consultas.filter(co => Number(co.cliente_id || co.treinador_id) === Number(c.id));
      return `
      <article class="doctor-card team-doctor-card trainer-card">
        <div class="team-doctor-top">
          <div class="doctor-avatar team-avatar team-avatar-${i % 4}">${iniciais(c.nome)}</div>
          <div class="team-doctor-main"><h3>${esc(c.nome)}</h3><p>Treinador Pokémon</p><span class="team-license">${esc(c.cidade || "Região não informada")}</span></div>
          <span class="team-consult-count">${petsDoTreinador.length} Pokémon</span>
        </div>
        <div class="team-doctor-contact">
          <span><b>☎</b>${esc(c.telefone || "Telefone não informado")}</span>
          <span><b>✉</b>${esc(c.email || "E-mail não informado")}</span>
        </div>
        <div class="team-specialty-tags"><span>◉ ${petsDoTreinador.length} Pokémon cadastrado(s)</span><span>Centro Pokémon</span></div>
        <div class="team-card-actions">
          <button class="btn btn-primary" type="button" onclick="alternarPerfilTreinador(${c.id})">Ver perfil</button>
          <button class="btn btn-light" type="button" onclick='abrirCliente(${jsonAttr(c)})'>Editar</button>
          ${adminDelete("clientes", c.id)}
        </div>
        <div class="team-profile-details" id="perfil-treinador-${c.id}" hidden>
          <h4>Ficha do treinador</h4>
          <dl><div><dt>Telefone</dt><dd>${esc(c.telefone || "Não informado")}</dd></div><div><dt>E-mail</dt><dd>${esc(c.email || "Não informado")}</dd></div><div><dt>Região</dt><dd>${esc(c.cidade || "Não informada")}</dd></div><div><dt>Pokémon registrados</dt><dd>${petsDoTreinador.length}</dd></div><div><dt>Atendimentos vinculados</dt><dd>${consultasDoTreinador.length}</dd></div></dl>
          ${petsDoTreinador.length ? `<div class="trainer-pokemon-list"><strong>Pokémon deste treinador</strong><div>${petsDoTreinador.map(p => `<span>${p.sprite_url ? `<img src="${escAttr(p.sprite_url)}" alt="" loading="lazy">` : `<b>◉</b>`}<span>${esc(p.nome)}<small>${esc(p.especie || "Pokémon")}</small></span></span>`).join("")}</div></div>` : `<p class="trainer-no-pokemon">Este treinador ainda não possui Pokémon cadastrados.</p>`}
        </div>
      </article>`;
    }).join("")
    : `<div class="trainer-empty">Nenhum treinador corresponde à pesquisa.</div>`;
  renderPaginacao("clientes", pag.totalPages);
}

function alternarPerfilTreinador(id) {
  const painel = document.querySelector(`#perfil-treinador-${Number(id)}`);
  if (!painel) return;
  const abrir = painel.hidden;
  document.querySelectorAll('[id^="perfil-treinador-"]').forEach(el => { el.hidden = true; });
  painel.hidden = !abrir;
  if (abrir) painel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderPets() {
  const termo = document.querySelector("#busca-pets").value.toLowerCase();
  const especie = document.querySelector("#filtro-especie").value;
  const dados = state.pets.filter(p =>
    (!especie || p.especie === especie) &&
    `${p.nome} ${p.especie} ${p.raca || ""} ${p.cliente_nome}`.toLowerCase().includes(termo)
  );
  const stats = document.querySelector("#pokemon-collection-stats");
  if (stats) {
    const especies = new Set(state.pets.map(p => String(p.especie || "").toLowerCase()).filter(Boolean));
    const treinadores = new Set(state.pets.map(p => Number(p.cliente_id)).filter(Boolean));
    const consultas = state.pets.reduce((total, p) => total + Number(p.total_consultas || 0), 0);
    stats.innerHTML = `
      <article class="pokemon-stat-card"><span class="pokemon-stat-icon">◉</span><div><small>Pokémon cadastrados</small><strong>${state.pets.length}</strong><em>Registros individuais</em></div></article>
      <article class="pokemon-stat-card"><span class="pokemon-stat-icon purple">✦</span><div><small>Espécies diferentes</small><strong>${especies.size}</strong><em>Na coleção</em></div></article>
      <article class="pokemon-stat-card"><span class="pokemon-stat-icon pink">♙</span><div><small>Treinadores atendidos</small><strong>${treinadores.size}</strong><em>Com Pokémon cadastrados</em></div></article>
      <article class="pokemon-stat-card"><span class="pokemon-stat-icon blue">▦</span><div><small>Consultas realizadas</small><strong>${consultas}</strong><em>Somatório dos registros</em></div></article>`;
  }
  const pag = paginar(dados, "pets");
  document.querySelector("#lista-pets").innerHTML = pag.items.length
    ? pag.items.map(p => `
      <article class="pet-card pokemon-collection-card" role="button" tabindex="0" aria-label="Abrir ficha de ${escAttr(p.nome)}" onclick="abrirFichaPokemon(${p.id})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();abrirFichaPokemon(${p.id})}">
        <button class="pokemon-card-menu" type="button" title="Editar Pokémon" onclick="event.stopPropagation();abrirPet(${jsonAttr(p)})">⋮</button>
        <div class="pokemon-card-art"><div class="pet-photo">${petVisual(p)}</div>${p.pokedex_id ? `<span class="pokemon-number">Nº ${String(p.pokedex_id).padStart(3,"0")}</span>` : ""}</div>
        <div class="pokemon-card-identity"><h3>${esc(p.nome)}</h3><p>${esc(p.especie)}${p.raca ? ` · ${esc(p.raca)}` : ""}</p></div>
        <div class="pokemon-card-tags"><span class="pokemon-species-tag">${esc(p.especie)}</span>${p.sexo ? `<span class="pokemon-sex-tag">${esc(p.sexo)}</span>` : ""}</div>
        <div class="pokemon-card-trainer"><span class="trainer-mini-avatar">${esc((p.cliente_nome||"T").slice(0,1).toUpperCase())}</span><div><small>Treinador</small><strong>${esc(p.cliente_nome || "Não informado")}</strong></div></div>
        <div class="pokemon-card-footer"><span>${Number(p.total_consultas || 0)} consulta(s)</span><span class="pokemon-open-link">Ver ficha <b>→</b></span></div>
      </article>`).join("")
    : vazio("Nenhum Pokémon encontrado.");
  renderPaginacao("pets", pag.totalPages);
}

function renderVeterinarios() {
  const busca = document.querySelector("#busca-veterinarios");
  const filtro = document.querySelector("#filtro-especialidade-equipe");
  const termo = (busca?.value || "").toLocaleLowerCase("pt-BR");
  const especialidades = [...new Set(state.veterinarios.map(v => (v.especialidade || "Clínica geral").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  if (filtro) {
    const atual = filtro.value;
    filtro.innerHTML = '<option value="">Todas</option>' + especialidades.map(e => `<option value="${escAttr(e)}">${esc(e)}</option>`).join("");
    filtro.value = especialidades.includes(atual) ? atual : "";
  }
  const especialidadeSelecionada = filtro?.value || "";
  const dados = state.veterinarios.filter(v => {
    const especialidade = v.especialidade || "Clínica geral";
    return (!especialidadeSelecionada || especialidade === especialidadeSelecionada) &&
      `${v.nome} ${v.crmv} ${especialidade} ${v.email || ""} ${v.telefone || ""}`.toLocaleLowerCase("pt-BR").includes(termo);
  });
  const pag = paginar(dados, "veterinarios");

  const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  setText("team-total", state.veterinarios.length);
  setText("team-consultas", state.veterinarios.reduce((total, v) => total + Number(v.total_consultas || 0), 0));
  setText("team-especialidades", especialidades.length);
  setText("team-agendados", state.consultas.filter(c => c.status === "Agendada").length);
  setText("team-result-count", `${dados.length} ${dados.length === 1 ? "integrante" : "integrantes"}`);

  document.querySelector("#lista-veterinarios").innerHTML = pag.items.length
    ? pag.items.map((v, i) => `
      <article class="doctor-card team-doctor-card">
        <div class="team-doctor-top">
          <div class="doctor-avatar team-avatar team-avatar-${i % 4}">${iniciais(v.nome)}</div>
          <div class="team-doctor-main"><h3>${esc(v.nome)}</h3><p>${esc(v.especialidade || "Clínica geral")}</p><span class="team-license">${esc(v.crmv || "Registro não informado")}</span></div>
          <span class="team-consult-count">${Number(v.total_consultas || 0)} ${Number(v.total_consultas || 0) === 1 ? "consulta" : "consultas"}</span>
        </div>
        <div class="team-doctor-contact">
          <span><b>☎</b>${esc(v.telefone || "Telefone não informado")}</span>
          <span><b>✉</b>${esc(v.email || "E-mail não informado")}</span>
        </div>
        <div class="team-specialty-tags"><span>✦ ${esc(v.especialidade || "Clínica geral")}</span><span>Centro Pokémon</span></div>
        <div class="team-card-actions">
          <button class="btn btn-primary" type="button" onclick="alternarPerfilEquipe(${v.id})">Ver perfil</button>
          <button class="btn btn-light" type="button" onclick='abrirVeterinario(${jsonAttr(v)})'>Editar</button>
          ${usuario.perfil === "Administrador" ? `<button class="btn btn-danger" type="button" onclick="excluirItem('veterinarios',${v.id})">Excluir</button>` : ""}
        </div>
        <div class="team-profile-details" id="perfil-equipe-${v.id}" hidden>
          <h4>Ficha profissional</h4>
          <dl><div><dt>Registro profissional</dt><dd>${esc(v.crmv || "Não informado")}</dd></div><div><dt>Telefone</dt><dd>${esc(v.telefone || "Não informado")}</dd></div><div><dt>E-mail</dt><dd>${esc(v.email || "Não informado")}</dd></div><div><dt>Especialidade principal</dt><dd>${esc(v.especialidade || "Clínica geral")}</dd></div><div><dt>Atendimentos vinculados</dt><dd>${Number(v.total_consultas || 0)}</dd></div></dl>
        </div>
      </article>`).join("")
    : vazio("Nenhum integrante corresponde aos filtros selecionados.");

  renderPaginacao("veterinarios", pag.totalPages);
}

function alternarPerfilEquipe(id) {
  const painel = document.querySelector(`#perfil-equipe-${Number(id)}`);
  if (!painel) return;
  const abrir = painel.hidden;
  document.querySelectorAll(".team-profile-details").forEach(el => { el.hidden = true; });
  painel.hidden = !abrir;
  if (abrir) painel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderConsultas() {
  const termo = document.querySelector("#busca-consultas").value.toLocaleLowerCase("pt-BR");
  const status = document.querySelector("#filtro-status").value;
  const periodo = document.querySelector("#filtro-periodo")?.value || "all";
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataLimite = new Date(hoje);
  if (periodo !== "all" && periodo !== "today") dataLimite.setDate(dataLimite.getDate() - (Number(periodo) - 1));
  const total = state.consultas.length;
  const contar = valor => state.consultas.filter(c => String(c.status || "").toLocaleLowerCase("pt-BR") === valor).length;
  document.querySelector("#appointment-total").textContent = total;
  document.querySelector("#appointment-scheduled").textContent = contar("agendada");
  document.querySelector("#appointment-done").textContent = contar("concluída") + contar("concluida");
  document.querySelector("#appointment-cancelled").textContent = contar("cancelada");

  const dados = state.consultas.filter(c => {
    const data = new Date(`${String(c.data_consulta).slice(0,10)}T00:00:00`);
    const correspondePeriodo = periodo === "all" ||
      (periodo === "today" ? data.getTime() === hoje.getTime() : data >= dataLimite && data <= hoje);
    return (!status || c.status === status) && correspondePeriodo &&
      `${c.pet_nome} ${c.especie || ""} ${c.cliente_nome} ${c.veterinario_nome} ${c.motivo} ${c.status}`.toLocaleLowerCase("pt-BR").includes(termo);
  });
  const pag = paginar(dados, "consultas");
  const body = document.querySelector("#lista-consultas");
  body.innerHTML = pag.items.length ? pag.items.map(c => {
    const pet = state.pets.find(p => Number(p.id) === Number(c.pet_id)) || {};
    const sprite = pet.sprite_url || pet.foto_url || (pet.pokedex_id ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pet.pokedex_id}.png` : "");
    const avatar = sprite
      ? `<span class="appointment-pokemon-avatar"><img src="${esc(sprite)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='${emojiEspecie(c.especie)}'"></span>`
      : `<span class="appointment-pokemon-avatar">${emojiEspecie(c.especie)}</span>`;
    const statusClass = String(c.status || "").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
    return `<tr>
      <td class="appointment-date-cell"><strong>${formatarData(c.data_consulta)}</strong><span>${esc(String(c.horario || "").slice(0,5))}</span></td>
      <td><div class="appointment-pet-cell">${avatar}<div><strong>${esc(c.pet_nome)}</strong><small>${esc(c.cliente_nome)}</small></div></div></td>
      <td><div class="appointment-vet-cell"><span class="appointment-vet-avatar">${esc(String(c.veterinario_nome || "?").trim().split(/\s+/).map(n => n[0]).slice(0,2).join("").toUpperCase())}</span><span>${esc(c.veterinario_nome)}</span></div></td>
      <td class="appointment-reason">${esc(c.motivo)}</td>
      <td><span class="appointment-status status-${statusClass}"><i></i>${esc(c.status)}</span></td>
      <td><div class="appointment-actions">
        <button class="appointment-action" title="Editar atendimento" aria-label="Editar atendimento" onclick='abrirConsulta(${jsonAttr(c)})'>✎</button>
        ${adminDelete("consultas", c.id)}
      </div></td>
    </tr>`;
  }).join("") : linhaVazia(6, "Nenhum atendimento encontrado para os filtros selecionados.");

  document.querySelector("#appointment-results").textContent = dados.length
    ? `Mostrando ${Math.min((state.page.consultas - 1) * state.perPage + 1, dados.length)} a ${Math.min(state.page.consultas * state.perPage, dados.length)} de ${dados.length} atendimentos`
    : "Nenhum atendimento encontrado";
  renderPaginacao("consultas", pag.totalPages);
}

function renderCalendario() {
  const date = state.calendarDate;
  const ano = date.getFullYear();
  const mes = date.getMonth();
  document.querySelector("#calendar-title").textContent =
    new Date(ano, mes, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const consultasMes = state.consultas.filter(c => {
    const d = new Date(`${c.data_consulta}T00:00:00`);
    return d.getFullYear() === ano && d.getMonth() === mes;
  });
  const hojeISO = (() => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,"0")}-${String(h.getDate()).padStart(2,"0")}`; })();
  const consultasHoje = state.consultas.filter(c => c.data_consulta === hojeISO);
  const proximas = state.consultas.filter(c => c.data_consulta >= hojeISO && !["cancelada", "cancelado"].includes(String(c.status || "").toLowerCase())).length;
  const treinadoresUnicos = new Set(consultasMes.map(c => c.cliente_id || c.treinador_id || c.cliente_nome).filter(Boolean)).size;
  const stats = document.querySelector("#calendar-stats");
  if (stats) stats.innerHTML = `
    <article class="calendar-stat-card stat-red"><span class="calendar-stat-icon">▦</span><div><small>Atendimentos no mês</small><strong>${consultasMes.length}</strong><span>Registros na agenda</span></div></article>
    <article class="calendar-stat-card stat-blue"><span class="calendar-stat-icon">◷</span><div><small>Atendimentos hoje</small><strong>${consultasHoje.length}</strong><span>Cuidados programados</span></div></article>
    <article class="calendar-stat-card stat-purple"><span class="calendar-stat-icon">♙</span><div><small>Treinadores atendidos</small><strong>${treinadoresUnicos}</strong><span>Neste mês</span></div></article>
    <article class="calendar-stat-card stat-green"><span class="calendar-stat-icon">♡</span><div><small>Próximos atendimentos</small><strong>${proximas}</strong><span>Agendados a partir de hoje</span></div></article>`;

  const primeiro = new Date(ano, mes, 1);
  const inicio = new Date(ano, mes, 1 - primeiro.getDay());
  const diasSemana = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

  let html = diasSemana.map(d => `<div class="calendar-head">${d}</div>`).join("");

  for (let i = 0; i < 42; i++) {
    const dia = new Date(inicio);
    dia.setDate(inicio.getDate() + i);
    const iso = `${dia.getFullYear()}-${String(dia.getMonth()+1).padStart(2,"0")}-${String(dia.getDate()).padStart(2,"0")}`;
    const eventos = state.consultas.filter(c => c.data_consulta === iso);
    const hoje = new Date();
    const ehHoje = dia.getFullYear() === hoje.getFullYear() && dia.getMonth() === hoje.getMonth() && dia.getDate() === hoje.getDate();
    const fimDeSemana = dia.getDay() === 0 || dia.getDay() === 6;
    html += `
      <div class="calendar-day ${dia.getMonth() !== mes ? "muted-day" : ""} ${ehHoje ? "today-day" : ""} ${fimDeSemana ? "weekend-day" : ""}">
        <div class="calendar-day-top"><span class="calendar-number">${dia.getDate()}</span>${ehHoje ? `<span class="today-label">HOJE</span>` : ""}${eventos.length ? `<span class="day-event-count">${eventos.length}</span>` : ""}</div>
        ${eventos.slice(0,3).map(e =>
          `<span class="calendar-event" title="${escAttr(e.motivo || "Atendimento agendado")}"><i class="calendar-event-mark" aria-hidden="true"></i><span class="calendar-event-time">${esc(e.horario.slice(0,5))}</span><span class="calendar-event-name">${esc(e.pet_nome)}</span></span>`
        ).join("")}
        ${eventos.length > 3 ? `<span class="calendar-more">+${eventos.length-3} atendimento(s)</span>` : ""}
      </div>`;
  }

  document.querySelector("#calendar-grid").innerHTML = html;
}

function abrirCliente(dado = null) {
  const regioesPokemon = [
    "Kanto", "Johto", "Hoenn", "Sinnoh", "Unova", "Kalos",
    "Alola", "Galar", "Hisui", "Paldea", "Ilhas Laranja",
    "Ilhas Sevii", "Orre", "Fiore", "Almia", "Oblivia",
    "Ransei", "Ferrum", "Pasio", "Lental", "Aeos", "Kitakami",
    "Blueberry Academy", "Bonsly Town", "Península de Paldea"
  ];
  const regiaoAtual = dado?.cidade && !regioesPokemon.includes(dado.cidade)
    ? `<option value="${escAttr(dado.cidade)}" selected>${esc(dado.cidade)} (região atual)</option>`
    : "";

  abrirFormulario(dado ? "Editar treinador" : "Novo treinador", "clientes", dado, `
    <div class="form-grid">
      ${campo("nome","Nome completo",dado?.nome,true)}
      ${campo("telefone","Telefone",dado?.telefone,true)}
      ${campo("email","E-mail",dado?.email,false,"email")}
      <label class="field"><span>Região Pokémon</span><select name="cidade" required>
        <option value="">Selecione a região</option>
        ${regiaoAtual}
        ${regioesPokemon.map(regiao => `<option value="${escAttr(regiao)}" ${dado?.cidade===regiao?"selected":""}>${esc(regiao)}</option>`).join("")}
      </select></label>
      ${botoesForm()}
    </div>`);
}


const cacheTiposCompletosPokemon = new Map();

async function obterTiposCompletosPokemon(pokemon) {
  const id = Number(pokemon?.pokedex_id);
  if (!id) return [];
  if (cacheTiposCompletosPokemon.has(id)) return cacheTiposCompletosPokemon.get(id);
  try {
    const resposta = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    if (!resposta.ok) throw new Error("Pokémon não encontrado na PokéAPI");
    const dados = await resposta.json();
    const tipos = (dados.types || [])
      .sort((a, b) => a.slot - b.slot)
      .map(item => ({
        nome: nomesTiposPokemon[item.type.name] || item.type.name,
        slug: item.type.name
      }));
    cacheTiposCompletosPokemon.set(id, tipos);
    return tipos;
  } catch (erro) {
    console.warn("Não foi possível carregar os tipos do Pokémon:", pokemon?.nome, erro);
    return [];
  }
}

async function abrirFichaPokemon(petId, aba = "geral") {
  const pet = state.pets.find(p => Number(p.id) === Number(petId));
  if (!pet) return toast("Pokémon não encontrado.", "error");
  const tiposPokemon = await obterTiposCompletosPokemon(pet);
  const etiquetasTipos = tiposPokemon.length
    ? tiposPokemon.map(tipo => `<span class="pokedex-type type-${escAttr(tipo.slug)}">${esc(tipo.nome)}</span>`).join(" ")
    : `<span class="type-pill">Tipo não identificado</span>`;
  const textoTipos = tiposPokemon.length ? tiposPokemon.map(tipo => tipo.nome).join(" / ") : "Não identificado";
  const modal = document.querySelector("#modal");
  const card = modal.querySelector(".modal-card");
  card.classList.add("pokemon-record-modal");
  document.querySelector("#modal-title").textContent = `Ficha Pokémon — ${pet.nome}`;
  const form = document.querySelector("#modal-form");
  form.onsubmit = null;
  form.dataset.tipo = "ficha-pokemon";
  form.dataset.id = pet.id;
  form.innerHTML = `<div class="pokemon-record">
    <header class="record-hero">
      <div class="record-sprite">${petVisual(pet)}</div>
      <div class="record-identity"><span class="eyebrow">FICHA INDIVIDUAL</span><h2>${esc(pet.nome)}</h2>
        <p>${esc(pet.especie)}${pet.pokedex_id ? ` · #${String(pet.pokedex_id).padStart(3,"0")}` : ""}</p>
        <div class="pokedex-types record-type-badges" aria-label="Tipo Pokémon">${etiquetasTipos}</div>
        <p class="record-trainer">Treinador responsável: <strong>${esc(pet.cliente_nome || "-")}</strong></p>
        <div class="record-hero-actions"><button type="button" class="btn btn-light" onclick="abrirPet(state.pets.find(p=>Number(p.id)===${pet.id}));document.querySelector('.modal-card').classList.remove('pokemon-record-modal')">Editar</button><button type="button" class="btn btn-primary" onclick="abrirConsulta(null,${pet.id});document.querySelector('.modal-card').classList.remove('pokemon-record-modal')">Registrar atendimento</button></div>
      </div>
      <div class="record-stats"><div><small>PESO</small><strong>${pet.peso ? `${esc(pet.peso)} kg` : "Não informado"}</strong></div><div><small>SEXO</small><strong>${esc(pet.sexo || "Não informado")}</strong></div><div><small>CONSULTAS</small><strong>${Number(pet.total_consultas || 0)}</strong></div><div><small>ESPÉCIE</small><strong>${esc(pet.especie)}</strong></div></div>
    </header>
    <nav class="record-tabs">${[["geral","Visão geral"],["consultas","Consultas"],["historico","Histórico clínico"],["vacinas","Vacinas"],["prontuario","Prontuário"]].map(([key,label])=>`<button type="button" class="record-tab ${aba===key?"active":""}" onclick="abrirFichaPokemon(${pet.id},'${key}')">${label}</button>`).join("")}</nav>
    <div class="record-content" id="record-content"><div class="record-loading">Carregando ficha...</div></div></div>`;
  modal.classList.add("open");
  try {
    const [historico, vacinas, prontuario] = await Promise.all([
      request(`/pets/${pet.id}/historico`).catch(()=>[]),
      request(`/vacinacoes/pet/${pet.id}`).catch(()=>[]),
      request(`/prontuarios/pet/${pet.id}`).catch(()=>[])
    ]);
    const content = document.querySelector("#record-content");
    if (!content) return;
    const hist = Array.isArray(historico) ? historico : [];
    const vac = Array.isArray(vacinas) ? vacinas : [];
    const pront = Array.isArray(prontuario) ? prontuario : [];
    const ordered = hist.slice().sort((a,b)=>String(b.data_consulta).localeCompare(String(a.data_consulta)));
    const today = new Date(); today.setHours(0,0,0,0);
    const nextVac = vac.filter(v=>v.proxima_dose && new Date(`${String(v.proxima_dose).slice(0,10)}T12:00:00`)>=today).sort((a,b)=>String(a.proxima_dose).localeCompare(String(b.proxima_dose)))[0];
    if (aba === "geral") {
      content.innerHTML = `<div class="record-columns"><section class="record-panel"><h3>Informações básicas</h3><dl class="record-details"><dt>Nome (apelido)</dt><dd>${esc(pet.nome)}</dd><dt>Espécie</dt><dd>${esc(pet.especie)}</dd><dt>Número Pokédex</dt><dd>${pet.pokedex_id ? "#"+String(pet.pokedex_id).padStart(3,"0") : "Não informado"}</dd><dt>Tipo Pokémon</dt><dd><div class="pokedex-types record-type-badges">${etiquetasTipos}</div><span class="sr-only">${esc(textoTipos)}</span></dd><dt>Treinador</dt><dd>${esc(pet.cliente_nome||"-")}</dd><dt>Raça / forma</dt><dd>${esc(pet.raca||"Não informada")}</dd><dt>Sexo</dt><dd>${esc(pet.sexo||"Não informado")}</dd><dt>Peso</dt><dd>${pet.peso ? esc(pet.peso)+" kg" : "Não informado"}</dd><dt>Nascimento</dt><dd>${pet.nascimento ? formatarData(pet.nascimento) : "Não informado"}</dd></dl></section>
      <section class="record-panel"><h3>Resumo clínico</h3><div class="record-summary-row"><span>Total de consultas</span><strong>${hist.length}</strong></div><div class="record-summary-row"><span>Total de vacinas</span><strong>${vac.length}</strong></div><div class="record-summary-row"><span>Última consulta</span><strong>${ordered[0] ? formatarData(ordered[0].data_consulta) : "Nenhuma"}</strong></div><div class="record-summary-row"><span>Próxima vacina</span><strong>${nextVac ? formatarData(nextVac.proxima_dose) : "Não registrada"}</strong></div><h3 class="record-subheading">Observações gerais</h3><p>${esc(pet.observacoes||"Nenhuma observação cadastrada.")}</p></section></div>
      <section class="record-panel record-wide"><h3>Atendimentos recentes</h3>${ordered.length ? ordered.slice(0,3).map(h=>`<article class="record-list-item"><div><strong>${esc(h.motivo||"Consulta")}</strong><p>${formatarData(h.data_consulta)} · ${esc(h.veterinario_nome||"Veterinário não informado")}</p><small>${esc(h.observacoes||"Sem resumo clínico registrado.")}</small></div><span class="status status-${slug(h.status)}">${esc(h.status||"Registrada")}</span></article>`).join("") : `<p class="record-muted">Nenhum atendimento registrado.</p>`}</section>`;
    } else if (aba === "consultas") {
      const all = await request("/consultas").catch(()=>[]);
      const consultas = (Array.isArray(all)?all:[]).filter(c=>Number(c.pet_id)===Number(pet.id)).sort((a,b)=>String(b.data_consulta).localeCompare(String(a.data_consulta)));
      content.innerHTML = `<div class="record-section-heading"><div><h3>Consultas</h3><p>Agendamentos e atendimentos deste Pokémon</p></div><button type="button" class="btn btn-primary" onclick="abrirConsulta(null,${pet.id});document.querySelector('.modal-card').classList.remove('pokemon-record-modal')">+ Nova consulta</button></div>${consultas.length ? consultas.map(c=>`<article class="record-list-item"><div><strong>${esc(c.motivo||"Consulta")}</strong><p>${formatarData(c.data_consulta)} às ${String(c.horario||"").slice(0,5)} · ${esc(c.veterinario_nome||"Veterinário")}</p><small>${esc(c.observacoes||"Sem observações registradas.")}</small></div><span class="status status-${slug(c.status)}">${esc(c.status||"Agendada")}</span></article>`).join("") : `<p class="record-muted">Nenhuma consulta cadastrada.</p>`}`;
    } else if (aba === "historico") {
      content.innerHTML = `<h3>Histórico clínico</h3><p class="record-muted">Resumo dos atendimentos anteriores</p>${ordered.length ? ordered.map(h=>`<article class="record-history-item"><div class="record-history-date">${formatarData(h.data_consulta)}${h.horario ? " · "+String(h.horario).slice(0,5):""}</div><div class="record-history-body"><div class="record-section-heading"><strong>${esc(h.motivo||"Atendimento")}</strong><span class="status status-${slug(h.status)}">${esc(h.status||"Registrada")}</span></div><p><b>Veterinário:</b> ${esc(h.veterinario_nome||"Não informado")}</p><p><b>Resumo / observações:</b> ${esc(h.observacoes||"Nenhum resumo foi registrado nesta consulta.")}</p></div></article>`).join("") : `<p class="record-muted">Nenhum histórico clínico registrado.</p>`}`;
    } else if (aba === "vacinas") {
      content.innerHTML = `<div class="record-section-heading"><div><h3>Vacinas</h3><p>Controle de aplicações e próximas doses</p></div><button type="button" class="btn btn-primary" onclick="abrirVacinacoes(${pet.id},'${escAttr(pet.nome)}');document.querySelector('.modal-card').classList.remove('pokemon-record-modal')">+ Registrar vacina</button></div>${nextVac?`<div class="record-vaccine-alert"><strong>Próxima dose: ${formatarData(nextVac.proxima_dose)}</strong><p>${esc(nextVac.vacina)}</p></div>`:""}${vac.length?`<div class="record-table-wrap"><table class="record-table"><thead><tr><th>Vacina</th><th>Aplicação</th><th>Próxima dose</th><th>Lote</th><th>Status</th></tr></thead><tbody>${vac.map(v=>`<tr><td>${esc(v.vacina)}</td><td>${formatarData(v.data_aplicacao)}</td><td>${v.proxima_dose?formatarData(v.proxima_dose):"—"}</td><td>${esc(v.lote||"—")}</td><td>${v.proxima_dose?"Dose programada":"Aplicada"}</td></tr>`).join("")}</tbody></table></div>`:`<p class="record-muted">Nenhuma vacinação registrada.</p>`}`;
    } else {
      content.innerHTML = `<div class="record-section-heading"><div><h3>Prontuário</h3><p>Registros clínicos e evolução</p></div><button type="button" class="btn btn-primary" onclick="abrirProntuario(${pet.id},'${escAttr(pet.nome)}');document.querySelector('.modal-card').classList.remove('pokemon-record-modal')">+ Novo registro</button></div>${pront.length?pront.map(r=>`<article class="record-list-item"><div><strong>${esc(r.titulo)}</strong><p>${formatarData(String(r.criado_em).slice(0,10))} · ${esc(r.tipo)}</p><small>${esc(r.descricao)}</small>${r.peso?`<p>Peso registrado: ${esc(r.peso)} kg</p>`:""}</div></article>`).join(""):`<p class="record-muted">Nenhum registro no prontuário ainda.</p>`}`;
    }
  } catch (erro) {
    const content = document.querySelector("#record-content");
    if (content) content.innerHTML = `<p class="record-muted">Não foi possível carregar a ficha: ${esc(erro.message||"erro desconhecido")}</p>`;
  }
}

function abrirPet(dado = null, clientePreSelecionado = null) {
  abrirFormulario(dado ? "Editar Pokémon" : "Cadastrar Pokémon", "pets", dado, `
    <div class="form-grid">
      <div class="field full"><span>Buscar espécie na Pokédex</span>
        <div class="field-inline"><input id="pokedex-species-search" placeholder="Ex.: Pikachu ou 25" value="${escAttr(dado?.especie || "")}"><button type="button" class="btn btn-light" id="pokedex-species-find">Buscar</button></div>
        <small class="field-help" id="pokedex-species-help">Busque na PokéAPI para preencher espécie, número e imagem automaticamente.</small>
      </div>
      <div class="field full" id="pokedex-species-results" hidden></div>
      ${campo("nome","Apelido / identificação individual",dado?.nome,true)}
      <input type="hidden" name="especie" id="pet-especie" value="${escAttr(dado?.especie || "")}" required>
      <input type="hidden" name="pokedex_id" id="pet-pokedex-id" value="${escAttr(dado?.pokedex_id || "")}">
      <input type="hidden" name="sprite_url" id="pet-sprite-url" value="${escAttr(dado?.sprite_url || "")}">
      <div class="field"><span>Treinador responsável</span><div class="field-inline"><select name="cliente_id" required><option value="">Selecione o treinador</option>${state.clientes.map(c=>`<option value="${c.id}" ${Number(dado?.cliente_id || clientePreSelecionado)===Number(c.id)?"selected":""}>${esc(c.nome)}</option>`).join("")}</select><button type="button" class="btn btn-light btn-register-pokemon" onclick="cadastrarTreinadorDuranteCadastroPokemon()">+ Cadastrar treinador</button></div></div>
      <label class="field"><span>Sexo</span><select name="sexo" required><option value="">Selecione</option>${option("Macho",dado?.sexo)}${option("Fêmea",dado?.sexo)}</select></label>
      ${state.clientes.length ? "" : `<p class="field full form-hint">Cadastre um treinador antes de cadastrar o Pokémon.</p>`}
      <input type="hidden" name="raca" value="${escAttr(dado?.raca || "")}"><input type="hidden" name="nascimento" value="${escAttr(dataInput(dado?.nascimento) || "")}"><input type="hidden" name="peso" value="${escAttr(dado?.peso ?? "")}"><input type="hidden" name="cor" value="${escAttr(dado?.cor || "")}"><input type="hidden" name="foto_url" value="${escAttr(dado?.foto_url || "")}"><input type="hidden" name="observacoes" value="${escAttr(dado?.observacoes || "")}">
      ${botoesForm()}
    </div>`);
  const form = document.querySelector("#modal-form");
  const buscar = async () => {
    const q = form.querySelector("#pokedex-species-search").value.trim().toLowerCase();
    const area = form.querySelector("#pokedex-species-results");
    const help = form.querySelector("#pokedex-species-help");
    if (!q) { help.textContent = "Digite o nome ou número de um Pokémon."; return; }
    help.textContent = "Consultando PokéAPI..."; area.hidden = false; area.innerHTML = "";
    try {
      let pokemon;
      const resp = await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(q)}`);
      if (!resp.ok) throw new Error("Pokémon não encontrado na Pokédex.");
      pokemon = await resp.json();
      const nomeEspecie = pokemon.name.charAt(0).toUpperCase()+pokemon.name.slice(1).replace(/-/g," ");
      form.querySelector("#pet-especie").value = nomeEspecie;
      form.querySelector("#pet-pokedex-id").value = pokemon.id;
      form.querySelector("#pet-sprite-url").value = pokemon.sprites?.other?.["official-artwork"]?.front_default || pokemon.sprites?.front_default || "";
      const imagem = form.querySelector("#pet-sprite-url").value;
      area.innerHTML = `<div class="panel" style="padding:12px;display:flex;align-items:center;gap:12px">${imagem?`<img src="${escAttr(imagem)}" alt="" style="width:76px;height:76px;object-fit:contain">`:""}<div><strong>${esc(nomeEspecie)} #${pokemon.id}</strong><p>${pokemon.types.map(t=>esc(t.type.name)).join(" / ")}</p><small>Espécie selecionada. Agora informe um apelido individual, por exemplo: Pikachu do Ash 1.</small></div></div>`;
      help.textContent = "Espécie selecionada pela PokéAPI.";
    } catch (e) { help.textContent = e.message || "Não foi possível consultar a PokéAPI."; area.hidden = true; }
  };
  form.querySelector("#pokedex-species-find").addEventListener("click", buscar);
  form.querySelector("#pokedex-species-search").addEventListener("keydown", e=>{ if(e.key==="Enter"){e.preventDefault();buscar();} });
}

function abrirVeterinario(dado = null) {
  abrirFormulario(dado ? "Editar integrante" : "Novo integrante", "veterinarios", dado, `
    <div class="form-grid">
      ${campo("nome","Nome completo",dado?.nome,true)}
      ${campo("crmv","CRMV",dado?.crmv,true)}
      ${campo("especialidade","Especialidade",dado?.especialidade)}
      ${campo("telefone","Telefone",dado?.telefone)}
      ${campo("email","E-mail",dado?.email,false,"email")}
      ${botoesForm()}
    </div>`);
}

function abrirConsulta(dado = null, petPreSelecionado = null) {
  const treinadorAtual = state.pets.find(p=>Number(p.id)===Number(petPreSelecionado ?? dado?.pet_id))?.cliente_id || "";
  abrirFormulario(dado?.id ? "Editar atendimento" : "Novo atendimento", "consultas", dado, `
    <div class="form-grid">
      <label class="field full"><span>Treinador responsável</span><select name="treinador_filtro" id="consulta-treinador" required><option value="">Selecione o treinador primeiro</option>${state.clientes.map(c=>`<option value="${c.id}" ${Number(treinadorAtual)===Number(c.id)?"selected":""}>${esc(c.nome)}</option>`).join("")}</select></label>
      <div class="field full"><span>Pokémon atendido</span><div class="field-inline"><select name="pet_id" id="consulta-pokemon" required><option value="">${treinadorAtual?"Selecione o Pokémon":"Selecione primeiro o treinador"}</option></select><button type="button" class="btn btn-light btn-register-pokemon" onclick="cadastrarPokemonDuranteAgendamento()">+ Cadastrar Pokémon</button></div><small class="field-help">Se o treinador tiver dois Pikachu, cada um aparecerá com seu apelido individual.</small></div>
      <label class="field full"><span>Veterinário / especialista</span><select name="veterinario_id" required><option value="">Selecione</option>${state.veterinarios.map(v=>`<option value="${v.id}" ${Number(dado?.veterinario_id)===Number(v.id)?"selected":""}>${esc(v.nome)}</option>`).join("")}</select></label>
      ${campo("data_consulta","Data",dataInput(dado?.data_consulta),true,"date")}${campo("horario","Horário",dado?.horario?.slice(0,5),true,"time")}
      <label class="field"><span>Duração (minutos)</span><select name="duracao_minutos">${[15,20,30,45,60,90,120].map(n=>`<option value="${n}" ${Number(dado?.duracao_minutos||30)===n?"selected":""}>${n} min</option>`).join("")}</select></label>
      <label class="field full"><span>Motivo do atendimento</span><input name="motivo" value="${escAttr(dado?.motivo || "")}" required></label>
      <label class="field"><span>Status</span><select name="status">${["Agendada","Concluída","Cancelada"].map(s=>option(s,dado?.status||"Agendada")).join("")}</select></label>
      <label class="field full"><span>Observações / prontuário</span><textarea name="observacoes">${esc(dado?.observacoes || "")}</textarea></label>${botoesForm()}
    </div>`);
  const form=document.querySelector("#modal-form"), treinador=form.querySelector("#consulta-treinador"), pokemon=form.querySelector("#consulta-pokemon");
  const carregarPokemons=()=>{ const lista=state.pets.filter(p=>Number(p.cliente_id)===Number(treinador.value)); pokemon.innerHTML=`<option value="">${lista.length?"Selecione o Pokémon":"Nenhum Pokémon cadastrado para este treinador"}</option>`+lista.map(p=>`<option value="${p.id}" ${Number(p.id)===Number(petPreSelecionado ?? dado?.pet_id)?"selected":""}>${esc(p.nome)} (${esc(p.especie)})</option>`).join(""); };
  treinador.addEventListener("change",carregarPokemons); carregarPokemons();
}

function cadastrarPokemonDuranteAgendamento() {
  const form = document.querySelector("#modal-form");
  state.agendamentoRascunho = Object.fromEntries(new FormData(form).entries());
  state.cadastroTreinadorParaPokemon = state.clientes.length === 0 ? "agendamento" : false;

  if (state.cadastroTreinadorParaPokemon) {
    toast("Antes do Pokémon, cadastre o treinador responsável.");
    abrirCliente();
    return;
  }

  abrirPet();
}

function cadastrarTreinadorDuranteCadastroPokemon() {
  const form = document.querySelector("#modal-form");
  state.pokemonRascunho = Object.fromEntries(new FormData(form).entries());
  state.cadastroTreinadorParaPokemon = "pokemon";
  abrirCliente();
}

function aplicarMascaraTelefone(input) {
  const somenteNumeros = valor => String(valor || "").replace(/\D/g, "").slice(0, 11);

  const formatar = valor => {
    const numeros = somenteNumeros(valor);
    if (numeros.length <= 2) return numeros ? `(${numeros}` : "";
    const ddd = numeros.slice(0, 2);
    const numero = numeros.slice(2);
    if (numero.length <= 4) return `(${ddd}) ${numero}`;
    if (numeros.length <= 10) {
      return `(${ddd}) ${numero.slice(0, 4)}-${numero.slice(4)}`;
    }
    return `(${ddd}) ${numero.slice(0, 5)}-${numero.slice(5)}`;
  };

  const posicaoParaDigitos = (valor, quantidade) => {
    if (quantidade <= 0) return 0;
    let encontrados = 0;
    for (let i = 0; i < valor.length; i++) {
      if (/\d/.test(valor[i])) encontrados++;
      if (encontrados >= quantidade) return i + 1;
    }
    return valor.length;
  };

  input.type = "tel";
  input.inputMode = "numeric";
  input.placeholder = "(31) 99999-9999";
  input.maxLength = 15;
  input.value = formatar(input.value);

  input.addEventListener("input", () => {
    const cursorAtual = input.selectionStart ?? input.value.length;
    const digitosAntesCursor = somenteNumeros(input.value.slice(0, cursorAtual)).length;
    const valorFormatado = formatar(input.value);
    input.value = valorFormatado;
    const novaPosicao = posicaoParaDigitos(valorFormatado, digitosAntesCursor);
    try { input.setSelectionRange(novaPosicao, novaPosicao); } catch (_) {}
  });

  // Permite apagar um dígito mesmo quando o cursor está junto a parênteses,
  // espaço ou hífen inseridos automaticamente pela máscara.
  input.addEventListener("keydown", event => {
    const inicio = input.selectionStart;
    const fim = input.selectionEnd;
    if (inicio !== fim) return;

    const valor = input.value;
    if (event.key === "Backspace" && inicio > 0 && !/\d/.test(valor[inicio - 1])) {
      const antes = valor.slice(0, inicio);
      const posUltimoDigito = antes.search(/\d(?=\D*$)/);
      if (posUltimoDigito >= 0) {
        event.preventDefault();
        input.value = formatar(valor.slice(0, posUltimoDigito) + valor.slice(inicio));
        const novaPosicao = posicaoParaDigitos(input.value, somenteNumeros(valor.slice(0, posUltimoDigito)).length);
        try { input.setSelectionRange(novaPosicao, novaPosicao); } catch (_) {}
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  });
}

function abrirFormulario(titulo, tipo, dado, html) {
  document.querySelector("#modal-title").textContent = titulo;
  const form = document.querySelector("#modal-form");
  form.innerHTML = html;
  form.dataset.tipo = tipo;
  form.dataset.id = dado?.id || "";
  if (tipo === "clientes") {
    const telefone = form.querySelector('[name="telefone"]');
    if (telefone) aplicarMascaraTelefone(telefone);
  }
  document.querySelector("#modal").classList.add("open");

  form.onsubmit = async e => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    const id = form.dataset.id;
    const botao = form.querySelector("[type=submit]");
    botao.disabled = true;

    try {
      const resposta = await request(`/${tipo}${id ? `/${id}` : ""}`, {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      // Fluxo encadeado: cadastrar treinador durante o cadastro de Pokémon ou agendamento.
      if (tipo === "clientes" && state.cadastroTreinadorParaPokemon) {
        const origem = state.cadastroTreinadorParaPokemon;
        toast(resposta.mensagem || "Treinador cadastrado.");
        await carregarTudo();

        if (origem === "pokemon") {
          const rascunhoPokemon = state.pokemonRascunho || {};
          state.pokemonRascunho = null;
          state.cadastroTreinadorParaPokemon = false;
          abrirPet(rascunhoPokemon, resposta.id);
        } else {
          abrirPet(null, resposta.id);
        }
        return;
      }

      if (tipo === "pets" && state.agendamentoRascunho) {
        const rascunho = state.agendamentoRascunho;
        state.agendamentoRascunho = null;
        state.cadastroTreinadorParaPokemon = false;
        toast("Pokémon cadastrado com sucesso.");
        await carregarTudo();
        abrirConsulta(rascunho, resposta.id);
        return;
      }

      toast(
      tipo === "pets"
        ? (id
            ? "Pokémon atualizado com sucesso."
            : "Pokémon cadastrado com sucesso.")
        : (resposta.mensagem || "Registro salvo.")
        );
      fecharModal();
      await carregarTudo();
    } catch (erro) {
      toast(erro.message, "error");
    } finally {
      botao.disabled = false;
    }
  };
}

function fecharModal() {
  const form = document.querySelector("#modal-form");
  const modal = document.querySelector("#modal");

  if (form.dataset.tipo === "clientes" && state.cadastroTreinadorParaPokemon === "pokemon") {
    const rascunhoPokemon = state.pokemonRascunho || {};
    state.pokemonRascunho = null;
    state.cadastroTreinadorParaPokemon = false;
    modal.classList.remove("open");
    abrirPet(rascunhoPokemon);
    return;
  }

  if (state.agendamentoRascunho &&
      (form.dataset.tipo === "pets" ||
       (form.dataset.tipo === "clientes" && state.cadastroTreinadorParaPokemon))) {
    const rascunho = state.agendamentoRascunho;
    state.agendamentoRascunho = null;
    state.cadastroTreinadorParaPokemon = false;
    modal.classList.remove("open");
    abrirConsulta(rascunho);
    return;
  }

  modal.classList.remove("open");
  modal.querySelector(".modal-card")?.classList.remove("pokemon-record-modal");
}

async function excluirItem(tipo, id) {
  if (!confirm("Deseja realmente excluir este registro?")) return;
  try {
    const resposta = await request(`/${tipo}/${id}`, { method: "DELETE" });
    toast(resposta.mensagem);
    await carregarTudo();
  } catch (erro) {
    toast(erro.message, "error");
  }
}

async function verHistorico(id, nome) {
  try {
    const dados = await request(`/pets/${id}/historico`);
    document.querySelector("#modal-title").textContent = `Histórico de ${nome}`;
    document.querySelector("#modal-form").innerHTML = dados.length ? `
      <div class="timeline">
        ${dados.map(h => `
          <article class="panel" style="padding:16px;margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;gap:12px">
              <strong>${formatarData(h.data_consulta)} às ${h.horario.slice(0,5)}</strong>
              <span class="status status-${slug(h.status)}">${esc(h.status)}</span>
            </div>
            <p><strong>${esc(h.motivo)}</strong></p>
            <p style="color:var(--muted)">${esc(h.veterinario_nome)} · ${esc(h.observacoes || "Sem observações.")}</p>
          </article>`).join("")}
      </div>` : vazio("Nenhum atendimento registrado.");
    document.querySelector("#modal").classList.add("open");
  } catch (erro) {
    toast(erro.message, "error");
  }
}

async function abrirProntuario(petId, nome) {
  try {
    const registros = await request(`/prontuarios/pet/${petId}`);
    const form = document.querySelector("#modal-form");
    document.querySelector("#modal-title").textContent = `Prontuário — ${nome}`;
    form.innerHTML = `
      <div class="timeline">${registros.length ? registros.map(r => `
        <article class="panel" style="padding:14px;margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><strong>${esc(r.titulo)}</strong><small>${formatarData(String(r.criado_em).slice(0,10))}</small></div>
          <small>${esc(r.tipo)}${r.usuario_nome ? ` · ${esc(r.usuario_nome)}` : ""}${r.peso ? ` · ${esc(r.peso)} kg` : ""}</small>
          <p>${esc(r.descricao)}</p>
        </article>`).join("") : vazio("Nenhum registro de prontuário ainda.")}</div>
      <hr style="margin:18px 0;border:0;border-top:1px solid var(--border)">
      <h3>Novo registro</h3><div class="form-grid">
        <label class="field"><span>Tipo</span><select name="tipo"><option>Evolução</option><option>Exame</option><option>Diagnóstico</option><option>Procedimento</option><option>Recomendação</option></select></label>
        <label class="field"><span>Peso (kg), opcional</span><input name="peso" type="number" min="0.01" max="999.99" step="0.01"></label>
        <label class="field full"><span>Título</span><input name="titulo" maxlength="160" required></label>
        <label class="field full"><span>Descrição</span><textarea name="descricao" maxlength="10000" required></textarea></label>
        <div class="form-actions"><button type="submit" class="btn btn-primary">Salvar registro</button></div>
      </div>`;
    form.dataset.tipo = "prontuarios"; form.dataset.id = "";
    form.onsubmit = async e => { e.preventDefault(); const dados=Object.fromEntries(new FormData(form).entries()); const botao=form.querySelector('[type="submit"]'); botao.disabled=true; try { await request("/prontuarios", {method:"POST",body:JSON.stringify({...dados,pet_id:petId})}); toast("Registro salvo no prontuário."); await abrirProntuario(petId,nome); } catch(err) { toast(err.message,"error"); } finally { if (botao.isConnected) botao.disabled=false; } };
    document.querySelector("#modal").classList.add("open");
  } catch (erro) { toast(erro.message, "error"); }
}

async function abrirVacinacoes(petId, nome) {
  try {
    const [registros, pendentes] = await Promise.all([request(`/vacinacoes/pet/${petId}`), request("/vacinacoes/pendentes")]);
    const form = document.querySelector("#modal-form");
    document.querySelector("#modal-title").textContent = `Vacinação — ${nome}`;
    const alertas = pendentes.filter(v => Number(v.pet_id)===Number(petId));
    form.innerHTML = `
      ${alertas.length ? `<div class="panel" style="padding:12px;margin-bottom:12px"><strong>Próximas doses</strong>${alertas.map(v=>`<p>${esc(v.vacina)} — ${formatarData(v.proxima_dose)}</p>`).join("")}</div>` : ""}
      <div class="timeline">${registros.length ? registros.map(v=>`<article class="panel" style="padding:14px;margin-bottom:10px"><strong>${esc(v.vacina)}</strong><p>Aplicada em ${formatarData(v.data_aplicacao)}${v.proxima_dose ? ` · Próxima dose: ${formatarData(v.proxima_dose)}` : " · Sem próxima dose registrada"}</p><small>${v.lote ? `Lote: ${esc(v.lote)} · ` : ""}${esc(v.observacoes||"")}</small>${usuario.perfil === "Administrador" ? `<div style="margin-top:8px"><button type="button" class="btn btn-danger" onclick="excluirVacinacao(${v.id},${petId},'${escAttr(nome)}')">Excluir</button></div>` : ""}</article>`).join("") : vazio("Nenhuma vacinação registrada.")}</div>
      <hr style="margin:18px 0;border:0;border-top:1px solid var(--border)"><h3>Registrar vacinação</h3>
      <div class="form-grid"><label class="field full"><span>Vacina</span><input name="vacina" maxlength="120" required></label>
      <label class="field"><span>Data de aplicação</span><input name="data_aplicacao" type="date" required></label>
      <label class="field"><span>Próxima dose</span><input name="proxima_dose" type="date"></label>
      <label class="field"><span>Lote</span><input name="lote" maxlength="80"></label>
      <label class="field full"><span>Observações</span><textarea name="observacoes" maxlength="5000"></textarea></label>
      <div class="form-actions"><button type="submit" class="btn btn-primary">Salvar vacinação</button></div></div>`;
    form.dataset.tipo = "vacinacoes"; form.dataset.id = "";
    form.onsubmit = async e => { e.preventDefault(); const dados=Object.fromEntries(new FormData(form).entries()); const botao=form.querySelector('[type="submit"]'); botao.disabled=true; try { await request("/vacinacoes",{method:"POST",body:JSON.stringify({...dados,pet_id:petId})}); toast("Vacinação registrada."); await abrirVacinacoes(petId,nome); } catch(err) { toast(err.message,"error"); } finally { if(botao.isConnected) botao.disabled=false; } };
    document.querySelector("#modal").classList.add("open");
  } catch (erro) { toast(erro.message, "error"); }
}

async function excluirVacinacao(id, petId, nome) {
  if (!confirm("Deseja excluir este registro de vacinação?")) return;
  try { const r=await request(`/vacinacoes/${id}`,{method:"DELETE"}); toast(r.mensagem); await abrirVacinacoes(petId,nome); }
  catch(e) { toast(e.message,"error"); }
}

function exportarConsultasCSV() {
  const colunas = ["Data", "Horário", "Duração (min)", "Pokémon", "Treinador", "Equipe", "Motivo", "Status", "Observações"];
  const linhas = state.consultas.map(c => [c.data_consulta, c.horario, c.duracao_minutos || 30, c.pet_nome, c.cliente_nome, c.veterinario_nome, c.motivo, c.status, c.observacoes || ""]);
  const escaparCSV = valor => `"${String(valor ?? "").replace(/"/g, '""')}"`;
  const csv = "\uFEFF" + [colunas, ...linhas].map(l => l.map(escaparCSV).join(";")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a");
  link.href = url; link.download = `atendimentos-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  toast("Relatório CSV gerado.");
}

function popularEspecies() {
  const select = document.querySelector("#filtro-especie");
  const atual = select.value;
  const especies = [...new Set(state.pets.map(p => p.especie))].sort();
  select.innerHTML = `<option value="">Todas as espécies</option>` +
    especies.map(e => `<option ${e===atual?"selected":""}>${esc(e)}</option>`).join("");
}

function paginar(dados, tipo) {
  const totalPages = Math.max(1, Math.ceil(dados.length / state.perPage));
  state.page[tipo] = Math.min(state.page[tipo], totalPages);
  const start = (state.page[tipo] - 1) * state.perPage;
  return { items: dados.slice(start, start + state.perPage), totalPages };
}

function renderPaginacao(tipo, totalPages) {
  const el = document.querySelector(`#paginacao-${tipo}`);
  el.innerHTML = Array.from({length: totalPages}, (_, i) => `
    <button class="page-btn ${state.page[tipo]===i+1?"active":""}"
      onclick="mudarPagina('${tipo}',${i+1})">${i+1}</button>
  `).join("");
}

function mudarPagina(tipo, pagina) {
  state.page[tipo] = pagina;
  ({clientes:renderClientes,pets:renderPets,veterinarios:renderVeterinarios,consultas:renderConsultas}[tipo])();
}

function resetRender(tipo) {
  state.page[tipo] = 1;
  ({clientes:renderClientes,pets:renderPets,veterinarios:renderVeterinarios,consultas:renderConsultas}[tipo])();
}

function drawBarChart(id, data) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  fitCanvas(canvas);
  const ctx = canvas.getContext("2d");
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  if (!data.length) {
    ctx.fillStyle = css("--muted");
    ctx.font = "12px system-ui";
    ctx.fillText("Sem dados suficientes", 16, 35);
    return;
  }

  const max = Math.max(...data.map(d => Number(d.value) || 0), 1);
  const pad = { l: 28, r: 18, t: 18, b: 28 };
  // Mantém as barras agrupadas à esquerda, como no layout de referência.
  const chartW = (w - pad.l - pad.r) * 0.66;
  const chartH = h - pad.t - pad.b;
  const slot = chartW / data.length;
  const bar = Math.min(46, slot * .58);

  ctx.textAlign = "center";
  ctx.font = "600 12px system-ui";
  data.forEach((d, i) => {
    const x = pad.l + slot * i + slot / 2;
    const value = Number(d.value) || 0;
    const bh = Math.max(value > 0 ? 8 : 0, (value / max) * chartH);
    const grad = ctx.createLinearGradient(0, pad.t + chartH - bh, 0, pad.t + chartH);
    grad.addColorStop(0, "#ef4052");
    grad.addColorStop(1, "#ff777b");
    if (bh > 0) roundRect(ctx, x - bar / 2, pad.t + chartH - bh, bar, bh, 7, grad);
    ctx.fillStyle = css("--text");
    ctx.fillText(value, x, Math.max(12, pad.t + chartH - bh - 7));
    ctx.fillStyle = css("--muted");
    ctx.font = "11px system-ui";
    ctx.fillText(d.label, x, h - 7);
    ctx.font = "600 12px system-ui";
  });
}

function drawDonutChart(id, data) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  fitCanvas(canvas);
  const ctx = canvas.getContext("2d");
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  if (!data.length) return;

  const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  if (!total) return;
  // Cores oficiais da interface por tipo Pokémon (inclui variações de nomes).
  const typeColors = {
    "água": "#3295F6", "agua": "#3295F6",
    "fogo": "#FF422E",
    "planta": "#78C850", "grama": "#78C850",
    "elétrico": "#F8D030", "eletrico": "#F8D030",
    "psíquico": "#F85888", "psiquico": "#F85888",
    "normal": "#A8A878",
    "lutador": "#C03028",
    "voador": "#A890F0",
    "venenoso": "#A040A0", "veneno": "#A040A0",
    "terrestre": "#E0C068", "terra": "#E0C068",
    "pedra": "#B8A038", "rocha": "#B8A038",
    "inseto": "#A8B820",
    "fantasma": "#705898",
    "dragão": "#7038F8", "dragao": "#7038F8",
    "aço": "#B8B8D0", "aco": "#B8B8D0",
    "gelo": "#98D8D8",
    "sombrio": "#705848",
    "fada": "#EE99AC"
  };
  const colorForType = (label) => {
    const normalized = String(label || "").trim().toLocaleLowerCase("pt-BR");
    return typeColors[normalized] || "#4e91f5";
  };
  const colors = data.map(item => colorForType(item.label));
  const cx = w * .29, cy = h * .50;
  const radius = Math.min(h * .31, w * .145);
  let start = -Math.PI / 2;

  data.forEach((item, i) => {
    const angle = ((Number(item.value) || 0) / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.strokeStyle = colors[i % colors.length];
    ctx.lineWidth = Math.max(14, Math.min(23, h * .15));
    ctx.lineCap = "butt";
    ctx.arc(cx, cy, radius, start, start + angle);
    ctx.stroke();
    start += angle;
  });

  ctx.fillStyle = css("--text");
  ctx.textAlign = "center";
  ctx.font = "700 19px system-ui";
  ctx.fillText(total, cx, cy + 1);
  ctx.fillStyle = css("--muted");
  ctx.font = "10px system-ui";
  ctx.fillText("pokémon", cx, cy + 17);

  const legendX = w * .57;
  const rowGap = Math.min(28, (h - 18) / Math.max(data.length, 1));
  const legendStartY = cy - ((Math.min(data.length, 4) - 1) * rowGap) / 2;
  data.slice(0, 5).forEach((item, i) => {
    const y = legendStartY + i * rowGap;
    drawPokeballLegend(ctx, legendX, y - 4, colors[i % colors.length]);
    ctx.fillStyle = css("--text");
    ctx.textAlign = "left";
    ctx.font = "11px system-ui";
    ctx.fillText(`${item.label} (${item.value})`, legendX + 17, y);
  });
}

function drawPokeballLegend(ctx, x, y, color) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 7, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#263247";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 7, y);
  ctx.lineTo(x + 7, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width*dpr;
  canvas.height = rect.height*dpr;
  canvas.getContext("2d").setTransform(dpr,0,0,dpr,0,0);
}

function roundRect(ctx,x,y,w,h,r,fill) {
  ctx.beginPath();
  ctx.roundRect(x,y,w,h,r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
function toast(msg, type="success") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<strong>${type==="success"?"Tudo certo":"Atenção"}</strong><div>${esc(msg)}</div>`;
  document.querySelector("#toast-container").appendChild(el);
  setTimeout(()=>el.remove(),3500);
}
function campo(nome,label,valor="",required=false,type="text",extra="") {
  return `<label class="field"><span>${label}</span><input type="${type}" name="${nome}" value="${escAttr(valor ?? "")}" ${required?"required":""} ${extra}></label>`;
}
function botoesForm() {
  return `<div class="form-actions full"><button type="button" class="btn btn-light" onclick="fecharModal()">Cancelar</button><button type="submit" class="btn btn-primary">Salvar registro</button></div>`;
}
function option(valor, atual) { return `<option value="${valor}" ${valor===atual?"selected":""}>${valor}</option>`; }
function adminDelete(tipo,id) { return usuario.perfil==="Administrador" ? `<button class="action-btn" onclick="excluirItem('${tipo}',${id})">Excluir</button>` : ""; }
function petVisual(p) { const imagem = p.sprite_url || p.foto_url; return imagem ? `<img src="${escAttr(imagem)}" alt="${escAttr(p.nome)}" onerror="this.parentElement.innerHTML='${emojiEspecie(p.especie)}'">` : emojiEspecie(p.especie); }
function emojiEspecie(e="") { const s=e.toLowerCase(); return s.includes("gat")?"GA":s.includes("ave")?"AV":s.includes("coelho")?"CO":s.includes("cach")?"CA":(e.slice(0,2).toUpperCase()||"PT"); }
function formatarData(d) { return d ? new Date(`${String(d).slice(0,10)}T12:00:00`).toLocaleDateString("pt-BR") : "-"; }
function formatarMes(m) { const [a,mes]=m.split("-"); return new Date(a,mes-1,1).toLocaleDateString("pt-BR",{month:"short"}).replace(".",""); }
function dataInput(d) { return d ? String(d).slice(0,10) : ""; }
function iniciais(n="") { return n.split(" ").slice(0,2).map(x=>x[0]).join("").toUpperCase(); }
function slug(s="") { return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }
function vazio(msg) { return `<div style="padding:35px;text-align:center;color:var(--muted)">${msg}</div>`; }
function linhaVazia(cols,msg) { return `<tr><td colspan="${cols}" style="text-align:center;color:var(--muted);padding:35px">${msg}</td></tr>`; }
function esc(v) { return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function escAttr(v) { return esc(v); }
function jsonAttr(obj) { return JSON.stringify(obj).replaceAll("'","&#39;"); }

window.addEventListener("resize", () => renderDashboard());
window.fecharModal = fecharModal;
window.abrirCliente = abrirCliente;
window.abrirPet = abrirPet;
window.abrirVeterinario = abrirVeterinario;
window.abrirConsulta = abrirConsulta;
window.excluirItem = excluirItem;
window.verHistorico = verHistorico;
window.mudarPagina = mudarPagina;


// Pokédex pública: consulta a PokéAPI sem alterar os dados clínicos cadastrados.
let pokedexOffset = 0;
let pokedexTotal = 0;
let pokedexLoading = false;
let pokedexFilteredList = null;
const pokedexTypeCache = new Map();
const pokedexDamageRelationsCache = new Map();
const POKEAPI_BASE = "https://pokeapi.co/api/v2";

const nomesTiposPokemon = {
  normal: "Normal", fire: "Fogo", water: "Água", electric: "Elétrico",
  grass: "Planta", ice: "Gelo", fighting: "Lutador", poison: "Venenoso",
  ground: "Terrestre", flying: "Voador", psychic: "Psíquico", bug: "Inseto",
  rock: "Pedra", ghost: "Fantasma", dragon: "Dragão", dark: "Sombrio",
  steel: "Aço", fairy: "Fada"
};

function escaparHtmlPokedex(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, caractere => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[caractere]);
}

async function buscarDadosPokedex(url) {
  const resposta = await fetch(url);
  if (!resposta.ok) {
    if (resposta.status === 404) throw new Error("Pokémon não encontrado. Confira o nome ou número.");
    throw new Error("Não foi possível consultar a PokéAPI. Tente novamente.");
  }
  return resposta.json();
}

function inicializarPokedex() {
  carregarPaginaPokedex(0);
}

async function carregarPaginaPokedex(offset) {
  if (pokedexLoading) return;
  pokedexLoading = true;
  pokedexOffset = offset;
  const mensagem = document.querySelector("#pokedex-message");
  const grade = document.querySelector("#pokedex-grid");
  const tipoSelecionado = document.querySelector("#pokedex-type-filter").value;
  mensagem.textContent = "Carregando Pokémon da Pokédex...";
  mensagem.classList.remove("hidden");
  grade.innerHTML = "";
  document.querySelector("#pokedex-prev").disabled = offset <= 0;
  document.querySelector("#pokedex-next").disabled = true;

  try {
    let resultados;
    if (tipoSelecionado === "all") {
      pokedexFilteredList = null;
      const lista = await buscarDadosPokedex(`${POKEAPI_BASE}/pokemon?limit=24&offset=${offset}`);
      pokedexTotal = lista.count;
      resultados = lista.results.map(pokemon => ({ name: pokemon.name, url: pokemon.url }));
    } else {
      if (!pokedexTypeCache.has(tipoSelecionado)) {
        const dadosTipo = await buscarDadosPokedex(`${POKEAPI_BASE}/type/${tipoSelecionado}`);
        const listaTipo = dadosTipo.pokemon.map(item => item.pokemon);
        pokedexTypeCache.set(tipoSelecionado, listaTipo.sort((a, b) => {
          const idA = Number(a.url.split("/").filter(Boolean).pop());
          const idB = Number(b.url.split("/").filter(Boolean).pop());
          return idA - idB;
        }));
      }
      pokedexFilteredList = pokedexTypeCache.get(tipoSelecionado);
      pokedexTotal = pokedexFilteredList.length;
      resultados = pokedexFilteredList.slice(offset, offset + 24);
    }

    const cards = resultados.map(pokemon => {
      const id = Number(pokemon.url.split("/").filter(Boolean).pop());
      return { name: pokemon.name, id, image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png` };
    });
    grade.innerHTML = cards.map(pokemon => `
      <button type="button" class="pokedex-card" data-pokedex-id="${pokemon.id}" aria-label="Ver detalhes de ${escaparHtmlPokedex(pokemon.name)}">
        <span class="pokedex-card-number">Nº ${String(pokemon.id).padStart(4, "0")}</span>
        <img src="${pokemon.image}" alt="${escaparHtmlPokedex(pokemon.name)}" loading="lazy" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png'">
        <strong>${escaparHtmlPokedex(pokemon.name.replace(/-/g, " "))}</strong>
      </button>`).join("");
    grade.querySelectorAll("[data-pokedex-id]").forEach(card => {
      card.addEventListener("click", () => mostrarDetalhesPokedex(card.dataset.pokedexId));
    });
    mensagem.classList.add("hidden");
    const inicio = pokedexTotal ? offset + 1 : 0;
    const fim = Math.min(offset + cards.length, pokedexTotal);
    const nomeTipo = nomesTiposPokemon[tipoSelecionado] || tipoSelecionado;
    document.querySelector("#pokedex-list-subtitle").textContent = tipoSelecionado === "all"
      ? `Exibindo ${inicio}–${fim} de ${pokedexTotal} Pokémon`
      : `${nomeTipo}: exibindo ${inicio}–${fim} de ${pokedexTotal} Pokémon`;
    document.querySelector("#pokedex-prev").disabled = offset <= 0;
    document.querySelector("#pokedex-next").disabled = offset + cards.length >= pokedexTotal;
    if (!cards.length) {
      mensagem.textContent = "Nenhum Pokémon encontrado para este tipo.";
      mensagem.classList.remove("hidden");
    }
  } catch (erro) {
    mensagem.textContent = `${erro.message} Verifique sua conexão com a internet.`;
    document.querySelector("#pokedex-list-subtitle").textContent = "Lista indisponível";
  } finally {
    pokedexLoading = false;
  }
}

async function pesquisarPokedex() {
  const termo = document.querySelector("#pokedex-search-input").value.trim().toLowerCase();
  if (!termo) {
    document.querySelector("#pokedex-message").textContent = "Digite o nome ou número de um Pokémon.";
    document.querySelector("#pokedex-message").classList.remove("hidden");
    return;
  }
  await mostrarDetalhesPokedex(termo);
}

// Calcula fraquezas oficiais combinando as relações de dano dos tipos na PokéAPI.
async function calcularFraquezasOficiais(tiposPokemon) {
  const todosTipos = Object.keys(nomesTiposPokemon);
  const multiplicadores = Object.fromEntries(todosTipos.map(tipo => [tipo, 1]));

  for (const tipoPokemon of tiposPokemon) {
    const nomeTipo = tipoPokemon.type.name;
    if (!pokedexDamageRelationsCache.has(nomeTipo)) {
      const dadosTipo = await buscarDadosPokedex(`${POKEAPI_BASE}/type/${nomeTipo}`);
      pokedexDamageRelationsCache.set(nomeTipo, dadosTipo.damage_relations);
    }
    const relacoes = pokedexDamageRelationsCache.get(nomeTipo);
    relacoes.double_damage_from.forEach(item => { multiplicadores[item.name] *= 2; });
    relacoes.half_damage_from.forEach(item => { multiplicadores[item.name] *= 0.5; });
    relacoes.no_damage_from.forEach(item => { multiplicadores[item.name] = 0; });
  }

  return todosTipos
    .filter(tipo => multiplicadores[tipo] >= 2)
    .sort((a, b) => multiplicadores[b] - multiplicadores[a] || nomesTiposPokemon[a].localeCompare(nomesTiposPokemon[b], "pt-BR"))
    .map(tipo => ({ tipo, multiplicador: multiplicadores[tipo] }));
}

async function mostrarDetalhesPokedex(identificador) {
  const mensagem = document.querySelector("#pokedex-message");
  const detalhe = document.querySelector("#pokedex-detail");
  mensagem.textContent = "Buscando informações do Pokémon...";
  mensagem.classList.remove("hidden");
  detalhe.classList.add("hidden");
  try {
    const pokemon = await buscarDadosPokedex(`${POKEAPI_BASE}/pokemon/${encodeURIComponent(String(identificador).toLowerCase())}`);
    const especies = await buscarDadosPokedex(`${POKEAPI_BASE}/pokemon-species/${pokemon.id}`).catch(() => null);
    const nomePt = especies?.names?.find(item => item.language.name === "pt-BR")?.name
      || especies?.names?.find(item => item.language.name === "es")?.name
      || pokemon.name.replace(/-/g, " ");
    const tipos = pokemon.types.map(item => `<span class="pokedex-type type-${item.type.name}">${nomesTiposPokemon[item.type.name] || item.type.name}</span>`).join("");
    const fraquezasOficiais = await calcularFraquezasOficiais(pokemon.types);
    const htmlFraquezas = fraquezasOficiais.length
      ? fraquezasOficiais.map(item => `<span class="pokedex-weakness type-${item.tipo}">${nomesTiposPokemon[item.tipo]} <strong>×${item.multiplicador}</strong></span>`).join("")
      : `<span class="pokedex-no-weakness">Nenhuma fraqueza com dano super efetivo.</span>`;
    const habilidades = pokemon.abilities.map(item => escaparHtmlPokedex(item.ability.name.replace(/-/g, " "))).join(", ");
    const stats = pokemon.stats.map(item => {
      const nome = ({ hp: "HP", attack: "Ataque", defense: "Defesa", "special-attack": "Atq. especial", "special-defense": "Def. especial", speed: "Velocidade" })[item.stat.name] || item.stat.name;
      const valor = item.base_stat;
      return `<div class="pokedex-stat"><div><span>${nome}</span><strong>${valor}</strong></div><div class="pokedex-stat-track"><span style="width:${Math.min(100, valor / 255 * 100)}%"></span></div></div>`;
    }).join("");
    const imagem = pokemon.sprites.other?.["official-artwork"]?.front_default || pokemon.sprites.front_default || "";
    detalhe.innerHTML = `
      <button type="button" class="pokedex-detail-close" id="pokedex-detail-close" aria-label="Fechar detalhes">×</button>
      <div class="pokedex-detail-art"><span>Nº ${String(pokemon.id).padStart(4, "0")}</span><img src="${imagem}" alt="${escaparHtmlPokedex(nomePt)}"></div>
      <div class="pokedex-detail-info">
        <span class="eyebrow">DADOS DA POKÉDEX</span>
        <h2>${escaparHtmlPokedex(nomePt)}</h2>
        <div class="pokedex-types">${tipos}</div>
        <div class="pokedex-facts">
          <div><small>Altura</small><strong>${(pokemon.height / 10).toLocaleString("pt-BR")} m</strong></div>
          <div><small>Peso</small><strong>${(pokemon.weight / 10).toLocaleString("pt-BR")} kg</strong></div>
          <div><small>Experiência base</small><strong>${pokemon.base_experience ?? "—"}</strong></div>
        </div>
        <p class="pokedex-abilities"><strong>Habilidades:</strong> ${habilidades || "Não informado"}</p>
        <section class="pokedex-weakness-section" aria-label="Fraquezas oficiais por tipo">
          <h3>Fraquezas</h3>
          <div class="pokedex-weakness-list">${htmlFraquezas}</div>
          <p class="pokedex-weakness-note">Multiplicadores calculados a partir das relações oficiais de tipos da PokéAPI. ×4 indica fraqueza quádrupla.</p>
        </section>
        <h3>Estatísticas base</h3>
        <div class="pokedex-stats">${stats}</div>
        <p class="pokedex-source">Fonte: PokéAPI · Dados de referência, não substituem o prontuário clínico.</p>
      </div>`;
    detalhe.classList.remove("hidden");
    document.querySelector("#pokedex-detail-close").addEventListener("click", () => detalhe.classList.add("hidden"));
    mensagem.classList.add("hidden");
    detalhe.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (erro) {
    mensagem.textContent = erro.message;
    mensagem.classList.remove("hidden");
  }
}
