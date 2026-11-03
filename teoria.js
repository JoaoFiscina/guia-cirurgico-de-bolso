/**
 * Guia Cirúrgico de Bolso - Aba Teoria Cirúrgica
 * teoria.js - Motor de renderização modular e independente
 */

(function () {
  const STORAGE_KEY_REVIEW = "lacir-teoria-review:v1";
  const DEBUG_PREFIX = "[Teoria]";

  // Estado interno da teoria
  const teoriaState = {
    manifest: null,
    activeModuleId: null,
    activeModuleData: null,
    activeMode: "explorar", // "explorar" ou "quiz"
    activeGroupFilter: "all",
    searchTerm: "",
    selectedInstrumentId: null,
    quiz: {
      currentIndex: 0,
      questions: [],
      revealed: false,
      history: {} // { questionId: 'easy' | 'hard' }
    }
  };

  // Cache dos elementos DOM
  let dom = {};
  let isInitialized = false;

  // Inicializador principal: chamado a cada abertura da aba, mas só configura uma vez
  // (antes, cada abertura duplicava os ouvintes de eventos).
  function init() {
    if (!isInitialized) {
      logInfo("Inicializando Teoria Cirúrgica...");
      cacheElements();
      loadReviewHistory();
      setupLightbox();

      const teoriaSidebarToggle = document.getElementById("mobileTeoriaSidebarToggle");
      const teoriaSidebar = document.querySelector(".teoria-sidebar");
      if (teoriaSidebarToggle && teoriaSidebar) {
        teoriaSidebarToggle.addEventListener("click", () => {
          teoriaSidebar.classList.toggle("is-expanded");
        });
      }

      if (dom.activeModule) {
        dom.activeModule.addEventListener("click", handleModuleClick);
      }

      isInitialized = true;
    }

    // Se o manifesto falhou antes, tenta de novo ao reabrir a aba.
    if (!teoriaState.manifest) {
      fetchManifest();
    }
  }

  // Um único ouvinte para os botões gerados dinamicamente no módulo ativo.
  function handleModuleClick(event) {
    const trigger = event.target.closest("[data-teoria-action]");
    if (!trigger || !dom.activeModule.contains(trigger)) return;

    const action = trigger.dataset.teoriaAction;

    if (action === "open-lightbox") {
      window.TeoriaManager.openLightbox(trigger.dataset.src, trigger.dataset.alt);
    } else if (action === "open-detail-image") {
      const mainImg = document.getElementById("teoriaDetailMainImg");
      window.TeoriaManager.openLightbox(mainImg ? mainImg.src : trigger.dataset.src, trigger.dataset.alt);
    } else if (action === "show-details") {
      showDetails(trigger.dataset.itemId);
    } else if (action === "close-details") {
      closeDetails();
    } else if (action === "select-image") {
      selectDetailImage(Number(trigger.dataset.index));
    } else if (action === "restart-quiz") {
      restartQuiz(trigger.dataset.onlyHard === "true");
    } else if (action === "retry-module") {
      retryActiveModule(trigger.dataset.moduleId, trigger.dataset.fileUrl);
    }
  }

  // Comparação de texto sem acento e sem diferenciar maiúsculas.
  function normalizeText(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  }

  // Embaralhamento uniforme (Fisher-Yates); sort com Math.random é enviesado.
  function shuffle(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Escapar HTML para segurança contra aspas nas strings de attributes
  function escapeHtml(text) {
    if (!text) return "";
    return text.toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Obter lista normalizada de imagens para um item (suporta imagem string e imagens array)
  function getItemImages(item) {
    if (item.imagens && Array.isArray(item.imagens) && item.imagens.length > 0) {
      return item.imagens.map(img => {
        if (typeof img === "string") {
          return {
            src: img,
            alt: item.nome || item.titulo || "Imagem",
            legenda: ""
          };
        } else if (img && typeof img === "object") {
          return {
            src: img.src || "",
            alt: img.alt || item.nome || item.titulo || "Imagem",
            legenda: img.legenda || ""
          };
        }
        return null;
      }).filter(Boolean);
    }
    
    if (item.imagem) {
      return [{
        src: item.imagem,
        alt: item.nome || item.titulo || "Imagem",
        legenda: ""
      }];
    }
    
    return [];
  }

  // Configuração dinâmica do modal Lightbox para ampliação de imagem
  function setupLightbox() {
    let lightbox = document.getElementById("teoriaLightbox");
    if (!lightbox) {
      lightbox = document.createElement("div");
      lightbox.id = "teoriaLightbox";
      lightbox.className = "teoria-lightbox";
      lightbox.setAttribute("aria-hidden", "true");
      lightbox.innerHTML = `
        <button type="button" class="teoria-lightbox-close" aria-label="Fechar">&times;</button>
        <div class="teoria-lightbox-content">
          <img id="teoriaLightboxImage" src="" alt="Imagem ampliada" />
        </div>
      `;
      document.body.appendChild(lightbox);
    }

    const closeBtn = lightbox.querySelector(".teoria-lightbox-close");
    const imgEl = lightbox.querySelector("#teoriaLightboxImage");

    const closeLightbox = () => {
      lightbox.classList.remove("is-open");
      lightbox.setAttribute("aria-hidden", "true");
      imgEl.src = "";
    };

    closeBtn.addEventListener("click", closeLightbox);
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox || e.target.classList.contains("teoria-lightbox-content")) {
        closeLightbox();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && lightbox.classList.contains("is-open")) {
        closeLightbox();
      }
    });

    window.TeoriaManager.openLightbox = (src, alt) => {
      if (!src) return;
      imgEl.src = src;
      imgEl.alt = alt || "Imagem ampliada";
      lightbox.classList.add("is-open");
      lightbox.setAttribute("aria-hidden", "false");
    };
  }

  // Cachear seletores DOM da aba Teoria
  function cacheElements() {
    dom = {
      modulesList: document.getElementById("teoriaModulesList"),
      emptyState: document.getElementById("teoriaEmptyState"),
      activeModule: document.getElementById("teoriaActiveModule"),
      theorySectionTab: document.getElementById("theorySectionTab")
    };
  }

  // Carregar histórico de revisão do localStorage
  function loadReviewHistory() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_REVIEW);
      if (saved) {
        teoriaState.quiz.history = JSON.parse(saved);
      }
    } catch (e) {
      logError("Erro ao carregar histórico de revisão.", e);
    }
  }

  // Salvar progresso de revisão
  function saveReviewHistory() {
    try {
      localStorage.setItem(STORAGE_KEY_REVIEW, JSON.stringify(teoriaState.quiz.history));
    } catch (e) {
      logError("Erro ao salvar histórico de revisão.", e);
    }
  }

  // Buscar manifesto
  async function fetchManifest() {
    try {
      const response = await fetch("teoria/teoria-manifest.json");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      teoriaState.manifest = await response.json();
      logInfo("Manifesto de teoria carregado com sucesso.");
      renderSidebar();
    } catch (error) {
      logError("Falha ao carregar manifesto de teoria.", error);
      if (dom.modulesList) {
        dom.modulesList.innerHTML = `<p class="error-message">Erro ao carregar módulos: ${escapeHtml(error.message)}</p>`;
      }
    }
  }

  // Renderizar sidebar de módulos
  function renderSidebar() {
    if (!dom.modulesList || !teoriaState.manifest) return;

    dom.modulesList.innerHTML = "";

    teoriaState.manifest.modulos.forEach(modulo => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `teoria-module-card ${teoriaState.activeModuleId === modulo.id ? "is-active" : ""}`;
      button.dataset.moduleId = modulo.id;

      button.innerHTML = `
        <span class="teoria-module-icon">${escapeHtml(modulo.icone || "📖")}</span>
        <div class="teoria-module-info">
          <strong class="teoria-module-title">${escapeHtml(modulo.titulo)}</strong>
          <span class="teoria-module-desc">${escapeHtml(modulo.descricao)}</span>
        </div>
      `;

      button.addEventListener("click", () => selectModule(modulo.id, modulo.arquivo));
      dom.modulesList.appendChild(button);
    });
  }

  // Selecionar um módulo de teoria
  async function selectModule(moduleId, fileUrl) {
    if (teoriaState.activeModuleId === moduleId && teoriaState.activeModuleData) {
      const teoriaSidebar = document.querySelector(".teoria-sidebar");
      if (teoriaSidebar) {
        teoriaSidebar.classList.remove("is-expanded");
      }
      return;
    }

    logInfo(`Carregando módulo: ${moduleId} (${fileUrl})`);
    teoriaState.activeModuleId = moduleId;
    // Sem isto, uma falha deixava os dados do módulo anterior e o "Tentar novamente" não fazia nada.
    teoriaState.activeModuleData = null;
    const teoriaSidebar = document.querySelector(".teoria-sidebar");
    if (teoriaSidebar) {
      teoriaSidebar.classList.remove("is-expanded");
    }
    teoriaState.selectedInstrumentId = null;
    teoriaState.activeGroupFilter = "all";
    teoriaState.searchTerm = "";
    teoriaState.activeMode = "explorar";

    // Atualizar classe ativa na sidebar
    const cards = dom.modulesList.querySelectorAll(".teoria-module-card");
    cards.forEach(card => {
      if (card.dataset.moduleId === moduleId) {
        card.classList.add("is-active");
      } else {
        card.classList.remove("is-active");
      }
    });

    // Mostrar carregamento no container ativo
    if (dom.emptyState) dom.emptyState.classList.add("hidden");
    if (dom.activeModule) {
      dom.activeModule.classList.remove("hidden");
      dom.activeModule.innerHTML = `
        <div class="panel">
          <p class="status-message">Carregando conteúdo teórico...</p>
        </div>
      `;
    }

    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      teoriaState.activeModuleData = await response.json();
      logInfo(`Módulo ${moduleId} carregado com sucesso.`);
      
      // Preparar perguntas rápidas
      initializeQuizData();
      
      // Renderizar o módulo
      renderActiveModule();
    } catch (error) {
      logError(`Erro ao carregar o módulo ${moduleId}`, error);
      if (dom.activeModule) {
        dom.activeModule.innerHTML = `
          <div class="panel error-panel">
            <h3>Falha ao carregar conteúdo</h3>
            <p>${escapeHtml(error.message)}</p>
            <button type="button" class="button button-primary" data-teoria-action="retry-module" data-module-id="${escapeHtml(moduleId)}" data-file-url="${escapeHtml(fileUrl)}">Tentar novamente</button>
          </div>
        `;
      }
    }
  }

  // Inicializar dados de quiz para o módulo atual
  function initializeQuizData() {
    const questions = teoriaState.activeModuleData.perguntas || [];
    // Embaralhar as perguntas para uma melhor experiência
    teoriaState.quiz.questions = shuffle(questions);
    teoriaState.quiz.currentIndex = 0;
    teoriaState.quiz.revealed = false;
  }

  // Renderizar o módulo ativo
  function renderActiveModule() {
    if (!dom.activeModule || !teoriaState.activeModuleData) return;

    const data = teoriaState.activeModuleData;

    dom.activeModule.innerHTML = `
      <!-- Cabeçalho do Módulo -->
      <header class="teoria-header">
        <div class="teoria-header-meta">
          <span class="badge category-badge">${escapeHtml(data.categoria)}</span>
          <span class="badge neutral-badge" id="teoriaModuleStats"></span>
        </div>
        <div class="teoria-title-row">
          <h2>${escapeHtml(data.titulo)}</h2>
        </div>
        <p class="teoria-description">${escapeHtml(data.descricao)}</p>
        ${data.fonte ? `<p class="teoria-fonte">Fonte: ${escapeHtml(data.fonte)}</p>` : ""}
      </header>

      <!-- Abas de Modo -->
      <nav class="teoria-mode-tabs">
        <button type="button" class="teoria-mode-tab ${teoriaState.activeMode === "explorar" ? "is-active" : ""}" id="teoriaTabExplorar">
          📚 Explorar
        </button>
        <button type="button" class="teoria-mode-tab ${teoriaState.activeMode === "quiz" ? "is-active" : ""}" id="teoriaTabQuiz">
          ⚡ Perguntas Rápidas
        </button>
      </nav>

      <!-- Painel de Detalhes de Instrumento (Oculto por padrão, abre inline) -->
      <div id="teoriaDetailContainer"></div>

      <!-- Conteúdo do Módulo -->
      <div id="teoriaContentArea"></div>
    `;

    // Atualizar Estatísticas do Módulo (Quantidade de itens e progresso do quiz)
    updateModuleStats();

    // Adicionar Event Listeners das abas de modo
    document.getElementById("teoriaTabExplorar").addEventListener("click", () => {
      setMode("explorar");
    });
    document.getElementById("teoriaTabQuiz").addEventListener("click", () => {
      setMode("quiz");
    });

    // Renderizar a área de conteúdo inicial
    renderContentArea();
  }

  // Atualizar contagem no cabeçalho do módulo
  function updateModuleStats() {
    const statsEl = document.getElementById("teoriaModuleStats");
    if (!statsEl || !teoriaState.activeModuleData) return;

    const data = teoriaState.activeModuleData;
    let statsText = "";

    if (data.instrumentos) {
      statsText = `${data.instrumentos.length} itens `;
    } else if (data.topicos) {
      statsText = `${data.topicos.length} tópicos `;
    }

    if (data.perguntas && data.perguntas.length > 0) {
      const answeredCount = data.perguntas.filter(q => teoriaState.quiz.history[q.id] === "easy").length;
      statsText += `• Revisão: ${answeredCount}/${data.perguntas.length} dominados`;
    }

    statsEl.textContent = statsText;
  }

  // Alternar o modo de estudo (Explorar / Quiz)
  function setMode(mode) {
    if (teoriaState.activeMode === mode) return;
    teoriaState.activeMode = mode;
    teoriaState.selectedInstrumentId = null;

    // Atualizar abas
    const tabExplorar = document.getElementById("teoriaTabExplorar");
    const tabQuiz = document.getElementById("teoriaTabQuiz");

    if (mode === "explorar") {
      tabExplorar.classList.add("is-active");
      tabQuiz.classList.remove("is-active");
    } else {
      tabQuiz.classList.add("is-active");
      tabExplorar.classList.remove("is-active");
    }

    // Fechar detalhe anterior
    const detailContainer = document.getElementById("teoriaDetailContainer");
    if (detailContainer) detailContainer.innerHTML = "";

    renderContentArea();
  }

  // Renderizar área de conteúdo de acordo com o modo
  function renderContentArea() {
    const area = document.getElementById("teoriaContentArea");
    if (!area) return;

    if (teoriaState.activeMode === "explorar") {
      renderExplorarMode(area);
    } else {
      renderQuizMode(area);
    }
  }

  // ==========================================
  // MODO EXPLORAR (Grid, Busca, Filtros, Detalhes)
  // ==========================================
  function renderExplorarMode(container) {
    const data = teoriaState.activeModuleData;

    // 1. Tópicos Gerais (se houver, como regras de mesa/passagem)
    let topicsHtml = "";
    if (data.topicos_gerais && data.topicos_gerais.length > 0) {
      topicsHtml = `
        <div class="teoria-general-topics">
          ${data.topicos_gerais.map(topic => `
            <div class="teoria-topic-panel">
              <h3>${escapeHtml(topic.titulo)}</h3>
              <div class="teoria-topic-grid">
                <div class="teoria-topic-content">
                  <ul class="teoria-detail-list">
                    ${(topic.conteudo || []).map(item => `<li>${escapeHtml(item)}</li>`).join("")}
                  </ul>
                </div>
                ${(() => {
                  const topicImages = getItemImages(topic);
                  const firstImg = topicImages.length > 0 ? topicImages[0] : null;
                  const firstImgSrc = firstImg ? firstImg.src : "";
                  return firstImgSrc ? `
                    <div class="teoria-topic-image" style="cursor: pointer;" data-teoria-action="open-lightbox" data-src="${escapeHtml(firstImgSrc)}" data-alt="${escapeHtml(topic.titulo)}">
                      <img src="${escapeHtml(firstImgSrc)}" alt="${escapeHtml(topic.titulo)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'"/>
                      <div class="teoria-card-fallback-icon" style="display: none; flex-direction: column; gap: 8px; align-items: center; justify-content: center; width: 100%; height: 100%;">
                        <span style="font-size: 3rem; opacity: 0.5;">📖</span>
                        <span style="font-size: 0.8rem; color: var(--muted); font-weight: 500;">Imagem em revisão</span>
                      </div>
                    </div>
                  ` : "";
                })()}
              </div>
            </div>
          `).join("")}
        </div>
      `;
    }

    // 2. Filtros de Grupo e Barra de Pesquisa (apenas se tiver instrumentos ou tópicos detalhados)
    let filtersHtml = "";
    let searchHtml = "";
    let gridHtml = "";

    if (data.instrumentos || data.topicos) {
      // Filtros de Grupo (ex: Diérese, Preensão)
      if (data.grupos && data.grupos.length > 0) {
        filtersHtml = `
          <div class="teoria-filters">
            <button type="button" class="teoria-filter-chip ${teoriaState.activeGroupFilter === "all" ? "is-active" : ""}" data-group="all">
              Todos os grupos
            </button>
            ${data.grupos.map(grupo => `
              <button type="button" class="teoria-filter-chip ${teoriaState.activeGroupFilter === grupo.id ? "is-active" : ""}" data-group="${escapeHtml(grupo.id)}">
                ${escapeHtml(grupo.nome)}
              </button>
            `).join("")}
          </div>
        `;
      }

      // Campo de busca
      searchHtml = `
        <div class="teoria-search-container">
          <input type="search" id="teoriaSearchInput" placeholder="Buscar instrumentais, funções ou palavras-chave..." value="${escapeHtml(teoriaState.searchTerm)}" autocomplete="off" />
        </div>
      `;

      // Placeholder do grid
      gridHtml = `<div class="teoria-grid" id="teoriaItemsGrid"></div>`;
    }

    container.innerHTML = `
      ${topicsHtml}
      ${searchHtml}
      ${filtersHtml}
      ${gridHtml}
    `;

    // Ligar listeners de busca e filtro
    bindExplorarEvents();

    // Renderizar itens no grid
    renderGridItems();
  }

  function bindExplorarEvents() {
    const searchInput = document.getElementById("teoriaSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        teoriaState.searchTerm = e.target.value.trim();
        renderGridItems();
      });
    }

    const filterChips = document.querySelectorAll(".teoria-filter-chip");
    filterChips.forEach(chip => {
      chip.addEventListener("click", () => {
        filterChips.forEach(c => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        teoriaState.activeGroupFilter = chip.dataset.group;
        renderGridItems();
      });
    });
  }

  // Filtrar e renderizar itens no grid
  function renderGridItems() {
    const grid = document.getElementById("teoriaItemsGrid");
    if (!grid || !teoriaState.activeModuleData) return;

    const data = teoriaState.activeModuleData;
    const items = data.instrumentos || data.topicos || [];
    const groups = data.grupos || [];

    // Aplicar filtros
    const filteredItems = items.filter(item => {
      // Filtro de Grupo
      if (teoriaState.activeGroupFilter !== "all" && item.grupo !== teoriaState.activeGroupFilter) {
        return false;
      }

      // Filtro de busca textual
      if (teoriaState.searchTerm) {
        const query = normalizeText(teoriaState.searchTerm);
        const nameMatch = normalizeText(item.nome || item.titulo).includes(query);
        const functionMatch = normalizeText(item.funcao || item.descricao).includes(query);
        const recogMatch = normalizeText(item.como_reconhecer).includes(query);
        const tagMatch = item.tags ? item.tags.some(t => normalizeText(t).includes(query)) : false;

        return nameMatch || functionMatch || recogMatch || tagMatch;
      }

      return true;
    });

    if (filteredItems.length === 0) {
      grid.innerHTML = `
        <div class="panel" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
          <p class="sidebar-copy">Nenhum instrumental corresponde aos filtros aplicados.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filteredItems.map(item => {
      const groupInfo = groups.find(g => g.id === item.grupo);
      const badgeStyle = `background-color: ${escapeHtml((groupInfo && groupInfo.cor) || "var(--green)")}`;
      const title = item.nome || item.titulo || "Sem Nome";
      const subtitle = item.funcao || item.descricao || "";
      
      const images = getItemImages(item);
      const mainImg = images.length > 0 ? images[0] : null;
      const mainImgSrc = mainImg ? mainImg.src : "";
      
      return `
        <div class="teoria-card" id="card-${escapeHtml(item.id)}">
          ${mainImgSrc ? `
            <div class="teoria-card-image">
              <img src="${escapeHtml(mainImgSrc)}" alt="${escapeHtml(mainImg.alt)}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'"/>
              <div class="teoria-card-fallback-icon" style="display: none; flex-direction: column; gap: 8px; align-items: center; justify-content: center; width: 100%; height: 100%;">
                <span style="font-size: 2.8rem; opacity: 0.5;">${teoriaState.activeModuleId === "instrumental_cirurgico" ? "🔧" : "📖"}</span>
                <span style="font-size: 0.8rem; color: var(--muted); font-weight: 500;">Imagem em revisão</span>
              </div>
            </div>
          ` : ""}
          
          ${groupInfo ? `
            <span class="teoria-card-badge" style="${badgeStyle}">${escapeHtml(groupInfo.nome)}</span>
          ` : ""}

          <div class="teoria-card-info">
            <h4 class="teoria-card-title">${escapeHtml(title)}</h4>
            <p class="teoria-card-desc">${escapeHtml(subtitle.length > 90 ? subtitle.slice(0, 87) + "..." : subtitle)}</p>
          </div>

          <button type="button" class="button button-secondary button-compact teoria-card-action" data-teoria-action="show-details" data-item-id="${escapeHtml(item.id)}">
            🔍 Ver Detalhes
          </button>
        </div>
      `;
    }).join("");
  }

  // Mostrar painel de detalhes do instrumental
  function showDetails(itemId) {
    const detailContainer = document.getElementById("teoriaDetailContainer");
    if (!detailContainer || !teoriaState.activeModuleData) return;

    const data = teoriaState.activeModuleData;
    const items = data.instrumentos || data.topicos || [];
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    teoriaState.selectedInstrumentId = itemId;
    teoriaState.activeDetailImageIndex = 0; // Reset index upon opening new item

    const title = item.nome || item.titulo || "Sem nome";
    const groupInfo = (data.grupos || []).find(g => g.id === item.grupo);

    const images = getItemImages(item);
    const activeIndex = teoriaState.activeDetailImageIndex || 0;
    const selectedImg = images.length > 0 ? images[activeIndex] : null;
    const selectedImgSrc = selectedImg ? selectedImg.src : "";

    detailContainer.innerHTML = `
      <div class="teoria-detail-panel">
        <div class="teoria-detail-header">
          <div class="teoria-detail-title-col">
            <span class="badge category-badge" style="background-color: ${escapeHtml((groupInfo && groupInfo.cor) || "var(--green)")}">${escapeHtml(groupInfo ? groupInfo.nome : "Tópico")}</span>
            <h3>${escapeHtml(title)}</h3>
          </div>
          <button type="button" class="button button-ghost button-compact" data-teoria-action="close-details" aria-label="Fechar detalhes" style="font-size: 1.5rem; line-height: 1;">×</button>
        </div>

        <div class="teoria-detail-grid" ${images.length === 0 ? 'style="grid-template-columns: 1fr;"' : ''}>
          <!-- Bloco Imagem -->
          ${images.length > 0 ? `
            <div class="teoria-detail-image-box-wrapper">
              <div class="teoria-detail-image-box" style="cursor: pointer;"
                   data-teoria-action="open-detail-image" data-src="${escapeHtml(selectedImgSrc)}" data-alt="${escapeHtml(title)}">
                ${selectedImgSrc ? `
                  <img id="teoriaDetailMainImg" src="${escapeHtml(selectedImgSrc)}" alt="${escapeHtml(selectedImg.alt)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'"/>
                ` : ""}
                <div class="teoria-card-fallback-icon" style="display: ${selectedImgSrc ? "none" : "flex"}; flex-direction: column; gap: 8px; align-items: center; justify-content: center; width: 100%; height: 100%;">
                  <span style="font-size: 4rem; opacity: 0.5;">${teoriaState.activeModuleId === "instrumental_cirurgico" ? "🔧" : "📖"}</span>
                  <span style="font-size: 0.9rem; color: var(--muted); font-weight: 500;">Imagem em revisão</span>
                </div>
              </div>
              
              ${selectedImg && selectedImg.legenda ? `
                <p class="teoria-detail-image-caption" id="teoriaDetailImageCaption">${escapeHtml(selectedImg.legenda)}</p>
              ` : `
                <p class="teoria-detail-image-caption" id="teoriaDetailImageCaption" style="display: none;"></p>
              `}
              
              ${images.length > 1 ? `
                <div class="teoria-detail-gallery-thumbnails">
                  ${images.map((img, idx) => `
                    <button type="button" class="teoria-detail-thumbnail ${idx === activeIndex ? 'is-active' : ''}"
                            data-teoria-action="select-image" data-index="${idx}" aria-label="Visualizar imagem ${idx + 1}">
                      <img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt)}" loading="lazy" />
                    </button>
                  `).join("")}
                </div>
              ` : ""}
            </div>
          ` : ""}

          <!-- Bloco Informações -->
          <div class="teoria-detail-info-box">
            ${item.funcao ? `
              <div>
                <h5 class="teoria-detail-section-title">Função Principal</h5>
                <p class="teoria-detail-text">${escapeHtml(item.funcao)}</p>
              </div>
            ` : item.conteudo ? `
              <div>
                <h5 class="teoria-detail-section-title">Conteúdo</h5>
                <ul class="teoria-detail-list">
                  ${item.conteudo.map(li => `<li>${escapeHtml(li)}</li>`).join("")}
                </ul>
              </div>
            ` : ""}

            ${item.caracteristicas && item.caracteristicas.length > 0 ? `
              <div>
                <h5 class="teoria-detail-section-title">Características Físicas</h5>
                <ul class="teoria-detail-list">
                  ${item.caracteristicas.map(carac => `<li>${escapeHtml(carac)}</li>`).join("")}
                </ul>
              </div>
            ` : ""}

            ${item.usos && item.usos.length > 0 ? `
              <div>
                <h5 class="teoria-detail-section-title">Aplicações Clínicas / Indicações</h5>
                <ul class="teoria-detail-list">
                  ${item.usos.map(uso => `<li>${escapeHtml(uso)}</li>`).join("")}
                </ul>
              </div>
            ` : ""}

            ${item.como_reconhecer ? `
              <div>
                <h5 class="teoria-detail-section-title">Como Reconhecer Facilmente</h5>
                <p class="teoria-detail-text">${escapeHtml(item.como_reconhecer)}</p>
              </div>
            ` : ""}

            ${item.pegadinha ? `
              <div class="teoria-pegadinha-box">
                <h5 class="teoria-detail-section-title">⚠️ Pegadinha de Prova / Dica Técnica</h5>
                <p class="teoria-detail-text" style="font-weight: 500;">${escapeHtml(item.pegadinha)}</p>
              </div>
            ` : ""}
          </div>
        </div>
      </div>
    `;

    // Rolar suavemente para o painel de detalhes
    detailContainer.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeDetails() {
    const detailContainer = document.getElementById("teoriaDetailContainer");
    if (detailContainer) {
      detailContainer.innerHTML = "";
    }
    teoriaState.selectedInstrumentId = null;
  }

  // ==========================================
  // MODO QUIZ (Revisão Ativa / Flashcards)
  // ==========================================
  function renderQuizMode(container) {
    const quiz = teoriaState.quiz;

    if (quiz.questions.length === 0) {
      container.innerHTML = `
        <div class="panel" style="text-align: center; padding: 40px;">
          <p class="sidebar-copy">Este módulo não possui perguntas cadastradas.</p>
        </div>
      `;
      return;
    }

    // Caso tenha finalizado todas as perguntas do bloco
    if (quiz.currentIndex >= quiz.questions.length) {
      renderQuizFinished(container);
      return;
    }

    const question = quiz.questions[quiz.currentIndex];
    const progressText = `Pergunta ${quiz.currentIndex + 1} de ${quiz.questions.length}`;

    container.innerHTML = `
      <div class="teoria-quiz-container">
        <span class="teoria-quiz-progress">${progressText}</span>

        <!-- Flashcard -->
        <div class="teoria-flashcard ${quiz.revealed ? "is-revealed" : ""}" id="teoriaFlashcard">
          <span class="teoria-flashcard-tag">${escapeHtml(question.grupo ? question.grupo.toUpperCase() : "TEORIA")}</span>

          <p class="teoria-flashcard-question">${escapeHtml(question.pergunta)}</p>

          ${quiz.revealed ? `
            <div class="teoria-flashcard-answer-box">
              <p class="teoria-detail-section-title">Resposta Educacional</p>
              <p class="teoria-flashcard-answer">${escapeHtml(question.resposta)}</p>
            </div>
          ` : `
            <span class="teoria-flashcard-hint">Clique no card para revelar a resposta</span>
          `}
        </div>

        <!-- Controles do Quiz -->
        <div class="teoria-quiz-controls">
          ${quiz.revealed ? `
            <button type="button" class="button button-secondary" id="quizBtnHard">
              🔴 Revisar depois
            </button>
            <button type="button" class="button button-primary" id="quizBtnEasy">
              🟢 Acertei / Já sei!
            </button>
          ` : `
            <button type="button" class="button button-primary" id="quizBtnReveal" style="max-width: 300px; margin: 0 auto;">
              👁️ Revelar Resposta
            </button>
          `}
        </div>
      </div>
    `;

    bindQuizEvents();
  }

  function bindQuizEvents() {
    const flashcard = document.getElementById("teoriaFlashcard");
    const btnReveal = document.getElementById("quizBtnReveal");
    const btnEasy = document.getElementById("quizBtnEasy");
    const btnHard = document.getElementById("quizBtnHard");

    const revealAction = () => {
      if (teoriaState.quiz.revealed) return;
      teoriaState.quiz.revealed = true;
      renderContentArea();
    };

    if (flashcard) flashcard.addEventListener("click", revealAction);
    if (btnReveal) btnReveal.addEventListener("click", revealAction);

    if (btnEasy) {
      btnEasy.addEventListener("click", () => {
        const question = teoriaState.quiz.questions[teoriaState.quiz.currentIndex];
        teoriaState.quiz.history[question.id] = "easy";
        saveReviewHistory();
        nextQuestion();
      });
    }

    if (btnHard) {
      btnHard.addEventListener("click", () => {
        const question = teoriaState.quiz.questions[teoriaState.quiz.currentIndex];
        teoriaState.quiz.history[question.id] = "hard";
        saveReviewHistory();
        nextQuestion();
      });
    }
  }

  function nextQuestion() {
    teoriaState.quiz.currentIndex++;
    teoriaState.quiz.revealed = false;
    updateModuleStats();
    renderContentArea();
  }

  // Quiz concluído
  function renderQuizFinished(container) {
    const questions = teoriaState.quiz.questions;
    const history = teoriaState.quiz.history;

    const easyCount = questions.filter(q => history[q.id] === "easy").length;
    const hardCount = questions.length - easyCount;

    container.innerHTML = `
      <div class="panel" style="text-align: center; max-width: 500px; margin: 0 auto; padding: 40px; display: flex; flex-direction: column; gap: 20px;">
        <span style="font-size: 4rem;">🎉</span>
        <h3>Módulo revisado!</h3>
        <p class="sidebar-copy">Você concluiu a rodada de revisão rápida para este módulo teórico.</p>
        
        <div class="status-grid" style="grid-template-columns: 1fr 1fr; margin-top: 12px;">
          <div class="status-card" style="border-left: 4px solid var(--green);">
            <span class="status-label">Já dominados</span>
            <strong>${easyCount}</strong>
          </div>
          <div class="status-card" style="border-left: 4px solid #d39e00;">
            <span class="status-label">Para revisar</span>
            <strong>${hardCount}</strong>
          </div>
        </div>

        <div style="display: flex; gap: 12px; margin-top: 16px;">
          <button type="button" class="button button-secondary" data-teoria-action="restart-quiz" data-only-hard="false" style="flex: 1;">
            🔁 Repetir tudo
          </button>
          ${hardCount > 0 ? `
            <button type="button" class="button button-primary" data-teoria-action="restart-quiz" data-only-hard="true" style="flex: 1;">
              🎯 Revisar erros
            </button>
          ` : ""}
        </div>
      </div>
    `;
  }

  // Reiniciar quiz
  function restartQuiz(onlyHard = false) {
    const allQuestions = teoriaState.activeModuleData.perguntas || [];
    
    if (onlyHard) {
      // Filtrar apenas as que marcou como hard (revisar depois)
      teoriaState.quiz.questions = allQuestions.filter(q => teoriaState.quiz.history[q.id] === "hard");
      if (teoriaState.quiz.questions.length === 0) {
        teoriaState.quiz.questions = [...allQuestions];
      }
    } else {
      // Repetir tudo e reembaralhar
      teoriaState.quiz.questions = shuffle(allQuestions);
    }

    teoriaState.quiz.currentIndex = 0;
    teoriaState.quiz.revealed = false;
    renderContentArea();
  }

  // Tentar recarregar o módulo em caso de erro
  function retryActiveModule(moduleId, fileUrl) {
    selectModule(moduleId, fileUrl);
  }

  // Logger helper
  function logInfo(message, details) {
    if (details === undefined) {
      console.info(`${DEBUG_PREFIX} ${message}`);
      return;
    }
    console.info(`${DEBUG_PREFIX} ${message}`, details);
  }

  function logError(message, details) {
    if (details === undefined) {
      console.error(`${DEBUG_PREFIX} ${message}`);
      return;
    }
    console.error(`${DEBUG_PREFIX} ${message}`, details);
  }

  // Mudar a imagem exibida no detalhe (galeria)
  function selectDetailImage(index) {
    teoriaState.activeDetailImageIndex = index;
    const detailGrid = document.querySelector(".teoria-detail-grid");
    if (!detailGrid || !teoriaState.selectedInstrumentId) return;
    
    const items = (teoriaState.activeModuleData.instrumentos || teoriaState.activeModuleData.topicos || []);
    const item = items.find(i => i.id === teoriaState.selectedInstrumentId);
    if (!item) return;
    
    const images = getItemImages(item);
    if (index < 0 || index >= images.length) return;
    
    const selectedImg = images[index];
    const mainImgEl = document.getElementById("teoriaDetailMainImg");
    const imageBoxEl = document.querySelector(".teoria-detail-image-box");
    
    if (mainImgEl) {
      mainImgEl.src = selectedImg.src;
      mainImgEl.alt = selectedImg.alt;
      mainImgEl.style.display = "block";
      
      const fallbackEl = imageBoxEl ? imageBoxEl.querySelector(".teoria-card-fallback-icon") : null;
      if (fallbackEl) fallbackEl.style.display = "none";
    }
    
    // Atualizar classe ativa nas miniaturas
    const thumbnails = document.querySelectorAll(".teoria-detail-thumbnail");
    thumbnails.forEach((thumb, idx) => {
      if (idx === index) {
        thumb.classList.add("is-active");
      } else {
        thumb.classList.remove("is-active");
      }
    });
    
    // Atualizar legenda
    const captionEl = document.getElementById("teoriaDetailImageCaption");
    if (captionEl) {
      if (selectedImg.legenda) {
        captionEl.textContent = selectedImg.legenda;
        captionEl.style.display = "block";
      } else {
        captionEl.textContent = "";
        captionEl.style.display = "none";
      }
    }
  }

  // Expor gerenciador da teoria globalmente
  window.TeoriaManager = {
    init: init,
    showDetails: showDetails,
    closeDetails: closeDetails,
    restartQuiz: restartQuiz,
    retryActiveModule: retryActiveModule,
    selectDetailImage: selectDetailImage
  };

  // Inicializar quando o DOM estiver pronto
  document.addEventListener("DOMContentLoaded", () => {
    // Se a aba estiver ativa por padrão, inicializa
    const theoryTab = document.getElementById("theorySectionTab");
    if (theoryTab && theoryTab.classList.contains("is-active")) {
      init();
    }
  });
})();
