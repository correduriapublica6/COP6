(() => {
  const API = window.ControlAvaluosDesktop?.getApiBaseUrl?.() || "/api";
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value || "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[character]));
  const requestDialog = $("#publicRequestDialog");
  const applicantLoginDialog = $("#applicantLoginDialog");
  const applicantRegisterDialog = $("#applicantRegisterDialog");
  const applicantRequestsDialog = $("#applicantRequestsDialog");
  let requests = [];
  let requestsPage = 1;
  const REQUESTS_PAGE_SIZE = 10;
  let editingRequestId = "";
  let applicantSession = null;
  let archivosSeleccionados = [];
  let archivosExistentesEnEdicion = [];
  let applicantRefreshTimer = null;
  let applicantNotificationTimer = null;
  let applicantRequestsCache = [];
  let applicantRequestsPage = 1;
  const APPLICANT_REQUESTS_PAGE_SIZE = 5;
  let applicantNotifications = [];
  let applicantHighlightRequestId = "";
  const APPLICANT_APP_VERSION_KEY = "app_version";
  const REQUEST_DRAFT_KEY = "control-avaluos.public-request-draft.v1";
  let requestDraftTimer = null;

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
        const isFormData = typeof FormData !== "undefined" && requestOptions.body instanceof FormData;
        const headers = { ...(isFormData ? {} : { "Content-Type": "application/json" }), ...(activeInternalUser ? { "X-User-Name": encodeURIComponent(activeInternalUser) } : {}), ...(applicantSession?.email ? { "X-Applicant-Email": applicantSession.email } : {}), ...(applicantSession?.id ? { "X-Applicant-Id": applicantSession.id } : {}), ...(requestOptions.headers || {}) };
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

  let requestStep = 1;
  function refreshRequestIcons() { window.lucide?.createIcons?.(); }
  function showRequestStep(step) {
    requestStep = Math.max(1, Math.min(5, Number(step) || 1));
    document.querySelectorAll("#publicRequestForm .step-content").forEach((panel, index) => { panel.classList.toggle("hidden", index + 1 !== requestStep); });
    document.querySelectorAll("#publicRequestForm .step-tab").forEach((tab, index) => {
      const active = index + 1 === requestStep;
      tab.querySelector("[id^=step-icon-]")?.classList.toggle("bg-brand-600", active);
      tab.querySelector("[id^=step-icon-]")?.classList.toggle("text-white", active);
      tab.querySelector("[id^=step-icon-]")?.classList.toggle("bg-slate-200", !active);
      tab.querySelector("[id^=step-icon-]")?.classList.toggle("text-slate-600", !active);
    });
    const previous = $("#btn-prev");
    const next = $("#btn-next");
    const submit = $("#publicRequestSubmit");
    if (previous) { previous.hidden = requestStep === 1; previous.classList.toggle("opacity-0", requestStep === 1); previous.classList.toggle("pointer-events-none", requestStep === 1); }
    if (next) next.hidden = requestStep === 5;
    if (submit) submit.classList.toggle("hidden", requestStep !== 5);
    updateSummary?.();
    refreshRequestIcons();
  }
  const requestCategoryStyles = {
    inmuebles: ["border-blue-500", "bg-blue-50", "text-blue-700"],
    vehiculos: ["border-emerald-500", "bg-emerald-50", "text-emerald-700"],
    maquinaria: ["border-amber-500", "bg-amber-50", "text-amber-700"],
    mobiliario: ["border-violet-500", "bg-violet-50", "text-violet-700"],
    intangibles: ["border-rose-500", "bg-rose-50", "text-rose-700"]
  };
  const requestCategoryValues = {
    inmuebles: "Inmuebles",
    vehiculos: "Vehículo Automotriz",
    maquinaria: "Maquinaria y equipo",
    mobiliario: "Mobiliario y Bienes Diversos",
    intangibles: "Intangibles"
  };
  function selectCategory(category) {
    const key = String(category || "").toLowerCase();
    const selected = requestCategoryValues[key] ? key : Object.keys(requestCategoryValues).find((candidate) => requestCategoryValues[candidate] === category);
    if (!selected) return;
    const typeField = $("#publicRequestType");
    if (typeField) typeField.value = requestCategoryValues[selected];
    const allColors = Object.values(requestCategoryStyles).flat();
    document.querySelectorAll("#publicRequestForm [data-request-category]").forEach((button) => {
      button.classList.remove(...allColors, "border-slate-200", "bg-white", "text-slate-800");
      if (button.dataset.requestCategory === requestCategoryValues[selected]) button.classList.add(...requestCategoryStyles[selected]);
      else button.classList.add("border-slate-200", "bg-white", "text-slate-800");
    });
    renderDynamicFields();
    document.querySelectorAll("#publicRequestForm [data-request-category]").forEach((button) => {
      const active = button.dataset.requestCategory === requestCategoryValues[selected];
      button.querySelector("[data-lucide]")?.classList.toggle("text-white", active);
      button.querySelector("[data-lucide]")?.classList.toggle("text-slate-500", !active);
    });
    fillNotaries();
    updateSummary?.();
  }
  function requestStepValid(step) {
    const form = $("#publicRequestForm");
    if (step === 1) return requireFields(form, ["nombre", "telefono"]);
    if (step === 2) return requireFields(form, ["tipoBien"]);
    return true;
  }
  function renderSelectedFiles() {
    const list = $("#publicRequestAttachmentsList");
    if (!list) return;
    list.innerHTML = archivosSeleccionados.length ? `<ul>${archivosSeleccionados.map((file, index) => `<li><span title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span><small>${Math.max(1, Math.round(file.size / 1024))} KB</small><button type="button" data-remove-request-file="${index}" aria-label="Quitar ${escapeHtml(file.name)}">Quitar</button></li>`).join("")}</ul>` : "";
    list.querySelectorAll("[data-remove-request-file]").forEach((button) => button?.addEventListener("click", () => {
      archivosSeleccionados.splice(Number(button.dataset.removeRequestFile), 1);
      renderSelectedFiles();
    }));
  }
  function addSelectedFiles(fileList) {
    Array.from(fileList || []).forEach((file) => {
      if (!(file instanceof File)) return;
      const duplicate = archivosSeleccionados.some((saved) => saved.name === file.name && saved.size === file.size && saved.lastModified === file.lastModified);
      if (!duplicate && archivosSeleccionados.length < 8) archivosSeleccionados.push(file);
    });
    const input = $("#publicRequestAttachments");
    if (input) input.value = "";
    renderSelectedFiles();
    updateSummary?.();
  }
  async function readFiles(files) {
    const selectedFiles = Array.from(files || []);
    if (!selectedFiles.length) return [];
    return (await window.ControlAvaluosImageUtils?.uploadFiles(selectedFiles, { maxFiles: 8 })) || [];
  }

  function valuadores() {
    const users = window.ControlAvaluosDesktop?.allUsers?.() || [];
    const remote = window.__controlRemoteUsers || [];
    const names = [...new Set([...users, ...remote.filter((user) => user.role === "valuador").map((user) => user.name)])].filter((name) => /Ivan|Juan|Gabriel|Cesar|Diana|Caridad|Francisco|Emmanuel/i.test(name)); return names.sort((a, b) => { const priority = (name) => /juan manuel barrera mart[ií]nez/i.test(name) ? 0 : 1; return priority(a) - priority(b) || a.localeCompare(b, "es"); });
  }

  async function fillAdvisors() {
    const select = $("#publicRequestAdvisor");
    if (!select) return;
    let names = valuadores();
    try { const state = await api("/state"); window.__controlRemoteUsers = state.users || []; names = [...new Set((state.users || []).filter((user) => user.role === "valuador").map((user) => user.name).concat(names))].sort((a, b) => (/juan manuel barrera mart[ií]nez/i.test(a) ? 0 : 1) - (/juan manuel barrera mart[ií]nez/i.test(b) ? 0 : 1) || a.localeCompare(b, "es")); } catch {}
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
      results.querySelectorAll("[data-notary-value]").forEach((button) => button?.addEventListener("click", () => { hidden.value = button.dataset.notaryValue || ""; const item = (Array.isArray(window.__controlNotarias) ? window.__controlNotarias : []).find((candidate) => `${candidate.numero} · ${candidate.municipio} · ${candidate.nombre}` === hidden.value); if (item) { municipality.value = item.municipio; query.value = `${item.numero} · ${item.nombre}`; } results.querySelectorAll(".notary-search-result").forEach((candidate) => candidate.classList.toggle("is-selected", candidate === button)); }));
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
    const type = String($("#publicRequestType")?.value || "");
    const keyByType = { "Inmuebles": "inmuebles", "Vehículo Automotriz": "vehiculos", "Automotriz": "vehiculos", "Maquinaria y equipo": "maquinaria", "Mobiliario y Bienes Diversos": "mobiliario", "Intangibles": "intangibles" };
    const selected = keyByType[type] || "";
    document.querySelectorAll("#publicRequestForm .cat-specific-block").forEach((block) => {
      const active = block.id === `cat-fields-${selected}`;
      block.classList.toggle("hidden", !active);
      block.querySelectorAll("input, select, textarea").forEach((field) => { field.required = active; });
    });
    $("#valor-operacion-container")?.classList.toggle("hidden", selected !== "inmuebles");
  }

  function renderInmuebleModeFields() {
    const mode = $("#requestInmuebleMode")?.value;
    const target = $("#requestInmuebleModeFields");
    if (!target) return;
    target.innerHTML = mode === "Referido" ? `<div class="notary-search-field"><label>Municipio *<select id="requestNotaryMunicipality" required><option value="">Selecciona un municipio</option></select></label><label>Buscar número o nombre de notaría *<input id="requestNotarySearch" type="search" autocomplete="off" placeholder="Ej. 14 o Emilio Darwi" required /></label><input type="hidden" id="requestNotaryValue" name="notariaReferida" /><div id="requestNotaryResults" class="notary-search-results" role="listbox"></div><p class="field-help">Primero selecciona el municipio; después escribe el número o una parte del nombre.</p></div>` : mode === "Otro" ? `<label>Describe la modalidad<input name="otraModalidad" required /></label>` : "";
    if (mode === "Referido") { fillNotaries().then(() => renderNotarySearch()); }
  }

  function ensureRequestFieldNames() {
    const names = { solicitante_nombre: "nombre", solicitante_telefono: "telefono", solicitante_correo: "correo", valuador_asignado: "asesor", tipo_avaluo: "tipoAvaluo", inmueble_subtipo: "subtipoBien", inmueble_enajenantes: "numeroEnajenantes", inmueble_propietario: "propietario", vehiculo_marca: "marcaVehiculo", vehiculo_modelo: "modeloVehiculo", vehiculo_km: "kilometraje", maquinaria_tipo: "tipoMaquinaria", maquinaria_serie: "serieMaquinaria", mobiliario_tipo: "tipoMobiliario", mobiliario_estado: "estadoMobiliario", intangible_tipo: "tipoIntangible", intangible_registro: "registroIntangible", descripcion_bien: "descripcion", valor_operacion: "valorOperacion", contacto_visita: "contactoVisitaNombre", telefono_visita: "contactoVisitaTelefono", direccion_visita: "direccionVisita", observaciones_solicitud: "observaciones" };
    const form = $("#publicRequestForm");
    Object.entries(names).forEach(([id, name]) => { const field = form?.querySelector(`#${id}`); if (field && !field.name) field.name = name; });
  }
  function textValue(id, fallback = "-") { return String($("#" + id)?.value || "").trim() || fallback; }
  function updateSummary() {
    ensureRequestFieldNames();
    const values = { solicitante: textValue("solicitante_nombre"), telefono: textValue("solicitante_telefono"), correo: textValue("solicitante_correo"), valuador: textValue("valuador_asignado"), tipo: textValue("publicRequestType"), tipoAvaluo: textValue("tipo_avaluo"), subtipo: textValue("inmueble_subtipo"), propietario: textValue("inmueble_propietario"), contacto: textValue("contacto_visita"), telefonoVisita: textValue("telefono_visita"), direccion: textValue("direccion_visita"), descripcion: textValue("descripcion_bien"), observaciones: textValue("observaciones_solicitud"), archivos: String(archivosSeleccionados.length) };
    const set = (id, value) => { const node = $("#" + id); if (node) node.textContent = value; };
    set("sum-solicitante", values.solicitante); set("sum-telefono", values.telefono); set("sum-correo", values.correo); set("sum-valuador", values.valuador); set("sum-categoria", values.tipo); set("sum-tipo-avaluo", values.tipoAvaluo); set("sum-contacto-visita", values.contacto); set("sum-telefono-visita", values.telefonoVisita); set("sum-direccion", values.direccion); set("sum-descripcion", values.descripcion); set("sum-archivos", `${values.archivos} archivo(s)`); set("sum-observaciones", values.observaciones);
    const inmueble = values.tipo === "Inmuebles"; $("#sum-inmueble-enajenantes-row")?.classList.toggle("hidden", !inmueble); $("#sum-inmueble-propietario-row")?.classList.toggle("hidden", !inmueble); set("sum-inmueble-enajenantes", textValue("inmueble_enajenantes")); set("sum-inmueble-propietario", values.propietario); set("sum-valor-num", textValue("valor_operacion", "$0.00") + " MXN");
  }
  window.updateSummary = updateSummary;
  window.formatTitleCase = (input) => { if (input?.value) input.value = input.value.replace(/\s+/g, " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()); updateSummary(); };
  function openDialog(dialog) { if (dialog?.showModal) dialog.showModal(); }
  function closeDialog(dialog) { if (dialog?.open) dialog.close(); }
  function formObject(form) { return Object.fromEntries(new FormData(form).entries()); }
  function setMessage(element, text, tone = "error") { if (!element) return; element.textContent = text; element.dataset.tone = tone; element.hidden = !text; }
  function setBusy(form, busy, label) { const button = form?.querySelector('button[type="submit"]'); if (!button) return; if (!button.dataset.defaultLabel) button.dataset.defaultLabel = button.textContent; button.disabled = busy; button.textContent = busy ? label : button.dataset.defaultLabel; }
  function requireFields(form, names) { const missing = names.find((name) => { const field = name === "tipoBien" ? form.querySelector("#publicRequestType") : form.elements[name]; return !String(field?.value || "").trim(); }); if (missing) { const field = missing === "tipoBien" ? form.querySelector("#publicRequestType") : form.elements[missing]; field?.focus(); return false; } return true; }
  function getRequestForm() { return $("#publicRequestForm"); }
  function saveRequestDraft() {
    const form = getRequestForm();
    if (!form || editingRequestId) return;
    try {
      const values = Object.fromEntries(new FormData(form).entries());
      delete values.archivos;
      localStorage.setItem(REQUEST_DRAFT_KEY, JSON.stringify({ values, savedAt: new Date().toISOString() }));
    } catch {}
  }
  function scheduleRequestDraftSave() {
    window.clearTimeout(requestDraftTimer);
    requestDraftTimer = window.setTimeout(saveRequestDraft, 250);
  }
  function restoreRequestDraft() {
    const form = getRequestForm();
    if (!form || editingRequestId) return;
    try {
      const draft = JSON.parse(localStorage.getItem(REQUEST_DRAFT_KEY) || "null");
      const values = draft?.values;
      if (!values || typeof values !== "object") return;
      Object.entries(values).forEach(([name, value]) => {
        const field = form.elements[name];
        if (field && typeof value === "string" && !field.readOnly) field.value = value;
      });
      if (form.elements.tipoAvaluo?.value) renderDynamicFields();
      Object.entries(values).forEach(([name, value]) => {
        const field = form.elements[name];
        if (field && typeof value === "string" && !field.readOnly) field.value = value;
      });
      if (form.elements.tipoAvaluo?.value) fillNotaries();
      setMessage($("#publicRequestMessage"), "Se restauró el borrador guardado localmente. Revisa los datos antes de enviar.", "success");
    } catch {}
  }
  function clearRequestDraft() {
    window.clearTimeout(requestDraftTimer);
    try { localStorage.removeItem(REQUEST_DRAFT_KEY); } catch {}
  }
  function resetRequestForm() {
    const form = getRequestForm();
    if (!form) return;
    ensureRequestFieldNames();
    form.reset();
    archivosSeleccionados = [];
    archivosExistentesEnEdicion = [];
    renderSelectedFiles();
    document.querySelectorAll("#publicRequestForm .cat-specific-block").forEach((block) => { block.classList.add("hidden"); block.querySelectorAll("input, select, textarea").forEach((field) => { field.required = false; }); });
    $("#valor-operacion-container")?.classList.add("hidden");
    document.querySelectorAll("#publicRequestForm [data-request-category]").forEach((button) => { button.className = "category-btn border-2 border-slate-200 bg-white rounded-2xl p-3 flex flex-col items-center justify-center gap-2 text-center transition"; button.querySelector("[data-lucide]")?.classList.remove("text-white"); button.querySelector("[data-lucide]")?.classList.add("text-slate-500"); });
    updateSummary();
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
  function requestStatusClass(status) { return String(status || "recibida").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-"); }
  function requestDate(value) { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "Sin fecha"; }
  function applicantRequestStatusGroup(status) {
    const normalized = String(status || "recibida").toLowerCase();
    if (normalized === "concluida") return "concluida";
    if (["recibida", "recibido"].includes(normalized)) return "recibida";
    return "proceso";
  }
  function applicantRequestOwner(item) {
    return item.propietario || item.datosEspecificos?.propietario || item.datosEspecificos?.razonSocial || item.solicitante?.nombre || "No especificado";
  }
  function applicantRequestAssetType(item) {
    return item.tipoBien || item.datosEspecificos?.tipoBien || item.datosEspecificos?.tipoBienSolicitado || item.modalidad || item.datosEspecificos?.modalidadInmueble || "No especificado";
  }
  function applicantRequestAppraisalType(item) {
    return item.modalidad || item.datosEspecificos?.modalidadInmueble || item.datosEspecificos?.tipoAvaluo || item.tipoAvaluo || "No especificado";
  }
  function applicantPdfUrl(item) {
    return apiResourceUrl(item.finalPdfUrl || item.pdfUrl || item.archivoFinal?.url || "");
  }
  function applicantRequestStatusGroup(status) {
    const normalized = String(status || "recibida").toLowerCase();
    if (normalized === "concluida") return "concluida";
    if (["recibida", "recibido"].includes(normalized)) return "recibida";
    return "proceso";
  }
  function applicantRequestOwner(item) { return item.propietario || item.datosEspecificos?.propietario || item.datosEspecificos?.razonSocial || item.solicitante?.nombre || "No especificado"; }
  function applicantRequestAssetType(item) { return item.tipoBien || item.datosEspecificos?.tipoBien || item.datosEspecificos?.tipoBienSolicitado || item.modalidad || item.datosEspecificos?.modalidadInmueble || "No especificado"; }
  function applicantRequestAppraisalType(item) { return item.modalidad || item.datosEspecificos?.modalidadInmueble || item.datosEspecificos?.tipoAvaluo || item.tipoAvaluo || "No especificado"; }
  function applicantPdfUrl(item) { return apiResourceUrl(item.finalPdfUrl || item.pdfUrl || item.archivoFinal?.url || ""); }
  function renderApplicantNotifications() {
    const list = $("#applicantNotificationsList");
    const count = $("#applicantNotificationsCount");
    if (!list) return;
    const unread = applicantNotifications.filter((item) => !item.leida).length;
    if (count) { count.textContent = String(unread); count.hidden = unread < 1; }
    list.innerHTML = applicantNotifications.length ? applicantNotifications.slice(0, 50).map((item) => `<button type="button" class="applicant-notification-item${item.leida ? " is-read" : ""}" data-applicant-notification-id="${escapeHtml(item.id)}"><span class="applicant-notification-icon">${item.tipo === "cambio_estatus" ? "↻" : item.tipo === "actualizacion" ? "↻" : "✓"}</span><span><strong>${escapeHtml(item.titulo)}</strong><small>${escapeHtml(item.mensaje)}<br />${escapeHtml(requestDate(item.created_at))}</small></span></button>`).join("") : "<p>No hay notificaciones.</p>";
    list.querySelectorAll("[data-applicant-notification-id]").forEach((button) => button?.addEventListener("click", async () => {
      const item = applicantNotifications.find((candidate) => candidate.id === button.dataset.applicantNotificationId);
      if (!item) return;
      try {
        await api(`/notifications/${encodeURIComponent(item.id)}/read`, { method: "PUT" });
        item.leida = true;
        renderApplicantNotifications();
        if (item.url_destino === "app://refresh") { const version = item.mensaje.match(/app_version:([^\)]+)/)?.[1] || ""; if (version) localStorage.setItem(APPLICANT_APP_VERSION_KEY, version); const url = new URL(window.location.href); url.searchParams.set("v", version || String(Date.now())); window.location.replace(url.toString()); return; }
        if (item.tipo === "cambio_estatus" && item.url_destino?.startsWith("solicitud:")) {
          applicantHighlightRequestId = item.url_destino.slice("solicitud:".length);
          $("#applicantNotificationsPanel").hidden = true;
          $("#applicantNotificationsButton")?.setAttribute("aria-expanded", "false");
          filterApplicantRequests();
          window.setTimeout(() => { const row = document.querySelector(`[data-applicant-request-row="${CSS.escape(applicantHighlightRequestId)}"]`); row?.scrollIntoView({ behavior: "smooth", block: "center" }); }, 80);
        }
      } catch (error) { window.alert(error.message || "No fue posible marcar la notificación."); }
    }));
  }
  function showApplicantVersionUpdatePopup(serverVersion) {
    const dialog = $("#versionUpdateDialog");
    const reloadButton = $("#versionUpdateReloadButton");
    if (!dialog || !serverVersion) return;
    dialog.dataset.version = serverVersion;
    if (reloadButton && reloadButton.dataset.applicantVersionBound !== "true") {
      reloadButton.dataset.applicantVersionBound = "true";
      reloadButton.addEventListener("click", () => {
        const version = dialog.dataset.version || serverVersion;
        localStorage.setItem(APPLICANT_APP_VERSION_KEY, version);
        const url = new URL(window.location.href);
        url.searchParams.set("v", version);
        window.location.replace(url.toString());
      });
    }
    if (!dialog.open) dialog.showModal?.();
  }
  async function refreshApplicantNotifications() {
    if (!applicantSession) return;
    try {
      const clientVersion = localStorage.getItem(APPLICANT_APP_VERSION_KEY) || "";
      const serverVersion = await api("/version");
      const currentVersion = String(serverVersion?.version || "").trim();
      if (currentVersion && !clientVersion) localStorage.setItem(APPLICANT_APP_VERSION_KEY, currentVersion);
      if (currentVersion && clientVersion && clientVersion !== currentVersion) {
        await api("/notifications/system-version", { method: "POST", body: JSON.stringify({ clientVersion }) });
        showApplicantVersionUpdatePopup(currentVersion);
      }
      applicantNotifications = await api("/notifications");
      renderApplicantNotifications();
    } catch { /* Se conserva el contador anterior durante una caída momentánea. */ }
  }
  function applicantOwnRequestsTable(list) {
    if (!list.length) return `<div class="client-empty-state"><div class="client-empty-icon">＋</div><h4>Aún no tienes solicitudes</h4><p>Inicia tu primer trámite y consulta aquí todo su avance.</p><button type="button" class="client-primary-button btn-copu-primary btn-gold-cream" id="clientEmptyNewRequest">Solicitar un servicio</button></div>`;
    return `<div class="client-request-table-wrap"><table class="client-request-table"><thead><tr><th>Folio</th><th>Tipo de bien</th><th>Tipo de avalúo</th><th>Propietario</th><th>Estatus</th><th>Detalles</th><th>PDF</th></tr></thead><tbody>${list.map((item) => { const group=applicantRequestStatusGroup(item.estado); const pdf=applicantPdfUrl(item); const pdfAction=pdf ? `<a class="client-pdf-link" href="${escapeHtml(pdf)}" target="_blank" rel="noopener" download>⇩</a>` : `<span class="client-pdf-disabled" title="Avalúo en proceso">En proceso</span>`; return `<tr data-applicant-request-row="${escapeHtml(item.id)}" class="${applicantHighlightRequestId === item.id ? "is-notification-highlight" : ""}"><td><strong>${escapeHtml(item.folio || "Pendiente")}</strong></td><td>${escapeHtml(applicantRequestAssetType(item))}</td><td>${escapeHtml(applicantRequestAppraisalType(item))}</td><td>${escapeHtml(applicantRequestOwner(item))}</td><td><span class="client-status-badge client-status-${requestStatusClass(item.estado)}">${escapeHtml(item.estado || "Recibida")}</span></td><td><button type="button" class="client-table-view-button" data-request-detail="${escapeHtml(item.id)}">Detalles</button></td><td class="client-pdf-cell">${pdfAction}</td></tr>`; }).join("")}</tbody></table></div>`;
  }
  function applicantRequestsPagination(page, total) {
    const pages = Math.max(1, Math.ceil(total / APPLICANT_REQUESTS_PAGE_SIZE));
    const current = Math.min(Math.max(1, page), pages);
    const first = total ? (current - 1) * APPLICANT_REQUESTS_PAGE_SIZE + 1 : 0;
    const last = Math.min(current * APPLICANT_REQUESTS_PAGE_SIZE, total);
    const buttons = Array.from({ length: pages }, (_, index) => { const number = index + 1; return `<button type="button" class="table-page-button${number === current ? " is-active" : ""}" data-applicant-page="${number}" aria-current="${number === current ? "page" : "false"}">${number}</button>`; }).join("");
    return `<nav class="table-pagination applicant-table-pagination" aria-label="Paginación de mis solicitudes"><span>Mostrando ${first}-${last} de ${total}</span><div><button type="button" class="table-page-button" data-applicant-page="${current - 1}" ${current === 1 ? "disabled" : ""} aria-label="Página anterior">‹</button>${buttons}<button type="button" class="table-page-button" data-applicant-page="${current + 1}" ${current === pages ? "disabled" : ""} aria-label="Página siguiente">›</button></div></nav>`;
  }
  function filterApplicantRequests(resetPage = false) {
    if (resetPage) applicantRequestsPage = 1;
    const query=String($("#applicantRequestSearchInput")?.value || "").trim().toLowerCase(); const status=$("#applicantRequestStatusFilter")?.value || "";
    const visible=applicantRequestsCache.filter((item) => { const owner=applicantRequestOwner(item).toLowerCase(); const folio=String(item.folio || "").toLowerCase(); const asset=applicantRequestAssetType(item).toLowerCase(); const appraisal=applicantRequestAppraisalType(item).toLowerCase(); return (!query || folio.includes(query) || owner.includes(query) || asset.includes(query) || appraisal.includes(query)) && (!status || applicantRequestStatusGroup(item.estado) === status); });
    const pages = Math.max(1, Math.ceil(visible.length / APPLICANT_REQUESTS_PAGE_SIZE));
    applicantRequestsPage = Math.min(Math.max(1, applicantRequestsPage), pages);
    const pageItems = visible.slice((applicantRequestsPage - 1) * APPLICANT_REQUESTS_PAGE_SIZE, applicantRequestsPage * APPLICANT_REQUESTS_PAGE_SIZE);
    const table=$("#applicantHomeRequestsTable"); if (!table) return; table.innerHTML=applicantOwnRequestsTable(pageItems) + applicantRequestsPagination(applicantRequestsPage, visible.length); bindRequestDetailButtons(table, pageItems); table.querySelector("#clientEmptyNewRequest")?.addEventListener("click", () => { resetRequestForm(); openDialog(requestDialog); fillAdvisors(); });
    table.querySelectorAll("[data-applicant-page]").forEach((button) => button?.addEventListener("click", () => { if (button.disabled) return; applicantRequestsPage = Number(button.dataset.applicantPage) || 1; filterApplicantRequests(); }));
  }

  function showApplicantHome() {
    const content = $(".public-entry-content");
    const home = $("#applicantHomePanel");
    if (!content || !home || !applicantSession) return;
    const requestsTable = $("#applicantHomeRequestsTable");
    if (requestsTable && !requestsTable.dataset.loaded) requestsTable.innerHTML = '<div class="client-loading-state" role="status"><span class="client-loading-spinner" aria-hidden="true"></span><span>Cargando tus solicitudes…</span></div>';
    content.hidden = true;
    home.hidden = false;
    $("#loginScreen")?.classList.add("applicant-dashboard-active");
    if (!applicantRefreshTimer) applicantRefreshTimer = window.setInterval(() => renderApplicantHomeRequests(), 2500);
    if (!applicantNotificationTimer) applicantNotificationTimer = window.setInterval(() => refreshApplicantNotifications(), 5 * 60 * 1000);
    $("#loginVisualBrand")?.setAttribute("hidden", "true");
    $("#applicantVisualPanel")?.setAttribute("hidden", "true");
    $("#openInternalAccessButton")?.setAttribute("hidden", "true");
    const applicantName = String(applicantSession.name || applicantSession.nombre || "—").trim() || "—";
    const applicantEmail = String(applicantSession.email || applicantSession.correo || "—").trim() || "—";
    const applicantPhone = String(applicantSession.phone || applicantSession.telefono || "—").trim() || "—";
    $("#applicantWelcomeName") && ($("#applicantWelcomeName").textContent = applicantName);
    $("#applicantWelcomeNameMessage") && ($("#applicantWelcomeNameMessage").textContent = applicantName);
    $("#applicantWelcomeNameMirror") && ($("#applicantWelcomeNameMirror").textContent = applicantName);
    $("#applicantProfileEmail") && ($("#applicantProfileEmail").textContent = applicantEmail);
    $("#applicantProfilePhone") && ($("#applicantProfilePhone").textContent = applicantPhone);
    $("#publicRequestForm")?.elements.correo && ($("#publicRequestForm").elements.correo.readOnly = true);
    renderApplicantHomeRequests();
    refreshApplicantNotifications();
  }
  function showPublicEntry() {
    const content = $(".public-entry-content");
    const home = $("#applicantHomePanel");
    if (content) content.hidden = false;
    if (home) home.hidden = true;
    if (applicantRefreshTimer) { window.clearInterval(applicantRefreshTimer); applicantRefreshTimer = null; }
    if (applicantNotificationTimer) { window.clearInterval(applicantNotificationTimer); applicantNotificationTimer = null; }
    applicantNotifications = [];
    renderApplicantNotifications();
    $("#loginScreen")?.classList.remove("applicant-dashboard-active");
    $("#loginVisualBrand")?.removeAttribute("hidden");
    $("#applicantVisualPanel")?.setAttribute("hidden", "true");
    $("#openInternalAccessButton")?.removeAttribute("hidden");
    resetRequestForm();
  }
  async function renderApplicantHomeRequests() {
    const table = $("#applicantHomeRequestsTable");
    if (!table || !applicantSession) return;
    try {
      const own = await api(`/mis-solicitudes?email=${encodeURIComponent(applicantSession.email)}&usuario_id=${encodeURIComponent(applicantSession.id || "")}`);
      applicantRequestsCache = own;
      applicantRequestsPage = Math.min(applicantRequestsPage, Math.max(1, Math.ceil(own.length / APPLICANT_REQUESTS_PAGE_SIZE)));
      table.dataset.loaded = "true";
      if ($("#applicantTotalRequests")) $("#applicantTotalRequests").textContent = own.length;
      if ($("#applicantActiveRequests")) $("#applicantActiveRequests").textContent = own.filter((item) => !["concluida", "cancelada"].includes(String(item.estado || "").toLowerCase())).length;
      if ($("#applicantCompletedRequests")) $("#applicantCompletedRequests").textContent = own.filter((item) => String(item.estado || "").toLowerCase() === "concluida").length;
      filterApplicantRequests();
    } catch (error) { table.innerHTML = `<p class="request-empty">${escapeHtml(error.message)}</p>`; }
  }
  function apiResourceUrl(source) {
    const value = String(source || "");
    if (!value || value.startsWith("data:") || /^https?:\/\//i.test(value)) return value;
    if (value.startsWith("/")) return `${API.replace(/\/api\/?$/, "")}${value}`;
    return `${API.replace(/\/$/, "")}/${value}`;
  }
  function safeFileData(file) {
    const data = String(file?.data || "");
    const lower = data.toLowerCase();
    const allowed = lower.startsWith("data:image/") || lower.startsWith("data:application/pdf") || lower.startsWith("data:application/msword") || lower.startsWith("data:application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    return allowed ? data : "";
  }
  function requestFileUrl(item, index, download = false) {
    const file = Array.isArray(item.archivos) ? item.archivos[index] : null;
    const suffix = download ? (file?.url?.includes("?") ? "&download=1" : "?download=1") : "";
    return file?.url ? `${apiResourceUrl(file.url)}${suffix}` : `${API}/service-requests/${encodeURIComponent(item.id)}/files/${index}${download ? "?download=1" : ""}`;
  }
  async function uploadFinalPdf(item) {
    if (!item?.id) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,.pdf";
    input?.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append("pdf", file, file.name);
      try {
        const result = await api(`/admin/solicitudes/${encodeURIComponent(item.id)}/subir-pdf-final`, { method: "POST", body: formData });
        const updated = result.solicitud || { ...item, estado: "concluida", finalPdfUrl: result.archivoFinal?.url || "" };
        requests = requests.map((request) => request.id === updated.id ? updated : request);
        await renderRequests();
        renderRequestDetail(updated);
        window.alert("Avalúo final cargado. El trámite quedó como concluido y ya está disponible para el cliente.");
      } catch (error) { window.alert(error.message || "No fue posible subir el avalúo final."); }
    });
    input.click();
  }
  async function annexDocuments(item) {
    if (!item?.id) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,.pdf,.doc,.docx";
    input.multiple = true;
    input?.addEventListener("change", async () => {
      const selected = Array.from(input.files || []);
      if (!selected.length) return;
      const formData = new FormData();
      selected.slice(0, 8).forEach((file) => formData.append("documentos", file, file.name));
      try {
        const result = await api(`/solicitudes/${encodeURIComponent(item.id)}/anexar-documento`, { method: "POST", body: formData });
        const updated = result.solicitud || { ...item, archivos: [...(item.archivos || []), ...(result.archivos || [])] };
        await renderApplicantHomeRequests();
        renderRequestDetail(updated);
        window.alert("Documento(s) anexado(s) correctamente al expediente.");
      } catch (error) { window.alert(error.message || "No fue posible anexar el documento."); }
    });
    input.click();
  }
  function openResourceViewer(resourceUrl, resourceName = "Archivo", resourceType = "application/pdf", downloadUrl = resourceUrl) {
    const viewer = $("#fileViewerDialog");
    const content = $("#fileViewerContent");
    const source = apiResourceUrl(resourceUrl);
    if (!viewer || !content || !source) { window.alert("El archivo no está disponible para visualizar."); return; }
    const name = escapeHtml(resourceName);
    const type = String(resourceType || "").toLowerCase();
    const media = type.startsWith("image/")
      ? `<img class="file-viewer-image" src="${escapeHtml(source)}" alt="${name}" />`
      : type === "application/pdf" || /\.pdf$/i.test(resourceName)
        ? `<iframe class="file-viewer-frame" title="${name}" src="${escapeHtml(source)}"></iframe>`
        : `<div class="file-viewer-unavailable"><strong>${name}</strong><p>Este formato no tiene vista previa. Puedes descargarlo desde el expediente.</p></div>`;
    content.innerHTML = `<div class="file-viewer-heading"><strong>${name}</strong><a class="file-viewer-download" href="${escapeHtml(apiResourceUrl(downloadUrl))}" download>Descargar</a></div>${media}`;
    openDialog(viewer);
  }
  function openFileViewer(item, index) {
    const file = Array.isArray(item?.archivos) ? item.archivos[index] : null;
    if (!file) return;
    openResourceViewer(file.url || safeFileData(file), file.name || `Archivo ${index + 1}`, file.type || "", requestFileUrl(item, index, true));
  }
  async function saveRequestInfo(item, form) {
    const values = Object.fromEntries(new FormData(form).entries());
    const message = form.querySelector("[data-edit-message]");
    const button = form.querySelector("[data-save-request-info]");
    if (!values.nombre?.trim()) { if (message) { message.textContent = "El nombre es obligatorio."; message.hidden = false; } return; }
    if (button) { button.disabled = true; button.textContent = "Guardando…"; }
    try {
      const result = await api(`/service-requests/${encodeURIComponent(item.id)}`, {
        method: "PUT",
        body: JSON.stringify({
          solicitante: { nombre: values.nombre, telefono: values.telefono, correo: values.correo },
          propietario: values.propietario,
          valorOperacion: values.valorOperacion,
          tipoAvaluo: values.tipoAvaluo,
          datosEspecificos: { propietario: values.propietario, valorOperacion: values.valorOperacion, tipoAvaluo: values.tipoAvaluo }
        })
      });
      const updated = result?.solicitud || result;
      applicantRequestsCache = applicantRequestsCache.map((candidate) => candidate.id === updated.id ? updated : candidate);
      filterApplicantRequests();
      renderRequestDetail(updated);
      window.alert("Los cambios de la solicitud se guardaron correctamente.");
    } catch (error) {
      if (message) { message.textContent = error.message || "No fue posible guardar los cambios."; message.hidden = false; }
    } finally {
      if (button) { button.disabled = false; button.textContent = "Guardar cambios"; }
    }
  }
  async function bindExternalAssignment(detail, item) {
    const nameInput = detail.querySelector("[data-external-name]");
    const emailInput = detail.querySelector("[data-external-email]");
    const phoneInput = detail.querySelector("[data-external-phone]");
    const results = detail.querySelector("[data-external-results]");
    const save = detail.querySelector("[data-save-request-external]");
    if (!nameInput || !emailInput || !phoneInput || !results || !save) return;
    let applicants = [];
    let selected = item.asignadoExternoId ? { id: item.asignadoExternoId, name: item.asignadoExternoNombre || "", email: item.asignadoExternoEmail || "", phone: "" } : null;
    const renderMatches = () => {
      const query = [nameInput.value, emailInput.value, phoneInput.value].join(" ").trim().toLocaleLowerCase("es-MX");
      const matches = !query ? applicants.slice(0, 8) : applicants.filter((user) => [user.name, user.email, user.phone].join(" ").toLocaleLowerCase("es-MX").includes(query)).slice(0, 8);
      results.innerHTML = matches.length ? matches.map((user) => `<button type="button" class="request-external-result" data-external-result="${escapeHtml(user.id)}"><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email || "")} · ${escapeHtml(user.phone || "Sin teléfono")}</small></button>`).join("") : `<small class="request-external-empty">No se encontraron usuarios externos.</small>`;
      results.querySelectorAll("[data-external-result]").forEach((button) => button?.addEventListener("click", () => {
        selected = applicants.find((user) => user.id === button.dataset.externalResult) || null;
        if (selected) { nameInput.value = selected.name || ""; emailInput.value = selected.email || ""; phoneInput.value = selected.phone || ""; }
        results.innerHTML = selected ? `<small class="request-external-selected">Seleccionado: ${escapeHtml(selected.name)}</small>` : "";
      }));
    };
    try {
      applicants = await api("/applicants");
      if (selected) { nameInput.value = selected.name; emailInput.value = selected.email; phoneInput.value = selected.phone; }
      [nameInput, emailInput, phoneInput].forEach((input) => input?.addEventListener("input", () => { selected = null; renderMatches(); }));
      renderMatches();
      save?.addEventListener("click", async () => {
        if (!selected) selected = applicants.find((user) => String(user.name || "").toLocaleLowerCase("es-MX") === nameInput.value.trim().toLocaleLowerCase("es-MX") || String(user.email || "").toLowerCase() === emailInput.value.trim().toLowerCase() || String(user.phone || "").trim() === phoneInput.value.trim()) || null;
        if (!selected) { window.alert("Busca y selecciona un usuario externo antes de asignar."); return; }
        save.disabled = true;
        try { const updated = await api(`/service-requests/${encodeURIComponent(item.id)}`, { method: "PUT", body: JSON.stringify({ asignadoExternoId: selected.id, asignadoExternoEmail: selected.email || "", asignadoExternoNombre: selected.name || "" }) }); requests = requests.map((candidate) => candidate.id === item.id ? updated : candidate); renderRequestDetail(updated); window.dispatchEvent(new CustomEvent("control-avaluos:request-updated", { detail: updated })); } catch (error) { window.alert(error.message || "No se pudo asignar el usuario externo."); } finally { save.disabled = false; }
      });
    } catch { results.innerHTML = `<small class="request-external-empty">No se pudieron cargar los usuarios externos.</small>`; save.disabled = true; }
  }
  function renderRequestDetail(item) {
    const detail = $("#requestDetailContent");
    const dialog = $("#requestDetailDialog");
    if (!detail || !dialog || !item) return;

    dialog.classList.add("cp6-request-detail-dialog");
    const files = Array.isArray(item.archivos) ? item.archivos : [];
    const specific = item.datosEspecificos && typeof item.datosEspecificos === "object" ? item.datosEspecificos : {};
    const currentApplicant = item.solicitante && typeof item.solicitante === "object" ? item.solicitante : {};
    const activeRole = $("#appShell")?.dataset.role || "";
    const canManage = !applicantSession && ["admin", "auditor", "valuador"].includes(activeRole);
    const isAdmin = !applicantSession && activeRole === "admin";
    const readValue = (value, fallback = "N/D") => escapeHtml(value === undefined || value === null || value === "" ? fallback : String(value));
    const creatorName = item.creadoPorNombre || item.creadoPor || currentApplicant.nombre || "Usuario externo";
    const creatorRole = item.creadorRol ? ({ admin: "Administrador", auditor: "Auditor", valuador: "Valuador", editor: "Editor", viewer: "Solo lectura" }[item.creadorRol] || item.creadorRol) : "";
    const externalName = item.asignadoExternoNombre || "";
    const appraisalNumber = String(item.numeroAvaluo || "").replace(/\D/g, "").slice(0, 4);
    const finalPdf = apiResourceUrl(item.finalPdfUrl || item.pdfUrl || item.archivoFinal?.url || "");
    const visitContact = item.contactoVisita && typeof item.contactoVisita === "object" ? item.contactoVisita : {};

    const filesMarkup = files.length ? files.map((file, index) => {
      const name = escapeHtml(file.name || `Archivo ${index + 1}`);
      const source = apiResourceUrl(file.url || safeFileData(file));
      if (!source) return `<div class="cp6-file-card cp6-file-unavailable"><span>${name}</span></div>`;
      const isPdf = /\.pdf$/i.test(file.name || "") || String(file.type || "").toLowerCase() === "application/pdf";
      const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name || "") || String(file.type || "").startsWith("image/");
      const iconClass = isPdf ? "fa-file-pdf text-red-600 bg-red-50" : (isImage ? "fa-file-image text-amber-600 bg-amber-50" : "fa-file-lines text-blue-600 bg-blue-50");
      const preview = `<div class="cp6-file-icon w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${iconClass}" aria-hidden="true"><i class="fa-solid ${iconClass.split(" ")[0]}"></i></div>`;
      return `<div class="cp6-file-card cp6-file-document bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between hover:shadow-sm transition min-w-0">
        <div class="flex items-center gap-2.5 overflow-hidden min-w-0"><button type="button" class="cp6-file-preview flex-shrink-0" data-view-file="${index}" aria-label="Ver ${name}">${preview}</button><div class="truncate"><span class="text-xs font-bold text-slate-800 truncate block" title="${name}">${name}</span><span class="text-[10px] text-slate-400 block">${escapeHtml(file.size || "1.2 MB")}</span></div></div>
        <div class="flex items-center gap-1"><button type="button" class="cp6-detail-button p-1.5 text-slate-400 hover:text-blue-600 rounded-lg flex-shrink-0" data-view-file="${index}" aria-label="Ver archivo"><i class="fa-solid fa-eye text-xs"></i></button>${isAdmin ? `<button type="button" class="cp6-file-delete p-1.5 text-slate-400 hover:text-red-600 rounded-lg flex-shrink-0" data-delete-file="${index}" title="Eliminar archivo (Solo Admin)"><i class="fa-solid fa-trash-can text-xs"></i></button>` : ""}</div>
      </div>`;
    }).join("") : `<div class="cp6-file-empty text-xs text-slate-500 p-3">No hay documentos cargados.</div>`;

    const finalActions = finalPdf
      ? `<button type="button" class="cp6-action-button cp6-primary-button bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition shadow-sm flex items-center gap-1.5" data-view-final-pdf="${escapeHtml(finalPdf)}"><i class="fa-solid fa-eye text-[10px]"></i> Ver avalúo final</button>${isAdmin ? `<button type="button" class="cp6-action-button cp6-danger-button bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold px-3 py-2 rounded-xl text-xs transition shadow-sm flex items-center gap-1.5" data-delete-final-pdf="${escapeHtml(item.id)}" title="Eliminar avalúo"><i class="fa-solid fa-trash-can text-[10px]"></i></button>` : ""}`
      : `<button type="button" class="cp6-action-button cp6-primary-button bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition shadow-sm flex items-center gap-1.5" data-upload-final-pdf="${escapeHtml(item.id)}"><i class="fa-solid fa-cloud-arrow-up text-[10px]"></i> Subir avalúo final</button>`;
    const finalSection = finalPdf
      ? `<div class="bg-emerald-50/80 rounded-2xl p-4 border border-emerald-200 flex flex-wrap items-center justify-between gap-3"><div class="flex items-center gap-3"><div class="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-base shadow-sm"><i class="fa-solid fa-file-circle-check"></i></div><div><h4 class="text-xs font-bold text-slate-900" style="font-family: system-ui, -apple-system, sans-serif !important;">Avalúo final cargado</h4><p class="text-[11px] text-emerald-700 font-medium">El documento final está disponible para consulta.</p></div></div><div class="flex items-center gap-2">${finalActions}</div></div>`
      : `<div class="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3"><div class="flex items-center gap-3"><div class="w-9 h-9 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-base shadow-sm"><i class="fa-solid fa-file-arrow-up"></i></div><div><h4 class="text-xs font-bold text-slate-900" style="font-family: system-ui, -apple-system, sans-serif !important;">Avalúo final pendiente</h4><p class="text-[11px] text-slate-500">Aún no se ha adjuntado el documento final de este trámite.</p></div></div><div>${finalActions}</div></div>`;
    const valueOperation = item.valorOperacion ?? specific.valorOperacion ?? specific.valor_operacion ?? "";
    const contactName = visitContact.nombre || visitContact.name || item.contactoVisitaNombre || specific.contactoVisitaNombre || specific.contacto_visita || "";
    const visitPhone = visitContact.telefono || visitContact.phone || item.contactoVisitaTelefono || specific.contactoVisitaTelefono || specific.telefono_visita || "";
    const typeBien = item.tipoBien || specific.tipoBien || specific.tipo_bien || "";
    const typeAppraisal = item.tipoAvaluo || item.tipo_avaluo || specific.tipoAvaluo || specific.tipo_avaluo || specific.tipo_de_avaluo || "";

    detail.innerHTML = `<div class="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden relative my-2" data-request-card>
      <div class="h-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700"></div>
      <div class="px-6 py-4 border-b border-slate-100 flex flex-col justify-between gap-3 bg-slate-50/50 relative pr-14">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2.5 overflow-hidden min-w-0"><h2 class="text-xl font-black text-slate-900 tracking-tight truncate">${readValue(currentApplicant.nombre || item.nombre || creatorName)}</h2><span class="bg-blue-100 text-blue-700 text-[11px] font-bold px-2.5 py-1 rounded-full border border-blue-200 flex-shrink-0">No. de solicitud: ${readValue(item.folio, "Pendiente")}</span></div>
          <div class="text-xs text-slate-500 font-medium flex items-center gap-1 bg-white px-2.5 py-1 rounded-full border border-slate-200/80 shadow-xs flex-shrink-0"><i class="fa-solid fa-calendar-day text-blue-600"></i> Registrada el ${escapeHtml(requestDate(item.creadoEn))}</div>
        </div>
        <div class="flex flex-col sm:flex-row sm:flex-nowrap sm:items-center justify-between gap-2 pt-1.5 border-t border-slate-200/60">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium min-w-0"><span><i class="fa-solid fa-user-gear text-slate-400 mr-1"></i> Registró: ${readValue(creatorName)}${creatorRole ? ` · ${escapeHtml(creatorRole)}` : ""}</span><span>•</span><span class="text-emerald-600 font-semibold"><i class="fa-solid fa-user-check mr-1"></i> Valuador asignado: ${readValue(item.asesor || specific.asesor || "Sin asignar")}</span></div>
          <div class="flex flex-nowrap items-center justify-end gap-2 ml-auto flex-shrink-0 overflow-x-auto">
            <div class="flex flex-nowrap items-center bg-emerald-50/80 border border-emerald-200 rounded-xl px-2.5 py-1 gap-2 flex-shrink-0 whitespace-nowrap"><div class="flex items-center gap-1.5 text-emerald-800 font-bold text-xs"><i class="fa-solid fa-file-circle-check text-emerald-600 text-[10px]"></i><span>${appraisalNumber ? `No. ${escapeHtml(appraisalNumber)}` : "Sin asignar"}</span></div><button type="button" class="text-slate-500 hover:text-blue-600 transition text-xs px-1" data-open-appraisal-popup title="Editar número de avalúo"><i class="fa-solid fa-pen-to-square"></i></button></div>
            <div class="flex flex-nowrap items-center bg-blue-50/70 border border-blue-200/80 rounded-xl px-2.5 py-1 gap-2 flex-shrink-0 whitespace-nowrap"><div class="flex items-center gap-1.5 text-blue-800 font-bold text-xs min-w-0"><i class="fa-solid fa-user-check text-blue-600 text-[10px]"></i><span class="truncate max-w-[190px]">${externalName ? readValue(item.asignadoExternoEmail || externalName) : "Sin usuario externo"}</span></div><button type="button" class="text-slate-500 hover:text-blue-600 transition text-xs px-1" data-open-external-popup title="Asignar usuario externo"><i class="fa-solid fa-pen-to-square"></i></button></div>
          </div>
        </div>
        <button type="button" data-close-request-detail class="absolute top-4 right-4 w-8 h-8 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full flex items-center justify-center transition" aria-label="Cerrar detalle"><i class="fa-solid fa-xmark text-base"></i></button>
      </div>
      <div class="p-5 sm:p-6 space-y-4">
        <div class="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200/90 space-y-3.5 shadow-sm">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/70 pb-3"><div class="flex items-center gap-2.5"><div class="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-blue-500/20"><i class="fa-solid fa-folder-open"></i></div><div><h3 class="text-sm font-black text-slate-900 tracking-tight">Expediente Digital</h3><p class="text-[11px] text-slate-500">Documentos técnicos, escrituras, predial, facturas, fotografías, etc.</p></div></div><button type="button" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-2 rounded-xl text-xs transition shadow-sm flex items-center gap-1.5 flex-shrink-0" data-attach-missing="${escapeHtml(item.id)}"><i class="fa-solid fa-plus text-[10px]"></i> Anexar documentos</button></div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 min-h-[300px] max-h-[360px] overflow-y-auto cp6-custom-scroll pr-1.5">${filesMarkup}</div>
        </div>
        ${finalSection}
        <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-3 shadow-sm"><div class="border-b border-slate-100 pb-2.5 flex items-center justify-between"><div class="flex items-center gap-2"><i class="fa-solid fa-address-card text-blue-600"></i><h3 class="text-xs font-bold text-slate-900">Información registrada</h3></div><span class="text-[10px] font-semibold text-slate-400">Detalles del trámite</span></div><div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-100"><span class="text-[10px] font-bold uppercase text-slate-400 block tracking-wider mb-0.5">Valor de operación</span><p class="font-extrabold text-blue-700 text-xs">${readValue(valueOperation, "$0.00")}</p></div>
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-100"><span class="text-[10px] font-bold uppercase text-slate-400 block tracking-wider mb-0.5">Contacto para visita</span><p class="font-bold text-slate-800 text-xs">${readValue(contactName)}</p></div>
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-100"><span class="text-[10px] font-bold uppercase text-slate-400 block tracking-wider mb-0.5">Teléfono de visita</span><p class="font-semibold text-slate-800 text-xs"><i class="fa-solid fa-phone text-blue-600 mr-1 text-[10px]"></i> ${readValue(visitPhone)}</p></div>
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-100"><span class="text-[10px] font-bold uppercase text-slate-400 block tracking-wider mb-0.5">Tipo de bien</span><p class="font-semibold text-slate-800 text-xs"><i class="fa-solid fa-building text-blue-600 mr-1 text-[10px]"></i> ${readValue(typeBien)}</p></div>
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-100"><span class="text-[10px] font-bold uppercase text-slate-400 block tracking-wider mb-0.5">Tipo de avalúo</span><p class="font-semibold text-slate-800 text-xs"><i class="fa-solid fa-file-invoice-dollar text-blue-600 mr-1 text-[10px]"></i> ${readValue(typeAppraisal)}</p></div>
        </div></div>
      </div>
      <div class="cp6-submodal" data-appraisal-popup hidden><div class="cp6-submodal-card"><h3>Asignar avalúo</h3><p>Escribe el número de avalúo de 4 dígitos.</p><input data-popup-appraisal-number inputmode="numeric" maxlength="4" value="${escapeHtml(appraisalNumber)}" placeholder="0000" /><div><button type="button" class="cp6-secondary-button" data-close-submodal>Cancelar</button><button type="button" class="cp6-primary-button" data-accept-appraisal>Aceptar</button></div></div></div>
      <div class="cp6-submodal" data-external-popup hidden><div class="cp6-submodal-card"><h3>Asignar usuario externo</h3><input data-popup-external-search style="font-family: Plus Jakarta Sans, system-ui, -apple-system, sans-serif !important;" placeholder="Buscar por nombre, correo o teléfono" /><div class="cp6-popup-results max-h-48 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-lg mt-1 divide-y divide-slate-100" data-popup-external-results></div><div><button type="button" class="cp6-secondary-button" data-close-submodal>Cancelar</button><button type="button" class="cp6-primary-button" data-accept-external disabled>Aceptar</button></div></div></div>
    </div>`;
    detail.querySelectorAll("h2, h3, h4, button, input").forEach((element) => { element.style.fontFamily = "Plus Jakarta Sans, system-ui, -apple-system, sans-serif"; });
    openDialog(dialog);
    detail.querySelector("[data-close-request-detail]")?.addEventListener("click", () => closeDialog(dialog));
    detail.querySelectorAll("[data-view-file]").forEach((button) => button?.addEventListener("click", () => openFileViewer(item, Number(button.dataset.viewFile))));
    detail.querySelectorAll("[data-delete-file]").forEach((button) => button?.addEventListener("click", async () => {
      const index = Number(button.dataset.deleteFile);
      if (!isAdmin || !Number.isInteger(index) || !files[index]) return;
      if (!window.confirm("¿Eliminar este archivo del expediente?")) return;
      try {
        const updated = await api(`/service-requests/${encodeURIComponent(item.id)}`, { method: "PUT", body: JSON.stringify({ archivos: files.filter((_, fileIndex) => fileIndex !== index) }) });
        requests = requests.map((candidate) => candidate.id === item.id ? (updated?.solicitud || updated) : candidate);
        renderRequestDetail(updated?.solicitud || updated);
      } catch (error) { window.alert(error.message || "No se pudo eliminar el archivo."); }
    }));
    detail.querySelector("[data-view-final-pdf]")?.addEventListener("click", (event) => openResourceViewer(event.currentTarget.dataset.viewFinalPdf, "Avalúo final.pdf", "application/pdf"));
    detail.querySelector("[data-attach-missing]")?.addEventListener("click", () => annexDocuments(item));
    detail.querySelector("[data-upload-final-pdf]")?.addEventListener("click", () => uploadFinalPdf(item));
    detail.querySelector("[data-delete-final-pdf]")?.addEventListener("click", async () => {
      if (!window.confirm("¿Eliminar el avalúo final? El estatus cambiará a En trámite.")) return;
      try {
        const result = await api(`/service-requests/${encodeURIComponent(item.id)}`, { method: "PUT", body: JSON.stringify({ removeFinalPdf: true }) });
        const updated = result?.solicitud || result;
        requests = requests.map((candidate) => candidate.id === item.id ? updated : candidate);
        await renderRequests();
        renderRequestDetail(updated);
      } catch (error) { window.alert(error.message || "No se pudo eliminar el avalúo final."); }
    });
    const closeSubmodals = () => detail.querySelectorAll("[data-appraisal-popup],[data-external-popup]").forEach((modal) => { modal.hidden = true; });
    detail.querySelectorAll("[data-close-submodal]").forEach((button) => button?.addEventListener("click", closeSubmodals));
    const appraisalPopup = detail.querySelector("[data-appraisal-popup]");
    detail.querySelector("[data-open-appraisal-popup]")?.addEventListener("click", () => { closeSubmodals(); appraisalPopup.hidden = false; appraisalPopup.querySelector("input")?.focus(); });
    detail.querySelector("[data-accept-appraisal]")?.addEventListener("click", async () => {
      const input = detail.querySelector("[data-popup-appraisal-number]"); const value = String(input?.value || "").replace(/\D/g, "").slice(0, 4);
      if (!/^\d{4}$/.test(value)) { window.alert("El número de avalúo debe tener exactamente 4 dígitos."); return; }
      try { const updated = await api(`/service-requests/${encodeURIComponent(item.id)}`, { method: "PUT", body: JSON.stringify({ numeroAvaluo: value }) }); requests = requests.map((candidate) => candidate.id === item.id ? updated : candidate); renderRequestDetail(updated); } catch (error) { window.alert(error.message || "No se pudo asignar el avalúo."); }
    });
    const externalPopup = detail.querySelector("[data-external-popup]"); const search = detail.querySelector("[data-popup-external-search]"); const resultBox = detail.querySelector("[data-popup-external-results]"); const acceptExternal = detail.querySelector("[data-accept-external]");
    let externalUsers = []; let selectedExternal = null;
    detail.querySelector("[data-open-external-popup]")?.addEventListener("click", async () => { closeSubmodals(); externalPopup.hidden = false; search.focus(); try { externalUsers = await api("/applicants"); } catch (error) { resultBox.innerHTML = `<small>${escapeHtml(error.message || "No se pudieron cargar los usuarios.")}</small>`; } });
    search?.addEventListener("input", () => { selectedExternal = null; acceptExternal.disabled = true; const query = search.value.trim().toLocaleLowerCase("es-MX"); if (!query) { resultBox.innerHTML = ""; return; } const matches = externalUsers.filter((user) => [user.name, user.email, user.phone].join(" ").toLocaleLowerCase("es-MX").includes(query)).slice(0, 8); resultBox.innerHTML = matches.length ? matches.map((user) => `<button type="button" class="cp6-popup-result w-full text-left px-3 py-2 hover:bg-slate-50 transition flex flex-col" data-external-id="${escapeHtml(user.id)}"><span class="text-xs font-bold text-slate-800">${escapeHtml(user.name)}</span><span class="text-[11px] text-slate-500">${escapeHtml(user.email || "")} • ${escapeHtml(user.phone || "")}</span></button>`).join("") : `<small>No se encontraron usuarios.</small>`; resultBox.querySelectorAll("[data-external-id]").forEach((button) => button?.addEventListener("click", () => { selectedExternal = externalUsers.find((user) => user.id === button.dataset.externalId); search.value = selectedExternal?.name || ""; acceptExternal.disabled = !selectedExternal; resultBox.innerHTML = selectedExternal ? `<small>Seleccionado: ${escapeHtml(selectedExternal.name)}</small>` : ""; })); });
    acceptExternal?.addEventListener("click", async () => { if (!selectedExternal) return; try { const updated = await api(`/service-requests/${encodeURIComponent(item.id)}`, { method: "PUT", body: JSON.stringify({ asignadoExternoId: selectedExternal.id, asignadoExternoEmail: selectedExternal.email || "", asignadoExternoNombre: selectedExternal.name || "" }) }); requests = requests.map((candidate) => candidate.id === item.id ? updated : candidate); renderRequestDetail(updated); } catch (error) { window.alert(error.message || "No se pudo asignar el usuario externo."); } });
    const editButton = detail.querySelector("[data-edit-request-info]"); const readPanel = detail.querySelector("[data-read-request-info]"); const editForm = detail.querySelector("[data-request-info-form]");
    editButton?.addEventListener("click", () => { if (!readPanel || !editForm) return; readPanel.hidden = true; editButton.hidden = true; editForm.hidden = false; editForm.querySelector("input, textarea, select")?.focus(); });
    detail.querySelector("[data-cancel-request-info]")?.addEventListener("click", () => { if (!editForm || !readPanel || !editButton) return; editForm.hidden = true; readPanel.hidden = false; editButton.hidden = false; });
    editForm?.addEventListener("submit", async (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(editForm).entries()); const nextSpecific = { ...specific }; Object.entries(values).forEach(([key, value]) => { if (key.startsWith("specific:")) nextSpecific[key.slice(9)] = value; }); const body = { solicitante: { nombre: values.nombre, telefono: values.telefono, correo: values.correo }, propietario: values.propietario, valorOperacion: values.valorOperacion, tipoBien: values.tipoBien, tipoAvaluo: values.tipoAvaluo, asesor: values.asesor, notaria: values.notaria, modalidad: values.modalidad, observaciones: values.observaciones, datosEspecificos: { ...nextSpecific, ...Object.fromEntries(Object.entries(values).filter(([key]) => !key.startsWith("specific:") && !["nombre", "telefono", "correo"].includes(key))) } }; try { const updated = await api(`/service-requests/${encodeURIComponent(item.id)}`, { method: "PUT", body: JSON.stringify(body) }); requests = requests.map((candidate) => candidate.id === item.id ? updated : candidate); renderRequestDetail(updated); } catch (error) { const message = editForm.querySelector("[data-edit-message]"); message.textContent = error.message || "No se pudieron guardar los cambios."; message.hidden = false; } });
  }
  function bindRequestDetailButtons(container, list) { container.querySelectorAll("[data-request-detail]").forEach((button) => button?.addEventListener("click", () => { const item = list.find((candidate) => candidate.id === button.dataset.requestDetail); if (item) renderRequestDetail(item); })); }

  async function submitPublicRequest(event) {
    event.preventDefault();
    event.stopPropagation();
    const form = event.currentTarget;
    const message = $("#publicRequestMessage");
    setMessage(message, "");
    if (!requireFields(form, ["nombre", "telefono", "tipoBien"])) { setMessage(message, "Completa nombre, teléfono y tipo de avalúo."); return; }
    const values = formObject(form);
    // El formulario puede crear un segundo campo dinámico llamado tipoBien.
    // Siempre tomamos el selector principal para no dejar que el campo dinámico
    // vacío sobrescriba el tipo de bien seleccionado por el usuario.
    const primaryType = String(form.querySelector("#publicRequestType")?.value || "").trim();
    values.tipoBien = primaryType || String(values.tipoBien || "").trim();
    if (!values.tipoAvaluo || ["Inmuebles", "Vehículo Automotriz", "Automotriz", "Maquinaria y equipo", "Mobiliario y Bienes Diversos", "Intangibles"].includes(values.tipoAvaluo)) values.tipoAvaluo = values.tipoBien;
    setBusy(form, true, "Enviando…");
    try {
      const files = await readFiles(archivosSeleccionados);
      const payload = { solicitante: { nombre: values.nombre, telefono: values.telefono, correo: values.correo }, tipoBien: values.tipoBien, tipoAvaluo: values.tipoAvaluo, asesor: values.asesor, notaria: values.notaria || values.notariaReferida || "", modalidad: values.modalidadInmueble || "", datosEspecificos: { ...values, tipoBien: values.tipoBien }, archivos: [...archivosExistentesEnEdicion, ...files], contactoVisita: { nombre: values.contactoVisitaNombre, telefono: values.contactoVisitaTelefono }, observaciones: values.observaciones, usuario_id: applicantSession?.id || values.usuario_id || "", requesterEmail: values.correo || applicantSession?.email || "" };
      const result = await api(editingRequestId ? `/service-requests/${encodeURIComponent(editingRequestId)}` : "/service-requests", { method: editingRequestId ? "PUT" : "POST", body: JSON.stringify(payload) });
      clearRequestDraft();
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
    const own = await api(`/mis-solicitudes?email=${encodeURIComponent(applicantSession.email)}&usuario_id=${encodeURIComponent(applicantSession.id || "")}`);
    table.innerHTML = applicantOwnRequestsTable(own);
    bindRequestDetailButtons(table, own);
    table.querySelectorAll("[data-edit-own-request]").forEach((button) => button?.addEventListener("click", () => { const item = own.find((candidate) => candidate.id === button.dataset.editOwnRequest); if (item) editOwnRequest(item); }));
    openDialog(applicantRequestsDialog);
  }
  function editOwnRequest(item) {
    editingRequestId = item.id;
    archivosExistentesEnEdicion = Array.isArray(item.archivos) ? item.archivos : [];
    archivosSeleccionados = [];
    renderSelectedFiles();
    const form = $("#publicRequestForm");
    form.elements.nombre.value = item.solicitante?.nombre || "";
    form.elements.telefono.value = item.solicitante?.telefono || "";
    form.elements.correo.value = item.solicitante?.correo || applicantSession?.email || "";
    form.elements.tipoAvaluo.value = item.tipoAvaluo || "";
    renderDynamicFields();
    form.elements.asesor.value = item.asesor || "";
    if (item.datosEspecificos) Object.entries(item.datosEspecificos).forEach(([key, value]) => { const field = key === "tipoBien" ? (form.elements.subtipoBien || form.querySelector("#publicRequestType")) : form.elements[key]; if (field && !field.length) field.value = value; });
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
      $("#applicantWelcomeName") && ($("#applicantWelcomeName").textContent = updated.name || "—");
      $("#applicantWelcomeNameMessage") && ($("#applicantWelcomeNameMessage").textContent = updated.name || "—");
      $("#applicantWelcomeNameMirror") && ($("#applicantWelcomeNameMirror").textContent = updated.name || "—");
      $("#applicantProfileEmail") && ($("#applicantProfileEmail").textContent = updated.email || "—");
      $("#applicantProfilePhone") && ($("#applicantProfilePhone").textContent = updated.phone || "—");
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
    const hasActions = canManage || canViewDetail;
    const activeRole = String($("#appShell")?.dataset.role || "");
    const canUploadFinal = ["admin", "auditor", "valuador"].includes(activeRole);
    const infoIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 10v6M12 7h.01"></path></svg>`;
    const uploadIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 20h14"></path></svg>`;
    const replaceIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14-4L4 9M4 5v4h4M4 13a8 8 0 0 0 14 4l2-2M20 19v-4h-4"></path></svg>`;
    const deleteIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>`;
    const userCellIcon = `<span class="cp6-cell-icon cp6-cell-icon-user" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.2"></circle><path d="M5.5 20c.7-3.5 2.8-5.2 6.5-5.2s5.8 1.7 6.5 5.2"></path></svg></span>`;
    return `<table class="request-table request-table-compact"><thead><tr><th>Folio</th><th class="request-appraisal-number-heading">No. de Avalúo</th><th>Solicitante</th><th>Asesor</th><th>Estado</th><th>PDF</th>${hasActions ? "<th>Acciones</th>" : ""}</tr></thead><tbody>${list.map((item) => { const finalPdf = item.finalPdfUrl || item.pdfUrl || item.archivoFinal?.url; return `<tr><td class="request-folio-cell"><strong>${escapeHtml(item.folio || "—")}</strong></td><td class="request-appraisal-number-cell">${escapeHtml(item.numeroAvaluo || "—")}</td><td class="requester-cell"><span class="cp6-cell-with-icon">${userCellIcon}${escapeHtml(item.solicitante?.nombre || item.solicitante?.name || "—")}</span></td><td class="user-cell"><span class="cp6-cell-with-icon">${userCellIcon}${escapeHtml(item.asesor || "Sin asignar")}</span></td><td><span class="request-status request-status-${String(item.estado || "").toLowerCase() === "concluida" ? "concluida" : "tramite"}">${String(item.estado || "").toLowerCase() === "concluida" ? "Concluida" : "En trámite"}</span></td><td class="request-pdf-cell">${finalPdf ? `<span class="request-pdf-ready" title="PDF final cargado">✓</span>` : `<span class="request-pdf-pending">—</span>`}</td>${hasActions ? `<td class="request-action-cell">${canViewDetail ? `<button type="button" class="request-icon-button request-info-button" title="Ver detalle" aria-label="Ver detalle" data-request-detail="${escapeHtml(item.id)}">${infoIcon}</button>` : ""}${canUploadFinal ? `<button type="button" class="request-icon-button request-upload-pdf-button" title="${finalPdf ? "Reemplazar archivo" : "Subir archivo"}" aria-label="${finalPdf ? "Reemplazar archivo" : "Subir archivo"}" data-upload-final-row="${escapeHtml(item.id)}">${finalPdf ? replaceIcon : uploadIcon}</button>` : ""}${canDelete ? `<button type="button" class="request-icon-button request-delete-button" title="Eliminar" aria-label="Eliminar" data-delete-request="${escapeHtml(item.id)}">${deleteIcon}</button>` : ""}</td>` : ""}</tr>`; }).join("")}</tbody></table>`;
  }

  async function loadRequests(role = "", user = "") { try { const query = role === "valuador" && user ? `?asesor=${encodeURIComponent(user)}` : ""; requests = await api(`/service-requests${query}`); window.__controlSolicitudes = requests; } catch { requests = []; window.__controlSolicitudes = requests; } return requests; }
  async function renderRegisteredApplicants() {
    const table = $("#registeredApplicantsTable");
    if (!table) return;
    try {
      const applicants = await api("/applicants");
      const query = String($("#registeredApplicantsSearchInput")?.value || "").trim().toLocaleLowerCase("es-MX");
      const visible = applicants.filter((item) => !query || [item.name, item.email, item.phone, item.createdAt].join(" ").toLocaleLowerCase("es-MX").includes(query));
      const editIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 16l-1 4Z"></path><path d="m14 7 3 3"></path></svg>`;
      const deleteIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7l1-3h4l1 3"></path></svg>`;
      table.innerHTML = visible.length ? `<table class="request-table request-table-compact users-external-table"><thead><tr><th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Registro</th><th>Acciones</th></tr></thead><tbody>${visible.map((item) => `<tr><td><strong>${escapeHtml(item.name)}</strong></td><td>${escapeHtml(item.email)}</td><td>${escapeHtml(item.phone || "—")}</td><td>${escapeHtml(item.createdAt?.slice(0, 10) || "—")}</td><td class="request-action-cell"><button type="button" class="request-icon-button request-info-button" data-edit-applicant="${escapeHtml(item.id)}" title="Editar usuario" aria-label="Editar usuario">${editIcon}</button><button type="button" class="request-icon-button request-delete-button" data-delete-applicant="${escapeHtml(item.id)}" title="Eliminar usuario" aria-label="Eliminar usuario">${deleteIcon}</button></td></tr>`).join("")}</tbody></table>` : `<p class="request-empty">${query ? "No se encontraron usuarios externos." : "No hay solicitantes registrados."}</p>`;
      table.querySelectorAll("[data-edit-applicant]").forEach((button) => button?.addEventListener("click", () => editApplicant(applicants.find((item) => item.id === button.dataset.editApplicant))));
      table.querySelectorAll("[data-delete-applicant]").forEach((button) => button?.addEventListener("click", () => deleteApplicant(button.dataset.deleteApplicant)));
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
  function requestsPagination(page, total) {
    const pages = Math.max(1, Math.ceil(total / REQUESTS_PAGE_SIZE));
    if (pages <= 1) return "";
    const current = Math.min(Math.max(1, page), pages);
    const buttons = Array.from({ length: pages }, (_, index) => { const number = index + 1; return `<button type="button" class="table-page-button${number === current ? " is-active" : ""}" data-requests-page="${number}" aria-current="${number === current ? "page" : "false"}">${number}</button>`; }).join("");
    return `<nav class="table-pagination request-table-pagination" aria-label="Paginación de solicitudes"><span>Mostrando ${Math.min((current - 1) * REQUESTS_PAGE_SIZE + 1, total)}-${Math.min(current * REQUESTS_PAGE_SIZE, total)} de ${total}</span><div><button type="button" class="table-page-button" data-requests-page="${current - 1}" ${current === 1 ? "disabled" : ""} aria-label="Página anterior">‹</button>${buttons}<button type="button" class="table-page-button" data-requests-page="${current + 1}" ${current === pages ? "disabled" : ""} aria-label="Página siguiente">›</button></div></nav>`;
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
    const pages = Math.max(1, Math.ceil(visible.length / REQUESTS_PAGE_SIZE));
    requestsPage = Math.min(Math.max(1, requestsPage), pages);
    const pageItems = visible.slice((requestsPage - 1) * REQUESTS_PAGE_SIZE, requestsPage * REQUESTS_PAGE_SIZE);
    table.innerHTML = `${requestRows(pageItems, ["admin", "auditor", "valuador"].includes(role), true, role === "admin")}${requestsPagination(requestsPage, visible.length)}`;
    bindRequestDetailButtons(table, pageItems);
    table.querySelectorAll("[data-requests-page]").forEach((button) => button?.addEventListener("click", () => { if (button.disabled) return; requestsPage = Number(button.dataset.requestsPage) || 1; renderRequests(); }));
    table.querySelectorAll("[data-delete-request]").forEach((button) => button?.addEventListener("click", () => deleteRequest(button.dataset.deleteRequest))); table.querySelectorAll("[data-upload-final-row]").forEach((button) => button?.addEventListener("click", () => { const item = requests.find((request) => request.id === button.dataset.uploadFinalRow); if (item) uploadFinalPdf(item); }));
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
    document.querySelectorAll("#publicRequestForm .step-tab").forEach((tab, index) => tab?.addEventListener("click", () => showRequestStep(index + 1)));
    $("#btn-prev")?.addEventListener("click", () => showRequestStep(requestStep - 1));
    $("#btn-next")?.addEventListener("click", () => { if (requestStepValid(requestStep)) showRequestStep(requestStep + 1); });
    $("#publicRequestForm")?.addEventListener("click", (event) => {
      const category = event.target.closest?.("[data-request-category]");
      if (!category) return;
      if (category.getAttribute("onclick")) return;
      selectCategory(category.dataset.requestCategory || "");
      return;
      const categoryClasses = {
        "Inmuebles": ["border-blue-500", "bg-blue-50", "text-blue-700"],
        "Vehículo Automotriz": ["border-emerald-500", "bg-emerald-50", "text-emerald-700"],
        "Maquinaria y equipo": ["border-amber-500", "bg-amber-50", "text-amber-700"],
        "Mobiliario y Bienes Diversos": ["border-violet-500", "bg-violet-50", "text-violet-700"],
        "Intangibles": ["border-rose-500", "bg-rose-50", "text-rose-700"]
      };
      const allCategoryClasses = Object.values(categoryClasses).flat();
      document.querySelectorAll("[data-request-category]").forEach((candidate) => {
        candidate.classList.remove(...allCategoryClasses);
        if (candidate === category) candidate.classList.add(...(categoryClasses[category.dataset.requestCategory] || categoryClasses.Inmuebles));
        else candidate.classList.add("border-slate-200", "bg-white", "text-slate-800");
      });
      renderDynamicFields();
      fillNotaries();
    });

    $("#publicRequestAttachments")?.addEventListener("change", (event) => addSelectedFiles(event.target.files));
    window.addEventListener("control-avaluos:notarias-updated", () => { if (selectedNotaryValue() || $("#requestNotaryMunicipality")) renderNotarySearch(selectedNotaryValue()); });
    $("#publicRequestForm")?.addEventListener("submit", submitPublicRequest);
    $("#publicRequestForm")?.addEventListener("input", () => { updateSummary(); scheduleRequestDraftSave(); });
    $("#publicRequestForm")?.addEventListener("change", () => { updateSummary(); scheduleRequestDraftSave(); });
    requestDialog?.addEventListener("cancel", (event) => event.preventDefault());
    $("#applicantRegisterForm")?.addEventListener("submit", registerApplicant);
    $("#applicantLoginForm")?.addEventListener("submit", loginApplicant);
    $("#closeApplicantRequestsButton")?.addEventListener("click", () => closeDialog(applicantRequestsDialog));
    $("#cancelApplicantRequestsButton")?.addEventListener("click", () => closeDialog(applicantRequestsDialog));
    $("#newApplicantRequestButton")?.addEventListener("click", () => { closeDialog(applicantRequestsDialog); resetRequestForm(); openDialog(requestDialog); fillAdvisors(); restoreRequestDraft(); });
    $("#openPublicRequestButton")?.addEventListener("click", () => { applicantSession = null; resetRequestForm(); openDialog(requestDialog); fillAdvisors(); restoreRequestDraft(); });
    $("#openApplicantRegisterButton")?.addEventListener("click", () => { setMessage($("#applicantRegisterMessage"), ""); openDialog(applicantRegisterDialog); });
    $("#openApplicantLoginButton")?.addEventListener("click", () => applicantSession ? showApplicantHome() : openDialog(applicantLoginDialog));
    ["closePublicRequestButton", "cancelPublicRequestButton"].forEach((id) => $("#" + id)?.addEventListener("click", () => closeDialog(requestDialog)));
    ["closeApplicantRegisterButton", "cancelApplicantRegisterButton"].forEach((id) => $("#" + id)?.addEventListener("click", () => closeDialog(applicantRegisterDialog)));
    ["closeApplicantLoginButton", "cancelApplicantLoginButton"].forEach((id) => $("#" + id)?.addEventListener("click", () => closeDialog(applicantLoginDialog)));
    $("#newInternalRequestButton")?.addEventListener("click", () => { resetRequestForm(); openDialog(requestDialog); fillAdvisors(); });
    window.selectCategory = selectCategory;
    showRequestStep(1);
    refreshRequestIcons();
    $("#openRequestsViewButton")?.addEventListener("click", () => $("[data-app-view=solicitudes]")?.click());
    $("#backRequestsToAvaluosButton")?.addEventListener("click", () => $("[data-app-view=avaluos]")?.click());
    $("#applicantProfileForm")?.addEventListener("submit", saveApplicantProfile);
    $("#applicantHomeNewRequestButton")?.addEventListener("click", () => { resetRequestForm(); openDialog(requestDialog); fillAdvisors(); restoreRequestDraft(); });
    $("#applicantRequestSearchInput")?.addEventListener("input", () => filterApplicantRequests(true));
    $("#applicantRequestStatusFilter")?.addEventListener("change", () => filterApplicantRequests(true));
    document.querySelectorAll("[data-client-quick-filter]").forEach((button) => button?.addEventListener("click", () => {
      const value = button.dataset.clientQuickFilter || "";
      const select = $("#applicantRequestStatusFilter");
      if (select) select.value = value;
      document.querySelectorAll("[data-client-quick-filter]").forEach((item) => item.classList.toggle("is-active", item === button));
      filterApplicantRequests(true);
    }));
    $("#applicantVisualNewRequestButton")?.addEventListener("click", () => { resetRequestForm(); openDialog(requestDialog); fillAdvisors(); restoreRequestDraft(); });
    window.addEventListener("pagehide", saveRequestDraft);
    $("#applicantVisualProfileButton")?.addEventListener("click", openApplicantProfile);
    $("#applicantHomeProfileButton")?.addEventListener("click", openApplicantProfile);
    $("#applicantNotificationsButton")?.addEventListener("click", () => { const panel = $("#applicantNotificationsPanel"), button = $("#applicantNotificationsButton"); if (!panel || !button) return; panel.hidden = !panel.hidden; button.setAttribute("aria-expanded", String(!panel.hidden)); if (!panel.hidden) { renderApplicantNotifications(); refreshApplicantNotifications(); } });
    $("#applicantMarkNotificationsRead")?.addEventListener("click", async () => { try { await api("/notifications/read-all", { method: "PUT" }); applicantNotifications = applicantNotifications.map((item) => ({ ...item, leida: true })); renderApplicantNotifications(); } catch (error) { window.alert(error.message); } });
    $("#closeApplicantProfileButton")?.addEventListener("click", () => closeDialog($("#applicantProfileDialog")));
    $("#cancelApplicantProfileButton")?.addEventListener("click", () => closeDialog($("#applicantProfileDialog")));
    $("#applicantHomeLogoutButton")?.addEventListener("click", () => { applicantSession = null; sessionStorage.removeItem("control-avaluos.applicant"); showPublicEntry(); });
    $("#requestSearchInput")?.addEventListener("input", () => { requestsPage = 1; renderRequests(); });
    $("#registeredApplicantsSearchInput")?.addEventListener("input", renderRegisteredApplicants);
    $("#requestStatusFilter")?.addEventListener("change", () => { requestsPage = 1; renderRequests(); });
    window.addEventListener("control-avaluos:authenticated", () => { renderWelcomeRequests(); renderRequests(); });
    window.addEventListener("control-avaluos:users-view", renderRegisteredApplicants);
    window.addEventListener("control-avaluos:section", (event) => { if (event.detail === "solicitudes") renderRequests(); });
    $("#closeFileViewerButton")?.addEventListener("click", () => closeDialog($("#fileViewerDialog")));
    try { const storedApplicant = JSON.parse(sessionStorage.getItem("control-avaluos.applicant") || "null"); if (storedApplicant?.email) { applicantSession = storedApplicant; showApplicantHome(); } } catch { sessionStorage.removeItem("control-avaluos.applicant"); }
    fillAdvisors();
    fillNotaries();
    window.addEventListener("control-avaluos:notarias-updated", (event) => { window.__controlNotarias = event.detail || []; fillNotaries(); });
  }
  window.SolicitudesControl = { renderRequests, renderWelcomeRequests, renderApplicantRequests, openDetail: (id) => { const item = requests.find((candidate) => candidate.id === id); if (item) renderRequestDetail(item); }, open: () => { resetRequestForm(); openDialog(requestDialog); fillAdvisors(); fillNotaries(); } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind); else bind();
})();
