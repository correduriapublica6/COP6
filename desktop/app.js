(() => {
  const STORAGE_KEY = "control-avaluos.desktop.v3";
  const SESSION_KEY = "control-avaluos.desktop.session.v1";
  const CREDENTIALS_KEY = "control-avaluos.desktop.credentials.v1";
  const ROLE_STORAGE_KEY = "control-avaluos.desktop.roles.v1";
  const USER_STORAGE_KEY = "control-avaluos.desktop.users.v1";
  const RECEIPT_SEQUENCE_KEY = "control-avaluos.desktop.receipt-sequence.v1";
  const TECHNICAL_APPRAISALS_KEY = "control-avaluos.desktop.technical-appraisals.v1";
  const TECHNICAL_OBJECTIVES_KEY = "control-avaluos.desktop.technical-objectives.v1";
  const TASKS_KEY = "control-avaluos.desktop.tasks.v1";
  const CHAT_MESSAGES_KEY = "control-avaluos.desktop.chat.v1";
  const BACKUP_VERSION = 1;
  const USERS = ["Juan Manuel Barrera Martínez", "Gabriel Barrera Martínez", "Cesar Delgado Armendáriz", "Diana Barrera Rivera", "Francisco Gabriel Hernández Estrada", "Emmanuel Barrera Atilano", "Caridad Rojas Vázquez", "Ivan de Luna Aldape"];
  const DEFAULT_ROLE_BY_USER = { "Juan Manuel Barrera Martínez": "admin", "Francisco Gabriel Hernández Estrada": "admin", "Caridad Rojas Vázquez": "editor", "Ivan de Luna Aldape": "valuador" };
  const VALID_ROLES = ["admin", "editor", "viewer", "valuador", "auditor"];
  const LEGACY_KEYS = ["control-avaluos.desktop.v2", "control-avaluos.desktop.v1"];
  // API pública fija para despliegues externos como GitHub Pages.
  const API_BASE_URL = "https://api.cp6coahuila.com/api";
  const today = () => new Date().toISOString().slice(0, 10);
  const initialDraft = { numeroAvaluo: "", usuario: "", tipoBien: "", tipoAvaluo: "", solicitante: "", valorAvaluo: "", seEntregoA: "", pagoEntregadoA: "", observacion: "", fechaAvaluo: today(), pagado: false, montoPagado: 0, metodoPago: "", fechaPago: "" };

  let records = loadRecords();
  let technicalAppraisals = loadTechnicalAppraisals();
  let tasks = loadTasks();
  let chatMessages = loadChatMessages();
  let serverOnline = false;
  let remoteUsers = null;
  let notarias = [];
  let authorizedAppraisalNumbers = [];
  let operationalView = "todos";
  let activeAppView = "avaluos";
  let activeSessionUser = "";
  let pendingCredentialAuthorization = null;
  let editingId = null;
  let serverMonitorId = null;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const recordEditor = $("#recordEditor");
  const form = $("#recordForm");
  const paidInput = $("#paidInput");
  const paymentDetails = $("#paymentDetails");
  const numberInput = $("#numeroInput");
  const avaluoDateInput = $("#avaluoDateInput");
  const amountInput = $("#amountInput");
  const methodInput = $("#methodInput");
  const paymentDeliveredToInput = $("#paymentDeliveredToInput");
  const paymentDateInput = $("#paymentDateInput");
  const searchInput = $("#searchInput");
  const loginScreen = $("#loginScreen");
  const adminAccessDialog = $("#adminAccessDialog");
  const loginForm = $("#loginForm");
  const loginUser = $("#loginUser");
  const loginPassword = $("#loginPassword");
  const loginMessage = $("#loginMessage");
  const appShell = $("#appShell");
  const activeUser = $("#activeUser");
  const activeUserRole = $("#activeUserRole");
  const credentialDialog = $("#credentialDialog");
  const credentialForm = $("#credentialForm");
  const credentialUser = $("#credentialUser");
  const credentialPassword = $("#credentialPassword");
  const credentialPasswordConfirm = $("#credentialPasswordConfirm");
  const credentialMessage = $("#credentialMessage");
  const manageUsersButton = $("#manageUsersButton");

  function normalizeNumber(value) { return String(value || "").replace(/\D/g, "").slice(0, 4); }
  function normalizeRecord(record) {
    const now = today();
    return { ...initialDraft, ...record, numeroAvaluo: normalizeNumber(record.numeroAvaluo), seEntregoA: record.seEntregoA ?? record.referencia ?? "", pagoEntregadoA: record.pagoEntregadoA ?? "", fechaAvaluo: record.fechaAvaluo ?? record.creadoEn?.slice(0, 10) ?? now, fechaPago: record.fechaPago ?? (record.pagado ? record.actualizadoEn?.slice(0, 10) ?? now : ""), metodoPago: record.metodoPago ?? "", creadoEn: record.creadoEn ?? new Date().toISOString(), actualizadoEn: record.actualizadoEn ?? record.creadoEn ?? new Date().toISOString() };
  }
  function loadRecords() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || LEGACY_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.map(normalizeRecord) : [];
    } catch { return []; }
  }
  const saveRecords = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  function loadTechnicalAppraisals() {
    try {
      const saved = JSON.parse(localStorage.getItem(TECHNICAL_APPRAISALS_KEY) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch { return []; }
  }
  function stripInlineImages(value) {
    if (Array.isArray(value)) return value.map(stripInlineImages);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => {
      if (["dataUrl", "localizacionFoto", "fotografia", "foto", "data"].includes(key) && typeof nested === "string" && nested.startsWith("data:")) return [key, ""];
      return [key, stripInlineImages(nested)];
    }));
  }
  const saveTechnicalAppraisals = () => localStorage.setItem(TECHNICAL_APPRAISALS_KEY, JSON.stringify(technicalAppraisals.map(stripInlineImages)));
  function loadTasks() { try { const saved = JSON.parse(localStorage.getItem(TASKS_KEY) || "[]"); return Array.isArray(saved) ? saved : []; } catch { return []; } }
  const saveTasks = () => localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  function loadChatMessages() { try { const saved = JSON.parse(localStorage.getItem(CHAT_MESSAGES_KEY) || "[]"); return Array.isArray(saved) ? saved : []; } catch { return []; } }
  const saveChatMessages = () => localStorage.setItem(CHAT_MESSAGES_KEY, JSON.stringify(chatMessages));
  function setServerStatus(status) {
    const normalized = status === "online" ? "online" : status === "checking" ? "checking" : "offline";
    serverOnline = normalized === "online";
    document.body.dataset.serverStatus = normalized;
    const label = $("#serverStatusLabel");
    const indicator = $("#serverConnectionStatus");
    if (label) label.textContent = normalized === "online" ? "En línea" : normalized === "checking" ? "Comprobando servidor" : "Sin conexión";
    if (indicator) indicator.title = normalized === "online" ? "Conectado al servidor de Recepción; los datos se sincronizan con la base central." : normalized === "checking" ? "Comprobando conexión con el servidor de Recepción." : "No se puede acceder al servidor de Recepción; los datos no se están sincronizando.";
  }
  function loadTechnicalObjectives() {
    try {
      const saved = JSON.parse(localStorage.getItem(TECHNICAL_OBJECTIVES_KEY) || "[]");
      const local = Array.isArray(saved) ? saved.map((value) => String(value).trim()).filter(Boolean) : [];
      const shared = technicalAppraisals.map((appraisal) => String(appraisal?.objetivoAvaluo || "").trim()).filter(Boolean);
      return [...new Set([...local, ...shared])];
    } catch { return []; }
  }
  function saveTechnicalObjectives(values) { localStorage.setItem(TECHNICAL_OBJECTIVES_KEY, JSON.stringify([...new Set(values.map((value) => String(value).trim()).filter(Boolean))])); }
  const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  async function apiRequest(endpoint, options = {}) {
    const maxAttempts = Number.isFinite(options.retries) ? Math.max(1, Math.min(4, options.retries + 1)) : 3;
    const { retries: _retries, ...requestOptions } = options;
    let response;
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const requestHeaders = { "Content-Type": "application/json", ...(activeSessionUser ? { "X-User-Name": encodeURIComponent(activeSessionUser) } : {}), ...(requestOptions.headers || {}) };
        response = await fetch(`${API_BASE_URL}${endpoint}`, { ...requestOptions, cache: "no-store", headers: requestHeaders });
        if (response.ok || ![429, 502, 503, 504].includes(response.status) || attempt === maxAttempts) break;
        lastError = new Error(`Servidor temporalmente no disponible (${response.status}).`);
      } catch (error) {
        lastError = error;
        if (attempt === maxAttempts) break;
      }
      await wait(450 * attempt);
    }
    if (!response) {
      setServerStatus("offline");
      throw new Error("Sin conexión con el servidor de Recepción después de varios intentos. Verifica que esté encendido y que la dirección de red sea correcta.");
    }
    setServerStatus("online");
    if (!response.ok) {
      let detail = lastError?.message || "No se pudo completar la operación en el servidor.";
      try { detail = (await response.json()).error || detail; } catch {}
      if (/tipo de avalúo técnico no es válido/i.test(detail)) {
        detail = "El servidor de Recepción está desactualizado y no reconoce Mobiliario y Bienes Diversos. Reemplaza local-server/server.mjs con la versión actualizada y reinícialo sin borrar la carpeta data.";
      }
      throw new Error(detail);
    }
    return response.status === 204 ? null : response.json();
  }
  function startServerMonitor() {
    if (serverMonitorId) return;
    serverMonitorId = window.setInterval(async () => {
      if (editingId || document.hidden) return;
      try {
        const latestState = await apiRequest("/state");
        const latestRecords = Array.isArray(latestState.records) ? latestState.records : [];
        const latestAppraisals = Array.isArray(latestState.appraisals) ? latestState.appraisals : [];
        const latestTasks = Array.isArray(latestState.tasks) ? latestState.tasks : [];
        const latestChatMessages = Array.isArray(latestState.chatMessages) ? latestState.chatMessages : [];
        const latestAuthorizedFolios = Array.isArray(latestState.authorizedAppraisalNumbers) ? latestState.authorizedAppraisalNumbers.map(normalizeNumber).sort() : [];
        const latestSignature = JSON.stringify({ records: latestRecords.map((record) => `${record.id}:${record.actualizadoEn || record.updatedAt || ""}`), appraisals: latestAppraisals.map((appraisal) => `${appraisal.id}:${appraisal.actualizadoEn || appraisal.updatedAt || ""}`), tasks: latestTasks.map((task) => `${task.id}:${task.completed}:${task.actualizadoEn || task.updatedAt || ""}`), chat: latestChatMessages.map((item) => `${item.id}:${item.creadoEn || ""}`), authorizedFolios: latestAuthorizedFolios });
        const currentSignature = JSON.stringify({ records: records.map((record) => `${record.id}:${record.actualizadoEn || record.updatedAt || ""}`), appraisals: technicalAppraisals.map((appraisal) => `${appraisal.id}:${appraisal.actualizadoEn || appraisal.updatedAt || ""}`), tasks: tasks.map((task) => `${task.id}:${task.completed}:${task.actualizadoEn || task.updatedAt || ""}`), chat: chatMessages.map((item) => `${item.id}:${item.creadoEn || ""}`), authorizedFolios: authorizedAppraisalNumbers.map(normalizeNumber).sort() });
        if (latestSignature !== currentSignature) {
          const previousChatId = chatMessages.at(-1)?.id || "";
          const incomingChatMessage = latestChatMessages.at(-1);
          const chatPanelClosed = $("#chatPanel")?.hidden !== false;
          if (incomingChatMessage && incomingChatMessage.id !== previousChatId && incomingChatMessage.author !== activeSessionUser && chatPanelClosed) playChatNotification();
          records = latestRecords.map(normalizeRecord);
          technicalAppraisals = latestAppraisals;
          tasks = latestTasks;
          chatMessages = latestChatMessages;
          authorizedAppraisalNumbers = latestAuthorizedFolios;
          window.__controlAuthorizedFolios = authorizedAppraisalNumbers;
          saveRecords();
          saveTechnicalAppraisals();
          saveTasks();
          saveChatMessages();
          window.dispatchEvent(new CustomEvent("control-avaluos:technical-appraisals-updated"));
          renderWelcomeTasks();
          render();
        }
      } catch {
        setServerStatus("offline");
      }
    }, 2000);
  }
  async function loadRemoteState() {
    setServerStatus("checking");
    try {
      const remoteState = await apiRequest("/state");
      if (!Array.isArray(remoteState.records)) throw new Error("La respuesta del servidor no contiene registros válidos.");
      records = remoteState.records.map(normalizeRecord);
      technicalAppraisals = Array.isArray(remoteState.appraisals) ? remoteState.appraisals : loadTechnicalAppraisals();
      tasks = Array.isArray(remoteState.tasks) ? remoteState.tasks : loadTasks();
      chatMessages = Array.isArray(remoteState.chatMessages) ? remoteState.chatMessages : loadChatMessages();
      remoteUsers = Array.isArray(remoteState.users) ? remoteState.users : null;
      notarias = Array.isArray(remoteState.notarias) ? remoteState.notarias : [];
      authorizedAppraisalNumbers = Array.isArray(remoteState.authorizedAppraisalNumbers) ? remoteState.authorizedAppraisalNumbers : [];
      window.__controlNotarias = notarias;
      window.__controlAuthorizedFolios = authorizedAppraisalNumbers;
      saveRecords();
      saveTechnicalAppraisals();
      saveTasks();
      saveChatMessages();
      setServerStatus("online");
      syncUserOptions();
      syncCredentialSetupVisibility();
      if (activeSessionUser) { applyRoleUi(); renderAuthorizedFolios(); }
      render();
    } catch {
      setServerStatus("offline");
      render();
    } finally {
      startServerMonitor();
    }
  }
  async function saveRemoteRecord(record, editing) {
    if (!serverOnline) throw new Error("No fue posible comunicarse con el servidor de Recepción. Inicia el servidor y verifica /api/health antes de guardar.");
    const saved = await apiRequest(editing ? `/records/${encodeURIComponent(record.id)}` : "/records", { method: editing ? "PUT" : "POST", body: JSON.stringify(record) });
    return normalizeRecord(saved);
  }
  async function deleteRemoteRecord(id) {
    if (serverOnline) await apiRequest(`/records/${encodeURIComponent(id)}`, { method: "DELETE" });
  }
  async function saveTechnicalAppraisal(appraisal) {
    const exists = technicalAppraisals.some((item) => item.id === appraisal.id);
    const saved = await apiRequest(exists ? `/appraisals/${encodeURIComponent(appraisal.id)}` : "/appraisals", { method: exists ? "PUT" : "POST", body: JSON.stringify(appraisal) });
    technicalAppraisals = [saved, ...technicalAppraisals.filter((item) => item.id !== saved.id)];
    saveTechnicalAppraisals();
    window.dispatchEvent(new CustomEvent("control-avaluos:technical-appraisals-updated"));
    return saved;
  }
  async function saveTask(task, editing = false) {
    if (!serverOnline) {
      tasks = editing ? tasks.map((item) => item.id === task.id ? task : item) : [task, ...tasks];
      saveTasks();
      return task;
    }
    const saved = await apiRequest(editing ? `/tasks/${encodeURIComponent(task.id)}` : "/tasks", { method: editing ? "PUT" : "POST", body: JSON.stringify(task) });
    tasks = editing ? tasks.map((item) => item.id === saved.id ? saved : item) : [saved, ...tasks];
    saveTasks();
    return saved;
  }
  async function deleteTask(id) {
    if (serverOnline) await apiRequest(`/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
    tasks = tasks.filter((item) => item.id !== id);
    saveTasks();
  }
  async function saveChatMessage(message) {
    if (!serverOnline) {
      chatMessages = [...chatMessages, message].slice(-100);
      saveChatMessages();
      return message;
    }
    const saved = await apiRequest("/chat", { method: "POST", body: JSON.stringify(message) });
    chatMessages = [...chatMessages, saved].slice(-100);
    saveChatMessages();
    return saved;
  }
  async function deleteTechnicalAppraisal(id) {
    if (!serverOnline) {
      technicalAppraisals = technicalAppraisals.filter((item) => item.id !== id);
      saveTechnicalAppraisals();
      window.dispatchEvent(new CustomEvent("control-avaluos:technical-appraisals-updated"));
      return;
    }
    await apiRequest(`/appraisals/${encodeURIComponent(id)}`, { method: "DELETE" });
    technicalAppraisals = technicalAppraisals.filter((item) => item.id !== id);
    saveTechnicalAppraisals();
    window.dispatchEvent(new CustomEvent("control-avaluos:technical-appraisals-updated"));
  }
  async function getNextTechnicalFolio(year) {
    const normalizedYear = String(year || new Date().getFullYear()).replace(/\D/g, "").slice(0, 4) || String(new Date().getFullYear());
    if (serverOnline) {
      try {
        const response = await apiRequest(`/appraisals/next-folio?year=${encodeURIComponent(normalizedYear)}`);
        return response.folio;
      } catch {}
    }
    const matcher = new RegExp(`^(\\d{4})/${normalizedYear}$`);
    const highest = technicalAppraisals.reduce((current, appraisal) => {
      const match = String(appraisal.numeroAvaluo || "").match(matcher);
      return match ? Math.max(current, Number(match[1])) : current;
    }, 14);
    return `${String(Math.max(15, highest + 1)).padStart(4, "0")}/${normalizedYear}`;
  }
  function normalizeUserName(value) { return String(value || "").trim().replace(/\s+/g, " "); }
  function loadAddedUsers() {
    try {
      const saved = JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || "[]");
      return Array.isArray(saved) ? [...new Set(saved.map(normalizeUserName).filter((user) => user.length >= 3 && user.length <= 90 && !USERS.includes(user)))] : [];
    } catch { return []; }
  }
  function saveAddedUsers(users) { localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(users)); }
  const allUsers = () => remoteUsers?.length ? [...new Set(remoteUsers.map((user) => user.name))] : [...USERS, ...loadAddedUsers()];
  function loadRoles() {
    try {
      const saved = JSON.parse(localStorage.getItem(ROLE_STORAGE_KEY) || "{}");
      const roles = { ...DEFAULT_ROLE_BY_USER };
      Object.entries(saved && typeof saved === "object" ? saved : {}).forEach(([user, role]) => {
        if (allUsers().includes(user) && DEFAULT_ROLE_BY_USER[user] !== "admin" && VALID_ROLES.includes(role)) roles[user] = role;
      });
      return roles;
    } catch { return { ...DEFAULT_ROLE_BY_USER }; }
  }
  function saveRoles(roles) { localStorage.setItem(ROLE_STORAGE_KEY, JSON.stringify(roles)); }
  const roleFor = (user) => {
    const normalizedUser = normalizeUserName(user).toLocaleLowerCase("es-MX");
    const canonicalUser = Object.keys(DEFAULT_ROLE_BY_USER).find((name) => normalizeUserName(name).toLocaleLowerCase("es-MX") === normalizedUser) || user;
    if (DEFAULT_ROLE_BY_USER[canonicalUser] === "admin") return "admin";
    const remoteMatch = remoteUsers?.length ? remoteUsers.find((item) => normalizeUserName(item.name).toLocaleLowerCase("es-MX") === normalizedUser) : null;
    const role = remoteMatch?.role || loadRoles()[canonicalUser];
    return VALID_ROLES.includes(role) ? role : "viewer";
  };
  const roleLabel = (role) => ({ admin: "Administrador", editor: "Editor(a)", viewer: "Solo lectura", valuador: "Valuador", auditor: "Auditor" }[role] || "Solo lectura");
  const isAdmin = () => roleFor(activeSessionUser) === "admin";
  const canEdit = () => ["admin", "editor", "valuador", "auditor"].includes(roleFor(activeSessionUser));
  const canEditReception = () => ["admin", "editor", "auditor"].includes(roleFor(activeSessionUser));
  const canCreateTask = () => ["admin", "editor", "valuador", "auditor"].includes(roleFor(activeSessionUser));
  const canViewSummary = () => ["admin", "editor", "auditor"].includes(roleFor(activeSessionUser));
  const canAuthorizeFolios = () => ["admin", "auditor"].includes(roleFor(activeSessionUser));
  const canViewFePublica = () => ["admin", "editor", "auditor"].includes(roleFor(activeSessionUser));
  const canViewRequests = () => ["admin", "valuador", "auditor"].includes(roleFor(activeSessionUser));
  const escapeHtml = (value) => String(value || "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[character]));
  const formatCurrency = (amount) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(amount) || 0);
  const parseMoney = (value) => Number(String(value ?? "").replace(/[^0-9.-]/g, "")) || 0;
  function formatMoneyInput(input) { if (!input) return; const raw = String(input.value || ""); const digits = raw.replace(/[^0-9.]/g, ""); if (!digits) { input.value = ""; return; } const parts = digits.split("."); const whole = parts.shift().replace(/^0+(?=\d)/, "") || "0"; const decimals = parts.join("").slice(0, 2); input.value = `$${Number(whole).toLocaleString("en-US")}${decimals ? `.${decimals}` : ""}`; }
  function bindMoneyInputs() { document.querySelectorAll("[data-money-input], #appraisalValueInput, #amountInput").forEach((input) => { if (input.dataset.moneyBound === "true") return; input.dataset.moneyBound = "true"; input.addEventListener("input", () => formatMoneyInput(input)); input.addEventListener("blur", () => { if (input.value) formatMoneyInput(input); }); }); if (document.body.dataset.moneyDelegated !== "true") { document.body.dataset.moneyDelegated = "true"; document.addEventListener("input", (event) => { const input = event.target; if (input instanceof HTMLInputElement && input.matches("[data-money-input]")) formatMoneyInput(input); }); } }
  const formatDate = (value) => value ? new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`)) : "Sin fecha";
  const formatTaskDate = (value) => value ? formatDate(value) : "Pendiente";
  let lastSeenChatId = chatMessages.at(-1)?.id || "";
  function playChatNotification() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(740, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(980, context.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.24);
      oscillator.addEventListener("ended", () => context.close(), { once: true });
    } catch {}
  }

  function syncUserOptions() {
    const users = allUsers();
    const targets = [loginUser, credentialUser, $("#inlineCredentialUser"), form.elements.namedItem("usuario"), $("#taskAssignedTo")].filter(Boolean);
    targets.forEach((select) => {
      const selected = select.value;
      const firstOption = select.querySelector('option[value=""]');
      const prompt = firstOption ? firstOption.textContent : "Selecciona un usuario";
      select.innerHTML = `<option value="">${escapeHtml(prompt)}</option>${users.map((user) => `<option value="${escapeHtml(user)}">${escapeHtml(user)}</option>`).join("")}`;
      if (users.includes(selected)) select.value = selected;
    });
  }

  function loadCredentials() { try { return JSON.parse(localStorage.getItem(CREDENTIALS_KEY) || "{}") || {}; } catch { return {}; } }
  function saveCredentials(credentials) { localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials)); }
  function closeCredentialSetup() { credentialDialog.close(); }
  function isFirstAdminAccess(user = loginUser.value) {
    const credentials = loadCredentials();
    return Boolean(user && roleFor(user) === "admin" && !credentials[user]);
  }
  function syncCredentialSetupVisibility() {
    const button = $("#openCredentialSetupButton");
    if (!button) return;
    const selected = loginUser.value;
    const visible = Boolean(selected && roleFor(selected) === "admin");
    button.classList.toggle("is-hidden", !visible);
    button.disabled = !visible;
    button.title = visible ? "Configura o cambia la contraseña del Administrador seleccionado" : "Selecciona un perfil Administrador";
  }
  async function openCredentialSetup() {
    const credentials = loadCredentials();
    const bootstrap = Object.keys(credentials).length === 0;
    const selected = loginUser.value;
    const firstAdminAccess = isFirstAdminAccess(selected);
    if (!isAdmin() && roleFor(selected) !== "admin") {
      loginMessage.textContent = "Selecciona un perfil Administrador.";
      return;
    }
    if (!isAdmin()) {
      const currentPassword = String(loginPassword.value || "");
      if (!currentPassword) {
        loginMessage.textContent = "Escribe la contraseña actual del Administrador antes de cambiarla.";
        loginPassword.focus();
        return;
      }
      try {
        if (serverOnline) await apiRequest("/auth/login", { method: "POST", body: JSON.stringify({ name: selected, password: currentPassword }) });
        else if (credentials[selected] !== currentPassword) throw new Error("La contraseña actual no es válida en modo sin conexión.");
        pendingCredentialAuthorization = { user: selected, currentPassword, expiresAt: Date.now() + 5 * 60 * 1000 };
      } catch (error) {
        loginMessage.textContent = error.message || "No fue posible verificar la contraseña actual.";
        return;
      }
    }
    $$("#credentialUser option").forEach((option) => { option.disabled = Boolean(option.value) && (bootstrap || firstAdminAccess) && roleFor(option.value) !== "admin"; });
    credentialMessage.textContent = "";
    credentialUser.value = isAdmin() ? activeSessionUser : selected;
    credentialPassword.value = "";
    credentialPasswordConfirm.value = "";
    credentialDialog.showModal();
  }
  async function saveCredential(event) {
    event.preventDefault();
    const user = credentialUser.value;
    const password = credentialPassword.value;
    const credentials = loadCredentials();
    const bootstrap = Object.keys(credentials).length === 0;
    const firstAdminAccess = isFirstAdminAccess(user);
    const externalAuthorization = pendingCredentialAuthorization && pendingCredentialAuthorization.user === user && pendingCredentialAuthorization.expiresAt > Date.now();
    if (!isAdmin() && !externalAuthorization) {
      credentialMessage.textContent = "Verifica primero la contraseña actual del Administrador desde Acceso administrativo.";
      return;
    }
    if ((bootstrap || firstAdminAccess || externalAuthorization) && roleFor(user) !== "admin") {
      credentialMessage.textContent = "Solo se pueden modificar credenciales de perfiles Administrador desde este acceso.";
      return;
    }
    if (!user || password.length < 6) { credentialMessage.textContent = "Selecciona un usuario y usa una contraseña de al menos 6 caracteres."; return; }
    if (password !== credentialPasswordConfirm.value) { credentialMessage.textContent = "Las contraseñas no coinciden."; return; }
    try {
      const remoteUser = remoteUsers?.find((item) => item.name === user);
      if (externalAuthorization) {
        if (!serverOnline) throw new Error("Conecta el servidor de Recepción para cambiar la contraseña compartida.");
        await apiRequest("/auth/change-password", { method: "POST", body: JSON.stringify({ name: user, currentPassword: pendingCredentialAuthorization.currentPassword, newPassword: password }) });
      } else if (serverOnline && remoteUser) {
        await apiRequest(`/users/${encodeURIComponent(remoteUser.id)}`, { method: "PUT", body: JSON.stringify({ password }) });
      }
      if (remoteUser) remoteUsers = remoteUsers.map((item) => item.id === remoteUser.id ? { ...item, hasPassword: true } : item);
      credentials[user] = password;
      saveCredentials(credentials);
    } catch (error) { credentialMessage.textContent = error.message; return; }
    loginUser.value = user;
    loginPassword.value = "";
    loginMessage.textContent = "Contraseña individual guardada. Ya puedes iniciar sesión.";
    closeCredentialSetup();
    syncCredentialSetupVisibility();
    renderUserPermissions();
  }
  async function saveInlineCredential(event) {
    event.preventDefault();
    if (!isAdmin()) return;
    const user = $("#inlineCredentialUser").value;
    const password = $("#inlineCredentialPassword").value;
    const confirmPassword = $("#inlineCredentialPasswordConfirm").value;
    const message = $("#inlineCredentialMessage");
    if (!user || password.length < 6) { message.textContent = "Selecciona un usuario y usa una contraseña de al menos 6 caracteres."; return; }
    if (password !== confirmPassword) { message.textContent = "Las contraseñas no coinciden."; return; }
    try {
      if (serverOnline) {
        const remoteUser = remoteUsers?.find((item) => item.name === user);
        if (remoteUser) { await apiRequest(`/users/${encodeURIComponent(remoteUser.id)}`, { method: "PUT", body: JSON.stringify({ password }) }); remoteUsers = remoteUsers.map((item) => item.id === remoteUser.id ? { ...item, hasPassword: true } : item); }
      }
      const credentials = loadCredentials();
      credentials[user] = password;
      saveCredentials(credentials);
    } catch (error) { message.textContent = error.message; message.classList.add("is-error"); return; }
    $("#inlineCredentialPassword").value = "";
    $("#inlineCredentialPasswordConfirm").value = "";
    message.classList.remove("is-error");
    message.textContent = `Contraseña guardada para ${user}.`;
    renderUserPermissions();
  }

  function applyRoleUi() {
    const admin = isAdmin();
    $("#newRecordButton").disabled = !canEdit();
    $("#newTechnicalAppraisalButton").disabled = !canEdit();
    manageUsersButton.classList.toggle("is-hidden", !admin);
    $$(".admin-only").forEach((button) => button.classList.toggle("is-hidden", !admin));
    $$(".summary-access").forEach((button) => button.classList.toggle("is-hidden", !canViewSummary()));
    $$(".folio-authorizer-only").forEach((panel) => panel.classList.toggle("is-hidden", !canAuthorizeFolios()));
    $$(".fe-publica-access").forEach((button) => button.classList.toggle("is-hidden", !canViewFePublica()));
    appShell.dataset.role = roleFor(activeSessionUser);
    if ((activeAppView === "usuarios" || activeAppView === "configuracion") && !admin) switchAppView("avaluos");
    if (activeAppView === "resumen" && !canViewSummary()) switchAppView("avaluos");
    if (activeAppView === "fe-publica" && !canViewFePublica()) switchAppView("avaluos");
    $$(".solicitudes-access").forEach((button) => button.classList.toggle("is-hidden", !canViewRequests()));
    if (activeAppView === "solicitudes" && !canViewRequests()) switchAppView("avaluos");
    renderHomeActions();
  }
  function renderWelcomeTasks() {
    const assignedList = $("#taskList");
    const createdList = $("#createdTaskList");
    const count = $("#taskCount");
    const formElement = $("#taskForm");
    if (!assignedList || !createdList || !count) return;
    const sortTasks = (items) => items.sort((left, right) => Number(left.completed) - Number(right.completed) || new Date(right.creadoEn || 0).getTime() - new Date(left.creadoEn || 0).getTime());
    const assignedTasks = sortTasks(tasks.filter((task) => task.assignedTo === activeSessionUser));
    const createdTasks = sortTasks(tasks.filter((task) => task.createdBy === activeSessionUser && task.assignedTo !== activeSessionUser));
    count.textContent = String(assignedTasks.filter((task) => !task.completed).length);
    if (formElement) formElement.hidden = !canCreateTask();
    const renderItems = (items, createdByMe = false) => items.length ? items.map((task) => `<article class="task-item${task.completed ? " is-complete" : ""}"><label><input type="checkbox" data-complete-task="${escapeHtml(task.id)}" ${task.completed ? "checked" : ""} ${createdByMe ? "disabled" : ""} /><span><strong>${escapeHtml(task.title)}</strong>${task.details ? `<small>${escapeHtml(task.details)}</small>` : ""}<em>${createdByMe ? `Asignada a ${escapeHtml(task.assignedTo || "usuario")}` : `Asignada por ${escapeHtml(task.createdBy || "usuario")}`} · ${task.completed ? "Concluida" : "Pendiente"}</em><small class="task-dates">Creada: ${escapeHtml(formatTaskDate(task.creadoEn))} · Concluida: ${escapeHtml(formatTaskDate(task.completedAt))}</small></span></label>${(isAdmin() || task.createdBy === activeSessionUser || task.assignedTo === activeSessionUser) ? `<button class="task-remove" data-remove-task="${escapeHtml(task.id)}" type="button" aria-label="Quitar tarea">Quitar</button>` : ""}</article>`).join("") : `<p class="task-empty">${createdByMe ? "No hay tareas en esta categoría." : "No tienes tareas asignadas."}</p>`;
    const splitCreated = (items) => `<div class="task-status-group"><span class="task-status-label">Pendientes</span>${renderItems(items.filter((task) => !task.completed), true)}<span class="task-status-label task-status-label-complete">Completadas</span>${renderItems(items.filter((task) => task.completed), true)}</div>`;
    assignedList.innerHTML = renderItems(assignedTasks);
    createdList.innerHTML = splitCreated(createdTasks);
    [assignedList, createdList].forEach((list) => {
      list.querySelectorAll("[data-complete-task]:not(:disabled)").forEach((checkbox) => checkbox.addEventListener("change", () => toggleTask(checkbox.dataset.completeTask, checkbox.checked)));
      list.querySelectorAll("[data-remove-task]").forEach((button) => button.addEventListener("click", () => removeTask(button.dataset.removeTask)));
    });
  }
  function renderHomeActions() {
    const permissions = { recepcion: Boolean(activeSessionUser), gestion: canEdit(), solicitudes: canViewRequests(), crear: canEdit(), validacion: canAuthorizeFolios(), buscar: canViewRequests() };
    $$("[data-home-action]").forEach((card) => {
      const visible = Boolean(permissions[card.dataset.homeAction]);
      card.classList.toggle("is-hidden", !visible);
      card.disabled = !visible;
    });
  }
  function openHomeAction(action) {
    if (action === "solicitudes" || action === "buscar") { if (canViewRequests()) switchAppView("solicitudes"); return; }
    if (action === "recepcion") { switchAppView("avaluos"); window.dispatchEvent(new CustomEvent("control-avaluos:section", { detail: "recepcion" })); return; }
    if (["gestion", "crear", "validacion"].includes(action)) {
      switchAppView("avaluos");
      window.dispatchEvent(new CustomEvent("control-avaluos:section", { detail: action === "validacion" ? "validacion" : "crear" }));
      if (action === "crear") window.setTimeout(() => window.dispatchEvent(new CustomEvent("control-avaluos:open-technical-creation")), 0);
    }
  }
  async function toggleTask(id, completed) {
    const task = tasks.find((item) => item.id === id);
    if (!task || task.assignedTo !== activeSessionUser) return;
    try { await saveTask({ ...task, completed, completedAt: completed ? new Date().toISOString() : null }, true); renderWelcomeTasks(); } catch (error) { window.alert(error.message); }
  }
  async function removeTask(id) {
    const task = tasks.find((item) => item.id === id);
    if (!task || (task.assignedTo !== activeSessionUser && task.createdBy !== activeSessionUser && !isAdmin())) return;
    if (!window.confirm("¿Quitar esta tarea?")) return;
    try { await deleteTask(id); renderWelcomeTasks(); } catch (error) { window.alert(error.message); }
  }
  async function createTask(event) {
    event.preventDefault();
    if (!canCreateTask()) return;
    const formElement = event.currentTarget;
    const title = String($("#taskTitle").value || "").trim();
    const details = String($("#taskDetails").value || "").trim();
    const assignedTo = String($("#taskAssignedTo").value || "").trim();
    const messageElement = $("#taskMessage");
    const buttonElement = $("#taskSubmitButton");
    if (!title || !assignedTo) { messageElement.textContent = "Escribe la tarea y selecciona un usuario."; return; }
    try {
      buttonElement.disabled = true;
      await saveTask({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, title, details, assignedTo, completed: false, createdBy: activeSessionUser, creadoEn: new Date().toISOString() });
      formElement.reset();
      messageElement.textContent = "Tarea asignada correctamente.";
      renderWelcomeTasks();
    } catch (error) { messageElement.textContent = error.message; }
    finally { buttonElement.disabled = false; }
  }
  function renderChat() {
    const container = $("#chatMessages");
    const widget = $("#chatWidget");
    if (!container || !widget || !activeSessionUser) return;
    widget.hidden = false;
    container.innerHTML = chatMessages.length ? chatMessages.slice(-100).map((item) => `<article class="chat-message${item.author === activeSessionUser ? " is-mine" : ""}"><div class="chat-message-meta"><strong>${escapeHtml(item.author)}</strong><time>${escapeHtml(formatDate(item.creadoEn))}</time></div><p>${escapeHtml(item.message)}</p></article>`).join("") : `<p class="chat-empty">Aún no hay mensajes.</p>`;
    container.scrollTop = container.scrollHeight;
  }
  async function createChatMessage(event) {
    event.preventDefault();
    const input = $("#chatMessageInput");
    const button = $("#chatSendButton");
    const message = String(input?.value || "").trim();
    if (!message || !activeSessionUser) return;
    try {
      button.disabled = true;
      await saveChatMessage({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, author: activeSessionUser, message, creadoEn: new Date().toISOString() });
      input.value = "";
      renderChat();
    } catch (error) { window.alert(error.message); }
    finally { button.disabled = false; input.focus(); }
  }
  function showAuthenticatedApp(user) {
    if (adminAccessDialog?.open) adminAccessDialog.close();
    activeSessionUser = user;
    activeUser.textContent = user;
    activeUserRole.textContent = roleLabel(roleFor(user));
    $("#welcomeUserName").textContent = user || "usuario";
    const currentRole = roleFor(user);
    $("#welcomeRoleCopy").textContent = currentRole === "admin" ? "Tienes acceso administrativo para gestionar los avalúos, el resumen y la configuración local." : currentRole === "auditor" ? "Tienes acceso total a Avalúos, Fe Pública, Resumen general, Chat y Notas/Tareas." : currentRole === "valuador" ? "Puedes crear y editar avalúos técnicos, además de usar el Chat y registrar Notas/Tareas; Recepción es solo de consulta." : currentRole === "editor" ? "Puedes registrar y editar avalúos, además de consultar el Control de saldos." : "Puedes consultar los avalúos, recibos y listados disponibles en este equipo.";
    loginScreen.classList.add("is-hidden");
    appShell.classList.remove("is-hidden");
    appShell.classList.remove("is-entering");
    applyRoleUi();
    window.setTimeout(() => appShell.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    switchAppView("inicio");
    renderWelcomeTasks();
    window.dispatchEvent(new CustomEvent("control-avaluos:authenticated", { detail: { user } }));
    render();
  }
  function showLogin() {
    if (adminAccessDialog?.open) adminAccessDialog.close();
    activeSessionUser = "";
    appShell.classList.add("is-hidden");
    appShell.classList.remove("is-entering");
    loginScreen.classList.remove("is-hidden", "is-exiting");
    loginPassword.value = "";
    loginMessage.textContent = "";
    $("#openCredentialSetupButton").classList.toggle("is-hidden", Object.keys(loadCredentials()).length > 0);
    loginUser.focus();
  }
  async function authenticate(event) {
    event.preventDefault();
    const user = loginUser.value;
    const password = loginPassword.value;
    const credentials = loadCredentials();
    let authenticated = false;
    const remoteUser = remoteUsers?.find((item) => item.name === user);
    if (serverOnline && remoteUser?.hasPassword) {
      try { await apiRequest("/auth/login", { method: "POST", body: JSON.stringify({ name: user, password }) }); authenticated = true; } catch {}
    } else if (credentials[user] && password === credentials[user]) authenticated = true;
    if (!authenticated) {
      loginMessage.textContent = "Selecciona un usuario y captura su contraseña individual válida.";
      loginPassword.focus();
      return;
    }
    sessionStorage.setItem(SESSION_KEY, user);
    showAuthenticatedApp(user);
  }

  const VIEW_DETAILS = {
    inicio: { title: "Correduría Pública 6", kicker: "CORREDURÍA PÚBLICA 6", description: "" },
    solicitudes: { title: "Solicitudes de servicio", kicker: "CONTROL DE SOLICITUDES", description: "Administra solicitudes, asesores y estados del proceso." },
    avaluos: { title: "Avalúos", kicker: "CORREDURÍA PÚBLICA 6", description: "Registra, consulta, filtra, edita y da seguimiento a cada avalúo." },
    "fe-publica": { title: "Fe Pública", kicker: "MÓDULO EN DESARROLLO", description: "" },
    resumen: { title: "Resumen general", kicker: "", description: "" },
    usuarios: { title: "Usuarios", kicker: "ACCESO LOCAL", description: "Gestiona usuarios administrativos y usuarios externos registrados." },
    configuracion: { title: "Configuración", kicker: "RESPALDO LOCAL", description: "Exporta, importa y respalda la información del equipo." },
  };
  function setUsersSection(section = "menu") {
    const menu = $("#usuariosMenuSection");
    const adminPanel = $("#usuariosAdminPanel");
    const externalPanel = $("#usuariosExternalPanel");
    if (!menu || !adminPanel || !externalPanel) return;
    const showAdmin = section === "administrativos";
    const showExternal = section === "externos";
    menu.hidden = showAdmin || showExternal;
    adminPanel.hidden = !showAdmin;
    externalPanel.hidden = !showExternal;
    if (showAdmin) renderUserPermissions();
    if (showExternal) window.dispatchEvent(new CustomEvent("control-avaluos:users-view"));
  }

  function switchAppView(view) {
    if (!VIEW_DETAILS[view] || (view === "resumen" ? !canViewSummary() : view === "fe-publica" ? !canViewFePublica() : view === "solicitudes" ? !canViewRequests() : view !== "avaluos" && view !== "inicio" && !isAdmin())) return;
    activeAppView = view;
    $$(".app-view").forEach((section) => { const active = section.id === `${view}View`; section.hidden = !active; section.classList.toggle("is-active", active); });
    $$("[data-app-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.appView === view));
    const details = VIEW_DETAILS[view];
    $("#pageTitle").textContent = details.title;
    $("#pageKicker").textContent = details.kicker;
    $("#pageDescription").textContent = details.description;
    if (view === "avaluos") {
      window.dispatchEvent(new CustomEvent("control-avaluos:section", { detail: "inicio" }));
    } else {
      ["#backAvaluosButton", "#newRecordButton", "#newTechnicalAppraisalButton"].forEach((selector) => $(selector).classList.add("is-hidden"));
    }
    if (view === "solicitudes") window.dispatchEvent(new CustomEvent("control-avaluos:section", { detail: "solicitudes" }));
    window.dispatchEvent(new CustomEvent("control-avaluos:view", { detail: view }));
    if (view === "usuarios") { setUsersSection("menu"); window.dispatchEvent(new CustomEvent("control-avaluos:users-view")); }
    if (view === "resumen") initialiseReportDates();
    if (view === "configuracion") { renderNotarySettings(); renderPendingReceptionSummary(); refreshOperationalSettings(); }
  }

  function getExpiryDate(fechaAvaluo) { if (!fechaAvaluo) return ""; const date = new Date(`${fechaAvaluo}T12:00:00`); date.setMonth(date.getMonth() + 6); return date.toISOString().slice(0, 10); }
  const isExpiredWithoutDeliveryOrPayment = (record) => { const expiry = getExpiryDate(record.fechaAvaluo); return Boolean(!record.pagado && !record.seEntregoA && expiry && expiry < today()); };
  const dateInRange = (value, start, end) => Boolean(value && (!start || value >= start) && (!end || value <= end));
  function currentWeekRange() { const date = new Date(`${today()}T12:00:00`); const day = date.getDay(); date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day)); const start = date.toISOString().slice(0, 10); date.setDate(date.getDate() + 6); return { start, end: date.toISOString().slice(0, 10) }; }
  function prioritize(items) { return [...items].sort((left, right) => Number(left.pagado) - Number(right.pagado) || new Date(right.actualizadoEn).getTime() - new Date(left.actualizadoEn).getTime()); }
  function getVisibleRecords() {
    const query = searchInput.value.trim().toLocaleLowerCase("es-MX");
    const numericQuery = normalizeNumber(query);
    return prioritize(records.filter((record) => {
      const matchesSearch = !query || (numericQuery && normalizeNumber(record.numeroAvaluo).includes(numericQuery)) || record.solicitante.toLocaleLowerCase("es-MX").includes(query);
      return matchesSearch;
    }));
  }
  function getRecordsForOperationalView(view, source) {
    if (view === "pendientes-entrega") return source.filter((record) => !record.pagado && !record.seEntregoA && !isExpiredWithoutDeliveryOrPayment(record));
    if (view === "entregados-sin-pago") return source.filter((record) => !record.pagado && Boolean(record.seEntregoA));
    if (view === "pagados") return source.filter((record) => record.pagado);
    if (view === "vencidos") return source.filter(isExpiredWithoutDeliveryOrPayment);
    return source;
  }

  function renderListRow(record) {
    const paid = Boolean(record.pagado);
    const delivered = Boolean(record.seEntregoA);
    const expired = isExpiredWithoutDeliveryOrPayment(record);
    const statusClass = paid ? "paid" : expired ? "expired" : "pending";
    const statusLabel = paid ? "Pagado" : expired ? "Vencido" : delivered ? "Entregado sin pago" : "Pendiente de entrega";
    const receiptButton = paid ? `<button class="record-action receipt" data-receipt="${record.id}" type="button">Recibo</button>` : "";
    const editButton = canEditReception() ? `<button class="record-action" data-edit="${record.id}" type="button">Editar</button>` : `<button class="record-action" data-view="${record.id}" type="button">Ver</button>`;
    const deleteButton = isAdmin() ? `<button class="record-action delete" data-delete="${record.id}" type="button">Eliminar</button>` : "";
    return `<tr><td><strong class="avaluo-list-number">${escapeHtml(record.numeroAvaluo)}</strong></td><td class="avaluo-list-requester">${escapeHtml(record.solicitante)}</td><td>${escapeHtml(record.usuario)}</td><td>${formatCurrency(record.valorAvaluo)}</td><td><span class="avaluo-status ${statusClass}">${statusLabel}</span></td><td class="table-action-cell">${editButton}</td><td class="table-action-cell">${receiptButton}</td><td class="table-action-cell">${deleteButton}</td></tr>`;
  }
  function renderList(items, emptyCopy) { $("#statusRecordList").innerHTML = `<div class="operational-table-wrap"><table class="operational-table operational-table-compact"><thead><tr><th>#</th><th>Solicitante</th><th>Usuario</th><th>Valor del avalúo</th><th>Estado</th><th>Editar</th><th>Recibo</th><th>Eliminar</th></tr></thead><tbody>${items.length ? items.map(renderListRow).join("") : `<tr><td colspan="8" class="empty">${escapeHtml(emptyCopy)}</td></tr>`}</tbody></table></div>`; }
  function bindRecordActions() {
    $$('[data-edit]').forEach((button) => button.addEventListener("click", () => openDialog(button.dataset.edit)));
  $$('[data-view]').forEach((button) => button.addEventListener("click", () => openDialog(button.dataset.view, true)));
  $$('[data-delete]').forEach((button) => button.addEventListener("click", () => removeRecord(button.dataset.delete)));
  $$('[data-receipt]').forEach((button) => button.addEventListener("click", () => openReceipt(records.find((record) => record.id === button.dataset.receipt))));
  }
  function render() {
    const visible = getVisibleRecords();
    const operationalRecords = getRecordsForOperationalView(operationalView, visible);
    const titles = { todos: "Todos los avalúos", "pendientes-entrega": "Pendientes de entrega", "entregados-sin-pago": "Entregados sin registro de pago", pagados: "Pagados", vencidos: "Vencidos" };
    $("#filteredCount").textContent = `${visible.length} ${visible.length === 1 ? "resultado" : "resultados"}`;
    $("#statusListTitle").textContent = titles[operationalView];
    $("#statusListCount").textContent = String(operationalRecords.length);
    renderList(operationalRecords, "No hay avalúos para este estado, búsqueda o periodo.");
    renderAuthorizedFolios();
    bindRecordActions();
  }

  function setPaymentVisibility() {
    paymentDetails.classList.toggle("is-hidden", !paidInput.checked);
    $("#previewReceiptButton").classList.toggle("is-hidden", !paidInput.checked);
    amountInput.required = paidInput.checked;
    methodInput.required = paidInput.checked;
    paymentDeliveredToInput.required = paidInput.checked;
    paymentDateInput.required = paidInput.checked;
    if (!paidInput.checked) { amountInput.value = ""; methodInput.value = ""; paymentDeliveredToInput.value = ""; paymentDateInput.value = ""; }
    else if (!paymentDateInput.value) paymentDateInput.value = today();
  }
  function openDialog(id = null, readOnly = false) {
    if (!canEditReception() && !id) return;
    window.dispatchEvent(new CustomEvent("control-avaluos:section", { detail: "recepcion" }));
    editingId = id;
    const record = id ? records.find((item) => item.id === id) : initialDraft;
    if (!record) return;
    const viewOnly = readOnly || !canEditReception();
    form.reset();
    Object.entries(initialDraft).forEach(([key, value]) => { const field = form.elements.namedItem(key); if (field && field.type !== "checkbox") field.value = key === "valorAvaluo" ? (record[key] ? formatCurrency(record[key]) : "") : record[key] ?? value; });
    paidInput.checked = Boolean(record.pagado);
    amountInput.value = record.pagado ? formatCurrency(record.montoPagado || 0) : "";
    methodInput.value = record.pagado ? record.metodoPago || "" : "";
    paymentDeliveredToInput.value = record.pagado ? record.pagoEntregadoA || "" : "";
    paymentDateInput.value = record.pagado ? record.fechaPago || today() : "";
    avaluoDateInput.value = record.fechaAvaluo || today();
    form.querySelectorAll("input,select,textarea").forEach((field) => { field.disabled = viewOnly; });
    $("#saveRecordButton").classList.toggle("is-hidden", viewOnly);
    $("#dialogTitle").textContent = viewOnly ? "Consulta de avalúo" : id ? "Editar avalúo" : "Registrar avalúo";
    $("#formMessage").textContent = "";
    setPaymentVisibility();
    recordEditor.hidden = false;
    $("#avaluosView").classList.add("is-registering");
    if (!viewOnly) window.setTimeout(() => numberInput.focus(), 120);
  }
  function closeDialog() { recordEditor.hidden = true; $("#avaluosView").classList.remove("is-registering"); editingId = null; form.querySelectorAll("input,select,textarea").forEach((field) => { field.disabled = false; }); }
  async function removeRecord(id) { if (!isAdmin()) return; const record = records.find((item) => item.id === id); if (!record || !window.confirm(`¿Eliminar el avalúo ${record.numeroAvaluo}? Esta acción no se puede deshacer.`)) return; try { await deleteRemoteRecord(id); records = records.filter((item) => item.id !== id); saveRecords(); render(); } catch (error) { window.alert(error.message); } }
  function formDraft() {
    const data = new FormData(form);
    return { numeroAvaluo: normalizeNumber(data.get("numeroAvaluo")), usuario: String(data.get("usuario") || "").trim(), tipoBien: String(data.get("tipoBien") || "").trim(), tipoAvaluo: String(data.get("tipoAvaluo") || "").trim(), solicitante: String(data.get("solicitante") || "").trim(), valorAvaluo: parseMoney(data.get("valorAvaluo")), seEntregoA: String(data.get("seEntregoA") || "").trim(), pagoEntregadoA: paidInput.checked ? String(data.get("pagoEntregadoA") || "") : "", observacion: String(data.get("observacion") || "").trim(), fechaAvaluo: String(data.get("fechaAvaluo") || ""), pagado: paidInput.checked, montoPagado: paidInput.checked ? parseMoney(data.get("montoPagado")) : 0, metodoPago: paidInput.checked ? String(data.get("metodoPago") || "") : "", fechaPago: paidInput.checked ? String(data.get("fechaPago") || "") : "" };
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canEditReception()) return;
    const draft = formDraft();
    const required = [draft.numeroAvaluo, draft.usuario, draft.tipoBien, draft.tipoAvaluo, draft.solicitante, draft.fechaAvaluo];
    if (!/^\d{4}$/.test(draft.numeroAvaluo)) { $("#formMessage").textContent = "El número de avalúo debe tener exactamente cuatro dígitos."; return; }
    if (!serverOnline) { $("#formMessage").textContent = "No fue posible comunicarse con el servidor de Recepción. Verifica la dirección, el puerto 3000 y /api/health antes de registrar."; return; }
    if (!authorizedAppraisalNumbers.includes(draft.numeroAvaluo)) { $("#formMessage").textContent = `El avalúo ${draft.numeroAvaluo} no ha sido autorizado para su registro por Administración o Auditoría. Autorízalo primero desde Avalúos > Validación.`; return; }
    if (records.some((record) => record.id !== editingId && normalizeNumber(record.numeroAvaluo) === draft.numeroAvaluo)) { $("#formMessage").textContent = `El avalúo ${draft.numeroAvaluo} ya se agregó.`; return; }
    if (required.some((value) => !value) || (draft.pagado && (!draft.montoPagado || !draft.metodoPago || !draft.pagoEntregadoA || !draft.fechaPago))) { $("#formMessage").textContent = "Completa los campos obligatorios y los datos de pago, incluido a quién se entregó el pago."; return; }
    const now = new Date().toISOString();
    const candidate = editingId ? { ...records.find((record) => record.id === editingId), ...draft, id: editingId, actualizadoEn: now } : { ...draft, id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, creadoEn: now, actualizadoEn: now };
    try {
      $("#saveRecordButton").disabled = true;
      const saved = await saveRemoteRecord(candidate, Boolean(editingId));
      records = editingId ? records.map((record) => record.id === editingId ? saved : record) : [saved, ...records];
      saveRecords();
      closeDialog();
      render();
    } catch (error) {
      $("#formMessage").textContent = error.message;
    } finally {
      $("#saveRecordButton").disabled = false;
    }
  });

  function wordsUnderThousand(value) { const units = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"], teens = ["diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve"], tens = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"], hundreds = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"]; if (value === 0) return ""; if (value === 100) return "cien"; const head = hundreds[Math.floor(value / 100)], rest = value % 100; if (rest < 10) return [head, units[rest]].filter(Boolean).join(" "); if (rest < 20) return [head, teens[rest - 10]].filter(Boolean).join(" "); if (rest < 30) return [head, rest === 20 ? "veinte" : `veinti${units[rest - 20]}`].filter(Boolean).join(" "); const ten = tens[Math.floor(rest / 10)], unit = units[rest % 10]; return [head, unit ? `${ten} y ${unit}` : ten].filter(Boolean).join(" "); }
  function wholeWords(value) { if (value === 0) return "cero"; if (value < 1000) return wordsUnderThousand(value); if (value < 1000000) { const thousands = Math.floor(value / 1000), rest = value % 1000; return [thousands === 1 ? "mil" : `${wordsUnderThousand(thousands)} mil`, wordsUnderThousand(rest)].filter(Boolean).join(" "); } const millions = Math.floor(value / 1000000), rest = value % 1000000; return [millions === 1 ? "un millón" : `${wholeWords(millions)} millones`, rest ? wholeWords(rest) : ""].filter(Boolean).join(" "); }
  function amountInWords(amount) { const normalized = Math.max(0, Number(amount) || 0), whole = Math.floor(normalized), cents = Math.round((normalized - whole) * 100).toString().padStart(2, "0"), raw = wholeWords(whole), words = raw.endsWith("uno") ? `${raw.slice(0, -3)}un` : raw; return `${words.charAt(0).toUpperCase()}${words.slice(1)} pesos ${cents}/100 M.N.`; }
  function receiptPrefix(record) { return String(record.area || record.tipoRegistro || record.tipoAvaluo || "").toLocaleLowerCase("es-MX").includes("fe pública") || String(record.area || record.tipoRegistro || "").toLocaleLowerCase("es-MX").includes("fe-publica") ? "CP6FE" : "CP6AV"; }
  async function nextReceiptFolio(prefix) {
    if (serverOnline) {
      const response = await apiRequest("/receipts/next", { method: "POST", body: JSON.stringify({ prefix }) });
      return response.folio;
    }
    let stored = {};
    try { const parsed = JSON.parse(localStorage.getItem(RECEIPT_SEQUENCE_KEY) || "{}"); stored = parsed && typeof parsed === "object" ? parsed : { AV: Number(parsed) || 9999 }; } catch { stored = {}; }
    const key = prefix === "CP6FE" ? "FE" : "AV";
    const current = Number(stored[key]) || 9999;
    const next = Math.max(current + 1, 10000);
    stored[key] = next;
    localStorage.setItem(RECEIPT_SEQUENCE_KEY, JSON.stringify(stored));
    return `${prefix}${String(next).padStart(5, "0")}`;
  }
  async function getReceiptFolio(record) {
    if (record.folioRecibo) return record.folioRecibo;
    if (!record.id) return serverOnline ? "CP6AV10000" : nextReceiptFolio(receiptPrefix(record));
    const folioRecibo = await nextReceiptFolio(receiptPrefix(record));
    const updated = { ...record, folioRecibo };
    records = records.map((item) => item.id === record.id ? updated : item);
    if (serverOnline) { try { await saveRemoteRecord(updated, true); } catch {} }
    saveRecords();
    return folioRecibo;
  }
  function receiptHtml(record) { return `<!doctype html><html lang="es-MX"><head><meta charset="UTF-8"><title>Recibo ${escapeHtml(record.folioRecibo || record.numeroAvaluo)}</title><style>@page{margin:0;size:letter}html,body{height:100%;margin:0}body{background:#fff;color:#1f303a;display:flex;font-family:Georgia,"Times New Roman",serif;align-items:flex-start;justify-content:center}.receipt{background:#fff;box-sizing:border-box;margin:.45in auto 0;min-height:10.1in;padding:.72in .78in;width:7.05in}.top{border-bottom:3px solid #bb8a32;padding-bottom:14px;text-align:center}.brand{color:#123e5a;font-family:Arial,sans-serif;font-size:22px;font-weight:800;letter-spacing:.05em;margin:0;text-transform:uppercase}.address{color:#5c6c75;font-family:Arial,sans-serif;font-size:12px;line-height:1.45;margin:7px 0 0}.receipt-title{color:#123e5a;font-family:Arial,sans-serif;font-size:19px;font-weight:800;letter-spacing:.14em;margin:24px 0 6px;text-align:center;text-transform:uppercase}.meta{color:#5b6971;font-family:Arial,sans-serif;font-size:12px;text-align:center}.folio{color:#123e5a;font-family:Arial,sans-serif;font-size:13px;font-weight:800;letter-spacing:.08em;margin:10px 0 0;text-align:center}.rule{border-top:1px solid #d9e1e5;margin:20px 0}.body-copy{font-size:16px;line-height:1.6}.amount{background:#eff7f3;border-left:5px solid #167a5c;color:#114f3b;font-family:Arial,sans-serif;font-size:25px;font-weight:800;line-height:1.35;margin:18px 0;padding:14px 16px}.amount-words{color:#345565;font-family:Arial,sans-serif;font-size:13px;font-style:italic;line-height:1.4}.summary{background:#f7fafb;border:1px solid #dbe5e9;font-family:Arial,sans-serif;margin-top:20px;padding:12px 14px}.summary p{font-size:13px;margin:5px 0}.signature{font-family:Arial,sans-serif;font-size:13px;margin-top:72px;text-align:center}.signature-line{border-top:1px solid #667982;margin:0 auto 8px;width:260px}@media print{body{background:#fff;min-height:100vh}.receipt{margin:0;min-height:11in;padding:.72in .78in;width:8.5in}}</style></head><body><section class="receipt"><header class="top"><p class="brand">Correduría Pública No.6</p><p class="address">Av. Morelos 854 Oriente, Col. Centro<br>Torreón, Coahuila.</p></header><h1 class="receipt-title">Recibo de pago</h1><p class="folio">Folio: ${escapeHtml(record.folioRecibo || "CP6AV10000")}</p><p class="meta">Fecha de pago: ${formatDate(record.fechaPago)}</p><div class="rule"></div><p class="body-copy">Recibí de <strong>${escapeHtml(record.seEntregoA || "________________")}</strong> la cantidad de:</p><div class="amount">${formatCurrency(record.montoPagado)}<br><span class="amount-words">(${escapeHtml(amountInWords(record.montoPagado))})</span></div><p class="body-copy">Por concepto del avalúo número <strong>${escapeHtml(record.numeroAvaluo)}</strong>, correspondiente a un avalúo de tipo <strong>${escapeHtml(record.tipoAvaluo)}</strong>.</p><section class="summary"><p><strong>Método de pago:</strong> ${escapeHtml(record.metodoPago || "No especificado")}</p></section><div class="signature"><div class="signature-line"></div>Firma de recibido</div></section><script>window.onload=()=>window.print()<\/script></body></html>`; }
  async function openReceipt(record) { if (!record || !record.seEntregoA || !record.montoPagado || !record.numeroAvaluo || !record.tipoAvaluo) { $("#formMessage").textContent = "Completa quién recibe, cantidad, número y tipo de avalúo para generar el recibo."; return; } const receiptWindow = window.open("", "_blank", "width=980,height=900"); if (!receiptWindow) { alert("El navegador bloqueó la ventana del recibo. Permite ventanas emergentes e inténtalo de nuevo."); return; } try { const receiptRecord = { ...record, folioRecibo: await getReceiptFolio(record) }; receiptWindow.document.write(receiptHtml(receiptRecord)); receiptWindow.document.close(); } catch (error) { receiptWindow.close(); $("#formMessage").textContent = error.message; } }

  function reportData(start, end) {
    const active = records.filter((record) => dateInRange(record.fechaAvaluo, start, end) && !isExpiredWithoutDeliveryOrPayment(record));
    const paid = active.filter((record) => record.pagado);
    const pending = active.filter((record) => !record.pagado && !record.seEntregoA);
    const delivered = active.filter((record) => !record.pagado && Boolean(record.seEntregoA));
    return { paid, pending, delivered, totalPaid: paid.reduce((total, record) => total + Number(record.montoPagado || 0), 0) };
  }
  function inlineReportHtml(start, end) {
    const { paid, pending, delivered, totalPaid } = reportData(start, end);
    const pendingRows = pending.map((record) => `<tr><td>${escapeHtml(record.numeroAvaluo)}</td><td>${escapeHtml(record.usuario)}</td><td>${escapeHtml(record.solicitante)}</td><td>${escapeHtml(record.tipoBien)}</td><td>${escapeHtml(record.tipoAvaluo)}</td></tr>`).join("") || `<tr><td colspan="5" class="empty">No hay pendientes de entrega en este periodo.</td></tr>`;
    const paidRows = paid.map((record) => `<tr><td>${escapeHtml(record.numeroAvaluo)}</td><td>${escapeHtml(record.solicitante)}</td><td>${formatDate(record.fechaPago)}</td><td>${escapeHtml(record.metodoPago || "Sin especificar")}</td><td>${formatCurrency(record.montoPagado)}</td></tr>`).join("") || `<tr><td colspan="5" class="empty">No hay pagos registrados en este periodo.</td></tr>`;
    const deliverySummary = paid.reduce((result, record) => { const recipient = record.pagoEntregadoA || "Sin especificar"; const current = result.get(recipient) || { count: 0, cashAmount: 0, transferAmount: 0, total: 0 }; const amount = Number(record.montoPagado || 0); current.count += 1; if (record.metodoPago === "Efectivo") current.cashAmount += amount; if (record.metodoPago === "Transferencia") current.transferAmount += amount; current.total += amount; result.set(recipient, current); return result; }, new Map());
    const totalCash = paid.filter((record) => record.metodoPago === "Efectivo").reduce((total, record) => total + Number(record.montoPagado || 0), 0);
    const totalTransfer = paid.filter((record) => record.metodoPago === "Transferencia").reduce((total, record) => total + Number(record.montoPagado || 0), 0);
    const deliveryRows = [...deliverySummary.entries()].map(([recipient, summary]) => `<tr><td>${escapeHtml(recipient)}</td><td>${summary.count}</td><td>${formatCurrency(summary.cashAmount)}</td><td>${formatCurrency(summary.transferAmount)}</td><td>${formatCurrency(summary.total)}</td></tr>`).join("") || `<tr><td colspan="5" class="empty">No hay pagos entregados en este periodo.</td></tr>`;
    return `<article class="print-report"><header class="report-header"><p class="eyebrow">CORREDURÍA PÚBLICA 6 · PLAZA COAHUILA</p><h2>Resumen general de avalúos</h2><p>Av. Morelos 854 Oriente, Col. Centro · Torreón, Coahuila</p></header><div class="report-period"><strong>Periodo del reporte:</strong> ${formatDate(start)} al ${formatDate(end)}</div><section class="report-metrics"><article><span>Pagados</span><strong>${paid.length}</strong></article><article><span>Pendientes de entrega</span><strong>${pending.length}</strong></article><article><span>Entregados sin pago</span><strong>${delivered.length}</strong></article><article class="report-amount"><span>Importe pagado</span><strong>${formatCurrency(totalPaid)}</strong></article></section><section class="report-table-section"><h3>Pendientes de entrega</h3><div class="report-table-wrap"><table><thead><tr><th>Avalúo</th><th>Usuario</th><th>Solicitante</th><th>Tipo de bien</th><th>Tipo de avalúo</th></tr></thead><tbody>${pendingRows}</tbody></table></div></section><section class="report-table-section"><h3>Avalúos pagados</h3><div class="report-table-wrap"><table><thead><tr><th>Avalúo</th><th>Solicitante</th><th>Fecha de pago</th><th>Método</th><th>Importe</th></tr></thead><tbody>${paidRows}</tbody><tfoot><tr><td colspan="4">Total pagado</td><td>${formatCurrency(totalPaid)}</td></tr></tfoot></table></div></section><section class="report-table-section"><h3>Se entregó pago</h3><div class="report-table-wrap"><table><thead><tr><th>Entregado a</th><th>Pagos</th><th>Efectivo</th><th>Depósito / transferencia</th><th>Importe total</th></tr></thead><tbody>${deliveryRows}</tbody><tfoot><tr><td colspan="2">Total entregado</td><td>${formatCurrency(totalCash)}</td><td>${formatCurrency(totalTransfer)}</td><td>${formatCurrency(totalPaid)}</td></tr></tfoot></table></div></section></article>`;
  }
  function initialiseReportDates() { const week = currentWeekRange(); if (!$("#inlineReportStartDate").value) $("#inlineReportStartDate").value = week.start; if (!$("#inlineReportEndDate").value) $("#inlineReportEndDate").value = week.end; }
  function prepareInlineReport() {
    if (!canViewSummary()) return;
    const start = $("#inlineReportStartDate").value;
    const end = $("#inlineReportEndDate").value;
    const message = $("#inlineReportMessage");
    if (!start || !end || start > end) { message.textContent = "Selecciona un periodo válido: la fecha inicial debe ser anterior o igual a la final."; return; }
    message.textContent = "";
    $("#reportPreview").innerHTML = inlineReportHtml(start, end);
    $("#printInlineReportButton").disabled = false;
  }
  function printInlineReport() { if (!canViewSummary() || !$("#reportPreview .print-report")) return; window.print(); }

  const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  function exportRecords() {
    if (!isAdmin()) return;
    const start = $("#exportStartDate").value;
    const end = $("#exportEndDate").value;
    const message = $("#exportMessage");
    if (!start || !end || start > end) { message.textContent = "Selecciona un periodo válido antes de descargar el archivo."; return; }
    const selectedRecords = prioritize(records.filter((record) => dateInRange(record.fechaAvaluo, start, end)));
    const rows = [["Número de avalúo", "Fecha del avalúo", "Usuario", "Tipo de bien", "Tipo de avalúo", "Solicitante", "Se entregó a", "Pagado", "Cantidad pagada", "Método de pago", "Fecha de pago", "Vence", "Observación", "Fecha de creación", "Última actualización"], ...selectedRecords.map((record) => [record.numeroAvaluo, formatDate(record.fechaAvaluo), record.usuario, record.tipoBien, record.tipoAvaluo, record.solicitante, record.seEntregoA, record.pagado ? "Sí" : "No", record.pagado ? record.montoPagado : "", record.metodoPago, formatDate(record.fechaPago), formatDate(getExpiryDate(record.fechaAvaluo)), record.observacion, formatDate(record.creadoEn), formatDate(record.actualizadoEn)])];
    downloadBlob(new Blob([`\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`], { type: "text/csv;charset=utf-8;" }), `control-avaluos-${start}-a-${end}.csv`);
    message.classList.remove("is-error");
    message.textContent = `${selectedRecords.length} ${selectedRecords.length === 1 ? "registro exportado" : "registros exportados"} del periodo seleccionado.`;
  }
  function downloadBlob(blob, filename) { const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(link.href); }
  async function exportBackup() {
    if (!isAdmin()) return;
    try {
      const backup = serverOnline ? await apiRequest("/export") : { app: "Control de Avalúos", version: BACKUP_VERSION, exportedAt: new Date().toISOString(), records };
      downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }), `respaldo-control-avaluos-${today()}.json`);
    } catch (error) { $("#importMessage").textContent = error.message; }
  }
  async function importBackup() {
    if (!isAdmin()) return;
    const file = $("#importFileInput").files?.[0];
    const mode = $("#importMode").value;
    const message = $("#importMessage");
    if (!file) { message.textContent = "Selecciona un archivo de respaldo JSON para importar."; return; }
    try {
      const source = JSON.parse(await file.text());
      const incoming = Array.isArray(source) ? source : source?.records;
      const incomingAppraisals = Array.isArray(source?.appraisals) ? source.appraisals.filter((item) => item && item.tipo === "automotriz" && Array.isArray(item.vehiculos)) : [];
      if (!Array.isArray(incoming)) throw new Error("Estructura no válida");
      const valid = incoming.filter((item) => item && typeof item === "object" && /^\d{4}$/.test(normalizeNumber(item.numeroAvaluo))).map(normalizeRecord);
      if (!valid.length && incoming.length) throw new Error("Sin registros compatibles");
      if (mode === "replace" && !window.confirm("Se reemplazarán todos los avalúos actuales por los del respaldo. ¿Deseas continuar?")) return;
      if (serverOnline) {
        await apiRequest("/import", { method: "POST", body: JSON.stringify({ mode, records: valid, appraisals: incomingAppraisals }) });
        const remoteState = await apiRequest("/state");
        records = remoteState.records.map(normalizeRecord);
        technicalAppraisals = Array.isArray(remoteState.appraisals) ? remoteState.appraisals : [];
      } else if (mode === "replace") {
        records = valid;
        technicalAppraisals = incomingAppraisals;
      } else {
        const existingByNumber = new Map(records.map((record) => [record.numeroAvaluo, record]));
        valid.forEach((record) => { const existing = existingByNumber.get(record.numeroAvaluo); if (existing) Object.assign(existing, { ...record, id: existing.id }); else records.push({ ...record, id: record.id || `${Date.now()}-${Math.random().toString(16).slice(2)}` }); });
        const existingAppraisals = new Map(technicalAppraisals.map((appraisal) => [appraisal.id, appraisal]));
        incomingAppraisals.forEach((appraisal) => existingAppraisals.set(appraisal.id, appraisal));
        technicalAppraisals = [...existingAppraisals.values()];
      }
      saveRecords();
      saveTechnicalAppraisals();
      window.dispatchEvent(new CustomEvent("control-avaluos:technical-appraisals-updated"));
      $("#importFileInput").value = "";
      message.classList.remove("is-error");
      message.textContent = `${valid.length} ${valid.length === 1 ? "registro fue importado" : "registros fueron importados"} correctamente${serverOnline ? " en la base central" : ""}.`;
      render();
    } catch { message.textContent = "No se pudo importar el archivo. Selecciona un respaldo JSON generado desde esta aplicación."; }
  }

  async function updateUserRole(user, nextRole) {
    if (!isAdmin() || !allUsers().includes(user) || DEFAULT_ROLE_BY_USER[user] === "admin" || !VALID_ROLES.includes(nextRole)) return;
    const message = $("#roleMessage");
    try {
      const remoteUser = remoteUsers?.find((item) => item.name === user);
      if (serverOnline && remoteUser) {
        const saved = await apiRequest(`/users/${encodeURIComponent(remoteUser.id)}`, { method: "PUT", body: JSON.stringify({ role: nextRole }) });
        remoteUsers = remoteUsers.map((item) => item.id === saved.id ? { ...item, ...saved } : item);
      } else {
        const roles = loadRoles();
        roles[user] = nextRole;
        saveRoles(roles);
      }
      message.classList.add("is-success");
      message.textContent = `${user} ahora tiene el rol ${roleLabel(nextRole)}.`;
      renderUserPermissions();
      applyRoleUi();
    } catch (error) { message.textContent = error.message; message.classList.add("is-error"); }
  }
  function renderUserPermissions() {
    const credentials = loadCredentials();
    $("#userPermissionsList").innerHTML = allUsers().map((user) => { const role = roleFor(user);     const detail = role === "admin" ? "Control total, contraseñas, resumen y configuración" : role === "auditor" ? "Acceso total a Avalúos, Fe Pública, resumen, Chat y Notas/Tareas" : role === "valuador" ? "Puede crear y editar avalúos técnicos; Recepción solo en consulta" : role === "editor" ? "Puede crear y editar avalúos" : "Solo consulta, recibos y listados"; const roleControl = DEFAULT_ROLE_BY_USER[user] === "admin" ? `<span class="role-badge admin">Administrador</span>` : `<label class="role-select-label">Rol<select class="role-select" data-role-user="${escapeHtml(user)}" aria-label="Cambiar rol de ${escapeHtml(user)}"><option value="editor" ${role === "editor" ? "selected" : ""}>Editor(a)</option><option value="viewer" ${role === "viewer" ? "selected" : ""}>Solo lectura</option><option value="valuador" ${role === "valuador" ? "selected" : ""}>Valuador</option><option value="auditor" ${role === "auditor" ? "selected" : ""}>Auditor</option></select></label>`; return `<article class="user-permission-row"><div class="user-initial">${escapeHtml(user.split(" ").map((part) => part[0]).slice(0, 2).join(""))}</div><div><strong>${escapeHtml(user)}</strong><span>${detail}</span></div><div class="user-permission-status">${roleControl}<small>${credentials[user] ? "Contraseña configurada" : "Sin contraseña"}</small></div></article>`; }).join("");
    $$(".role-select").forEach((select) => select.addEventListener("change", () => updateUserRole(select.dataset.roleUser, select.value)));
  }

  async function registerUser(event) {
    event.preventDefault();
    if (!isAdmin()) return;
    const user = normalizeUserName($("#newUserName").value);
    const role = VALID_ROLES.includes($("#newUserRole").value) ? $("#newUserRole").value : "viewer";
    const message = $("#addUserMessage");
    if (user.length < 3) { message.textContent = "Escribe el nombre completo del nuevo usuario."; return; }
    if (!/[\p{L}]/u.test(user)) { message.textContent = "El nombre debe incluir al menos una letra."; return; }
    if (allUsers().some((candidate) => candidate.localeCompare(user, "es", { sensitivity: "base" }) === 0)) { message.textContent = "Ese usuario ya está registrado."; return; }
    const nextRole = role === "editor" ? "editor" : "viewer";
    try {
      if (serverOnline) {
        const created = await apiRequest("/users", { method: "POST", body: JSON.stringify({ name: user, role: nextRole }) });
        remoteUsers = [...(remoteUsers || []), created];
      } else {
        const addedUsers = loadAddedUsers();
        addedUsers.push(user);
        saveAddedUsers(addedUsers);
        const roles = loadRoles();
        roles[user] = nextRole;
        saveRoles(roles);
      }
    } catch (error) { message.textContent = error.message; message.classList.add("is-error"); return; }
    $("#newUserName").value = "";
    message.classList.add("is-success");
    message.textContent = `${user} fue registrado como ${roleLabel(nextRole)}. Configura su contraseña antes de iniciar sesión.`;
    syncUserOptions();
    renderUserPermissions();
  }

  function renderNotarySettings() {
    const target = $("#notariesSettingsList");
    if (!target) return;
    target.innerHTML = notarias.length ? notarias.map((item) => `<article class="settings-data-row"><div><strong>Notaría ${escapeHtml(item.numero)} · ${escapeHtml(item.municipio)}</strong><span>${escapeHtml(item.nombre)}${item.direccion ? ` · ${escapeHtml(item.direccion)}` : ""}${item.telefono ? ` · ${escapeHtml(item.telefono)}` : ""}</span></div><div class="settings-row-actions"><button type="button" class="text-action-button" data-edit-notary="${escapeHtml(item.id)}">Editar</button><button type="button" class="text-action-button is-danger" data-delete-notary="${escapeHtml(item.id)}">Eliminar</button></div></article>`).join("") : '<p class="settings-empty">No hay notarías cargadas.</p>';
    target.querySelectorAll("[data-edit-notary]").forEach((button) => button.addEventListener("click", () => { const item = notarias.find((candidate) => candidate.id === button.dataset.editNotary); if (!item) return; $("#notaryEditId").value = item.id; $("#notaryMunicipalityInput").value = item.municipio; $("#notaryNumberInput").value = item.numero; $("#notaryNameInput").value = item.nombre; $("#notaryAddressInput").value = item.direccion || ""; $("#notaryPhoneInput").value = item.telefono || ""; }));
    target.querySelectorAll("[data-delete-notary]").forEach((button) => button.addEventListener("click", async () => { if (!window.confirm("¿Eliminar esta notaría?")) return; try { await apiRequest(`/notarias/${encodeURIComponent(button.dataset.deleteNotary)}`, { method: "DELETE" }); notarias = notarias.filter((item) => item.id !== button.dataset.deleteNotary); renderNotarySettings(); window.dispatchEvent(new CustomEvent("control-avaluos:notarias-updated", { detail: notarias })); } catch (error) { $("#notaryMessage").textContent = error.message; } }));
  }
  function renderAuthorizedFolios() {
    const targets = [$("#authorizedFoliosList"), $("#authorizedFoliosListAvaluos")].filter(Boolean);
    const validationCard = $(".validation-choice");
    const validationPanel = $("#avaluosAuthorizedFoliosPanel");
    const permitted = canAuthorizeFolios();
    validationCard?.classList.toggle("is-hidden", !permitted);
    if (validationPanel) validationPanel.classList.toggle("is-hidden", !permitted || !validationPanel.dataset.open);
    const markup = authorizedAppraisalNumbers.length ? authorizedAppraisalNumbers.map((number) => {
      const normalized = normalizeNumber(number);
      const registered = records.some((record) => normalizeNumber(record.numeroAvaluo) === normalized);
      return `<article class="settings-data-row"><div><strong>#${escapeHtml(number)}</strong><span class="folio-validation-status ${registered ? "is-registered" : "is-pending"}">${registered ? "Registrado en Recepción" : "Autorizado · pendiente de Recepción"}</span></div><button type="button" class="text-action-button is-danger" data-delete-authorized-folio="${escapeHtml(number)}">Retirar</button></article>`;
    }).join("") : '<p class="settings-empty">Aún no hay folios autorizados.</p>';
    targets.forEach((target) => { target.innerHTML = markup; target.querySelectorAll("[data-delete-authorized-folio]").forEach((button) => button.addEventListener("click", async () => { try { await apiRequest(`/authorized-folios/${encodeURIComponent(button.dataset.deleteAuthorizedFolio)}`, { method: "DELETE" }); authorizedAppraisalNumbers = authorizedAppraisalNumbers.filter((value) => value !== button.dataset.deleteAuthorizedFolio); renderAuthorizedFolios(); } catch (error) { const message = $("#authorizedFolioMessage") || $("#authorizedFolioMessageAvaluos"); if (message) message.textContent = error.message; } })); });
  }
  async function renderPendingReceptionSummary() {
    const target = $("#pendingReceptionSummary");
    if (!target || !serverOnline) return;
    try { const data = await apiRequest("/summary/pending-reception"); const pending = Array.isArray(data.pending) ? data.pending : []; target.innerHTML = pending.length ? pending.map((item) => `<article class="settings-data-row"><div><strong>#${escapeHtml(item.numeroAvaluo || "Sin folio")}</strong><span>${escapeHtml(item.tipoAvaluo || item.tipo || "Avalúo técnico")} · ${escapeHtml(item.solicitante || "Sin solicitante")}</span></div></article>`).join("") : '<p class="settings-empty">No hay avalúos pendientes de registrar en Recepción.</p>'; } catch (error) { target.innerHTML = `<p class="settings-empty">${escapeHtml(error.message)}</p>`; }
  }
  async function refreshOperationalSettings() {
    if (!serverOnline) return;
    try { notarias = await apiRequest("/notarias"); authorizedAppraisalNumbers = await apiRequest("/authorized-folios"); window.__controlNotarias = notarias; window.__controlAuthorizedFolios = authorizedAppraisalNumbers; renderNotarySettings(); renderAuthorizedFolios(); renderPendingReceptionSummary(); window.dispatchEvent(new CustomEvent("control-avaluos:notarias-updated", { detail: notarias })); } catch (error) { const message = $("#notaryMessage"); if (message) message.textContent = error.message; }
  }
  function closeCustomSelects(except) {
    $$(".custom-select.is-open").forEach((wrapper) => { if (wrapper !== except) wrapper.classList.remove("is-open"); });
  }
  function enhanceSelect(select) {
    if (!select || select.dataset.customEnhanced === "true") return;
    select.dataset.customEnhanced = "true";
    const wrapper = document.createElement("div");
    wrapper.className = "custom-select";
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    select.classList.add("custom-select-native");
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "custom-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    const menu = document.createElement("div");
    menu.className = "custom-select-menu";
    menu.setAttribute("role", "listbox");
    function syncOptions() {
      const selected = select.options[select.selectedIndex];
      trigger.textContent = selected?.textContent || "Selecciona una opción";
      trigger.setAttribute("aria-expanded", String(wrapper.classList.contains("is-open")));
      menu.innerHTML = [...select.options].map((option, index) => `<button type="button" class="custom-select-option${option.selected ? " is-selected" : ""}" role="option" aria-selected="${option.selected}" data-option-index="${index}">${escapeHtml(option.textContent || "")}</button>`).join("");
      menu.querySelectorAll("[data-option-index]").forEach((optionButton) => optionButton.addEventListener("click", () => {
        select.selectedIndex = Number(optionButton.dataset.optionIndex);
        select.dispatchEvent(new Event("change", { bubbles: true }));
        wrapper.classList.remove("is-open");
        syncOptions();
      }));
    }
    trigger.addEventListener("click", () => { const open = !wrapper.classList.contains("is-open"); closeCustomSelects(wrapper); wrapper.classList.toggle("is-open", open); syncOptions(); });
    select.addEventListener("change", syncOptions);
    const optionObserver = new MutationObserver(syncOptions);
    optionObserver.observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ["selected"] });
    wrapper.append(trigger, menu);
    syncOptions();
  }
  function enhanceAllSelects() { $("body").querySelectorAll("select:not([data-custom-enhanced='true'])").forEach(enhanceSelect); }
  document.addEventListener("pointerdown", (event) => { if (!event.target.closest(".custom-select")) closeCustomSelects(); });
  const selectObserver = new MutationObserver(enhanceAllSelects);
  selectObserver.observe(document.body, { childList: true, subtree: true });
  enhanceAllSelects();
  loginForm.addEventListener("submit", authenticate);
  loginUser.addEventListener("change", syncCredentialSetupVisibility);
  $("#openInternalAccessButton").addEventListener("click", () => { loginMessage.textContent = ""; loginPassword.value = ""; syncCredentialSetupVisibility(); adminAccessDialog.showModal(); window.setTimeout(() => loginUser.focus(), 40); });
  $("#closeAdminAccessButton").addEventListener("click", () => adminAccessDialog.close());
  $("#cancelAdminAccessButton").addEventListener("click", () => adminAccessDialog.close());
  $("#taskForm").addEventListener("submit", createTask);
  $("#homeButton").addEventListener("click", () => { switchAppView("inicio"); renderHomeActions(); });
  $$('[data-home-action]').forEach((card) => card.addEventListener('click', () => openHomeAction(card.dataset.homeAction)));
  $("#chatForm").addEventListener("submit", createChatMessage);
  $("#chatToggleButton").addEventListener("click", () => { const widget = $("#chatWidget"); const panel = $("#chatPanel"); const button = $("#chatToggleButton"); const isOpening = widget.hidden || panel.hidden; widget.hidden = false; panel.hidden = !isOpening; button.setAttribute("aria-expanded", String(isOpening)); button.textContent = isOpening ? "Cerrar" : "Abrir Chat"; if (isOpening) { renderChat(); $("#chatMessageInput").focus(); } });
  $("#closeChatButton").addEventListener("click", () => { $("#chatPanel").hidden = true; $("#chatWidget").hidden = true; $("#chatToggleButton").setAttribute("aria-expanded", "false"); $("#chatToggleButton").textContent = "Chat"; });
  $("#openCredentialSetupButton").addEventListener("click", openCredentialSetup);
  manageUsersButton.addEventListener("click", () => switchAppView("usuarios"));
  credentialForm.addEventListener("submit", saveCredential);
  $("#closeCredentialDialogButton").addEventListener("click", closeCredentialSetup);
  $("#cancelCredentialDialogButton").addEventListener("click", closeCredentialSetup);
  $("#inlineCredentialForm").addEventListener("submit", saveInlineCredential);
  $("#addUserForm").addEventListener("submit", registerUser);
  $("#logoutButton").addEventListener("click", () => { sessionStorage.removeItem(SESSION_KEY); showLogin(); });
  $("#newRecordButton").addEventListener("click", () => openDialog());
  $("#newTechnicalAppraisalButton").addEventListener("click", () => window.dispatchEvent(new CustomEvent("control-avaluos:open-technical-creation")));
  $("#backAvaluosButton").addEventListener("click", () => {
    const creationPanel = $("#technicalCreationPanel");
    const mobiliarioEditor = $("#mobiliarioEditor");
    const automotrizEditor = $("#automotrizEditor");
    const editingTechnical = !creationPanel.hidden || !mobiliarioEditor.hidden || !automotrizEditor.hidden;
    if (editingTechnical) window.dispatchEvent(new CustomEvent("control-avaluos:close-technical-creation"));
    else window.dispatchEvent(new CustomEvent("control-avaluos:section", { detail: "inicio" }));
  });
  window.addEventListener("control-avaluos:subsection-change", (event) => {
    const section = event.detail;
    const details = {
      inicio: { title: "Avalúos", description: "Registra, consulta, filtra, edita y da seguimiento a cada avalúo." },
      recepcion: { title: "Avalúos - Recepción", description: "Registra y controla los avalúos recibidos, sus pagos y entregas." },
      crear: { title: "Gestión de Avalúos", description: "Consulta los expedientes técnicos y elabora un avalúo nuevo." },
      validacion: { title: "Avalúos - Validación", description: "Autoriza folios y verifica cuáles siguen pendientes de Recepción." },
    }[section] || { title: "Avalúos", description: "" };
    $("#pageTitle").textContent = details.title;
    $("#pageDescription").textContent = details.description;
    const inAvaluos = activeAppView === "avaluos";
    $("#backAvaluosButton").classList.toggle("is-hidden", !inAvaluos || section === "inicio");
    $("#newRecordButton").classList.toggle("is-hidden", !inAvaluos || section !== "recepcion" || !canEditReception());
    $("#newTechnicalAppraisalButton").classList.toggle("is-hidden", !inAvaluos || section !== "crear" || !canEdit());
  });
  window.addEventListener("control-avaluos:technical-creation-state", (event) => {
    if (activeAppView !== "avaluos") return;
    $("#newTechnicalAppraisalButton").classList.toggle("is-hidden", Boolean(event.detail) || !canEdit());
  });
  $("#closeDialogButton").addEventListener("click", closeDialog);
  $("#cancelDialogButton").addEventListener("click", closeDialog);
  $("#previewReceiptButton").addEventListener("click", () => openReceipt(formDraft()));
  paidInput.addEventListener("change", setPaymentVisibility);
  numberInput.addEventListener("input", () => { numberInput.value = normalizeNumber(numberInput.value); });
  searchInput.addEventListener("input", () => { if (searchInput.value.trim()) { operationalView = "todos"; $$("[data-view]").forEach((item) => item.classList.toggle("is-active", item.dataset.view === "todos")); } render(); });
  $$("[data-view]").forEach((button) => button.addEventListener("click", () => { operationalView = button.dataset.view; $$("[data-view]").forEach((item) => item.classList.toggle("is-active", item === button)); render(); }));
  $$("[data-app-view]").forEach((button) => button.addEventListener("click", () => switchAppView(button.dataset.appView)));
  $("#generateInlineReportButton").addEventListener("click", prepareInlineReport);
  $$('[data-users-section]').forEach((button) => button.addEventListener("click", () => setUsersSection(button.dataset.usersSection)));
  $$('[data-users-back]').forEach((button) => button.addEventListener("click", () => setUsersSection("menu")));
  $("#printInlineReportButton").addEventListener("click", printInlineReport);
  $("#exportCsvSettingsButton").addEventListener("click", exportRecords);
  $("#exportBackupButton").addEventListener("click", exportBackup);
  $("#importDataButton").addEventListener("click", importBackup);
  $("#exportButton").addEventListener("click", () => switchAppView("configuracion"));
  $("#reportButton").addEventListener("click", () => switchAppView("resumen"));
  $("#statusViewSelect")?.addEventListener("change", (event) => { operationalView = event.target.value; render(); });
  $("#notaryForm")?.addEventListener("submit", async (event) => { event.preventDefault(); if (!isAdmin()) return; const id = $("#notaryEditId").value.trim(); const payload = { municipio: $("#notaryMunicipalityInput").value.trim(), numero: $("#notaryNumberInput").value, nombre: $("#notaryNameInput").value.trim(), direccion: $("#notaryAddressInput").value.trim(), telefono: $("#notaryPhoneInput").value.trim() }; const message = $("#notaryMessage"); try { const saved = await apiRequest(id ? `/notarias/${encodeURIComponent(id)}` : "/notarias", { method: id ? "PUT" : "POST", body: JSON.stringify(payload) }); notarias = Array.isArray(saved) ? saved : (id ? notarias.map((item) => item.id === id ? saved : item) : [...notarias, saved]); $("#notaryForm").reset(); $("#notaryEditId").value = ""; message.textContent = "Notaría guardada correctamente."; message.className = "form-message is-success"; renderNotarySettings(); window.dispatchEvent(new CustomEvent("control-avaluos:notarias-updated", { detail: notarias })); } catch (error) { message.textContent = error.message; message.className = "form-message is-error"; } });
  $("#toggleNotariesRecordsButton")?.addEventListener("click", () => { const target = $("#notariesSettingsList"); const button = $("#toggleNotariesRecordsButton"); if (!target || !button) return; const willShow = target.hidden; target.hidden = !willShow; button.setAttribute("aria-expanded", String(willShow)); button.textContent = willShow ? "Ocultar registros" : "Ver registros"; if (willShow) renderNotarySettings(); });
  $("#cancelNotaryEditButton")?.addEventListener("click", () => { $("#notaryForm").reset(); $("#notaryEditId").value = ""; });
  async function saveAuthorizedFolioFrom(inputSelector, messageSelector) { if (!canAuthorizeFolios()) return; const value = normalizeNumber($(inputSelector)?.value || ""); const message = $(messageSelector); if (!/^\d{4}$/.test(value)) { if (message) message.textContent = "Escribe un número de avalúo de cuatro dígitos."; return; }     try { const response = await apiRequest("/authorized-folios", { method: "POST", body: JSON.stringify({ numeroAvaluo: value }) }); authorizedAppraisalNumbers = Array.isArray(response.values) ? response.values : [...new Set([...authorizedAppraisalNumbers, value])].sort(); $(inputSelector).value = ""; if (message) { message.textContent = `El avalúo ${value} quedó autorizado para Recepción.`; message.className = "form-message is-success"; } renderAuthorizedFolios(); await renderPendingReceptionSummary(); } catch (error) { if (message) { message.textContent = error.message; message.className = "form-message is-error"; } } }
  $("#authorizedFolioForm")?.addEventListener("submit", async (event) => { event.preventDefault(); await saveAuthorizedFolioFrom("#authorizedFolioInput", "#authorizedFolioMessage"); });
  $("#authorizedFolioFormAvaluos")?.addEventListener("submit", async (event) => { event.preventDefault(); await saveAuthorizedFolioFrom("#authorizedFolioInputAvaluos", "#authorizedFolioMessageAvaluos"); });
  $("#refreshPendingSummaryButton")?.addEventListener("click", renderPendingReceptionSummary);

  syncUserOptions();
  bindMoneyInputs();
  renderNotarySettings();
  renderAuthorizedFolios();
  loadRemoteState();
  syncCredentialSetupVisibility();
  const storedSession = sessionStorage.getItem(SESSION_KEY);
  if (storedSession && allUsers().includes(storedSession)) { loginUser.value = storedSession; showAuthenticatedApp(storedSession); } else { showLogin(); }

  window.ControlAvaluosDesktop = {
    canEdit,
    getActiveUser: () => activeSessionUser,
    getTechnicalObjectives: loadTechnicalObjectives,
    saveTechnicalObjectives,
    saveTechnicalAppraisal,
    deleteTechnicalAppraisal,
    getNextTechnicalFolio,
    getTechnicalAppraisals: () => [...technicalAppraisals],
    apiRequest,
    getApiBaseUrl: () => API_BASE_URL,
    allUsers,
    canViewRequests,
    renderAuthorizedFolios,
    renderPendingReceptionSummary,
    refreshRecords: render,
  };
})();
