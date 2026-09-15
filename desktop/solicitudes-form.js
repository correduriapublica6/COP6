(() => {
  const API = window.ControlAvaluosDesktop?.getApiBaseUrl?.() || "/api";
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value || "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[character]));
  const requestDialog = $("#publicRequestDialog");
  const applicantLoginDialog = $("#applicantLoginDialog");
  const applicantRegisterDialog = $("#applicantRegisterDialog");
  const applicantRequestsDialog = $("#applicantRequestsDialog");
  let requests = [];
  let editingRequestId = "";
  let applicantSession = null;

  const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  async function api(endpoint, options = {}) {
    const maxAttempts = 3;
    const { retries: _retries, signal: _signal, ...requestOptions } = options;
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 10000);
      try {
        const activeInternalUser = window.ControlAvaluosDesktop?.getActiveUser?.() || "";
        const headers = { "Content-Type": "application/json", ...(activeInternalUser ? { "X-User-Name": encodeURIComponent(activeInternalUser) } : {}), ...(applicantSession?.email ? { "X-Applicant-Email": applicantSession.email } : {}), ...(requestOptions.headers || {}) };
        const response = await fetch(`${API}${endpoint}`, { ...requestOptions, cache: "no-store", headers, signal: controller.signal });
        if (response.ok) return response.status === 204 ? null : response.json();
        if (![429, 502, 503, 504].includes(response.status) || attempt === maxAttempts) {
          let message = "No se pudo completar la operación.";
          try { message = (await response.json()).error || message; } catch {}
          throw new Error(message);
        }
        lastError = new Error(`Servidor temporalmente no disponible (${response.status}).`);
      } catch (error) {
        lastError = error?.name === "AbortError" ? new Error("El servidor tardó demasiado en responder.") : error;
        if (attempt === maxAttempts || (error?.name !== "AbortError" && !(error instanceof TypeError))) throw error;
      } finally {
        window.clearTimeout(timeout);
      }
      await wait(450 * attempt);
    }
    throw new Error(lastError?.message || "No fue posible comunicarse con el servidor. Verifica la conexión y la dirección de Recepción.");
  }

  async function readFiles(input) {
    const files = [...(input?.files || [])].slice(0, 8);
    return Promise.all(files.map((file) => new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, data: reader.result }); reader.onerror = () => resolve(null); reader.readAsDataURL(file); }))).then((items) => items.filter(Boolean));
  }

  function valuadores() {
    const users = window.ControlAvaluosDesktop?.allUsers?.() || [];
    const remote = window.__controlRemoteUsers || [];
    return [...new Set([...users, ...remote.filter((user) => user.role === "valuador").map((user) => user.name)])].filter((name) => /Ivan|Juan|Gabriel|Cesar|Diana|Caridad|Francisco|Emmanuel/i.test(name));
  }

  async function fillAdvisors() {
    const select = $("#publicRequestAdvisor");
    if (!select) return;
    let names = valuadores();
    try { const state = await api("/state"); window.__controlRemoteUsers = state.users || []; names = [...new Set((state.users || []).filter((user) => user.role === "valuador").map((user) => user.name).concat(names))]; } catch {}
    select.innerHTML = `<option value="">Selecciona un valuador</option>${names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}`;
  }
  function notaryOptions(selected = "") {
    const list = Array.isArray(window.__controlNotarias) ? window.__controlNotarias : [];
    return `<option value="">Selecciona una notaría</option>${list.map((item) => { const value = `${item.numero} · ${item.municipio} · ${item.nombre}`; return `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(value)}</option>`; }).join("")}`;
  }
  function normalizeSearch(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
  function notaryMunicipalities() { return [...new Set((Array.isArray(window.__controlNotarias) ? window.__controlNotarias : []).map((item) => String(item.municipio || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")); }
  function renderNotarySearch(selected = "") {
    const municipality = $("#requestNotaryMunicipality");
    const query = $("#requestNotarySearch");
    const results = $("#requestNotaryResults");
    const hidden = $("#requestNotaryValue");
    if (!municipality || !query || !results || !hidden) return;
    municipality.innerHTML = `<option value="">Selecciona un municipio</option>${notaryMunicipalities().map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
    const selectedItem = (Array.isArray(window.__controlNotarias) ? window.__controlNotarias : []).find((item) => `${item.numero} · ${item.municipio} · ${item.nombre}` === selected || `${item.numero} · ${item.municipio} · ${item.nombre}` === hidden.value);
    if (selectedItem) { municipality.value = selectedItem.municipio; query.value = `${selectedItem.numero} · ${selectedItem.nombre}`; hidden.value = `${selectedItem.numero} · ${selectedItem.municipio} · ${selectedItem.nombre}`; }
    const render = () => {
      const municipalityValue = normalizeSearch(municipality.value);
      const text = normalizeSearch(query.value);
      const list = (Array.isArray(window.__controlNotarias) ? window.__controlNotarias : []).filter((item) => (!municipalityValue || normalizeSearch(item.municipio) === municipalityValue) && (!text || normalizeSearch(`${item.numero} ${item.nombre}`).includes(text))).slice(0, 30);
      results.innerHTML = list.length ? list.map((item) => { const value = `${item.numero} · ${item.municipio} · ${item.nombre}`; return `<button type="button" class="notary-search-result${hidden.value === value ? " is-selected" : ""}" data-notary-value="${escapeHtml(value)}"><strong>${escapeHtml(item.numero)} · ${escapeHtml(item.nombre)}</strong><span>${escapeHtml(item.municipio)}${item.direccion ? ` · ${escapeHtml(item.direccion)}` : ""}</span></button>`; }).join("") : `<p class="notary-search-empty">Selecciona un municipio y escribe el número o nombre de la notaría.</p>`;
      results.querySelectorAll("[data-notary-value]").forEach((button) => button.addEventListener("click", () => { hidden.value = button.dataset.notaryValue || ""; const item = (Array.isArray(window.__controlNotarias) ? window.__controlNotarias : []).find((candidate) => `${candidate.numero} · ${candidate.municipio} · ${candidate.nombre}` === hidden.value); if (item) { municipality.value = item.municipio; query.value = `${item.numero} · ${item.nombre}`; } results.querySelectorAll(".notary-search-result").forEach((candidate) => candidate.classList.toggle("is-selected", candidate === button)); }));
    };
    municipality.onchange = render; query.oninput = render; render();
  }
  function selectedNotaryValue() { return $("#requestNotaryValue")?.value || ""; }
  async function fillNotaries() {
    let list = Array.isArray(window.__controlNotarias) ? window.__controlNotarias : [];
    try { const remoteList = await api("/notarias"); if (Array.isArray(remoteList)) { list = remoteList; window.__controlNotarias = remoteList; } } catch {}
    const selectors = [$("#applicantRegisterNotary")].filter(Boolean);
    selectors.forEach((select) => { const selected = select.value; select.innerHTML = notaryOptions(selected); if (selected) select.value = selected; });
  }

  function renderDynamicFields() {
    const type = $("#publicRequestType")?.value;
    const container = $("#publicRequestDynamicFields");
    if (!container) return;
    if (type === "Inmuebles") {
      container.innerHTML = `<div class="request-subgrid"><label>Modalidad *<select name="modalidadInmueble" id="requestInmuebleMode"><option value="">Selecciona</option><option>Referido</option><option>Comercial</option><option>Otro</option></select></label><div id="requestInmuebleModeFields"></div><label>Tipo de bien *<select name="tipoBien"><option value="">Selecciona</option><option>Terreno</option><option>Construcción</option></select></label><label>Valor de la operación<input name="valorOperacion" type="text" inputmode="decimal" data-money-input placeholder="$0.00" /></label><label>Número de enajenantes<input name="numeroEnajenantes" type="number" min="0" step="1" /></label><label>Propietario<input name="propietario" /></label></div>`;
      $("#requestInmuebleMode").addEventListener("change", renderInmuebleModeFields);
    } else if (type === "Maquinaria y equipo") {
      container.innerHTML = `<div class="request-subgrid"><label>Calle<input name="calle" /></label><label>Número<input name="numero" /></label><label>Colonia<input name="colonia" /></label><label>Ciudad<input name="ciudad" /></label><label>Propietario<input name="propietario" /></label></div>`;
    } else if (type === "Intangibles") {
      container.innerHTML = `<div class="request-subgrid"><label>Tipo de intangible *<select name="tipoIntangible" id="requestIntangibleType"><option value="">Selecciona</option><option>Empresa en marcha</option><option>Marca</option><option>Patente</option><option>Títulos accionarios</option><option>Partes sociales</option><option>Otro</option></select></label><div id="requestIntangibleOther"></div></div>`;
      $("#requestIntangibleType").addEventListener("change", () => { $("#requestIntangibleOther").innerHTML = $("#requestIntangibleType").value === "Otro" ? `<label>Describe el intangible<input name="otroIntangible" required /></label>` : ""; });
    } else container.innerHTML = "";
  }

  function renderInmuebleModeFields() {
    const mode = $("#requestInmuebleMode")?.value;
    const target = $("#requestInmuebleModeFields");
    if (!target) return;
    target.innerHTML = mode === "Referido" ? `<div class="notary-search-field"><label>Municipio *<select id="requestNotaryMunicipality" required><option value="">Selecciona un municipio</option></select></label><label>Buscar número o nombre de notaría *<input id="requestNotarySearch" type="search" autocomplete="off" placeholder="Ej. 14 o Emilio Darwi" required /></label><input type="hidden" id="requestNotaryValue" name="notariaReferida" /><div id="requestNotaryResults" class="notary-search-results" role="listbox"></div><p class="field-help">Primero selecciona el municipio; después escribe el número o una parte del nombre.</p></div>` : mode === "Otro" ? `<label>Describe la modalidad<input name="otraModalidad" required /></label>` : "";
    if (mode === "Referido") { fillNotaries().then(() => renderNotarySearch()); }
  }

  function openDialog(dialog) { if (dialog?.showModal) dialog.showModal(); }
  function closeDialog(dialog) { if (dialog?.open) dialog.close(); }
  function formObject(form) { return Object.fromEntries(new FormData(form).entries()); }
  function setMessage(element, text, tone = "error") { if (!element) return; element.textContent = text; element.dataset.tone = tone; element.hidden = !text; }
  function setBusy(form, busy, label) { const button = form?.querySelector('button[type="submit"]'); if (!button) return; if (!button.dataset.defaultLabel) button.dataset.defaultLabel = button.textContent; button.disabled = busy; button.textContent = busy ? label : button.dataset.defaultLabel; }
  function requireFields(form, names) { const missing = names.find((name) => !String(form.elements[name]?.value || "").trim()); if (missing) { form.elements[missing]?.focus(); return false; } return true; }
  function getRequestForm() { return $("#publicRequestForm"); }
  function resetRequestForm() {
    const form = getRequestForm();
    if (!form) return;
    form.reset();
    $("#publicRequestDynamicFields").innerHTML = "";
    editingRequestId = "";
    if (applicantSession) {
      form.elements.nombre.value = applicantSession.name || "";
      form.elements.telefono.value = applicantSession.phone || "";
      form.elements.correo.value = applicantSession.email || "";
      if (form.elements.notaria) form.elements.notaria.value = applicantSession.notaria || "";
      form.elements.correo.readOnly = true;
      form.elements.nombre.readOnly = true;
      form.elements.telefono.readOnly = Boolean(applicantSession.phone);
    } else {
      form.elements.correo.readOnly = false;
      form.elements.nombre.readOnly = false;
      form.elements.telefono.readOnly = false;
    }
    setMessage($("#publicRequestMessage"), "");
  }
  function applicantOwnRequestsTable(list) {
    if (!list.length) return `<p class="request-empty">Todavía no has enviado solicitudes.</p>`;
    return `<table class="request-table applicant-request-table"><thead><tr><th>Folio</th><th>Tipo de avalúo</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>${list.map((item) => `<tr><td><strong>${escapeHtml(item.folio)}</strong></td><td>${escapeHtml(item.tipoAvaluo)}</td><td><span class="request-status request-status-${String(item.estado).replace(/\\s+/g, "-")}">${escapeHtml(item.estado)}</span></td><td>${escapeHtml(item.creadoEn?.slice(0, 10) || "")}</td><td class="request-action-cell"><button type="button" class="request-detail-button" data-request-detail="${escapeHtml(item.id)}">Ver detalle</button><button type="button" class="request-detail-button" data-edit-own-request="${escapeHtml(item.id)}">Editar</button></td></tr>`).join("")}</tbody></table>`;
  }
  function showApplicantHome() {
    const content = $(".public-entry-content");
    const home = $("#applicantHomePanel");
    if (!content || !home || !applicantSession) return;
    content.hidden = true;
    home.hidden = false;
    $("#loginVisualBrand")?.setAttribute("hidden", "true");
    $("#applicantVisualPanel")?.removeAttribute("hidden");
    $("#openInternalAccessButton")?.setAttribute("hidden", "true");
    $("#applicantWelcomeName").textContent = applicantSession.name || "solicitante";
    $("#applicantWelcomeContact").textContent = [applicantSession.phone, applicantSession.email].filter(Boolean).join(" · ");
    $("#publicRequestForm")?.elements.correo && ($("#publicRequestForm").elements.correo.readOnly = true);
    renderApplicantHomeRequests();
  }
  function showPublicEntry() {
    const content = $(".public-entry-content");
    const home = $("#applicantHomePanel");
    if (content) content.hidden = false;
    if (home) home.hidden = true;
    $("#loginVisualBrand")?.removeAttribute("hidden");
    $("#applicantVisualPanel")?.setAttribute("hidden", "true");
    $("#openInternalAccessButton")?.removeAttribute("hidden");
    resetRequestForm();
  }
  async function renderApplicantHomeRequests() {
    const table = $("#applicantHomeRequestsTable");
    if (!table || !applicantSession) return;
    try { const own = await api(`/service-requests?email=${encodeURIComponent(applicantSession.email)}`); table.innerHTML = applicantOwnRequestsTable(own); const visualTable = $("#applicantVisualRequestsTable"); if (visualTable) { visualTable.innerHTML = applicantOwnRequestsTable(own); bindRequestDetailButtons(visualTable, own); visualTable.querySelectorAll("[data-edit-own-request]").forEach((button) => button.addEventListener("click", () => { const item = own.find((candidate) => candidate.id === button.dataset.editOwnRequest); if (item) editOwnRequest(item); })); } bindRequestDetailButtons(table, own); table.querySelectorAll("[data-edit-own-request]").forEach((button) => button.addEventListener("click", () => { const item = own.find((candidate) => candidate.id === button.dataset.editOwnRequest); if (item) editOwnRequest(item); })); } catch (error) { table.innerHTML = `<p class="request-empty">${escapeHtml(error.message)}</p>`; }
  }
  function safeFileData(file) {
    const data = String(file?.data || "");
    const lower = data.toLowerCase();
    const allowed = lower.startsWith("data:image/") || lower.startsWith("data:application/pdf") || lower.startsWith("data:application/msword") || lower.startsWith("data:application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    return allowed ? data : "";
  }
  function requestFileUrl(item, index, download = false) {
    const suffix = download ? "?download=1" : "";
    return `${API}/service-requests/${encodeURIComponent(item.id)}/files/${index}${suffix}`;
  }
  function renderRequestDetail(item) {
    const detail = $("#requestDetailContent");
    const dialog = $("#requestDetailDialog");
    if (!detail || !dialog || !item) return;
    const files = Array.isArray(item.archivos) ? item.archivos : [];
    const info = item.datosEspecificos && typeof item.datosEspecificos === "object" ? item.datosEspecificos : {};
    const fileMarkup = files.length ? files.map((file, index) => {
      const name = escapeHtml(file.name || `Archivo ${index + 1}`);
      const data = safeFileData(file);
      if (!data) return `<li class="request-file-card request-file-unavailable"><span>${name}</span><small>Archivo no disponible</small></li>`;
      const preview = String(file.type || "").startsWith("image/") ? `<img src="${data}" alt="${name}" />` : file.type === "application/pdf" ? `<iframe title="${name}" src="${data}"></iframe>` : `<div class="request-file-icon" aria-hidden="true">DOC</div>`;
      return `<li class="request-file-card request-file-document">${preview}<span>${name}</span><div class="request-file-actions"><button type="button" class="request-detail-button" data-view-file="${index}">Ver</button><button type="button" class="request-detail-button" data-download-file="${index}">Descargar</button></div></li>`;
    }).join("") : `<li class="request-file-empty">No hay documentos ni imágenes adjuntos.</li>`;
    $("#requestDetailTitle").textContent = `${item.folio || "Solicitud"}`;
    detail.innerHTML = `<div class="request-detail-summary"><div><span>Solicitante</span><strong>${escapeHtml(item.solicitante?.nombre || "")}</strong></div><div><span>Tipo de avalúo</span><strong>${escapeHtml(item.tipoAvaluo || "")}</strong></div><div><span>Asesor</span><strong>${escapeHtml(item.asesor || "Sin asignar")}</strong></div><div><span>Estado</span><strong>${escapeHtml(item.estado || "recibida")}</strong></div></div><section class="request-detail-section"><h3>Información registrada</h3><dl>${Object.entries(info).filter(([key, value]) => key !== "archivos" && value && typeof value !== "object").map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("") || "<p>No hay datos adicionales.</p>"}</dl></section><section class="request-detail-section"><h3>Documentos e imágenes</h3><ul class="request-files-grid">${fileMarkup}</ul></section>`;
    detail.querySelectorAll("[data-view-file]").forEach((button) => button.addEventListener("click", () => { const index = Number(button.dataset.viewFile); const popup = window.open("about:blank", "_blank", "noopener"); if (popup) popup.location.href = requestFileUrl(item, index); else window.location.href = requestFileUrl(item, index); }));
    detail.querySelectorAll("[data-download-file]").forEach((button) => button.addEventListener("click", () => { const link = document.createElement("a"); link.href = requestFileUrl(item, Number(button.dataset.downloadFile), true); link.download = files[Number(button.dataset.downloadFile)]?.name || "archivo"; document.body.appendChild(link); link.click(); link.remove(); }));
    openDialog(dialog);
  }
  function bindRequestDetailButtons(container, list) { container.querySelectorAll("[data-request-detail]").forEach((button) => button.addEventListener("click", () => { const item = list.find((candidate) => candidate.id === button.dataset.requestDetail); if (item) renderRequestDetail(item); })); }

  async function submitPublicRequest(event) {
    event.preventDefault();
    event.stopPropagation();
    const form = event.currentTarget;
    const message = $("#publicRequestMessage");
    setMessage(message, "");
    if (!requireFields(form, ["nombre", "telefono", "tipoAvaluo"])) { setMessage(message, "Completa nombre, teléfono y tipo de avalúo."); return; }
    const values = formObject(form);
    setBusy(form, true, "Enviando…");
    try {
      const files = await readFiles(form.elements.archivos);
      const payload = { solicitante: { nombre: values.nombre, telefono: values.telefono, correo: values.correo }, tipoAvaluo: values.tipoAvaluo, asesor: values.asesor, notaria: values.notaria || values.notariaReferida || "", modalidad: values.modalidadInmueble || "", datosEspecificos: values, archivos: files, contactoVisita: { nombre: values.contactoVisitaNombre, telefono: values.contactoVisitaTelefono }, observaciones: values.observaciones, requesterEmail: values.correo || applicantSession?.email || "" };
      const result = await api(editingRequestId ? `/service-requests/${encodeURIComponent(editingRequestId)}` : "/service-requests", { method: editingRequestId ? "PUT" : "POST", body: JSON.stringify(payload) });
      const actionLabel = editingRequestId ? "Solicitud actualizada" : "Solicitud registrada";
      setMessage(message, `${actionLabel} con folio ${result.folio}. Conserva este número para consultar el avance.`, "success");
      window.setTimeout(() => { resetRequestForm(); closeDialog(requestDialog); if (applicantSession) renderApplicantHomeRequests(); }, 2600);
    } catch (error) { setMessage(message, error.message || "No se pudo registrar la solicitud."); }
    finally { setBusy(form, false); }
  }

  async function registerApplicant(event) {
    event.preventDefault();
    event.stopPropagation();
    const form = event.currentTarget;
    const values = formObject(form);
    const message = $("#applicantRegisterMessage");
    setMessage(message, "");
    if (!requireFields(form, ["nombre", "correo", "password", "passwordConfirm"])) { setMessage(message, "Completa los campos obligatorios del registro."); return; }
    if (values.password !== values.passwordConfirm) { setMessage(message, "Las contraseñas no coinciden."); return; }
    setBusy(form, true, "Registrando…");
    try {
      const result = await api("/applicants/register", { method: "POST", body: JSON.stringify({ name: values.nombre, email: values.correo, phone: values.telefono, notaria: values.notaria || "", password: values.password }) });
      applicantSession = result;
      sessionStorage.setItem("control-avaluos.applicant", JSON.stringify(result));
      setMessage(message, "Registro realizado. Ya puedes enviar solicitudes y consultar su avance.", "success");
      window.setTimeout(() => { closeDialog(applicantRegisterDialog); resetRequestForm(); openDialog(requestDialog); fillAdvisors(); }, 900);
    } catch (error) { setMessage(message, error.message || "No se pudo registrar el usuario."); }
    finally { setBusy(form, false); }
  }

  async function renderApplicantRequests() {
    if (!applicantSession) return;
    const table = $("#applicantRequestsTable");
    if (!table) return;
    const own = await api(`/service-requests?email=${encodeURIComponent(applicantSession.email)}`);
    table.innerHTML = applicantOwnRequestsTable(own);
    bindRequestDetailButtons(table, own);
    table.querySelectorAll("[data-edit-own-request]").forEach((button) => button.addEventListener("click", () => { const item = own.find((candidate) => candidate.id === button.dataset.editOwnRequest); if (item) editOwnRequest(item); }));
    openDialog(applicantRequestsDialog);
  }
  function editOwnRequest(item) {
    editingRequestId = item.id;
    const form = $("#publicRequestForm");
    form.elements.nombre.value = item.solicitante?.nombre || "";
    form.elements.telefono.value = item.solicitante?.telefono || "";
    form.elements.correo.value = item.solicitante?.correo || applicantSession?.email || "";
    form.elements.tipoAvaluo.value = item.tipoAvaluo || "";
    renderDynamicFields();
    form.elements.asesor.value = item.asesor || "";
    if (item.datosEspecificos) Object.entries(item.datosEspecificos).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value; });
    if (item.notaria || item.datosEspecificos?.notariaReferida) renderNotarySearch(item.notaria || item.datosEspecificos.notariaReferida);
    closeDialog(applicantRequestsDialog); openDialog(requestDialog); fillAdvisors();
  }
  async function saveApplicantProfile(event) {
    event.preventDefault();
    if (!applicantSession) return;
    const form = event.currentTarget;
    const values = formObject(form);
    const message = $("#applicantProfileMessage");
    setMessage(message, "");
    if (!String(values.nombre || "").trim()) { setMessage(message, "El nombre es obligatorio."); return; }
    if (values.password && values.password !== values.passwordConfirm) { setMessage(message, "Las contraseñas no coinciden."); return; }
    setBusy(form, true, "Guardando…");
    try {
      const updated = await api(`/applicants/${encodeURIComponent(applicantSession.id)}/profile`, { method: "PUT", body: JSON.stringify({ name: values.nombre, phone: values.telefono, password: values.password || "" }) });
      applicantSession = updated;
      sessionStorage.setItem("control-avaluos.applicant", JSON.stringify(updated));
      $("#applicantWelcomeName").textContent = updated.name;
      $("#applicantWelcomeContact").textContent = [updated.phone, updated.email].filter(Boolean).join(" · ");
      setMessage(message, "Perfil actualizado correctamente.", "success");
      window.setTimeout(() => closeDialog($("#applicantProfileDialog")), 700);
    } catch (error) { setMessage(message, error.message || "No se pudo actualizar el perfil."); }
    finally { setBusy(form, false); }
  }
  function openApplicantProfile() {
    if (!applicantSession) return;
    const form = $("#applicantProfileForm");
    form.elements.nombre.value = applicantSession.name || "";
    form.elements.correo.value = applicantSession.email || "";
    form.elements.telefono.value = applicantSession.phone || "";
    form.elements.password.value = "";
    form.elements.passwordConfirm.value = "";
    setMessage($("#applicantProfileMessage"), "");
    openDialog($("#applicantProfileDialog"));
  }
  async function loginApplicant(event) {
    event.preventDefault();
    event.stopPropagation();
    const form = event.currentTarget;
    const values = formObject(form);
    const message = $("#applicantLoginMessage");
    setMessage(message, "");
    if (!requireFields(form, ["email", "password"])) { setMessage(message, "Captura correo y contraseña."); return; }
    setBusy(form, true, "Entrando…");
    try { applicantSession = await api("/applicants/login", { method: "POST", body: JSON.stringify({ email: values.email, password: values.password }) }).then((result) => result.applicant); sessionStorage.setItem("control-avaluos.applicant", JSON.stringify(applicantSession)); closeDialog(applicantLoginDialog); showApplicantHome(); } catch (error) { setMessage(message, error.message || "No se pudo iniciar sesión."); }
    finally { setBusy(form, false); }
  }

  function requestRows(list, canManage = false, canViewDetail = true, canDelete = false) {
    if (!list.length) return `<p class="request-empty">No hay solicitudes para mostrar.</p>`;
    const statusOptions = (item) => ["recibida", "en revisión", "asignada", "en visita", "en elaboración", "concluida", "cancelada"].map((status) => `<option value="${escapeHtml(status)}" ${item.estado === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("");
    const hasActions = canManage || canViewDetail;
    return `<table class="request-table"><thead><tr><th>Folio</th><th>Solicitante</th><th>Tipo de avalúo</th><th>Asesor</th><th>Estado</th><th>Fecha</th>${hasActions ? "<th>Acciones</th>" : ""}</tr></thead><tbody>${list.map((item) => `<tr><td><strong>${escapeHtml(item.folio)}</strong></td><td>${escapeHtml(item.solicitante?.nombre)}</td><td>${escapeHtml(item.tipoAvaluo)}</td><td>${escapeHtml(item.asesor || "Sin asignar")}</td><td><span class="request-status request-status-${String(item.estado).replace(/\\s+/g, "-")}">${escapeHtml(item.estado)}</span></td><td>${escapeHtml(item.creadoEn?.slice(0, 10) || "")}</td>${hasActions ? `<td class="request-action-cell">${canViewDetail ? `<button type="button" class="request-detail-button" data-request-detail="${escapeHtml(item.id)}">Ver detalle</button>` : ""}${canManage ? `<select class="request-status-select" aria-label="Cambiar estado de ${escapeHtml(item.folio)}" data-request-status="${escapeHtml(item.id)}">${statusOptions(item)}</select>` : ""}${canDelete ? `<button type="button" class="request-detail-button is-danger" data-delete-request="${escapeHtml(item.id)}">Eliminar</button>` : ""}</td>` : ""}</tr>`).join("")}</tbody></table>`;
  }

  async function loadRequests(role = "", user = "") { try { const query = role === "valuador" && user ? `?asesor=${encodeURIComponent(user)}` : ""; requests = await api(`/service-requests${query}`); } catch { requests = []; } return requests; }
  async function renderRegisteredApplicants() {
    const table = $("#registeredApplicantsTable");
    if (!table) return;
    try {
      const applicants = await api("/applicants");
      table.innerHTML = applicants.length ? `<table class="request-table"><thead><tr><th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Registro</th><th>Acciones</th></tr></thead><tbody>${applicants.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.email)}</td><td>${escapeHtml(item.phone || "")}</td><td>${escapeHtml(item.createdAt?.slice(0, 10) || "")}</td><td class="request-action-cell"><button type="button" class="request-detail-button" data-edit-applicant="${escapeHtml(item.id)}">Editar</button><button type="button" class="request-detail-button is-danger" data-delete-applicant="${escapeHtml(item.id)}">Eliminar</button></td></tr>`).join("")}</tbody></table>` : `<p class="request-empty">No hay solicitantes registrados.</p>`;
      table.querySelectorAll("[data-edit-applicant]").forEach((button) => button.addEventListener("click", () => editApplicant(applicants.find((item) => item.id === button.dataset.editApplicant))));
      table.querySelectorAll("[data-delete-applicant]").forEach((button) => button.addEventListener("click", () => deleteApplicant(button.dataset.deleteApplicant)));
    } catch { table.innerHTML = `<p class="request-empty">No se pudo cargar la lista de solicitantes.</p>`; }
  }
  async function editApplicant(item) {
    if (!item) return;
    const name = window.prompt("Nombre completo", item.name); if (name === null) return;
    const email = window.prompt("Correo electrónico", item.email); if (email === null) return;
    const phone = window.prompt("Teléfono", item.phone || ""); if (phone === null) return;
    const password = window.prompt("Nueva contraseña (opcional)", "");
    try { await api(`/applicants/${encodeURIComponent(item.id)}`, { method: "PUT", body: JSON.stringify({ name, email, phone, password: password || "" }) }); await renderRegisteredApplicants(); } catch (error) { window.alert(error.message); }
  }
  async function deleteApplicant(id) {
    if (!window.confirm("¿Eliminar este solicitante registrado?")) return;
    try { await api(`/applicants/${encodeURIComponent(id)}`, { method: "DELETE" }); await renderRegisteredApplicants(); } catch (error) { window.alert(error.message); }
  }
  async function deleteRequest(id) {
    if (!window.confirm("¿Eliminar esta solicitud? Esta acción no se puede deshacer.")) return;
    try { await api(`/service-requests/${encodeURIComponent(id)}`, { method: "DELETE" }); await renderRequests(); } catch (error) { window.alert(error.message); }
  }
  async function renderRequests() {
    const table = $("#serviceRequestsTable");
    if (!table) return;
    const role = $("#appShell")?.dataset.role || "viewer";
    const user = window.ControlAvaluosDesktop?.getActiveUser?.() || "";
    await loadRequests(role, user);
    let visible = requests;
    const query = String($("#requestSearchInput")?.value || "").toLowerCase();
    const status = $("#requestStatusFilter")?.value || "";
    visible = visible.filter((item) => (!query || JSON.stringify(item).toLowerCase().includes(query)) && (!status || item.estado === status));
    table.innerHTML = requestRows(visible, role === "admin" || role === "auditor", true, role === "admin");
    bindRequestDetailButtons(table, visible);
    table.querySelectorAll("[data-request-status]").forEach((select) => select.addEventListener("change", async () => { const item = requests.find((request) => request.id === select.dataset.requestStatus); if (!item) return; try { await api(`/service-requests/${encodeURIComponent(item.id)}`, { method: "PUT", body: JSON.stringify({ estado: select.value }) }); await renderRequests(); } catch (error) { window.alert(error.message); } })); table.querySelectorAll("[data-delete-request]").forEach((button) => button.addEventListener("click", () => deleteRequest(button.dataset.deleteRequest)));
  }

  async function renderWelcomeRequests() {
    const panel = $("#welcomeRequestsPanel");
    const table = $("#welcomeRequestsTable");
    if (!panel || !table) return;
    const role = $("#appShell")?.dataset.role || "viewer";
    if (!["admin", "auditor", "valuador"].includes(role)) { panel.hidden = true; return; }
    const user = window.ControlAvaluosDesktop?.getActiveUser?.() || "";
    await loadRequests(role, user);
    const visible = requests;
    panel.hidden = false; table.innerHTML = requestRows(visible.slice(0, 8), false, true); bindRequestDetailButtons(table, visible.slice(0, 8));
  }

  function bind() {
    if (window.__controlSolicitudesBound) return;
    window.__controlSolicitudesBound = true;
    $("#publicRequestType")?.addEventListener("change", () => { renderDynamicFields(); fillNotaries(); });
    window.addEventListener("control-avaluos:notarias-updated", () => { if (selectedNotaryValue() || $("#requestNotaryMunicipality")) renderNotarySearch(selectedNotaryValue()); });
    $("#publicRequestForm")?.addEventListener("submit", submitPublicRequest);
    $("#applicantRegisterForm")?.addEventListener("submit", registerApplicant);
    $("#applicantLoginForm")?.addEventListener("submit", loginApplicant);
    $("#closeApplicantRequestsButton")?.addEventListener("click", () => closeDialog(applicantRequestsDialog));
    $("#cancelApplicantRequestsButton")?.addEventListener("click", () => closeDialog(applicantRequestsDialog));
    $("#newApplicantRequestButton")?.addEventListener("click", () => { closeDialog(applicantRequestsDialog); resetRequestForm(); openDialog(requestDialog); fillAdvisors(); });
    $("#openPublicRequestButton")?.addEventListener("click", () => { applicantSession = null; resetRequestForm(); openDialog(requestDialog); fillAdvisors(); });
    $("#openApplicantRegisterButton")?.addEventListener("click", () => { setMessage($("#applicantRegisterMessage"), ""); openDialog(applicantRegisterDialog); });
    $("#openApplicantLoginButton")?.addEventListener("click", () => applicantSession ? showApplicantHome() : openDialog(applicantLoginDialog));
    ["closePublicRequestButton", "cancelPublicRequestButton"].forEach((id) => $("#" + id)?.addEventListener("click", () => closeDialog(requestDialog)));
    ["closeApplicantRegisterButton", "cancelApplicantRegisterButton"].forEach((id) => $("#" + id)?.addEventListener("click", () => closeDialog(applicantRegisterDialog)));
    ["closeApplicantLoginButton", "cancelApplicantLoginButton"].forEach((id) => $("#" + id)?.addEventListener("click", () => closeDialog(applicantLoginDialog)));
    $("#newInternalRequestButton")?.addEventListener("click", () => { resetRequestForm(); openDialog(requestDialog); fillAdvisors(); });
    $("#openRequestsViewButton")?.addEventListener("click", () => $("[data-app-view=solicitudes]")?.click());
    $("#backRequestsToAvaluosButton")?.addEventListener("click", () => $("[data-app-view=avaluos]")?.click());
    $("#applicantProfileForm")?.addEventListener("submit", saveApplicantProfile);
    $("#applicantHomeNewRequestButton")?.addEventListener("click", () => { resetRequestForm(); openDialog(requestDialog); fillAdvisors(); });
    $("#applicantVisualNewRequestButton")?.addEventListener("click", () => { resetRequestForm(); openDialog(requestDialog); fillAdvisors(); });
    $("#applicantVisualProfileButton")?.addEventListener("click", openApplicantProfile);
    $("#closeApplicantProfileButton")?.addEventListener("click", () => closeDialog($("#applicantProfileDialog")));
    $("#cancelApplicantProfileButton")?.addEventListener("click", () => closeDialog($("#applicantProfileDialog")));
    $("#applicantHomeLogoutButton")?.addEventListener("click", () => { applicantSession = null; sessionStorage.removeItem("control-avaluos.applicant"); showPublicEntry(); });
    $("#requestSearchInput")?.addEventListener("input", renderRequests);
    $("#requestStatusFilter")?.addEventListener("change", renderRequests);
    window.addEventListener("control-avaluos:authenticated", () => { renderWelcomeRequests(); renderRequests(); });
    window.addEventListener("control-avaluos:users-view", renderRegisteredApplicants);
    window.addEventListener("control-avaluos:section", (event) => { if (event.detail === "solicitudes") renderRequests(); });
    $("#closeRequestDetailButton")?.addEventListener("click", () => closeDialog($("#requestDetailDialog")));
    $("#cancelRequestDetailButton")?.addEventListener("click", () => closeDialog($("#requestDetailDialog")));
    try { const storedApplicant = JSON.parse(sessionStorage.getItem("control-avaluos.applicant") || "null"); if (storedApplicant?.email) { applicantSession = storedApplicant; showApplicantHome(); } } catch { sessionStorage.removeItem("control-avaluos.applicant"); }
    fillAdvisors();
    fillNotaries();
    window.addEventListener("control-avaluos:notarias-updated", (event) => { window.__controlNotarias = event.detail || []; fillNotaries(); });
  }
  window.SolicitudesControl = { renderRequests, renderWelcomeRequests, renderApplicantRequests, open: () => { resetRequestForm(); openDialog(requestDialog); fillAdvisors(); fillNotaries(); } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind); else bind();
})();
