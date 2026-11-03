const STORAGE_KEY = "atlas-cirurgico-de-bolso:v2";
const CONFIG_PATH = "config/app-config.json";
const MANIFEST_FILENAME = "procedimentos-manifest.json";
const SUPPORTED_EXTENSIONS = [".json", ".txt"];
const DEBUG_PREFIX = "[Guia LACIR]";
const VERSIONS_PATH = "versoes.json";
const SEEN_VERSION_KEY = "lacir-versao-vista";
let catalogLoadToken = 0;
// Roteiro cujos passos estão desenhados no modo sequência (permite atualizar só o último cartão).
let renderedSequenceProcedure = null;
const DISPLAY_CATEGORIES = [
  "Lesões de pele e subcutâneo",
  "Suturas, feridas e curativos",
  "Sondas e drenos",
  "Acessos vasculares",
  "Via aérea e oxigenoterapia",
  "Trauma e emergência",
  "Cavidade abdominal e peritônio",
  "Procedimentos torácicos",
  "Urologia",
  "Punções e anestesia",
  "Cirurgia plástica e reconstrução",
  "Outros procedimentos"
];
// Cada termo casa com o início de uma palavra da categoria (ou do nome) já sem acentos.
const CATEGORY_RULES = [
  { category: "Cirurgia plástica e reconstrução", terms: ["enxertia", "retalho", "reconstrucao", "plastica", "zetaplastia"] },
  { category: "Urologia", terms: ["urologia", "cistostomia", "vesical"] },
  { category: "Procedimentos torácicos", terms: ["torac", "torax", "pleural", "pericardiocentese"] },
  { category: "Trauma e emergência", terms: ["trauma", "lpd", "atls", "emergencia"] },
  { category: "Cavidade abdominal e peritônio", terms: ["paracentese", "periton", "abdom"] },
  {
    category: "Via aérea e oxigenoterapia",
    terms: ["via aerea", "vias aereas", "iot", "intubacao", "ambu", "mascara", "canula", "crico", "traqueostomia", "oxigenoterapia"]
  },
  {
    category: "Acessos vasculares",
    terms: ["acesso", "venos", "venosa", "arterial", "gasometria", "pam", "intraosse", "disseccao venosa"]
  },
  { category: "Sondas e drenos", terms: ["sonda", "sondagem", "dreno"] },
  { category: "Suturas, feridas e curativos", terms: ["sutura", "ferida", "curativo", "pontos"] },
  {
    category: "Lesões de pele e subcutâneo",
    terms: ["lesoes de pele", "lesao de pele", "pele", "subcutaneo", "lipoma", "cisto", "abscesso"]
  },
  { category: "Punções e anestesia", terms: ["puncao lombar", "anestesi", "bloqueio"] }
];
const DEFAULT_APP_CONFIG = {
  github: {
    owner: "JoaoFiscina",
    repo: "Guia-cir-rgico-de-bolso-LACIR",
    branch: "main",
    proceduresPath: "procedimentos"
  }
};
const LOCAL_EXAMPLE_FILES = [
  "procedimentos/reconstrucao_cutanea_por_enxertia.txt",
  "procedimentos/reconstrucao_cutanea_por_enxertia_importacao1.txt"
];
const SOURCE_PRIORITY = {
  local: 0,
  github: 1,
  manifest: 2,
  example: 3
};

const appState = {
  config: null,
  procedures: [],
  baseProcedures: [],
  localImports: {},
  baseIssues: [],
  mergeIssues: [],
  selectedProcedureId: null,
  mode: "study",
  sequencePanelPinned: true,
  searchTerm: "",
  selectedCategory: "all",
  selectedDiscipline: "all",
  progress: {},
  primarySource: {
    kind: "none",
    label: "Nenhuma",
    fileCount: 0,
    filesProcessed: 0
  },
  loading: {
    active: false,
    label: "Aguardando",
    current: 0,
    total: 0
  },
  favorites: [],
  showFavoritesOnly: false,
  focusMode: false,
  versionInfo: null,
  statusDetail: "Aguardando inicialização."
};

const elements = {
  searchInput: document.querySelector("#searchInput"),
  categoryFilter: document.querySelector("#categoryFilter"),
  disciplineFilter: document.querySelector("#disciplineFilter"),
  disciplineFilterField: document.querySelector("#disciplineFilterField"),
  selectedDisciplineBadge: document.querySelector("#selectedDisciplineBadge"),
  procedureCountBadge: document.querySelector("#procedureCountBadge"),
  procedureList: document.querySelector("#procedureList"),
  loadMessage: document.querySelector("#loadMessage"),
  clearSavedProgressButton: document.querySelector("#clearSavedProgressButton"),
  reloadProceduresButton: document.querySelector("#reloadProceduresButton"),
  importSingleButton: document.querySelector("#importSingleButton"),
  importMultipleButton: document.querySelector("#importMultipleButton"),
  clearLocalImportsButton: document.querySelector("#clearLocalImportsButton"),
  singleFileInput: document.querySelector("#singleFileInput"),
  multipleFilesInput: document.querySelector("#multipleFilesInput"),
  emptyState: document.querySelector("#emptyState"),
  emptyStateTitle: document.querySelector("#emptyStateTitle"),
  emptyStateText: document.querySelector("#emptyStateText"),
  quickProcedurePicker: document.querySelector("#quickProcedurePicker"),
  quickProcedureSelect: document.querySelector("#quickProcedureSelect"),
  quickProcedureHint: document.querySelector("#quickProcedureHint"),
  randomProcedureButton: document.querySelector("#randomProcedureButton"),
  procedureView: document.querySelector("#procedureView"),
  selectedCategory: document.querySelector("#selectedCategory"),
  selectedStepSummary: document.querySelector("#selectedStepSummary"),
  selectedSourceBadge: document.querySelector("#selectedSourceBadge"),
  selectedFileLabel: document.querySelector("#selectedFileLabel"),
  selectedProcedureName: document.querySelector("#selectedProcedureName"),
  selectedProcedureDescription: document.querySelector("#selectedProcedureDescription"),
  heroImageWrapper: document.querySelector("#heroImageWrapper"),
  heroImage: document.querySelector("#heroImage"),
  studyModeButton: document.querySelector("#studyModeButton"),
  sequenceModeButton: document.querySelector("#sequenceModeButton"),
  backToStartButton: document.querySelector("#backToStartButton"),
  detailsContainer: document.querySelector("#detailsContainer"),
  openAllInfoButton: document.querySelector("#openAllInfoButton"),
  closeAllInfoButton: document.querySelector("#closeAllInfoButton"),
  stepsOnlyButton: document.querySelector("#stepsOnlyButton"),
  hubViewListButton: document.querySelector("#hubViewListButton"),
  hubRandomButton: document.querySelector("#hubRandomButton"),
  checklistProgressText: document.querySelector("#checklistProgressText"),
  studyStepsList: document.querySelector("#studyStepsList"),
  clearChecklistButton: document.querySelector("#clearChecklistButton"),
  studyView: document.querySelector("#studyView"),
  sequenceSection: document.querySelector("#sequenceSection"),
  sequenceSummary: document.querySelector("#sequenceSummary"),
  previousStepButton: document.querySelector("#previousStepButton"),
  nextStepButton: document.querySelector("#nextStepButton"),
  restartSequenceButton: document.querySelector("#restartSequenceButton"),
  toggleSequencePinButton: document.querySelector("#toggleSequencePinButton"),
  mobilePreviousStepButton: document.querySelector("#mobilePreviousStepButton"),
  mobileNextStepButton: document.querySelector("#mobileNextStepButton"),
  mobileRestartSequenceButton: document.querySelector("#mobileRestartSequenceButton"),
  mobileSequenceCounter: document.querySelector("#mobileSequenceCounter"),
  mobileSequenceProgressBar: document.querySelector("#mobileSequenceProgressBar"),
  sequenceCounter: document.querySelector("#sequenceCounter"),
  sequenceProgressBar: document.querySelector("#sequenceProgressBar"),
  sequenceIntro: document.querySelector("#sequenceIntro"),
  sequenceStepsList: document.querySelector("#sequenceStepsList"),
  statusMessage: document.querySelector("#statusMessage"),
  loadedProcedureCount: document.querySelector("#loadedProcedureCount"),
  statusProcedureBreakdown: document.querySelector("#statusProcedureBreakdown"),
  dataSourceLabel: document.querySelector("#dataSourceLabel"),
  configSummary: document.querySelector("#configSummary"),
  fileLoadSummary: document.querySelector("#fileLoadSummary"),
  issueSummary: document.querySelector("#issueSummary"),
  loadingLabel: document.querySelector("#loadingLabel"),
  loadingCounter: document.querySelector("#loadingCounter"),
  loadingProgressBar: document.querySelector("#loadingProgressBar"),
  issueCountBadge: document.querySelector("#issueCountBadge"),
  issuesList: document.querySelector("#issuesList"),
  issuesPanel: document.querySelector(".issues-panel"),
  statusPanel: document.querySelector(".status-panel"),
  toggleFavoritesFilterButton: document.querySelector("#toggleFavoritesFilterButton"),
  selectedProcedureFavoriteButton: document.querySelector("#selectedProcedureFavoriteButton"),
  mobileSidebarToggle: document.querySelector("#mobileSidebarToggle"),
  sidebar: document.querySelector(".sidebar"),
  focusModeButton: document.querySelector("#focusModeButton"),
  practiceSectionTab: document.querySelector("#practiceSectionTab"),
  theorySectionTab: document.querySelector("#theorySectionTab"),
  practiceSection: document.querySelector("#practiceSection"),
  theorySection: document.querySelector("#theorySection"),
  versionButton: document.querySelector("#versionButton"),
  versionLabel: document.querySelector("#versionLabel"),
  versionToast: document.querySelector("#versionToast"),
  versionToastText: document.querySelector("#versionToastText"),
  versionToastOpen: document.querySelector("#versionToastOpen"),
  versionToastClose: document.querySelector("#versionToastClose"),
  versionDialog: document.querySelector("#versionDialog"),
  versionDialogClose: document.querySelector("#versionDialogClose"),
  versionList: document.querySelector("#versionList")
};

document.addEventListener("DOMContentLoaded", initializeApp);

async function initializeApp() {
  logInfo("Início da inicialização.");

  try {
    restoreState();
    bindEvents();
    initializeLogoMarks();
    render();
    loadVersionInfo();
    await bootstrapCatalog();
  } catch (error) {
    logError("Falha inesperada na inicialização.", error);
    setStatusDetail("Falha inesperada na inicialização. Você ainda pode usar a importação local.");
    setLoadingState(false, "Falha na inicialização", 0, 0);
    showMessage("A inicialização automática falhou. A importação local continua disponível.", "error");
  }
}

function logInfo(message, details) {
  if (details === undefined) {
    console.info(`${DEBUG_PREFIX} ${message}`);
    return;
  }

  console.info(`${DEBUG_PREFIX} ${message}`, details);
}

function logWarn(message, details) {
  if (details === undefined) {
    console.warn(`${DEBUG_PREFIX} ${message}`);
    return;
  }

  console.warn(`${DEBUG_PREFIX} ${message}`, details);
}

function logError(message, details) {
  if (details === undefined) {
    console.error(`${DEBUG_PREFIX} ${message}`);
    return;
  }

  console.error(`${DEBUG_PREFIX} ${message}`, details);
}

function initializeLogoMarks() {
  document.querySelectorAll("[data-logo-src]").forEach((logoMark) => {
    const image = logoMark.querySelector("img.lacir-logo");
    const fallback = logoMark.querySelector(".lacir-logo-fallback");
    const logoSrc = logoMark.dataset.logoSrc;

    if (!image || !fallback || !logoSrc) {
      return;
    }

    fallback.hidden = false;
    image.hidden = true;

    fetch(logoSrc, { method: "HEAD", cache: "no-cache" })
      .then((response) => {
        if (!response.ok) {
          return;
        }

        image.addEventListener(
          "load",
          () => {
            image.hidden = false;
            fallback.hidden = true;
          },
          { once: true }
        );
        image.addEventListener(
          "error",
          () => {
            image.hidden = true;
            fallback.hidden = false;
          },
          { once: true }
        );
        image.src = logoSrc;
      })
      .catch(() => {
        image.hidden = true;
        fallback.hidden = false;
      });
  });
}

function bindEvents() {
  if (elements.practiceSectionTab && elements.theorySectionTab) {
    elements.practiceSectionTab.addEventListener("click", () => {
      elements.practiceSectionTab.classList.add("is-active");
      elements.theorySectionTab.classList.remove("is-active");
      elements.practiceSection.classList.remove("hidden");
      elements.theorySection.classList.add("hidden");
      logInfo("Alternou para aba de roteiros práticos");
    });

    elements.theorySectionTab.addEventListener("click", () => {
      elements.theorySectionTab.classList.add("is-active");
      elements.practiceSectionTab.classList.remove("is-active");
      elements.theorySection.classList.remove("hidden");
      elements.practiceSection.classList.add("hidden");
      logInfo("Alternou para aba de teoria cirúrgica");
      if (window.TeoriaManager && typeof window.TeoriaManager.init === "function") {
        window.TeoriaManager.init();
      }
    });
  }

  elements.searchInput.addEventListener("input", (event) => {
    appState.searchTerm = event.target.value.trim();
    persistState();
    renderProcedureList();
    renderQuickProcedurePicker();
  });

  elements.categoryFilter.addEventListener("change", (event) => {
    appState.selectedCategory = event.target.value;
    persistState();
    renderProcedureList();
    renderQuickProcedurePicker();
  });

  if (elements.disciplineFilter) {
    elements.disciplineFilter.addEventListener("change", (event) => {
      appState.selectedDiscipline = event.target.value;
      persistState();
      renderProcedureList();
      renderQuickProcedurePicker();
    });
  }

  elements.quickProcedureSelect.addEventListener("change", (event) => {
    const procedureId = safeText(event.target.value);

    if (!procedureId) {
      return;
    }

    selectProcedure(procedureId);
    revealProcedureAfterSelection();
  });

  elements.randomProcedureButton.addEventListener("click", () => {
    selectRandomProcedure();
    revealProcedureAfterSelection();
  });

  elements.reloadProceduresButton.addEventListener("click", async () => {
    await reloadPrimaryProcedures();
  });

  elements.importSingleButton.addEventListener("click", () => {
    elements.singleFileInput.click();
  });

  elements.importMultipleButton.addEventListener("click", () => {
    elements.multipleFilesInput.click();
  });

  elements.singleFileInput.addEventListener("change", async (event) => {
    await importLocalFiles(event.target.files);
    elements.singleFileInput.value = "";
  });

  elements.multipleFilesInput.addEventListener("change", async (event) => {
    await importLocalFiles(event.target.files);
    elements.multipleFilesInput.value = "";
  });

  elements.clearLocalImportsButton.addEventListener("click", () => {
    appState.localImports = {};
    rebuildCatalog();
    showMessage("Importações locais temporárias removidas. Mantidos apenas os arquivos da fonte principal.", "success");
  });

  elements.clearSavedProgressButton.addEventListener("click", () => {
    const confirmed = window.confirm(
      "Limpar o progresso salvo removerá checklist, sequência, filtros persistidos e o último roteiro aberto. Deseja continuar?"
    );

    if (!confirmed) {
      return;
    }

    appState.progress = {};
    appState.selectedProcedureId = null;
    appState.mode = "study";
    appState.searchTerm = "";
    appState.selectedCategory = "all";
    appState.selectedDiscipline = "all";
    elements.searchInput.value = "";
    elements.categoryFilter.value = "all";

    if (elements.disciplineFilter) {
      elements.disciplineFilter.value = "all";
    }

    persistState();
    render();
    showMessage("Progresso local removido com sucesso.", "success");
  });

  elements.studyModeButton.addEventListener("click", () => {
    appState.mode = "study";
    persistState();
    renderMode();
  });

  elements.sequenceModeButton.addEventListener("click", () => {
    appState.mode = "sequence";
    persistState();
    renderMode();
  });

  elements.backToStartButton.addEventListener("click", () => {
    // Mantém o ponto da sequência: voltar ao início não deve apagar o treino em andamento.
    appState.selectedProcedureId = null;
    persistState();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  elements.clearChecklistButton.addEventListener("click", () => {
    const procedure = getSelectedProcedure();

    if (!procedure) {
      return;
    }

    const progress = ensureProcedureProgress(procedure.id);

    if (!progress.checklist.length) {
      return;
    }

    if (!window.confirm(`Desmarcar os ${progress.checklist.length} passo(s) concluído(s) deste roteiro?`)) {
      return;
    }

    progress.checklist = [];
    persistState();
    renderStudySteps(procedure);
  });

  elements.previousStepButton.addEventListener("click", () => {
    updateSequenceBy(-1);
  });

  elements.nextStepButton.addEventListener("click", () => {
    updateSequenceBy(1);
  });

  elements.restartSequenceButton.addEventListener("click", () => {
    restartSequence();
  });

  elements.toggleSequencePinButton.addEventListener("click", () => {
    appState.sequencePanelPinned = !appState.sequencePanelPinned;
    persistState();
    renderSequenceSummaryState();
  });

  elements.mobilePreviousStepButton.addEventListener("click", () => {
    updateSequenceBy(-1);
  });

  elements.mobileNextStepButton.addEventListener("click", () => {
    updateSequenceBy(1);
  });

  elements.mobileRestartSequenceButton.addEventListener("click", () => {
    restartSequence();
  });

  elements.procedureList.addEventListener("click", (event) => {
    const starBtn = event.target.closest(".favorite-card-button");
    if (starBtn) {
      event.stopPropagation();
      const procedureId = starBtn.dataset.procedureId;
      toggleFavorite(procedureId);
      return;
    }

    const card = event.target.closest("[data-procedure-id]");

    if (!card) {
      return;
    }

    selectProcedure(card.dataset.procedureId);
  });

  elements.studyStepsList.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-step-number]");

    if (!checkbox) {
      return;
    }

    const procedure = getSelectedProcedure();

    if (!procedure) {
      return;
    }

    toggleChecklistStep(procedure.id, Number(checkbox.dataset.stepNumber), checkbox.checked);
  });

  if (elements.openAllInfoButton) {
    elements.openAllInfoButton.addEventListener("click", () => {
      document.querySelectorAll("#detailsContainer details").forEach((el) => {
        el.open = true;
      });
    });
  }

  if (elements.closeAllInfoButton) {
    elements.closeAllInfoButton.addEventListener("click", () => {
      document.querySelectorAll("#detailsContainer details").forEach((el) => {
        el.open = false;
      });
    });
  }

  if (elements.stepsOnlyButton) {
    elements.stepsOnlyButton.addEventListener("click", () => {
      document.querySelectorAll("#detailsContainer details").forEach((el) => {
        el.open = false;
      });
      const stepsHeader = document.querySelector(".steps-panel") || document.querySelector("#studyStepsList");
      if (stepsHeader) {
        stepsHeader.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  if (elements.hubViewListButton) {
    elements.hubViewListButton.addEventListener("click", () => {
      // No celular a lista fica recolhida; precisa abrir antes de focar a busca.
      setMobileSidebarExpanded(true);

      if (elements.searchInput) {
        elements.searchInput.focus({ preventScroll: true });
        elements.searchInput.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }

  if (elements.hubRandomButton) {
    elements.hubRandomButton.addEventListener("click", () => {
      selectRandomProcedure();
      revealProcedureAfterSelection();
    });
  }

  if (elements.toggleFavoritesFilterButton) {
    elements.toggleFavoritesFilterButton.addEventListener("click", () => {
      appState.showFavoritesOnly = !appState.showFavoritesOnly;
      if (appState.showFavoritesOnly) {
        appState.selectedCategory = "all";
        appState.selectedDiscipline = "all";
        if (elements.categoryFilter) {
          elements.categoryFilter.value = "all";
        }
        if (elements.disciplineFilter) {
          elements.disciplineFilter.value = "all";
        }
        persistState();
      }
      renderFavoritesFilterButton();
      renderProcedureList();
      renderQuickProcedurePicker();
    });
  }

  if (elements.selectedProcedureFavoriteButton) {
    elements.selectedProcedureFavoriteButton.addEventListener("click", () => {
      const procedure = getSelectedProcedure();
      if (procedure) {
        toggleFavorite(procedure.id);
      }
    });
  }

  if (elements.focusModeButton) {
    elements.focusModeButton.addEventListener("click", () => {
      appState.focusMode = !appState.focusMode;
      toggleFocusMode(appState.focusMode);
    });
  }

  if (elements.mobileSidebarToggle && elements.sidebar) {
    elements.mobileSidebarToggle.setAttribute("aria-expanded", "false");
    elements.mobileSidebarToggle.addEventListener("click", () => {
      setMobileSidebarExpanded(!elements.sidebar.classList.contains("is-expanded"));
    });
  }

  if (elements.versionButton && elements.versionDialog) {
    elements.versionButton.addEventListener("click", openVersionDialog);
    elements.versionToastOpen.addEventListener("click", openVersionDialog);
    elements.versionToastClose.addEventListener("click", hideVersionToast);
    elements.versionDialogClose.addEventListener("click", closeVersionDialog);
    elements.versionDialog.addEventListener("click", (event) => {
      // Clique no fundo escurecido (fora do conteúdo) fecha a janela.
      if (event.target === elements.versionDialog) {
        closeVersionDialog();
      }
    });
  }

  document.addEventListener("keydown", handleSequenceShortcuts);
  window.addEventListener("scroll", updateSequenceSummaryState, { passive: true });
  window.addEventListener("resize", updateSequenceSummaryState);
}

async function loadVersionInfo() {
  if (!elements.versionButton) {
    return;
  }

  try {
    const response = await fetch(buildAppUrl(VERSIONS_PATH), { cache: "no-cache" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const current = safeText(data.atual);
    const versions = Array.isArray(data.versoes) ? data.versoes.filter(isPlainObject) : [];

    if (!current) {
      return;
    }

    appState.versionInfo = { current, versions };
    elements.versionLabel.textContent = current;
    elements.versionButton.hidden = false;
    renderVersionList(versions, current);
    announceNewVersion(current, versions);
  } catch (error) {
    logWarn("Não foi possível ler o histórico de versões.", error);
  }
}

function announceNewVersion(current, versions) {
  let seenVersion = null;

  try {
    seenVersion = localStorage.getItem(SEEN_VERSION_KEY);
  } catch (error) {
    return;
  }

  // Na primeira visita só registra a versão: não há "atualização" para avisar.
  if (!seenVersion) {
    rememberSeenVersion(current);
    return;
  }

  if (seenVersion === current) {
    return;
  }

  const entry = versions.find((version) => version.versao === current);
  const title = entry ? safeText(entry.titulo) : "";
  elements.versionToastText.textContent = `Guia atualizado para a versão ${current}${title ? `: ${title}` : ""}.`;
  elements.versionToast.hidden = false;
}

function rememberSeenVersion(version) {
  try {
    localStorage.setItem(SEEN_VERSION_KEY, version);
  } catch (error) {
    // Sem armazenamento (aba anônima, por exemplo): o aviso só não fica lembrado.
  }
}

function renderVersionList(versions, current) {
  elements.versionList.innerHTML = versions
    .map((version) => {
      const isCurrent = version.versao === current;
      const changes = sanitizeStringArray(version.mudancas);

      return `
        <article class="version-entry ${isCurrent ? "is-current" : ""}">
          <header class="version-entry-header">
            <span class="badge ${isCurrent ? "category-badge" : "neutral-badge"}">v${escapeHtml(safeText(version.versao))}</span>
            <h3>${escapeHtml(safeText(version.titulo))}</h3>
            <time datetime="${escapeAttribute(safeText(version.data))}">${escapeHtml(formatVersionDate(version.data))}</time>
          </header>
          ${changes.length ? `<ul class="detail-list">${changes.map((change) => `<li>${escapeHtml(change)}</li>`).join("")}</ul>` : ""}
        </article>
      `;
    })
    .join("");
}

function formatVersionDate(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(safeText(isoDate));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : safeText(isoDate);
}

function openVersionDialog() {
  hideVersionToast();

  if (typeof elements.versionDialog.showModal === "function") {
    elements.versionDialog.showModal();
  } else {
    elements.versionDialog.setAttribute("open", "");
  }
}

function closeVersionDialog() {
  if (typeof elements.versionDialog.close === "function") {
    elements.versionDialog.close();
  } else {
    elements.versionDialog.removeAttribute("open");
  }
}

function hideVersionToast() {
  elements.versionToast.hidden = true;

  if (appState.versionInfo) {
    rememberSeenVersion(appState.versionInfo.current);
  }
}

async function bootstrapCatalog() {
  setLoadingState(true, "Lendo app-config.json", 0, 1);
  setStatusDetail("Lendo configuração...");

  const configResult = await loadAppConfig();

  appState.config = configResult.config;
  appState.baseIssues = configResult.issues;
  setLoadingState(false, "Configuração carregada", 1, 1);
  setStatusDetail(
    configResult.usedDefault
      ? "Falha ao ler config/app-config.json, usando configuração padrão embutida."
      : "Configuração carregada."
  );

  if (configResult.usedDefault) {
    showMessage("Configuração padrão embutida ativada porque app-config.json falhou ou estava inválido.", "warning");
  }

  await reloadPrimaryProcedures();
}

async function reloadPrimaryProcedures() {
  const configIssues = appState.baseIssues.filter((issue) => issue.sourceKind === "config");

  try {
    if (!appState.config) {
      logWarn("Configuração ausente; não foi possível iniciar a leitura automática.");
      setStatusDetail("Nenhuma configuração disponível. Importe um arquivo local para continuar.");
      showMessage("A configuração do app não está disponível. Corrija app-config.json para habilitar a leitura automática.", "error");
      return;
    }

    showMessage("", "");
    logInfo("Iniciando leitura automática de procedimentos.", appState.config.github);

    const loadToken = ++catalogLoadToken;

    // O manifest fica no próprio site (GitHub Pages ou servidor local): é a fonte mais
    // rápida e não depende do limite de 60 consultas/hora da API pública do GitHub.
    const manifestResult = await loadProceduresFromManifest(appState.config);

    if (manifestResult.ok) {
      appState.primarySource = manifestResult.source;
      appState.baseProcedures = manifestResult.entries;
      appState.baseIssues = [...configIssues, ...manifestResult.issues];
      rebuildCatalog();
      await loadExtraProceduresFromGitHub(appState.config, manifestResult.fileNames, loadToken);
      return;
    }

    // Sem manifest, a pasta inteira é lida pela API do GitHub.
    const githubResult = await loadProceduresFromGitHub(appState.config, manifestResult.issues);

    if (githubResult.ok) {
      appState.primarySource = githubResult.source;
      appState.baseProcedures = githubResult.entries;
      appState.baseIssues = [...configIssues, ...githubResult.issues];
      rebuildCatalog();
      showMessage("O manifest do site não pôde ser lido, então os roteiros foram lidos direto do GitHub.", "warning");
      return;
    }

    const exampleResult = await loadProceduresFromLocalExamples(appState.config, githubResult.issues);

    if (exampleResult.ok) {
      appState.primarySource = exampleResult.source;
      appState.baseProcedures = exampleResult.entries;
      appState.baseIssues = [...configIssues, ...exampleResult.issues];
      rebuildCatalog();
      showMessage("Falha ao ler GitHub e manifest. O site carregou exemplos locais para continuar utilizável.", "warning");
      return;
    }

    appState.primarySource = {
      kind: "none",
      label: "Falha no carregamento",
      fileCount: 0,
      filesProcessed: 0
    };
    appState.baseProcedures = [];
    appState.baseIssues = [...configIssues, ...exampleResult.issues];
    setStatusDetail("Nenhum roteiro encontrado. Importe arquivo local para continuar.");
    rebuildCatalog();
    showMessage("Não foi possível carregar a pasta do GitHub nem o manifest local.", "error");
  } catch (error) {
    logError("Falha inesperada ao recarregar procedimentos.", error);
    appState.primarySource = {
      kind: "none",
      label: "Falha no carregamento",
      fileCount: 0,
      filesProcessed: 0
    };
    appState.baseProcedures = [];
    appState.baseIssues = [
      ...configIssues,
      createIssue("error", "github", "Leitura automática", getReadableError(error))
    ];
    setStatusDetail("Falha inesperada na leitura automática. Importe arquivo local para continuar.");
    rebuildCatalog();
    showMessage("A leitura automática falhou inesperadamente. A importação local continua disponível.", "error");
  }
}

async function loadAppConfig() {
  const configUrl = buildAppUrl(CONFIG_PATH);
  logInfo(`Tentando ler configuração em ${configUrl.href}`);

  try {
    const response = await fetch(configUrl, { cache: "no-cache" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const config = normalizeAppConfig(data);
    logInfo("Configuração carregada com sucesso.", config.github);

    return { ok: true, config, issues: [], usedDefault: false };
  } catch (error) {
    logWarn("Falha ao ler configuração; usando configuração padrão embutida.", error);

    const config = normalizeAppConfig(DEFAULT_APP_CONFIG);
    const issues = [
      createIssue(
        "warning",
        "config",
        "app-config.json",
        `Não foi possível ler ${CONFIG_PATH}: ${getReadableError(error)}. O sistema passou a usar a configuração padrão embutida.`
      )
    ];

    if (window.location.protocol === "file:") {
      issues.push(
        createIssue(
          "warning",
          "config",
          "file://",
          "Ao abrir o projeto diretamente no navegador, alguns ambientes bloqueiam o fetch local. Prefira GitHub Pages ou um servidor local simples."
        )
      );
    }

    return { ok: true, config, issues, usedDefault: true };
  }
}

function normalizeAppConfig(data) {
  const github = isPlainObject(data) && isPlainObject(data.github) ? data.github : null;

  if (!github) {
    throw new Error("Estrutura inválida. Esperado um objeto com a chave github.");
  }

  const owner = safeText(github.owner);
  const repo = safeText(github.repo);
  const branch = safeText(github.branch || "main");
  const proceduresPath = normalizeRelativePath(safeText(github.proceduresPath || "procedimentos"));

  if (!owner || !repo || !branch || !proceduresPath) {
    throw new Error("Campos obrigatórios ausentes em config/app-config.json.");
  }

  return {
    github: {
      owner,
      repo,
      branch,
      proceduresPath
    }
  };
}

async function fetchGitHubProcedureListing(config) {
  const folderPath = config.github.proceduresPath;
  const listingUrl = buildGitHubContentsUrl(config.github, folderPath);

  logInfo(`Consultando a pasta do GitHub em ${listingUrl}`);

  // "no-cache" revalida com ETag; respostas 304 não contam no limite da API.
  const response = await fetch(listingUrl, { cache: "no-cache" });

  if (!response.ok) {
    throw createGitHubHttpError(response, folderPath);
  }

  const payload = await response.json();

  if (!Array.isArray(payload)) {
    throw new Error("A API retornou um formato inesperado para a pasta de procedimentos.");
  }

  return payload
    .filter((item) => item.type === "file")
    .filter((item) => isProcedureFileName(item.name))
    .filter((item) => item.name !== MANIFEST_FILENAME)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function toGitHubFileDescriptor(config, item) {
  return {
    fileName: item.name,
    filePath: item.path,
    fileUrl: item.download_url || buildRawGitHubUrl(config.github, item.path),
    sourceKind: "github",
    sourceLabel: "GitHub"
  };
}

function isLocalDevelopmentHost() {
  return (
    window.location.protocol === "file:" ||
    ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)
  );
}

// Roteiros enviados pelo GitHub que ainda não entraram no manifest continuam aparecendo
// sem editar o código. Falhas aqui são silenciosas: o manifest já carregou o site.
async function loadExtraProceduresFromGitHub(config, knownFileNames, loadToken) {
  if (isLocalDevelopmentHost()) {
    return;
  }

  try {
    const known = new Set(knownFileNames);
    const extraFiles = (await fetchGitHubProcedureListing(config)).filter((item) => !known.has(item.name));

    if (!extraFiles.length || loadToken !== catalogLoadToken) {
      return;
    }

    logInfo(`${extraFiles.length} roteiro(s) no GitHub fora do manifest.`, extraFiles.map((item) => item.name));

    const aggregate = await loadProcedureFiles(
      extraFiles.map((item) => toGitHubFileDescriptor(config, item)),
      "Lendo roteiros novos do GitHub",
      { silent: true }
    );

    if (loadToken !== catalogLoadToken) {
      return;
    }

    appState.baseProcedures = [...appState.baseProcedures, ...aggregate.entries];
    appState.baseIssues = [...appState.baseIssues, ...aggregate.issues];
    rebuildCatalog();
  } catch (error) {
    logWarn("Não foi possível conferir roteiros novos no GitHub.", error);
  }
}

async function loadProceduresFromGitHub(config, previousIssues = []) {
  const repoInfo = buildRepositoryLabel(config);
  const folderPath = config.github.proceduresPath;

  setLoadingState(true, "Consultando pasta do GitHub", 0, 1);
  setStatusDetail("Lendo pasta de procedimentos no GitHub...");

  try {
    const candidateFiles = await fetchGitHubProcedureListing(config);

    logInfo(`Pasta listada com sucesso. ${candidateFiles.length} arquivo(s) candidato(s) encontrados.`, candidateFiles.map((item) => item.name));
    setStatusDetail(`${candidateFiles.length} arquivo(s) .txt/.json encontrados na pasta de procedimentos.`);

    if (!candidateFiles.length) {
      setLoadingState(false, "Pasta consultada", 1, 1);
      setStatusDetail("Nenhum arquivo válido encontrado no GitHub. Tentando exemplos locais.");

      return {
        ok: false,
        entries: [],
        issues: [
          ...previousIssues,
          createIssue(
            "warning",
            "github",
            folderPath,
            "A pasta foi encontrada, mas não há arquivos .txt ou .json de roteiros."
          )
        ],
        source: {
          kind: "github",
          label: "GitHub",
          fileCount: 0,
          filesProcessed: 0,
          repositoryLabel: repoInfo
        }
      };
    }

    const aggregate = await loadProcedureFiles(
      candidateFiles.map((item) => toGitHubFileDescriptor(config, item)),
      "Lendo arquivos do GitHub"
    );

    logInfo(`Leitura do GitHub concluída com ${aggregate.entries.length} procedimento(s) válido(s).`);
    setLoadingState(false, "Leitura do GitHub concluída", candidateFiles.length, candidateFiles.length);
    setStatusDetail(`${aggregate.entries.length} roteiro(s) válidos carregados do GitHub.`);

    if (!aggregate.entries.length) {
      return {
        ok: false,
        entries: [],
        issues: [
          ...previousIssues,
          ...aggregate.issues,
          createIssue(
            "warning",
            "github",
            folderPath,
            "Os arquivos do GitHub foram lidos, mas nenhum roteiro válido foi encontrado. O sistema tentará os exemplos locais."
          )
        ],
        source: {
          kind: "github",
          label: "GitHub",
          fileCount: candidateFiles.length,
          filesProcessed: candidateFiles.length,
          repositoryLabel: repoInfo
        }
      };
    }

    return {
      ok: true,
      entries: aggregate.entries,
      issues: [...previousIssues, ...aggregate.issues],
      source: {
        kind: "github",
        label: "GitHub",
        fileCount: candidateFiles.length,
        filesProcessed: candidateFiles.length,
        repositoryLabel: repoInfo
      }
    };
  } catch (error) {
    logError("Falha ao listar a pasta de procedimentos no GitHub.", error);
    setLoadingState(false, "Falha ao consultar GitHub", 1, 1);
    setStatusDetail("Falha ao ler GitHub. Tentando exemplos locais...");

    return {
      ok: false,
      entries: [],
      issues: [
        ...previousIssues,
        createIssue(
          "error",
          "github",
          folderPath,
          getReadableError(error)
        )
      ],
      source: {
        kind: "github",
        label: "GitHub indisponível",
        fileCount: 0,
        filesProcessed: 0,
        repositoryLabel: repoInfo
      }
    };
  }
}

async function loadProceduresFromManifest(config, previousIssues = []) {
  const manifestPath = joinPaths(config.github.proceduresPath, MANIFEST_FILENAME);
  const manifestUrl = buildAppUrl(manifestPath);

  setLoadingState(true, "Lendo lista de roteiros", 0, 1);
  setStatusDetail("Lendo lista de roteiros do site...");
  logInfo(`Lendo manifest em ${manifestUrl.href}`);

  try {
    const response = await fetch(manifestUrl, { cache: "no-cache" });

    if (!response.ok) {
      throw new Error(
        response.status === 404
          ? `Manifest local não encontrado em ${manifestPath}.`
          : `Falha ao ler o manifest local: HTTP ${response.status}.`
      );
    }

    const data = await response.json();
    const files = normalizeManifestEntries(data, config.github.proceduresPath);
    logInfo(`Manifest local lido com sucesso. ${files.length} arquivo(s) listado(s).`, files.map((file) => file.fileName));

    if (!files.length) {
      setLoadingState(false, "Manifest lido", 1, 1);
      setStatusDetail("Manifest lido, mas sem arquivos válidos. Tentando GitHub.");

      return {
        ok: false,
        entries: [],
        issues: [
          ...previousIssues,
          createIssue(
            "warning",
            "manifest",
            manifestPath,
            "O manifest local foi lido, mas não contém arquivos de roteiros válidos."
          )
        ],
        source: {
          kind: "manifest",
          label: "Manifest local",
          fileCount: 0,
          filesProcessed: 0,
          repositoryLabel: buildRepositoryLabel(config)
        }
      };
    }

    const aggregate = await loadProcedureFiles(
      files.map((file) => ({
        fileName: file.fileName,
        filePath: file.filePath,
        fileUrl: buildAppUrl(file.filePath).href,
        sourceKind: "manifest",
        sourceLabel: "Repositório"
      })),
      "Lendo roteiros"
    );

    logInfo(`Leitura do manifest concluída com ${aggregate.entries.length} procedimento(s) válido(s).`);
    setLoadingState(false, "Leitura dos roteiros concluída", files.length, files.length);
    setStatusDetail(`${aggregate.entries.length} roteiro(s) válidos carregados.`);

    if (!aggregate.entries.length) {
      return {
        ok: false,
        entries: [],
        issues: [
          ...previousIssues,
          ...aggregate.issues,
          createIssue(
            "warning",
            "manifest",
            manifestPath,
            "O manifest foi lido, mas nenhum roteiro válido foi encontrado. O sistema tentará ler a pasta pelo GitHub."
          )
        ],
        source: {
          kind: "manifest",
          label: "Manifest local",
          fileCount: files.length,
          filesProcessed: files.length,
          repositoryLabel: buildRepositoryLabel(config)
        }
      };
    }

    return {
      ok: true,
      entries: aggregate.entries,
      fileNames: files.map((file) => file.fileName),
      issues: [...previousIssues, ...aggregate.issues],
      source: {
        kind: "manifest",
        label: "Manifest local",
        fileCount: files.length,
        filesProcessed: files.length,
        repositoryLabel: buildRepositoryLabel(config)
      }
    };
  } catch (error) {
    logError("Falha ao usar o manifest local.", error);
    setLoadingState(false, "Falha no manifest", 1, 1);
    setStatusDetail("Falha ao ler manifest, tentando GitHub.");

    return {
      ok: false,
      entries: [],
      issues: [
        ...previousIssues,
        createIssue(
          "error",
          "manifest",
          manifestPath,
          getReadableError(error)
        )
      ],
      source: {
        kind: "manifest",
        label: "Manifest indisponível",
        fileCount: 0,
        filesProcessed: 0,
        repositoryLabel: buildRepositoryLabel(config)
      }
    };
  }
}

async function loadProceduresFromLocalExamples(config, previousIssues) {
  setLoadingState(true, "Tentando exemplos locais", 0, 1);
  setStatusDetail("Falha ao ler manifest e GitHub, usando exemplos locais.");
  logInfo("Tentando carregar os exemplos locais embutidos.", LOCAL_EXAMPLE_FILES);

  try {
    const files = LOCAL_EXAMPLE_FILES.map((filePath) => ({
      fileName: getFileNameFromPath(filePath),
      filePath,
      fileUrl: buildAppUrl(filePath).href,
      sourceKind: "example",
      sourceLabel: "Exemplos locais"
    }));

    const aggregate = await loadProcedureFiles(files, "Lendo exemplos locais");
    logInfo(`Leitura dos exemplos locais concluída com ${aggregate.entries.length} procedimento(s) válido(s).`);
    setLoadingState(false, "Leitura dos exemplos concluída", files.length, files.length);
    setStatusDetail(`${aggregate.entries.length} roteiro(s) válidos carregados dos exemplos locais.`);

    if (!aggregate.entries.length) {
      return {
        ok: false,
        entries: [],
        issues: [
          ...previousIssues,
          createIssue(
            "error",
            "example",
            "Exemplos locais",
            "Os exemplos locais foram encontrados, mas nenhum roteiro válido pôde ser carregado."
          ),
          ...aggregate.issues
        ],
        source: {
          kind: "example",
          label: "Exemplos indisponíveis",
          fileCount: files.length,
          filesProcessed: files.length,
          repositoryLabel: buildRepositoryLabel(config)
        }
      };
    }

    return {
      ok: true,
      entries: aggregate.entries,
      issues: [
        ...previousIssues,
        createIssue(
          "warning",
          "example",
          "Exemplos locais",
          "GitHub e manifest falharam. O site passou a usar exemplos locais do projeto para permanecer utilizável."
        ),
        ...aggregate.issues
      ],
      source: {
        kind: "example",
        label: "Exemplos locais",
        fileCount: files.length,
        filesProcessed: files.length,
        repositoryLabel: buildRepositoryLabel(config)
      }
    };
  } catch (error) {
    logError("Falha ao carregar os exemplos locais.", error);
    setLoadingState(false, "Falha nos exemplos locais", 1, 1);
    setStatusDetail("Falha ao ler exemplos locais. A importação manual continua disponível.");

    return {
      ok: false,
      entries: [],
      issues: [
        ...previousIssues,
        createIssue(
          "error",
          "example",
          "Exemplos locais",
          getReadableError(error)
        )
      ],
      source: {
        kind: "example",
        label: "Exemplos indisponíveis",
        fileCount: 0,
        filesProcessed: 0,
        repositoryLabel: buildRepositoryLabel(config)
      }
    };
  }
}

function normalizeManifestEntries(data, proceduresPath) {
  const rawFiles = Array.isArray(data?.files) ? data.files : [];

  return rawFiles
    .map((item) => {
      if (typeof item === "string") {
        const trimmed = normalizeRelativePath(item);

        return trimmed
          ? {
              fileName: getFileNameFromPath(trimmed),
              filePath: trimmed.startsWith(proceduresPath) ? trimmed : joinPaths(proceduresPath, trimmed)
            }
          : null;
      }

      if (isPlainObject(item) && safeText(item.path)) {
        const normalizedPath = normalizeRelativePath(safeText(item.path));

        return {
          fileName: getFileNameFromPath(normalizedPath),
          filePath: normalizedPath.startsWith(proceduresPath)
            ? normalizedPath
            : joinPaths(proceduresPath, normalizedPath)
        };
      }

      return null;
    })
    .filter(Boolean)
    .filter((item) => isProcedureFileName(item.fileName))
    .filter((item) => item.fileName !== MANIFEST_FILENAME)
    .sort((a, b) => a.fileName.localeCompare(b.fileName, "pt-BR"));
}

async function loadProcedureFiles(files, loadingLabel, { silent = false } = {}) {
  let completed = 0;

  if (!silent) {
    setLoadingState(true, loadingLabel, 0, files.length);
    setStatusDetail(`Baixando ${files.length} arquivo(s)...`);
  }

  // Todos os arquivos são baixados ao mesmo tempo; o resultado mantém a ordem da lista.
  const results = await Promise.all(
    files.map(async (file) => {
      const result = await loadProcedureFile(file);
      completed += 1;

      if (!silent) {
        setLoadingState(true, loadingLabel, completed, files.length);
      }

      return result;
    })
  );

  return {
    entries: results.flatMap((result) => result.entries),
    issues: results.flatMap((result) => result.issues)
  };
}

async function loadProcedureFile(file) {
  try {
    // "no-cache" revalida com o servidor: arquivo novo aparece, arquivo igual vem do cache.
    const response = await fetch(file.fileUrl, { cache: "no-cache" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const result = parseProcedureDocument(text, file);
    logInfo(`Arquivo ${file.fileName} interpretado. ${result.entries.length} procedimento(s) válido(s).`);

    return result;
  } catch (error) {
    logError(`Falha ao processar o arquivo ${file.fileName}.`, error);

    return {
      entries: [],
      issues: [
        createIssue(
          "error",
          file.sourceKind,
          file.fileName,
          `Falha ao baixar ou interpretar o arquivo ${file.filePath}: ${getReadableError(error)}`
        )
      ]
    };
  }
}

function parseProcedureDocument(text, fileInfo) {
  const issues = [];
  const entries = [];

  try {
    const parsedContent = parseProcedureFileContent(text, fileInfo.fileName);
    logInfo(`Parse concluído para ${fileInfo.fileName}. ${parsedContent.procedures.length} item(ns) bruto(s) encontrado(s).`);
    issues.push(...parsedContent.issues);

    parsedContent.procedures.forEach((rawProcedure, index) => {
      const result = normalizeProcedureRecord(rawProcedure, fileInfo, index);

      if (result.ok) {
        entries.push(result.procedure);
      } else {
        issues.push(...result.issues);
      }
    });
  } catch (error) {
    logError(`Falha ao interpretar ${fileInfo.fileName}.`, error);
    issues.push(
      createIssue(
        "error",
        fileInfo.sourceKind,
        fileInfo.fileName,
        `Falha ao interpretar o arquivo: ${getReadableError(error)}`
      )
    );
  }

  return { entries, issues };
}

function parseProcedureFileContent(content, fileName) {
  const normalizedText = normalizeProcedureFileText(content);

  if (!normalizedText) {
    throw new Error("Arquivo vazio ou sem JSON utilizável.");
  }

  const parsed = JSON.parse(normalizedText);
  const issues = [];
  const procedures = extractProcedures(parsed, fileName, issues);

  return { procedures, issues };
}

function normalizeProcedureFileText(content) {
  const asText = String(content ?? "");
  const withoutBom = stripBom(asText);
  const trimmed = withoutBom.trim();

  if (!trimmed) {
    return "";
  }

  return stripJsonCodeFence(trimmed).trim();
}

function stripJsonCodeFence(text) {
  const match = String(text).match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1] : text;
}

function extractProcedures(payload, fileName, issues) {
  if (Array.isArray(payload)) {
    issues.push(
      createIssue(
        "warning",
        "validation",
        fileName,
        "O arquivo usa um array direto na raiz. O sistema aceitou o conteúdo, mas o formato recomendado é um objeto único ou um objeto com a chave procedimentos."
      )
    );

    return payload;
  }

  if (isPlainObject(payload) && Array.isArray(payload.procedimentos)) {
    return payload.procedimentos;
  }

  if (isPlainObject(payload)) {
    return [payload];
  }

  throw new Error("Formato inválido. Use um objeto JSON ou um objeto com a chave procedimentos.");
}

function normalizeProcedureRecord(rawProcedure, fileInfo, index) {
  const issues = [];

  if (!isPlainObject(rawProcedure)) {
    issues.push(
      createIssue(
        "error",
        fileInfo.sourceKind,
        fileInfo.fileName,
        `O item ${index + 1} não é um objeto JSON válido.`
      )
    );

    return { ok: false, issues };
  }

  const id = safeText(rawProcedure.id);
  const nome = safeText(rawProcedure.nome);
  const categoria = safeText(rawProcedure.categoria || "Sem categoria");
  const descricaoCurta = safeText(rawProcedure.descricao_curta || "Sem descrição resumida.");
  const rawPassos = Array.isArray(rawProcedure.passos) ? rawProcedure.passos : null;

  if (!id) {
    issues.push(
      createIssue("error", fileInfo.sourceKind, fileInfo.fileName, `Procedimento ${index + 1} sem o campo obrigatório id.`)
    );
  }

  if (!nome) {
    issues.push(
      createIssue("error", fileInfo.sourceKind, fileInfo.fileName, `Procedimento ${index + 1} sem o campo obrigatório nome.`)
    );
  }

  if (!rawPassos || !rawPassos.length) {
    issues.push(
      createIssue(
        "error",
        fileInfo.sourceKind,
        fileInfo.fileName,
        `Procedimento ${id || `#${index + 1}`} sem o campo obrigatório passos.`
      )
    );
  }

  if (issues.length) {
    return { ok: false, issues };
  }

  const steps = [];

  rawPassos.forEach((rawStep, stepIndex) => {
    if (!isPlainObject(rawStep)) {
      issues.push(
        createIssue(
          "error",
          fileInfo.sourceKind,
          fileInfo.fileName,
          `Procedimento ${id}: o passo ${stepIndex + 1} não é um objeto válido.`
        )
      );
      return;
    }

    const numero = Number(rawStep.numero);
    const titulo = safeText(rawStep.titulo);
    const descricao = safeText(rawStep.descricao);

    if (!Number.isFinite(numero) || !titulo || !descricao) {
      issues.push(
        createIssue(
          "error",
          fileInfo.sourceKind,
          fileInfo.fileName,
          `Procedimento ${id}: cada passo precisa ter numero, titulo e descricao.`
        )
      );
      return;
    }

    steps.push({
      numero,
      titulo,
      descricao,
      critico: Boolean(rawStep.critico),
      alerta: safeText(rawStep.alerta),
      imagem: resolveMediaPath(rawStep.imagem),
      subacoes: normalizeStepSubactions(rawStep.subacoes)
    });
  });

  if (issues.length || !steps.length) {
    return { ok: false, issues };
  }

  const procedure = {
    id,
    nome,
    categoria,
    disciplina: getProcedureDiscipline(rawProcedure),
    descricao_curta: descricaoCurta,
    indicacoes: sanitizeStringArray(rawProcedure.indicacoes),
    contraindicacoes: sanitizeStringArray(rawProcedure.contraindicacoes),
    preparo: sanitizeStringArray(rawProcedure.preparo),
    materiais: sanitizeStringArray(rawProcedure.materiais),
    acoes_iniciais: sanitizeStringArray(rawProcedure.acoes_iniciais),
    passos: steps.sort((a, b) => a.numero - b.numero),
    observacoes_finais: sanitizeStringArray(rawProcedure.observacoes_finais),
    referencias: sanitizeStringArray(rawProcedure.referencias),
    imagem_capa: resolveMediaPath(rawProcedure.imagem_capa),
    _meta: {
      sourceKind: fileInfo.sourceKind,
      sourceLabel: fileInfo.sourceLabel,
      fileName: fileInfo.fileName,
      filePath: fileInfo.filePath
    }
  };

  return { ok: true, procedure, issues: [] };
}

function normalizeStepSubactions(rawSubactions) {
  if (!Array.isArray(rawSubactions)) {
    return [];
  }

  return rawSubactions
    .map((item) => {
      if (!isPlainObject(item)) {
        return null;
      }

      const rotulo = safeText(item.rotulo);
      const texto = safeText(item.texto);

      if (!rotulo || !texto) {
        return null;
      }

      return { rotulo, texto };
    })
    .filter(Boolean);
}

async function importLocalFiles(fileList) {
  const files = Array.from(fileList || []).filter(Boolean);

  if (!files.length) {
    return;
  }

  const validFiles = files.filter((file) => isProcedureFileName(file.name));
  const skippedFiles = files.filter((file) => !isProcedureFileName(file.name));

  if (!validFiles.length) {
    showMessage("Nenhum dos arquivos selecionados possui extensão .txt ou .json.", "warning");
    return;
  }

  setLoadingState(true, "Importando arquivos locais", 0, validFiles.length);

  for (let index = 0; index < validFiles.length; index += 1) {
    const file = validFiles[index];
    setLoadingState(true, "Importando arquivos locais", index, validFiles.length);

    try {
      const text = await file.text();
      const result = parseProcedureDocument(text, {
        fileName: file.name,
        filePath: file.name,
        fileUrl: `local://${file.name}`,
        sourceKind: "local",
        sourceLabel: "Importação local"
      });

      appState.localImports[file.name] = {
        entries: result.entries,
        issues: result.issues
      };
    } catch (error) {
      appState.localImports[file.name] = {
        entries: [],
        issues: [
          createIssue(
            "error",
            "local",
            file.name,
            `Falha ao ler o arquivo local: ${getReadableError(error)}`
          )
        ]
      };
    }

    setLoadingState(true, "Importando arquivos locais", index + 1, validFiles.length);
  }

  skippedFiles.forEach((file) => {
    appState.localImports[file.name] = {
      entries: [],
      issues: [
        createIssue(
          "warning",
          "local",
          file.name,
          "Arquivo ignorado porque não possui extensão .txt ou .json."
        )
      ]
    };
  });

  setLoadingState(false, "Importação local concluída", validFiles.length, validFiles.length);
  rebuildCatalog();

  showMessage(
    `Importação local concluída. ${validFiles.length} arquivo(s) processado(s) para pré-visualização temporária.`,
    "success"
  );
}

function rebuildCatalog() {
  const localProcedures = getLocalProcedures();
  const mergeResult = mergeProcedureCollections(localProcedures, appState.baseProcedures);

  appState.procedures = mergeResult.entries.sort(sortProcedures);
  appState.mergeIssues = mergeResult.issues;
  syncSelectionAndProgress();
  populateCategoryFilter();
  populateDisciplineFilter();
  persistState();
  render();
  logInfo(`Catálogo reconstruído. ${appState.procedures.length} procedimento(s) final(is) disponível(is).`);

  if (!appState.procedures.length) {
    setStatusDetail("Nenhum roteiro encontrado, importe arquivo local.");
  }
}

function mergeProcedureCollections(localProcedures, baseProcedures) {
  // Local previews win over repository data so the user can test a draft before committing it.
  const candidates = [...localProcedures, ...baseProcedures].sort(compareBySourcePriority);
  const entries = [];
  const issues = [];
  const seen = new Map();

  candidates.forEach((procedure) => {
    const duplicate = seen.get(procedure.id);

    if (!duplicate) {
      seen.set(procedure.id, procedure);
      entries.push(procedure);
      return;
    }

    issues.push(
      createIssue(
        "warning",
        "merge",
        procedure._meta.fileName,
        `ID duplicado "${procedure.id}". Mantido ${duplicate._meta.fileName} (${duplicate._meta.sourceLabel}) e ignorado ${procedure._meta.fileName} (${procedure._meta.sourceLabel}). Regra aplicada: prioridade para importação local e, dentro da mesma origem, ordem alfabética do arquivo.`
      )
    );
  });

  return { entries, issues };
}

function compareBySourcePriority(a, b) {
  const sourceDifference = (SOURCE_PRIORITY[a._meta.sourceKind] ?? 99) - (SOURCE_PRIORITY[b._meta.sourceKind] ?? 99);

  if (sourceDifference !== 0) {
    return sourceDifference;
  }

  const fileDifference = a._meta.fileName.localeCompare(b._meta.fileName, "pt-BR");

  if (fileDifference !== 0) {
    return fileDifference;
  }

  return a.nome.localeCompare(b.nome, "pt-BR");
}

function sortProcedures(a, b) {
  const categoryA = getDisplayCategory(a);
  const categoryB = getDisplayCategory(b);
  const categoryDifference = getDisplayCategoryOrder(categoryA) - getDisplayCategoryOrder(categoryB);

  if (categoryDifference !== 0) {
    return categoryDifference;
  }

  const categoryNameDifference = categoryA.localeCompare(categoryB, "pt-BR");

  if (categoryNameDifference !== 0) {
    return categoryNameDifference;
  }

  return a.nome.localeCompare(b.nome, "pt-BR");
}

function restoreState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

    appState.selectedProcedureId = safeText(saved.selectedProcedureId) || null;
    appState.mode = saved.mode === "sequence" ? "sequence" : "study";
    appState.sequencePanelPinned = typeof saved.sequencePanelPinned === "boolean" ? saved.sequencePanelPinned : true;
    appState.searchTerm = typeof saved.searchTerm === "string" ? saved.searchTerm : "";
    appState.selectedCategory = typeof saved.selectedCategory === "string" ? saved.selectedCategory : "all";
    appState.selectedDiscipline = typeof saved.selectedDiscipline === "string" ? saved.selectedDiscipline : "all";
    appState.progress = isPlainObject(saved.progress) ? saved.progress : {};
  } catch (error) {
    localStorage.removeItem(STORAGE_KEY);
  }

  try {
    appState.favorites = JSON.parse(localStorage.getItem("lacir-favorites") || "[]");
  } catch (e) {
    appState.favorites = [];
  }
  appState.showFavoritesOnly = false;

  elements.searchInput.value = appState.searchTerm;
}

function persistState() {
  const payload = {
    selectedProcedureId: appState.selectedProcedureId,
    mode: appState.mode,
    sequencePanelPinned: appState.sequencePanelPinned,
    searchTerm: appState.searchTerm,
    selectedCategory: appState.selectedCategory,
    selectedDiscipline: appState.selectedDiscipline,
    progress: appState.progress
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function syncSelectionAndProgress() {
  const validIds = new Set(appState.procedures.map((procedure) => procedure.id));

  Object.keys(appState.progress).forEach((procedureId) => {
    if (!validIds.has(procedureId)) {
      delete appState.progress[procedureId];
      return;
    }

    const procedure = appState.procedures.find((item) => item.id === procedureId);
    const entry = ensureProcedureProgress(procedureId);
    const validSteps = new Set(procedure.passos.map((step) => step.numero));

    entry.checklist = entry.checklist.filter((stepNumber) => validSteps.has(stepNumber));
    entry.sequenceIndex = Math.max(0, Math.min(entry.sequenceIndex, procedure.passos.length));
  });

  if (appState.selectedProcedureId && !validIds.has(appState.selectedProcedureId)) {
    appState.selectedProcedureId = null;
  }
}

function populateCategoryFilter() {
  const categories = [...new Set(appState.procedures.map((item) => getDisplayCategory(item)))].sort(
    compareDisplayCategories
  );

  elements.categoryFilter.innerHTML = `
    <option value="all">Todas as categorias</option>
    ${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}
  `;

  if (!categories.includes(appState.selectedCategory)) {
    appState.selectedCategory = "all";
  }

  elements.categoryFilter.value = appState.selectedCategory;
}

function populateDisciplineFilter() {
  if (!elements.disciplineFilter) {
    return;
  }

  const disciplines = [...new Set(appState.procedures.map((item) => item.disciplina).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR", { numeric: true })
  );

  elements.disciplineFilter.innerHTML = `
    <option value="all">Todas as disciplinas</option>
    ${disciplines.map((discipline) => `<option value="${escapeHtml(discipline)}">${escapeHtml(discipline)}</option>`).join("")}
  `;

  if (!disciplines.includes(appState.selectedDiscipline)) {
    appState.selectedDiscipline = "all";
  }

  elements.disciplineFilter.value = appState.selectedDiscipline;

  if (elements.disciplineFilterField) {
    elements.disciplineFilterField.classList.toggle("hidden", !disciplines.length);
  }
}

function render() {
  renderStatusPanel();
  renderIssuesPanel();
  renderQuickProcedurePicker();
  renderProcedureList();
  renderFavoritesFilterButton();
  renderSelectedProcedure();
  renderMode();
}

function renderQuickProcedurePicker() {
  const allProcedures = appState.procedures;
  const filteredProcedures = getFilteredProcedures();

  elements.quickProcedureSelect.disabled = allProcedures.length === 0;
  elements.randomProcedureButton.disabled = filteredProcedures.length === 0;
  elements.randomProcedureButton.title = filteredProcedures.length
    ? "Seleciona aleatoriamente um roteiro visível com os filtros atuais."
    : "Nenhum roteiro visível para sorteio com os filtros atuais.";
  elements.quickProcedureHint.textContent = filteredProcedures.length
    ? `${filteredProcedures.length} roteiro(s) disponíveis para sorteio com os filtros atuais.`
    : "Nenhum roteiro visível com os filtros atuais. Ajuste a busca ou a categoria para sortear.";

  if (!allProcedures.length) {
    elements.quickProcedureHint.textContent = "Nenhum roteiro carregado ainda.";
    elements.quickProcedureSelect.innerHTML = `
      <option value="">Nenhum roteiro carregado</option>
    `;
    return;
  }

  const selectedProcedure = getSelectedProcedure();
  
  // Build option list from filteredProcedures.
  // To ensure the currently selected procedure is always selectable/visible in the dropdown,
  // we add it to the list if it's not already in the filtered pool.
  const pool = [...filteredProcedures];
  if (selectedProcedure && !pool.some(p => p.id === selectedProcedure.id)) {
    pool.push(selectedProcedure);
  }
  
  // Com busca ativa, quem tem o termo no nome vem primeiro; o resto segue em ordem alfabética.
  const searchWords = normalizeSearchText(appState.searchTerm).split(/\s+/).filter(Boolean);
  const matchesByName = (procedure) =>
    searchWords.length > 0 && searchWords.every((word) => normalizeSearchText(procedure.nome).includes(word));

  pool.sort((a, b) => Number(matchesByName(b)) - Number(matchesByName(a)) || a.nome.localeCompare(b.nome, "pt-BR"));

  elements.quickProcedureSelect.innerHTML = `
    <option value="">Escolha um roteiro...</option>
    ${pool
      .map(
        (procedure) => `
          <option value="${escapeAttribute(procedure.id)}">${escapeHtml(procedure.nome)}</option>
        `
      )
      .join("")}
  `;
  elements.quickProcedureSelect.value = selectedProcedure ? selectedProcedure.id : "";
}

function renderStatusPanel() {
  const procedures = appState.procedures;
  const issueCount = getAllIssues().length;
  const sourceCounts = countProceduresBySource();
  const localCount = getLocalProcedures().length;
  const total = procedures.length;

  if (elements.statusPanel) {
    if (appState.loading.active) {
      elements.statusPanel.classList.add("is-loading");
      elements.statusPanel.classList.remove("is-loaded");
    } else {
      elements.statusPanel.classList.remove("is-loading");
      elements.statusPanel.classList.add("is-loaded");
    }
  }

  // Simplificação das mensagens de status conforme solicitado
  if (appState.loading.active) {
    elements.statusMessage.textContent = "Carregando roteiros...";
  } else if (total > 0) {
    elements.statusMessage.textContent = `${total} ${total === 1 ? "roteiro carregado" : "roteiros carregados"}`;
  } else {
    elements.statusMessage.textContent = "Não foi possível carregar os roteiros. Verifique a conexão.";
  }

  // Controle de barra de progresso indeterminada vs progresso real
  const percentage = getLoadingPercentage();
  elements.loadingProgressBar.style.width = `${percentage}%`;

  if (appState.loading.active && !appState.loading.total) {
    elements.loadingProgressBar.classList.add("is-indeterminate");
  } else {
    elements.loadingProgressBar.classList.remove("is-indeterminate");
  }

  // Atualização dos elementos técnicos legados (mantidos em container oculto)
  elements.loadedProcedureCount.textContent = String(total);
  elements.statusProcedureBreakdown.textContent = buildProcedureBreakdownText(sourceCounts);
  elements.dataSourceLabel.textContent = buildSourceLabel();
  elements.configSummary.textContent = appState.config
    ? `Pasta configurada: /${appState.config.github.proceduresPath}`
    : "Configuração não carregada.";
  elements.fileLoadSummary.textContent = `${appState.primarySource.filesProcessed || 0} / ${appState.primarySource.fileCount || 0}`;
  elements.issueSummary.textContent = issueCount
    ? `${issueCount} erro(s) ou aviso(s) de importação registrados.`
    : "Sem erros de importação.";
  elements.loadingLabel.textContent = appState.loading.label;
  elements.loadingCounter.textContent = `${appState.loading.current} / ${appState.loading.total}`;
  elements.clearLocalImportsButton.disabled = !Object.keys(appState.localImports).length;
  elements.reloadProceduresButton.disabled = appState.loading.active;
}

function renderIssuesPanel() {
  const issues = getAllIssues();

  if (!issues.length) {
    if (elements.issuesPanel) {
      elements.issuesPanel.classList.add("hidden");
    }
    return;
  }

  if (elements.issuesPanel) {
    elements.issuesPanel.classList.remove("hidden");
  }

  elements.issueCountBadge.textContent = String(issues.length);

  elements.issuesList.innerHTML = issues
    .map(
      (issue) => `
        <article class="issue-item ${escapeHtml(issue.severity)}">
          <div class="issue-meta">
            <span class="badge ${issue.severity === "error" ? "error-badge" : "warning-badge"}">
              ${issue.severity === "error" ? "Erro" : "Aviso"}
            </span>
            <span class="badge muted">${escapeHtml(issue.sourceLabel)}</span>
          </div>
          <p class="issue-title">${escapeHtml(issue.fileName)}</p>
          <p class="issue-copy">${escapeHtml(issue.message)}</p>
        </article>
      `
    )
    .join("");
}

function renderProcedureList() {
  const procedures = getFilteredProcedures();
  const total = appState.procedures.length;

  elements.procedureCountBadge.textContent = `${procedures.length} / ${total}`;

  if (!appState.procedures.length) {
    elements.procedureList.innerHTML = `
      <div class="empty-procedures">
        Nenhum roteiro válido carregado ainda. Verifique o painel de erros ou importe um arquivo local para pré-visualizar.
      </div>
    `;
    return;
  }

  if (!procedures.length) {
    if (appState.showFavoritesOnly && appState.favorites.length === 0) {
      elements.procedureList.innerHTML = `
        <div class="empty-procedures">
          Nenhum roteiro favoritado ainda.
        </div>
      `;
    } else {
      elements.procedureList.innerHTML = `
        <div class="empty-procedures">
          Nenhum roteiro corresponde aos filtros atuais.
        </div>
      `;
    }
    return;
  }

  elements.procedureList.innerHTML = procedures
    .map((procedure) => {
      const totalSteps = procedure.passos.length;
      const isFav = appState.favorites.includes(procedure.id);

      return `
        <article class="procedure-card ${procedure.id === appState.selectedProcedureId ? "is-active" : ""}" data-procedure-id="${escapeHtml(procedure.id)}">
          <div class="procedure-card-header-row">
            <span class="badge muted">${escapeHtml(getDisplayCategory(procedure))}</span>
            <button type="button" class="favorite-card-button ${isFav ? "is-favorite" : ""}" data-procedure-id="${escapeHtml(procedure.id)}" aria-label="Favoritar" title="${isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}">
              ${isFav ? "★" : "☆"}
            </button>
          </div>
          <h3>${escapeHtml(procedure.nome)}</h3>
          <p>${escapeHtml(procedure.descricao_curta)}</p>
          <div class="procedure-card-footer">
            <span class="procedure-step-count">${totalSteps} passos</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderSelectedProcedure() {
  const procedure = getSelectedProcedure();
  renderEmptyState(procedure);

  if (!procedure) {
    elements.procedureView.classList.add("hidden");
    if (appState.focusMode) {
      appState.focusMode = false;
      toggleFocusMode(false);
    }
    return;
  }

  elements.procedureView.classList.remove("hidden");
  elements.selectedCategory.textContent = getDisplayCategory(procedure);

  if (elements.selectedDisciplineBadge) {
    elements.selectedDisciplineBadge.textContent = procedure.disciplina;
    elements.selectedDisciplineBadge.classList.toggle("hidden", !procedure.disciplina);
  }

  elements.selectedStepSummary.textContent = `${procedure.passos.length} passos`;
  // A origem só interessa quando é uma pré-visualização importada do computador.
  elements.selectedSourceBadge.textContent = procedure._meta.sourceLabel;
  elements.selectedSourceBadge.classList.toggle("hidden", procedure._meta.sourceKind !== "local");
  elements.selectedFileLabel.textContent = `${procedure._meta.filePath}`;
  elements.selectedProcedureName.textContent = procedure.nome;
  elements.selectedProcedureDescription.textContent = procedure.descricao_curta;

  renderHeroFavoriteButton(procedure);

  if (procedure.imagem_capa) {
    elements.heroImageWrapper.classList.remove("hidden");
    elements.heroImage.src = procedure.imagem_capa;
    elements.heroImage.alt = `Imagem ilustrativa de ${procedure.nome}`;
  } else {
    elements.heroImageWrapper.classList.add("hidden");
    elements.heroImage.removeAttribute("src");
    elements.heroImage.alt = "";
  }

  renderStudyView(procedure);
  renderSequenceView(procedure);
}

function renderHeroFavoriteButton(procedure) {
  const favoriteBtn = elements.selectedProcedureFavoriteButton;

  if (!favoriteBtn || !procedure) {
    return;
  }

  const isFavorite = appState.favorites.includes(procedure.id);

  favoriteBtn.classList.toggle("is-favorite", isFavorite);
  favoriteBtn.textContent = isFavorite ? "★" : "☆";
  favoriteBtn.title = isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos";
  favoriteBtn.setAttribute("aria-pressed", String(isFavorite));
  favoriteBtn.dataset.procedureId = procedure.id;
}

function renderEmptyState(selectedProcedure) {
  if (!appState.procedures.length) {
    elements.emptyState.classList.remove("hidden");
    elements.emptyStateTitle.textContent = "Nenhum roteiro válido carregado";
    elements.emptyStateText.textContent =
      "Verifique app-config.json, a pasta /procedimentos, o manifest local ou use a importação local temporária para testar novos roteiros.";
    return;
  }

  if (!selectedProcedure) {
    elements.emptyState.classList.remove("hidden");
    elements.emptyStateTitle.textContent = "Escolha um procedimento para começar";
    elements.emptyStateText.textContent =
      "Use a lista lateral para selecionar um roteiro, revisar as etapas no modo estudo ou treinar a sequência passo a passo.";
    return;
  }

  elements.emptyState.classList.add("hidden");
}

function renderStudyView(procedure) {
  renderStudyDetails(procedure);
  renderStudySteps(procedure);
}

function renderStudyDetails(procedure) {
  elements.detailsContainer.innerHTML = [
    createDetailPanel("Indicações", procedure.indicacoes, false),
    createDetailPanel("Contraindicações", procedure.contraindicacoes, false),
    createDetailPanel("Preparo", procedure.preparo, false),
    createDetailPanel("Materiais", procedure.materiais, false),
    createDetailPanel("Ações iniciais", procedure.acoes_iniciais, false),
    createDetailPanel("Observações finais", procedure.observacoes_finais, false),
    createDetailPanel("Referências", procedure.referencias, false)
  ]
    .filter(Boolean)
    .join("");
}

function renderStudySteps(procedure) {
  const progress = ensureProcedureProgress(procedure.id);

  renderChecklistProgressText(procedure);

  elements.studyStepsList.innerHTML = procedure.passos
    .map((step) =>
      createStepCard(step, {
        checked: progress.checklist.includes(step.numero),
        showChecklist: true
      })
    )
    .join("");
}

function renderChecklistProgressText(procedure) {
  const checklistCount = ensureProcedureProgress(procedure.id).checklist.length;
  elements.checklistProgressText.textContent = `${checklistCount} de ${procedure.passos.length} passos marcados como concluídos.`;
}

function renderSequenceView(procedure) {
  const progress = ensureProcedureProgress(procedure.id);
  const totalSteps = procedure.passos.length;
  const revealedSteps = procedure.passos.slice(0, progress.sequenceIndex);
  const percentage = totalSteps ? (progress.sequenceIndex / totalSteps) * 100 : 0;

  elements.sequenceCounter.textContent = `${progress.sequenceIndex} / ${totalSteps}`;
  elements.sequenceProgressBar.style.width = `${percentage}%`;

  if (elements.mobileSequenceCounter && elements.mobileSequenceProgressBar) {
    elements.mobileSequenceCounter.textContent = `${progress.sequenceIndex} / ${totalSteps}`;
    elements.mobileSequenceProgressBar.style.width = `${percentage}%`;
  }

  syncSequenceControls(progress.sequenceIndex, totalSteps);
  renderSequenceSummaryState();
  elements.sequenceIntro.classList.toggle("hidden", revealedSteps.length > 0);

  const list = elements.sequenceStepsList;
  const isSameProcedure = renderedSequenceProcedure === procedure;
  const renderedCount = list.children.length;

  if (isSameProcedure && renderedCount === revealedSteps.length) {
    return;
  }

  // Avançar ou voltar um passo mexe só no último cartão; os anteriores ficam
  // como estão (sem piscar imagens nem reiniciar animações).
  if (isSameProcedure && renderedCount === revealedSteps.length - 1) {
    setSequenceCardCurrent(list.lastElementChild, false);
    const newIndex = revealedSteps.length;
    list.insertAdjacentHTML(
      "beforeend",
      createStepCard(revealedSteps[newIndex - 1], { current: true, sequenceIndex: newIndex })
    );
    return;
  }

  if (isSameProcedure && renderedCount === revealedSteps.length + 1 && renderedCount > 0) {
    list.lastElementChild.remove();
    setSequenceCardCurrent(list.lastElementChild, true);
    return;
  }

  renderedSequenceProcedure = procedure;
  list.innerHTML = revealedSteps
    .map((step, index) =>
      createStepCard(step, {
        current: index === revealedSteps.length - 1,
        sequenceIndex: index + 1
      })
    )
    .join("");
}

function setSequenceCardCurrent(card, isCurrent) {
  if (!card) {
    return;
  }

  card.classList.toggle("is-current", isCurrent);
  const badges = card.querySelector(".step-badges");
  const currentBadge = badges ? badges.querySelector(".checked-badge") : null;

  if (isCurrent && badges && !currentBadge) {
    badges.insertAdjacentHTML("beforeend", '<span class="badge checked-badge">Passo atual</span>');
  } else if (!isCurrent && currentBadge) {
    currentBadge.remove();
  }
}

function createStepCard(step, options = {}) {
  const {
    checked = false,
    current = false,
    showChecklist = false,
    sequenceIndex = null
  } = options;

  return `
    <article
      class="step-card ${checked ? "is-checked" : ""} ${step.critico ? "is-critical" : ""} ${current ? "is-current" : ""}"
      ${sequenceIndex ? `data-sequence-index="${sequenceIndex}"` : ""}
    >
      <div class="step-topline">
        <div class="step-title-group">
          <span class="step-number">${step.numero}</span>
          <div class="step-meta">
            <h4>${escapeHtml(step.titulo)}</h4>
            <div class="step-badges">
              ${step.critico ? '<span class="badge critical-badge">Crítico</span>' : ""}
              ${current ? '<span class="badge checked-badge">Passo atual</span>' : ""}
            </div>
          </div>
        </div>

        ${
          showChecklist
            ? `
            <label class="step-check step-check-inline">
              <input type="checkbox" data-step-number="${step.numero}" ${checked ? "checked" : ""} />
              <span>${checked ? "Concluído" : "Marcar como concluído"}</span>
            </label>
          `
            : ""
        }
      </div>

      <p class="step-description">${escapeHtml(step.descricao)}</p>
      ${createSubactionsBlock(step.subacoes)}
      ${step.alerta ? `<div class="step-alert">${escapeHtml(step.alerta)}</div>` : ""}
      ${step.imagem ? createImageBlock(step.imagem, `Imagem do passo ${step.numero}: ${step.titulo}`) : ""}
    </article>
  `;
}

function createSubactionsBlock(subactions) {
  if (!Array.isArray(subactions) || !subactions.length) {
    return "";
  }

  return `
    <div class="step-subactions">
      <div class="step-subactions-title">Subações</div>
      <ul class="step-subaction-list">
        ${subactions
          .map(
            (subaction) => `
              <li class="step-subaction-item">
                <span class="step-subaction-label">${escapeHtml(subaction.rotulo)}</span>
                <span>${escapeHtml(subaction.texto)}</span>
              </li>
            `
          )
          .join("")}
      </ul>
    </div>
  `;
}

function renderMode() {
  const procedure = getSelectedProcedure();
  const isSequence = appState.mode === "sequence";

  elements.studyView.classList.toggle("hidden", isSequence);
  elements.sequenceSection.classList.toggle("hidden", !isSequence);
  elements.studyModeButton.classList.toggle("button-primary", !isSequence);
  elements.studyModeButton.classList.toggle("button-secondary", isSequence);
  elements.sequenceModeButton.classList.toggle("button-primary", isSequence);
  elements.sequenceModeButton.classList.toggle("button-secondary", !isSequence);
  elements.studyModeButton.setAttribute("aria-pressed", String(!isSequence));
  elements.sequenceModeButton.setAttribute("aria-pressed", String(isSequence));
  renderSequenceSummaryState();

  if (procedure && isSequence) {
    renderSequenceView(procedure);
  }
}

function renderSequenceSummaryState() {
  const isPinned = appState.sequencePanelPinned;
  const isSequenceVisible = !elements.sequenceSection.classList.contains("hidden");

  elements.sequenceSummary.classList.toggle("is-static", !isPinned);
  elements.sequenceSummary.classList.toggle("is-condensed", false);
  elements.toggleSequencePinButton.textContent = isPinned ? "Desfixar do topo" : "Fixar no topo";
  elements.toggleSequencePinButton.setAttribute("aria-pressed", String(isPinned));
  elements.toggleSequencePinButton.setAttribute(
    "aria-label",
    isPinned ? "Desativar painel fixo no topo" : "Ativar painel fixo no topo"
  );
  elements.toggleSequencePinButton.classList.toggle("is-active", isPinned);
  elements.toggleSequencePinButton.disabled = !isSequenceVisible;

  updateSequenceSummaryState();
}

function updateSequenceSummaryState() {
  const isDesktop = window.innerWidth > 720;
  const isSequenceVisible = !elements.sequenceSection.classList.contains("hidden");
  const shouldBeSticky = isDesktop && isSequenceVisible && appState.mode === "sequence" && appState.sequencePanelPinned;

  if (!shouldBeSticky) {
    elements.sequenceSummary.classList.remove("is-condensed");
    return;
  }

  const summaryTop = elements.sequenceSummary.getBoundingClientRect().top;
  const isCondensed = summaryTop <= 18.5 && window.scrollY > 0;

  elements.sequenceSummary.classList.toggle("is-condensed", isCondensed);
}

function createOverviewCard(title, items) {
  if (!items.length) {
    return `
      <article class="overview-card">
        <h3>${escapeHtml(title)}</h3>
        <p class="sidebar-copy">Sem itens cadastrados.</p>
      </article>
    `;
  }

  return `
    <article class="overview-card">
      <h3>${escapeHtml(title)}</h3>
      <ul>
        ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </article>
  `;
}

function createDetailPanel(title, items, openByDefault) {
  if (!items.length) {
    return "";
  }

  return `
    <div class="detail-panel-wrapper">
      <details class="detail-panel" ${openByDefault ? "open" : ""}>
        <summary>
          <span>${escapeHtml(title)}</span>
          <span class="detail-count" aria-label="${items.length} itens">${items.length}</span>
        </summary>
        <div class="detail-content">
          <ul class="detail-list">
            ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </div>
      </details>
    </div>
  `;
}

function createImageBlock(src, alt) {
  return `
    <div class="step-image">
      <img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" loading="lazy" />
    </div>
  `;
}

function getFilteredProcedures() {
  // Busca sem acento e por palavra: "puncao lombar" encontra "Punção lombar".
  const searchWords = normalizeSearchText(appState.searchTerm).split(/\s+/).filter(Boolean);

  return appState.procedures.filter((procedure) => {
    const searchText = getProcedureSearchText(procedure);
    const matchesSearch = searchWords.every((word) => searchText.includes(word));
    const matchesCategory =
      appState.selectedCategory === "all" || getDisplayCategory(procedure) === appState.selectedCategory;
    const matchesDiscipline =
      appState.selectedDiscipline === "all" || procedure.disciplina === appState.selectedDiscipline;
    const matchesFavorites = !appState.showFavoritesOnly || appState.favorites.includes(procedure.id);

    return matchesSearch && matchesCategory && matchesDiscipline && matchesFavorites;
  });
}

function getProcedureSearchText(procedure) {
  if (!procedure._meta.searchText) {
    procedure._meta.searchText = normalizeSearchText(
      [
        procedure.nome,
        procedure.categoria,
        procedure.disciplina,
        getDisplayCategory(procedure),
        procedure.descricao_curta,
        ...procedure.materiais,
        ...procedure.passos.map((step) => step.titulo)
      ].join(" ")
    );
  }

  return procedure._meta.searchText;
}

function getDisplayCategory(procedure) {
  if (!procedure) {
    return normalizeCategory("");
  }

  return normalizeCategory(procedure.categoria, procedure.nome);
}

function normalizeCategory(category, procedureName = "") {
  const cleanCategory = stripDisciplinePrefix(category) || "Sem categoria";
  const normalizedCategory = normalizeSearchText(cleanCategory);
  const exactMatch = DISPLAY_CATEGORIES.find((item) => normalizeSearchText(item) === normalizedCategory);

  // A categoria escrita no roteiro tem prioridade sobre o nome do procedimento.
  if (exactMatch) {
    return exactMatch;
  }

  const categoryMatches = findCategoryMatches(normalizedCategory);
  const nameMatches = findCategoryMatches(normalizeSearchText(procedureName));

  // Categorias compostas, como "Vias aéreas e dissecção venosa", são desempatadas pelo nome.
  if (categoryMatches.length) {
    return categoryMatches.find((item) => nameMatches.includes(item)) || categoryMatches[0];
  }

  return nameMatches[0] || "Outros procedimentos";
}

function stripDisciplinePrefix(category) {
  const originalCategory = safeText(category);
  const withoutPrefix = originalCategory
    .replace(/^\s*(?:Habilidades\s+Cirúrgicas|HC)\s*(?:I{1,2}|1|2)?\s*\/\s*/i, "")
    .replace(/\bHCI{1,2}\b/gi, "")
    .replace(/\bHabilidades\s+Cirúrgicas\s+I{1,2}\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return withoutPrefix || originalCategory;
}

function findCategoryMatches(normalizedText) {
  return CATEGORY_RULES.filter((rule) => rule.terms.some((term) => matchesCategoryTerm(normalizedText, term))).map(
    (rule) => rule.category
  );
}

// O termo precisa começar uma palavra ("torac" casa com "torácica"); siglas curtas
// precisam ser a palavra inteira ("ambu" não casa com "ambulatório").
function matchesCategoryTerm(normalizedText, term) {
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wordEnd = term.length <= 4 ? "(?![a-z0-9])" : "";
  return new RegExp(`(^|[^a-z0-9])${escapedTerm}${wordEnd}`).test(normalizedText);
}

function getProcedureDiscipline(rawProcedure) {
  const explicitDiscipline = safeText(rawProcedure.disciplina);

  if (explicitDiscipline) {
    return explicitDiscipline;
  }

  const match = safeText(rawProcedure.categoria).match(/^\s*(?:Habilidades\s+Cirúrgicas|HC)\s*(II|I|2|1)\b/i);

  if (!match) {
    return "";
  }

  return /^(II|2)$/i.test(match[1]) ? "HC II" : "HC I";
}

function normalizeSearchText(value) {
  return safeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function compareDisplayCategories(a, b) {
  const orderDifference = getDisplayCategoryOrder(a) - getDisplayCategoryOrder(b);

  if (orderDifference !== 0) {
    return orderDifference;
  }

  return a.localeCompare(b, "pt-BR");
}

function getDisplayCategoryOrder(category) {
  const index = DISPLAY_CATEGORIES.indexOf(category);
  return index === -1 ? DISPLAY_CATEGORIES.length : index;
}

function getSelectedProcedure() {
  return appState.procedures.find((procedure) => procedure.id === appState.selectedProcedureId) || null;
}

function selectProcedure(procedureId) {
  if (!appState.procedures.find((procedure) => procedure.id === procedureId)) {
    return;
  }

  const isDifferentProcedure = appState.selectedProcedureId !== procedureId;

  appState.selectedProcedureId = procedureId;
  persistState();
  render();

  if (isDifferentProcedure) {
    playEnterAnimation(elements.procedureView);
  }
}

function playEnterAnimation(element) {
  if (!element) {
    return;
  }

  element.classList.remove("is-entering");
  // Força o navegador a registrar a remoção para a animação recomeçar.
  void element.offsetWidth;
  element.classList.add("is-entering");

  const handleEnd = (event) => {
    // Ignora o fim das animações dos filhos (cartões, painéis), que também borbulham.
    if (event.target !== element) {
      return;
    }

    element.classList.remove("is-entering");
    element.removeEventListener("animationend", handleEnd);
  };

  element.addEventListener("animationend", handleEnd);
}

function selectRandomProcedure() {
  const pool = getFilteredProcedures();

  if (!pool.length) {
    return;
  }

  const randomIndex = Math.floor(Math.random() * pool.length);
  const selected = pool[randomIndex];

  if (selected) {
    selectProcedure(selected.id);
  }
}

function isCompactLayout() {
  // Mesmo ponto de quebra do CSS em que a barra lateral vira um painel recolhível.
  return window.matchMedia("(max-width: 1023px)").matches;
}

function setMobileSidebarExpanded(expanded) {
  if (!elements.sidebar) {
    return;
  }

  elements.sidebar.classList.toggle("is-expanded", expanded);

  if (elements.mobileSidebarToggle) {
    elements.mobileSidebarToggle.setAttribute("aria-expanded", String(expanded));
  }
}

function revealProcedureAfterSelection() {
  if (!isCompactLayout() || !getSelectedProcedure()) {
    return;
  }

  setMobileSidebarExpanded(false);
  elements.procedureView.scrollIntoView({ behavior: "smooth", block: "start" });
}

function ensureProcedureProgress(procedureId) {
  if (!appState.progress[procedureId]) {
    appState.progress[procedureId] = {
      checklist: [],
      sequenceIndex: 0
    };
  }

  return appState.progress[procedureId];
}

function toggleChecklistStep(procedureId, stepNumber, checked) {
  const entry = ensureProcedureProgress(procedureId);
  const nextChecklist = new Set(entry.checklist);

  if (checked) {
    nextChecklist.add(stepNumber);
  } else {
    nextChecklist.delete(stepNumber);
  }

  entry.checklist = [...nextChecklist].sort((a, b) => a - b);
  persistState();

  const procedure = getSelectedProcedure();

  if (!procedure) {
    return;
  }

  // Atualiza só o cartão marcado: redesenhar a lista inteira fechava os painéis
  // abertos e fazia a tela pular.
  const checkbox = elements.studyStepsList.querySelector(`[data-step-number="${stepNumber}"]`);
  const card = checkbox ? checkbox.closest(".step-card") : null;

  if (card) {
    card.classList.toggle("is-checked", checked);
    const label = checkbox.parentElement.querySelector("span");

    if (label) {
      label.textContent = checked ? "Concluído" : "Marcar como concluído";
    }
  }

  renderChecklistProgressText(procedure);
}

function restartSequence() {
  const procedure = getSelectedProcedure();

  if (!procedure) {
    return;
  }

  ensureProcedureProgress(procedure.id).sequenceIndex = 0;
  persistState();
  renderSequenceView(procedure);
  scrollSequenceSummaryIntoView();
}

function updateSequenceBy(amount) {
  const procedure = getSelectedProcedure();

  if (!procedure) {
    return;
  }

  const entry = ensureProcedureProgress(procedure.id);
  const previousIndex = entry.sequenceIndex;
  const nextIndex = Math.max(0, Math.min(entry.sequenceIndex + amount, procedure.passos.length));

  if (previousIndex === nextIndex) {
    return;
  }

  entry.sequenceIndex = nextIndex;
  persistState();
  renderSequenceView(procedure);

  if (amount > 0) {
    emphasizeSequenceStep(nextIndex);
  }
}

function syncSequenceControls(currentIndex, totalSteps) {
  const isAtStart = currentIndex === 0;
  const isComplete = currentIndex >= totalSteps;

  elements.previousStepButton.disabled = isAtStart;
  elements.nextStepButton.disabled = isComplete;
  elements.restartSequenceButton.disabled = isAtStart;
  elements.mobilePreviousStepButton.disabled = isAtStart;
  elements.mobileNextStepButton.disabled = isComplete;
  elements.mobileRestartSequenceButton.disabled = isAtStart;
}

function emphasizeSequenceStep(sequenceIndex) {
  const target = elements.sequenceStepsList.querySelector(`[data-sequence-index="${sequenceIndex}"]`);

  if (!target) {
    return;
  }

  target.classList.remove("is-revealed");

  requestAnimationFrame(() => {
    target.classList.add("is-revealed");
    target.scrollIntoView({ behavior: "smooth", block: "center" });

    window.setTimeout(() => {
      target.classList.remove("is-revealed");
    }, 1600);
  });
}

function scrollSequenceSummaryIntoView() {
  const summary = document.querySelector(".sequence-summary");

  if (!summary) {
    return;
  }

  summary.scrollIntoView({ behavior: "smooth", block: "start" });
}

function handleSequenceShortcuts(event) {
  if (appState.mode !== "sequence" || !getSelectedProcedure()) {
    return;
  }

  if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }

  if (isInteractiveTarget(event.target)) {
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    updateSequenceBy(1);
    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    updateSequenceBy(-1);
    return;
  }

  if (event.key.toLowerCase() === "r") {
    event.preventDefault();
    restartSequence();
  }
}

function isInteractiveTarget(target) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(target.closest("input, textarea, select, button, [contenteditable='true'], [contenteditable='']"));
}

function setStatusDetail(message) {
  appState.statusDetail = message;
  renderStatusPanel();
}

function setLoadingState(active, label, current, total) {
  appState.loading = {
    active,
    label,
    current,
    total
  };

  renderStatusPanel();
}

function getLoadingPercentage() {
  if (!appState.loading.total) {
    return 0;
  }

  return Math.max(0, Math.min(100, (appState.loading.current / appState.loading.total) * 100));
}

function countProceduresBySource() {
  return appState.procedures.reduce(
    (accumulator, procedure) => {
      accumulator[procedure._meta.sourceKind] = (accumulator[procedure._meta.sourceKind] || 0) + 1;
      return accumulator;
    },
    { github: 0, manifest: 0, example: 0, local: 0 }
  );
}

function buildProcedureBreakdownText(sourceCounts) {
  const parts = [];

  if (sourceCounts.github) {
    parts.push(`GitHub: ${sourceCounts.github}`);
  }

  if (sourceCounts.manifest) {
    parts.push(`Manifest: ${sourceCounts.manifest}`);
  }

  if (sourceCounts.local) {
    parts.push(`Local: ${sourceCounts.local}`);
  }

  if (sourceCounts.example) {
    parts.push(`Exemplos: ${sourceCounts.example}`);
  }

  return parts.length ? parts.join(" • ") : "Nenhum roteiro final carregado.";
}

function buildSourceLabel() {
  const hasLocal = getLocalProcedures().length > 0;

  if (appState.primarySource.kind === "github") {
    return hasLocal ? "GitHub + importação local" : "GitHub";
  }

  if (appState.primarySource.kind === "manifest") {
    return hasLocal ? "Manifest local + importação local" : "Manifest local";
  }

  if (appState.primarySource.kind === "example") {
    return hasLocal ? "Exemplos locais + importação local" : "Exemplos locais";
  }

  if (hasLocal) {
    return "Importação local";
  }

  return "Nenhuma fonte disponível";
}

function buildStatusMessage(totalProcedures, localCount) {
  if (appState.loading.active) {
    return `${appState.loading.label}...`;
  }

  if (!totalProcedures) {
    return "Nenhum roteiro válido disponível no momento. Confira o painel de erros, o manifest ou importe arquivos locais para teste.";
  }

  if (appState.primarySource.kind === "manifest") {
    return localCount
      ? "Base carregada por manifest local e combinada com importações temporárias."
      : "Base carregada a partir do manifest local após falha na leitura automática do GitHub.";
  }

  if (appState.primarySource.kind === "github") {
    return localCount
      ? "Roteiros lidos do GitHub e enriquecidos com arquivos locais temporários para pré-visualização."
      : "Roteiros lidos automaticamente da pasta configurada no repositório GitHub.";
  }

  if (appState.primarySource.kind === "example") {
    return localCount
      ? "Exemplos locais carregados e enriquecidos com arquivos temporários desta sessão."
      : "GitHub e manifest falharam, então o site carregou exemplos locais para permanecer utilizável.";
  }

  if (localCount) {
    return "Apenas arquivos locais temporários estão disponíveis nesta sessão.";
  }

  return "Aguardando uma fonte válida de dados.";
}

function getAllIssues() {
  return [...appState.baseIssues, ...getLocalIssues(), ...appState.mergeIssues];
}

function getLocalProcedures() {
  return Object.values(appState.localImports).flatMap((record) => record.entries || []);
}

function getLocalIssues() {
  return Object.values(appState.localImports).flatMap((record) => record.issues || []);
}

function showMessage(text, variant) {
  if (!text) {
    elements.loadMessage.textContent = "";
    elements.loadMessage.className = "message hidden";
    return;
  }

  elements.loadMessage.textContent = text;
  elements.loadMessage.className = `message ${variant || ""}`.trim();
}

function createIssue(severity, sourceKind, fileName, message) {
  return {
    severity,
    sourceKind,
    sourceLabel: getIssueSourceLabel(sourceKind),
    fileName,
    message
  };
}

function getIssueSourceLabel(sourceKind) {
  const labels = {
    config: "Configuração",
    github: "GitHub",
    manifest: "Manifest local",
    example: "Exemplos locais",
    local: "Importação local",
    merge: "Mesclagem",
    validation: "Validação"
  };

  return labels[sourceKind] || "Sistema";
}

function sanitizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => safeText(item)).filter(Boolean);
}

function resolveMediaPath(value) {
  const path = safeText(value);

  if (!path) {
    return "";
  }

  if (/^(https?:|data:|blob:)/i.test(path)) {
    return path;
  }

  // Relative media paths are resolved against the published site root, which keeps GitHub Pages compatible.
  return buildAppUrl(path).href;
}

function buildGitHubContentsUrl(githubConfig, path) {
  const encodedPath = encodePathSegments(path);

  return `https://api.github.com/repos/${encodeURIComponent(githubConfig.owner)}/${encodeURIComponent(githubConfig.repo)}/contents/${encodedPath}?ref=${encodeURIComponent(githubConfig.branch)}`;
}

function buildRawGitHubUrl(githubConfig, path) {
  return `https://raw.githubusercontent.com/${encodeURIComponent(githubConfig.owner)}/${encodeURIComponent(githubConfig.repo)}/${encodeURIComponent(githubConfig.branch)}/${encodePathSegments(path)}`;
}

function buildRepositoryLabel(config) {
  return `${config.github.owner}/${config.github.repo}@${config.github.branch}`;
}

function createGitHubHttpError(response, folderPath) {
  if (response.status === 404) {
    return new Error(`Pasta não encontrada no GitHub: ${folderPath}. Verifique owner, repo, branch e proceduresPath.`);
  }

  if (response.status === 403) {
    const remaining = response.headers.get("X-RateLimit-Remaining");
    const reset = response.headers.get("X-RateLimit-Reset");

    if (remaining === "0") {
      return new Error(
        `Limite temporário da API do GitHub atingido. Tente novamente mais tarde${reset ? ` (reset aproximado em ${new Date(Number(reset) * 1000).toLocaleString("pt-BR")})` : ""}.`
      );
    }

    return new Error("A API do GitHub recusou a requisição. Repositórios privados não funcionam sem autenticação, então mantenha o projeto público para GitHub Pages.");
  }

  return new Error(`Falha ao consultar a pasta ${folderPath} no GitHub: HTTP ${response.status}.`);
}

function getReadableError(error) {
  return error instanceof Error ? error.message : String(error);
}

function buildAppUrl(path) {
  return new URL(normalizeRelativePath(path), getSiteBaseUrl());
}

function getSiteBaseUrl() {
  const currentUrl = new URL(window.location.href);
  const cleanHref = currentUrl.href.split("#")[0].split("?")[0];

  if (currentUrl.protocol === "file:") {
    if (currentUrl.pathname.endsWith("/")) {
      return new URL(cleanHref);
    }

    const lastSegment = currentUrl.pathname.split("/").pop() || "";

    if (lastSegment.includes(".")) {
      return new URL("./", cleanHref);
    }

    return new URL(`${cleanHref.replace(/\/?$/, "/")}`);
  }

  let pathname = currentUrl.pathname || "/";

  if (pathname.endsWith("/")) {
    return new URL(pathname, currentUrl.origin);
  }

  const lastSegment = pathname.split("/").pop() || "";

  if (lastSegment.includes(".")) {
    pathname = pathname.slice(0, pathname.lastIndexOf("/") + 1) || "/";
  } else {
    pathname = `${pathname}/`;
  }

  return new URL(pathname, currentUrl.origin);
}

function normalizeRelativePath(path) {
  return String(path || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^\.\//, "")
    .trim();
}

function joinPaths(...parts) {
  return parts.map((part) => normalizeRelativePath(part)).filter(Boolean).join("/");
}

function getFileNameFromPath(path) {
  const normalized = normalizeRelativePath(path);
  const segments = normalized.split("/");
  return segments[segments.length - 1] || normalized;
}

function encodePathSegments(path) {
  return normalizeRelativePath(path)
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function isProcedureFileName(fileName) {
  const lowerCaseName = String(fileName || "").toLowerCase();
  return SUPPORTED_EXTENSIONS.some((extension) => lowerCaseName.endsWith(extension));
}

function stripBom(text) {
  return String(text || "").replace(/^\uFEFF/, "");
}

function safeText(value) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function toggleFavorite(procedureId) {
  const index = appState.favorites.indexOf(procedureId);
  if (index === -1) {
    appState.favorites.push(procedureId);
  } else {
    appState.favorites.splice(index, 1);
  }
  saveFavorites();
  // Sem render() completo, para não redesenhar o roteiro aberto.
  renderHeroFavoriteButton(getSelectedProcedure());
  renderProcedureList();
  renderQuickProcedurePicker();
}

function saveFavorites() {
  localStorage.setItem("lacir-favorites", JSON.stringify(appState.favorites));
}

function renderFavoritesFilterButton() {
  const btn = elements.toggleFavoritesFilterButton;
  if (!btn) return;
  if (appState.showFavoritesOnly) {
    btn.classList.add("button-primary");
    btn.classList.remove("button-secondary");
    btn.innerHTML = `Mostrar todos os roteiros <span>★</span>`;
  } else {
    btn.classList.remove("button-primary");
    btn.classList.add("button-secondary");
    btn.innerHTML = `Filtrar favoritos <span>☆</span>`;
  }
}

function toggleFocusMode(active) {
  if (active) {
    document.body.classList.add("focus-mode");
    if (elements.focusModeButton) {
      elements.focusModeButton.textContent = "Sair do foco";
      elements.focusModeButton.classList.add("button-primary");
      elements.focusModeButton.classList.remove("button-secondary");
    }
    // Recolher todos os acordeões de informações adicionais
    document.querySelectorAll("#detailsContainer details").forEach((el) => {
      el.open = false;
    });
    // Rolar a tela suavemente para o início do roteiro selecionado
    if (elements.selectedProcedureName) {
      elements.selectedProcedureName.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } else {
    document.body.classList.remove("focus-mode");
    if (elements.focusModeButton) {
      elements.focusModeButton.textContent = "Modo Foco";
      elements.focusModeButton.classList.add("button-secondary");
      elements.focusModeButton.classList.remove("button-primary");
    }
  }
}
