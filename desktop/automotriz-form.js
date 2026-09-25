(() => {
  const model = window.AutomotrizModel;
  const app = window.ControlAvaluosDesktop;
  if (!model || !app) return;

  const baseObjectives = ["Estimar el valor comercial", "Estimar el valor referido"];
  const vehiclesContainer = document.querySelector("#automotrizVehicles");
  const form = document.querySelector("#automotrizForm");
  const objectiveSelect = document.querySelector("#objetivoAvaluoSelect");
  const otherObjectiveField = document.querySelector("#otroObjetivoField");
  const otherObjectiveInput = document.querySelector("#otroObjetivoInput");
  const typeSelect = document.querySelector("#technicalTypeSelect");
  const typeHint = document.querySelector("#technicalTypeHint");
  const selectedTypeMessage = document.querySelector("#technicalSelectedType");
  const editor = document.querySelector("#automotrizEditor");
  const message = document.querySelector("#automotrizMessage");
  const folioInput = document.querySelector("#technicalFolioInput");
  const technicalDateInput = document.querySelector("#technicalAvaluoDate");
  const technicalListPanel = document.querySelector("#technicalListPanel");
  const technicalCreationPanel = document.querySelector("#technicalCreationPanel");
  const technicalSearchInput = document.querySelector("#technicalSearchInput");
  const technicalList = document.querySelector("#technicalAppraisalList");
  const considerationInput = document.querySelector("#considerationInput");
  const addConsiderationButton = document.querySelector("#addConsiderationButton");
  const considerationList = document.querySelector("#considerationList");
  const considerationMessage = document.querySelector("#considerationMessage");
  const marketResearchContainer = document.querySelector("#marketResearchContainer");
  const marketValueRows = document.querySelector("#marketValueRows");
  const replacementValueRows = document.querySelector("#replacementValueRows");
  const marketValueTotal = document.querySelector("#marketValueTotal");
  const replacementValueTotal = document.querySelector("#replacementValueTotal");
  const marketValueWords = document.querySelector("#marketValueWords");
  const replacementValueWords = document.querySelector("#replacementValueWords");
  const selectedValueSource = document.querySelector("#selectedValueSource");
  const selectedValueTotal = document.querySelector("#selectedValueTotal");
  const selectedValueWords = document.querySelector("#selectedValueWords");
  const locationPhotoInput = document.querySelector("#automotrizLocationPhoto");
  const locationPreview = document.querySelector("#automotrizLocationPreview");
  const photoStore = new Map();
  const marketResearchStore = new Map();
  const valueStore = new Map();
  const depreciationOptions = [
    { label: "Muy malo", value: 0.5 },
    { label: "Malo", value: 0.75 },
    { label: "Regular", value: 0.9 },
    { label: "Bueno", value: 1 },
    { label: "Muy bueno", value: 1.15 },
    { label: "Excelente", value: 1.3 },
  ];
  let considerations = [];
  let editingConsiderationIndex = null;
  let vehicleSequence = 0;
  let editingTechnicalId = null;
  let editingTechnicalCreatedAt = null;
  let locationDataUrl = "";

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]);
  }

  let saveToastTimer;
  function showSaveToast(text, tone = "success") {
    let toast = document.querySelector("#technicalSaveToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "technicalSaveToast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      Object.assign(toast.style, {
        alignItems: "center", borderRadius: "12px", boxShadow: "0 12px 30px rgba(15, 23, 42, .18)",
        color: "#fff", display: "flex", font: '600 14px/1.35 "Segoe UI", Arial, sans-serif',
        gap: "8px", maxWidth: "min(380px, calc(100vw - 32px))", opacity: "0", padding: "12px 16px",
        pointerEvents: "none", position: "fixed", right: "20px", top: "78px", transform: "translateY(-8px)",
        transition: "opacity .18s ease, transform .18s ease", zIndex: "3000"
      });
      document.body.appendChild(toast);
    }
    toast.textContent = `${tone === "error" ? "⚠" : "✓"} ${text}`;
    toast.style.background = tone === "error" ? "#a33f36" : "#176b58";
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
    window.clearTimeout(saveToastTimer);
    saveToastTimer = window.setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-8px)";
    }, 2600);
  }
  app.showTechnicalSaveToast = showSaveToast;

  function factorControls(factors, group) {
    const controls = factors.map((factor) => `<label>${escapeHtml(factor)}<select class="factor-select" data-factor-group="${group}" data-factor-name="${escapeHtml(factor)}">${depreciationOptions.map((option) => `<option value="${option.value}"${option.value === 1 ? " selected" : ""}>${option.label}</option>`).join("")}</select></label>`);
    if (group === "functionalGroupOne") {
      const mileage = `<label class="kilometraje-factor-field">Kilometraje<select class="factor-select" data-factor-group="functionalGroupOne" data-factor-name="Kilometraje">${depreciationOptions.map((option) => `<option value="${option.value}"${option.value === 1 ? " selected" : ""}>${option.label}</option>`).join("")}</select></label>`;
      const toldoIndex = factors.indexOf("Toldo");
      controls.splice(toldoIndex >= 0 ? toldoIndex + 1 : controls.length, 0, mileage);
    }
    return controls.join("");
  }

  function setSubsection(section) {
    const selected = ["inicio", "recepcion", "crear", "validacion"].includes(section) ? section : "inicio";
    const menu = document.querySelector("#avaluosMenuSection");
    const recepcion = document.querySelector("#recepcionAvaluosSection");
    const crear = document.querySelector("#crearAvaluoSection");
    const validation = document.querySelector("#avaluosAuthorizedFoliosPanel");
    menu.hidden = selected !== "inicio" && selected !== "validacion";
    const choiceGrid = menu.querySelector(".avaluos-choice-grid");
    if (choiceGrid) {
      const hideChoices = selected !== "inicio";
      choiceGrid.hidden = hideChoices;
      choiceGrid.classList.toggle("is-hidden", hideChoices);
    }
    recepcion.hidden = selected !== "recepcion";
    crear.hidden = selected !== "crear";
    if (validation) { validation.dataset.open = selected === "validacion" ? "true" : ""; validation.classList.toggle("is-hidden", selected !== "validacion"); }
    if (selected === "crear") { setTechnicalCreationMode(false); renderTechnicalList(); }
    else setTechnicalCreationMode(false);
    if (selected === "recepcion") app.refreshRecords?.();
    if (selected === "validacion") { window.ControlAvaluosDesktop?.renderAuthorizedFolios?.(); window.ControlAvaluosDesktop?.renderPendingReceptionSummary?.(); }
    document.querySelectorAll(".avaluos-choice-card[data-avaluos-section]").forEach((button) => {
      const active = button.dataset.avaluosSection === selected;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    window.dispatchEvent(new CustomEvent("control-avaluos:subsection-change", { detail: selected }));
  }

  function formatDate(value) {
    return value ? new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${String(value).slice(0, 10)}T12:00:00`)) : "Sin fecha";
  }

  function setTechnicalCreationMode(creating) {
    technicalListPanel.hidden = creating;
    technicalCreationPanel.hidden = !creating;
    window.dispatchEvent(new CustomEvent("control-avaluos:technical-creation-state", { detail: creating }));
  }

  async function saveAntecedentsDraft() {
    if (!folioInput.value || folioInput.value === "Calculando…") await refreshTechnicalFolio();
    const data = new FormData(form);
    const objective = objectiveSelect.value === "Otro" ? otherObjectiveInput.value.trim() : objectiveSelect.value;
    const draft = { id: editingTechnicalId || `tecnico-${Date.now()}-${Math.random().toString(16).slice(2)}`, tipo: "automotriz", tipoAvaluo: "Automotriz", estadoExpediente: "borrador", estado: "En proceso", solicitante: String(data.get("solicitante") || "").trim(), fechaSolicitud: String(data.get("fechaSolicitud") || ""), fechaVisita: String(data.get("fechaVisita") || ""), fechaAvaluo: String(data.get("fechaAvaluo") || ""), numeroAvaluo: folioInput.value, bienesAValuar: String(data.get("bienesAValuar") || "").trim(), propietario: String(data.get("propietario") || "").trim(), ubicacionBienes: String(data.get("ubicacionBienes") || "").trim(), objetivoAvaluo: objective, propositoAvaluo: String(data.get("propositoAvaluo") || "").trim(), creadoPor: app.getActiveUser(), creadoEn: editingTechnicalCreatedAt || undefined };
    message.textContent = "Guardando Antecedentes y generando folio…";
    const stored = await app.saveTechnicalAppraisal(draft);
    editingTechnicalId = stored.id;
    editingTechnicalCreatedAt = stored.creadoEn || stored.createdAt || editingTechnicalCreatedAt;
    folioInput.value = stored.numeroAvaluo || folioInput.value;
    message.classList.remove("is-error"); message.classList.add("is-success");
    message.textContent = `Antecedentes guardados. Folio ${folioInput.value}; expediente En proceso.`;
    showSaveToast(`Antecedentes guardados · Folio ${folioInput.value}`);
    return stored;
  }

  function buildAutomotivePayload() {
    const data = new FormData(form);
    const objective = objectiveSelect.value === "Otro" ? otherObjectiveInput.value.trim() : objectiveSelect.value;
    return {
      id: editingTechnicalId || `tecnico-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      tipo: "automotriz", tipoAvaluo: "Automotriz",
      solicitante: String(data.get("solicitante") || "").trim(),
      fechaSolicitud: String(data.get("fechaSolicitud") || ""),
      fechaVisita: String(data.get("fechaVisita") || ""),
      fechaAvaluo: String(data.get("fechaAvaluo") || ""), numeroAvaluo: folioInput.value,
      bienesAValuar: String(data.get("bienesAValuar") || "").trim(),
      propietario: String(data.get("propietario") || "").trim(),
      ubicacionBienes: String(data.get("ubicacionBienes") || "").trim(),
      objetivoAvaluo: objective, propositoAvaluo: String(data.get("propositoAvaluo") || "").trim(),
      localizacionFoto: locationDataUrl, creadoPor: app.getActiveUser(), creadoEn: editingTechnicalCreatedAt || undefined,
      consideraciones: [...considerations],
      vehiculos: [...vehiclesContainer.querySelectorAll(".vehicle-card")].map(collectVehicle),
      valores: valueRows().map((row) => ({ unidad: row.name, mercado: { ...row.inputs, calculo: row.market }, reposicion: { ...row.inputs, calculo: row.replacement } })),
      enfoqueValor: selectedValueSource?.value === "replacement" ? "replacement" : "market",
    };
  }

  async function saveAutomotiveProgress() {
    const existing = app.getTechnicalAppraisals().find((item) => item.id === editingTechnicalId);
    const isComplete = existing?.estadoExpediente === "completo";
    const appraisal = {
      ...buildAutomotivePayload(),
      estadoExpediente: isComplete ? existing.estadoExpediente : "borrador",
      estado: isComplete ? (existing.estado || "Concluido") : "En proceso",
    };
    message.textContent = "Guardando avance del expediente…";
    const stored = await persistAutomotiveImages(appraisal).then((value) => app.saveTechnicalAppraisal(value));
    editingTechnicalId = stored.id;
    editingTechnicalCreatedAt = stored.creadoEn || stored.createdAt || editingTechnicalCreatedAt;
    folioInput.value = stored.numeroAvaluo || folioInput.value;
    message.classList.remove("is-error"); message.classList.add("is-success");
    message.textContent = `Avance del avalúo ${folioInput.value} guardado.`;
    showSaveToast(`Pestaña guardada · Folio ${folioInput.value}`);
    return stored;
  }

  function setupTechnicalWizard() {
    if (!form || form.dataset.wizardReady) return;
    const sections = [...form.querySelectorAll(":scope > .technical-form-section")];
    if (!sections.length) return;
    form.dataset.wizardReady = "true";
    let currentStep = 0;
    const completed = new Set();
    const labels = ["Antecedentes", "Características de los bienes", "Consideraciones previas", "Investigación de mercado", "Valores"];
    const stepper = document.createElement("nav");
    stepper.className = "technical-stepper";
    stepper.setAttribute("aria-label", "Pasos del avalúo");
    stepper.innerHTML = labels.map((label, index) => `<button type="button" class="technical-step" data-step-index="${index}"><span>${index + 1}</span><strong>${label}</strong><small>Pendiente</small></button>`).join("");
    form.parentElement.insertBefore(stepper, form);
    const draftKey = "control-avaluos.technical-draft";
    const saveDraft = () => {
      const data = Object.fromEntries(new FormData(form).entries());
      localStorage.setItem(draftKey, JSON.stringify({ data, completed: [...completed], step: currentStep, updatedAt: new Date().toISOString() }));
    };
    const render = () => {
      sections.forEach((section, index) => { section.hidden = index !== currentStep; section.classList.toggle("is-current-step", index === currentStep); });
      stepper.querySelectorAll(".technical-step").forEach((button, index) => {
        const done = completed.has(index);
        button.classList.toggle("is-current", index === currentStep); button.classList.toggle("is-complete", done); button.setAttribute("aria-current", index === currentStep ? "step" : "false");
        const status = button.querySelector("small"); if (status) status.textContent = done ? "Completado" : index === currentStep ? "En curso" : "Pendiente";
      });
      form.querySelectorAll(".technical-step-actions").forEach((actions, index) => { actions.hidden = index !== currentStep; });
      const finalActions = form.querySelector(".technical-actions"); if (finalActions) finalActions.hidden = currentStep !== sections.length - 1;
    };
    const goTo = (index) => { currentStep = Math.max(0, Math.min(sections.length - 1, index)); render(); window.scrollTo({ top: 0, behavior: "smooth" }); };
    sections.forEach((section, index) => {
      const actions = document.createElement("div"); actions.className = "technical-step-actions"; actions.innerHTML = `${index ? `<button type="button" class="secondary-button technical-step-back">← Anterior</button>` : ""}<button type="button" class="subtle-action-button technical-step-save">${index === sections.length - 1 ? "Revisar y guardar avalúo" : "Guardar y continuar"}</button>`; section.appendChild(actions);
      actions.querySelector(".technical-step-back")?.addEventListener("click", () => goTo(index - 1));
      actions.querySelector(".technical-step-save")?.addEventListener("click", async () => {
        if (index === 0 && ![...section.querySelectorAll("input,select,textarea")].every((control) => control.checkValidity())) { section.querySelector(":invalid")?.reportValidity(); return; }
        try {
          if (index === 0) await saveAntecedentsDraft();
          else await saveAutomotiveProgress();
        } catch (error) {
          message.classList.add("is-error");
          message.textContent = error.message || "No se pudo guardar el avance del avalúo.";
          showSaveToast(message.textContent, "error");
          return;
        }
        completed.add(index); saveDraft(); if (index < sections.length - 1) goTo(index + 1); else form.requestSubmit();
      });
    });
    stepper.querySelectorAll(".technical-step").forEach((button) => button.addEventListener("click", () => { goTo(Number(button.dataset.stepIndex)); }));
    form.addEventListener("input", saveDraft);
    form.addEventListener("change", saveDraft);
    form.addEventListener("reset", () => { completed.clear(); currentStep = 0; localStorage.removeItem(draftKey); window.setTimeout(render, 0); });
    form._technicalWizardGoTo = goTo;
    form._technicalWizardMarkSaved = (appraisal) => {
      completed.clear();
      if (appraisal?.numeroAvaluo || appraisal?.solicitante) completed.add(0);
      if (appraisal?.vehiculos?.length) completed.add(1);
      if (appraisal?.consideraciones?.length) completed.add(2);
      if (appraisal?.vehiculos?.some((vehicle) => vehicle.investigacionMercado?.comparables?.length || vehicle.investigacionMercado?.valor)) completed.add(3);
      if (appraisal?.valores?.length) completed.add(4);
      render();
    };
    render();
  }

  function renderTechnicalList() {
    const query = technicalSearchInput.value.trim().toLocaleLowerCase("es-MX");
    const appraisals = app.getTechnicalAppraisals().filter((appraisal) => !query || [appraisal.numeroAvaluo, appraisal.solicitante, appraisal.bienesAValuar, appraisal.tipoAvaluo, appraisal.vehiculos?.map((vehicle) => `${vehicle.marca} ${vehicle.modelo} ${vehicle.placas}`).join(" "), appraisal.bienes?.map((item) => item.descripcion).join(" ")].join(" ").toLocaleLowerCase("es-MX").includes(query));
    appraisals.sort((a, b) => { const na = Number(String(a.numeroAvaluo || "").split("/")[0].replace(/\D/g, "")) || 0; const nb = Number(String(b.numeroAvaluo || "").split("/")[0].replace(/\D/g, "")) || 0; return nb - na || String(b.creadoEn || b.createdAt || "").localeCompare(String(a.creadoEn || a.createdAt || "")); });
    document.querySelector("#technicalFilteredCount").textContent = `${appraisals.length} ${appraisals.length === 1 ? "resultado" : "resultados"}`;
    document.querySelector("#technicalListCount").textContent = String(appraisals.length);
    technicalList.innerHTML = `<div class="operational-table-wrap"><table class="operational-table operational-table-compact"><thead><tr><th>Número de avalúo</th><th>Solicitante</th><th>Tipo</th><th>Fecha</th><th>Elaboró</th><th>Acciones</th></tr></thead><tbody>${appraisals.length ? appraisals.map((appraisal) => { const isMaquinaria = appraisal.tipo === "maquinaria" || /maquinaria/i.test(String(appraisal.tipoAvaluo || appraisal.tipo || "")); const isMobiliario = appraisal.tipo === "mobiliario" && !isMaquinaria; const label = isMaquinaria ? "Maquinaria y Equipo" : (isMobiliario ? "Mobiliario y Bienes Diversos" : "Automotriz"); const status = appraisal.estadoExpediente === "borrador" ? " · Borrador" : ""; const count = (isMobiliario || isMaquinaria) ? Number(appraisal.bienes?.length || 0) : Number(appraisal.vehiculos?.length || 0); return `<tr><td><strong class="avaluo-list-number">${escapeHtml(appraisal.numeroAvaluo)}</strong></td><td>${escapeHtml(appraisal.solicitante)}</td><td>${label}<small class="technical-record-status">${status}</small></td><td>${escapeHtml(formatDate(appraisal.fechaAvaluo))}</td><td>${escapeHtml(appraisal.creadoPor || "Sin registro")}</td><td><div class="technical-row-actions"><button class="technical-icon-button action-edit" data-edit-appraisal="${escapeHtml(appraisal.id)}" type="button" title="Editar" aria-label="Editar"><span class="action-icon" aria-hidden="true">✎</span></button>${appraisal.estadoExpediente === "borrador" ? "" : `<button class="technical-icon-button action-pdf" data-preview-appraisal="${escapeHtml(appraisal.id)}" type="button" title="Ver PDF" aria-label="Ver PDF"><span class="action-icon action-icon-label" aria-hidden="true">PDF</span></button><button class="technical-icon-button action-word" data-word-appraisal="${escapeHtml(appraisal.id)}" type="button" title="Ver o descargar Word" aria-label="Ver o descargar Word"><span class="action-icon action-icon-label" aria-hidden="true">W</span></button>`}<button class="technical-icon-button action-delete" data-delete-appraisal="${escapeHtml(appraisal.id)}" type="button" title="Eliminar" aria-label="Eliminar"><span class="action-icon" aria-hidden="true">⌫</span></button></div></td></tr>`; }).join("") : `<tr><td colspan="6" class="empty">No hay expedientes técnicos para esta búsqueda.</td></tr>`}</tbody></table></div>`;
    technicalList.querySelectorAll("[data-edit-appraisal]").forEach((button) => button.addEventListener("click", () => {
      const appraisal = app.getTechnicalAppraisals().find((item) => item.id === button.dataset.editAppraisal);
      if (!appraisal) return;
      if (appraisal.tipo === "mobiliario" || appraisal.tipo === "maquinaria" || /maquinaria/i.test(String(appraisal.tipoAvaluo || ""))) window.dispatchEvent(new CustomEvent("control-avaluos:open-mobiliario-edit", { detail: appraisal }));
      else openTechnicalEdit(appraisal);
    }));
    technicalList.querySelectorAll("[data-preview-appraisal]").forEach((button) => button.addEventListener("click", () => {
      const appraisal = app.getTechnicalAppraisals().find((item) => item.id === button.dataset.previewAppraisal);
      if (!appraisal) return;
      if (appraisal.tipo === "mobiliario" || appraisal.tipo === "maquinaria" || /maquinaria/i.test(String(appraisal.tipoAvaluo || ""))) window.dispatchEvent(new CustomEvent("control-avaluos:preview-mobiliario", { detail: appraisal }));
      else previewTechnicalPdf(appraisal);
    }));
    technicalList.querySelectorAll("[data-word-appraisal]").forEach((button) => button.addEventListener("click", () => {
      const appraisal = app.getTechnicalAppraisals().find((item) => item.id === button.dataset.wordAppraisal);
      if (appraisal?.tipo === "mobiliario" || appraisal?.tipo === "maquinaria" || /maquinaria/i.test(String(appraisal?.tipoAvaluo || ""))) window.dispatchEvent(new CustomEvent("control-avaluos:word-mobiliario", { detail: appraisal }));
      else if (appraisal) previewTechnicalPdf(appraisal, { word: true });
    }));
    technicalList.querySelectorAll("[data-delete-appraisal]").forEach((button) => button.addEventListener("click", async () => {
      const appraisal = app.getTechnicalAppraisals().find((item) => item.id === button.dataset.deleteAppraisal);
      if (!appraisal || !app.canEdit()) return;
      if (!window.confirm(`¿Eliminar definitivamente el avalúo ${appraisal.numeroAvaluo}? Esta acción no se puede deshacer.`)) return;
      try { await app.deleteTechnicalAppraisal(appraisal.id); }
      catch (error) { window.alert(error.message || "No se pudo eliminar el avalúo técnico."); }
    }));
  }

  function pdfField(label, value) { return `<div class="pdf-field"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value || "No especificado")}</span></div>`; }

  function renderPdfCharacteristics(appraisal) {
    const vehicles = Array.isArray(appraisal.vehiculos) ? appraisal.vehiculos : [];
    const vehicleSections = vehicles.length ? vehicles.map((vehicle, index) => {
      const unitName = vehicle.nombreUnidad || [vehicle.marca, vehicle.modelo].filter(Boolean).join(" ") || `Vehículo ${index + 1}`;
      const photos = Array.isArray(vehicle.fotografias) ? vehicle.fotografias.slice(0, 4) : [];
      const photoSlots = Array.from({ length: Math.max(2, photos.length) }, (_, photoIndex) => {
        const photo = photos[photoIndex];
        const source = photo?.url || photo?.dataUrl;
        return source
          ? `<figure class="vehicle-report-photo"><img src="${escapeHtml(source)}" alt="Fotografía ${photoIndex + 1} de ${escapeHtml(unitName)}" /></figure>`
          : `<figure class="vehicle-report-photo is-empty"><span>Espacio para fotografía ${photoIndex + 1}</span></figure>`;
      }).join("");
      const functionalGroupOne = vehicle.factores?.funcionalGrupoUno || [];
      const functionalGroupTwo = vehicle.factores?.funcionalGrupoDos || [];
      const economicFactors = vehicle.factores?.economica || [];
      const calculation = functionalGroupOne.length || functionalGroupTwo.length || economicFactors.length
        ? model.calculateObsolescence({ functionalGroupOne: functionalGroupOne.map((factor) => factor.valor), functionalGroupTwo: functionalGroupTwo.map((factor) => factor.valor), economic: economicFactors.map((factor) => factor.valor) })
        : (vehicle.calculo || {});
      const numericValue = (value) => {
        const number = Number(value ?? 0);
        return Number.isFinite(number) ? String(Number(number.toFixed(4))) : "0";
      };
      const factorRows = (factors = []) => factors.length ? factors.map((factor) => `<div class="depreciation-factor"><span>${escapeHtml(factor.nombre || "Factor")}</span><strong>${numericValue(factor.valor)}</strong></div>`).join("") : `<div class="depreciation-factor is-empty"><span>Sin factores capturados</span><strong>—</strong></div>`;
      const generalAverages = `<div class="obsolescence-averages"><div><span>Promedio de obsolescencia funcional</span><strong>${numericValue(calculation.functional)}</strong></div><div><span>Promedio de obsolescencia económica</span><strong>${numericValue(calculation.economic)}</strong></div></div>`;
      const depreciationSummary = `<div class="depreciation-summary"><div><span>Factor por demérito</span><strong>${numericValue(calculation.factor)}</strong></div><div><span>Porcentaje de demérito</span><strong>${(Number(calculation.demerit ?? 0) * 100).toFixed(2)} %</strong></div></div>`;
      const depreciationDetail = `<section class="depreciation-detail"><p class="depreciation-title">ELEMENTOS O FACTORES A CONSIDERAR PARA LA DEPRECIACIÓN</p><section class="depreciation-group"><h3>Obsolescencia funcional · Grupo 1</h3><div class="depreciation-factor-grid">${factorRows(functionalGroupOne)}</div><p class="depreciation-average"><strong>Promedio:</strong> ${numericValue(calculation.firstFunctionalAverage)}</p></section><section class="depreciation-group"><h3>Obsolescencia funcional · Grupo 2</h3><div class="depreciation-factor-grid">${factorRows(functionalGroupTwo)}</div><p class="depreciation-average"><strong>Promedio:</strong> ${numericValue(calculation.secondFunctionalAverage)}</p></section><section class="depreciation-group economic-factors"><h3>Obsolescencia económica</h3><div class="depreciation-factor-grid">${factorRows(economicFactors)}</div><p class="depreciation-average"><strong>Promedio:</strong> ${numericValue(calculation.economic)}</p></section>${generalAverages}${depreciationSummary}</section>`;
      const characteristicsHeading = index === 0 ? `<div class="section-title"><span>II.-</span><h2>CARACTERÍSTICAS DE LOS BIENES</h2></div><p class="characteristics-lead"><strong>Bienes a valuar:</strong> ${escapeHtml(appraisal.bienesAValuar || "No especificado")}</p>` : "";
      return `<section class="pdf-characteristics vehicle-page${index > 0 ? " vehicle-continuation" : ""}">${characteristicsHeading}<article class="pdf-vehicle"><p class="vehicle-unit-name"><strong>Nombre de la unidad:</strong> ${escapeHtml(unitName)}</p><table class="vehicle-characteristics-table"><thead><tr><th>Marca</th><th>Modelo</th><th>Año</th><th>Número de serie</th><th>Placas</th><th>Condiciones</th></tr></thead><tbody><tr><td>${escapeHtml(vehicle.marca || "No especificado")}</td><td>${escapeHtml(vehicle.modelo || "No especificado")}</td><td>${escapeHtml(vehicle.anio || "No especificado")}</td><td>${escapeHtml(vehicle.numeroSerie || "No especificado")}</td><td>${escapeHtml(vehicle.placas || "No especificado")}</td><td>${escapeHtml(vehicle.condiciones || "No especificado")}</td></tr></tbody></table><p class="vehicle-photos-title">Fotografías del bien</p><div class="vehicle-photo-grid">${photoSlots}</div>${depreciationDetail}</article></section>`;
    }).join("") : `<p class="pdf-empty">No se agregaron vehículos al expediente.</p>`;
    return vehicleSections;
  }

  function renderPdfConsiderations(appraisal) {
    const items = Array.isArray(appraisal.consideraciones) ? appraisal.consideraciones.filter(Boolean) : [];
    const list = items.length
      ? `<ol class="considerations-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`
      : `<p class="pdf-empty">No se registraron consideraciones previas para este avalúo.</p>`;
    return `<section class="pdf-considerations"><div class="section-title"><span>III.-</span><h2>CONSIDERACIONES PREVIAS AL AVALÚO</h2></div>${list}<footer class="considerations-closing"><p>EL PRESENTE AVALÚO SE RINDE TENIENDO EN CUENTA LOS VALORES DE MERCADO EN LA ZONA.</p><p>EL PRESENTE AVALÚO SE RINDE SIN DOLO NI MALA FE.-</p></footer></section>`;
  }

  function renderPdfMarketResearch(appraisal) {
    const vehicles = Array.isArray(appraisal.vehiculos) ? appraisal.vehiculos : [];
    const asNumber = (value) => Number(String(value ?? "").replace(",", ".")) || 0;
    const asAmount = (value) => new Intl.NumberFormat("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(asNumber(value));
    const currencyLabel = { MXN: "Pesos mexicanos (MXN)", USD: "Dólares estadounidenses (USD)", EUR: "Euros (EUR)" };
    const entries = vehicles.flatMap((vehicle, index) => {
      const market = vehicle.investigacionMercado || {};
      const comparables = Array.isArray(market.comparables) && market.comparables.length ? market.comparables : [market];
      const unitName = vehicle.nombreUnidad || [vehicle.marca, vehicle.modelo].filter(Boolean).join(" ") || `Vehículo ${index + 1}`;
      return comparables.map((comparable, comparableIndex) => { const currency = String(comparable.moneda || "MXN").toUpperCase(); return { unitName: `${unitName}${comparables.length > 1 ? ` · Mercado ${comparableIndex + 1}` : ""}`, currency, originalValue: asNumber(comparable.valor), nationalValue: model.convertToPesos(comparable.valor, currency, comparable.tipoCambio), source: comparable.fuente || "" }; });
    });
    const averageRows = vehicles.map((vehicle, index) => { const market = vehicle.investigacionMercado || {}; const comparables = Array.isArray(market.comparables) && market.comparables.length ? market.comparables : [market]; const values = comparables.map((comparable) => model.convertToPesos(comparable.valor, comparable.moneda, comparable.tipoCambio)).filter((value) => value > 0); if (!values.length) return ""; const average = values.reduce((sum, value) => sum + value, 0) / values.length; const unitName = vehicle.nombreUnidad || [vehicle.marca, vehicle.modelo].filter(Boolean).join(" ") || `Vehículo ${index + 1}`; return `<tr class="market-average-row"><th colspan="3">Promedio aplicable · ${escapeHtml(unitName)}</th><td>${money(average)}</td></tr>`; }).join("");
    const rows = entries.length ? entries.map((entry) => `<tr><td>${escapeHtml(entry.unitName)}</td><td>${asAmount(entry.originalValue)}</td><td>${escapeHtml(currencyLabel[entry.currency] || entry.currency)}</td><td>${money(entry.nationalValue)}</td></tr>`).join("") + averageRows : `<tr><td colspan="4">No se registraron valores de mercado.</td></tr>`;
    const total = vehicles.reduce((sum, vehicle) => { const market = vehicle.investigacionMercado || {}; const comparables = Array.isArray(market.comparables) && market.comparables.length ? market.comparables : [market]; const values = comparables.map((comparable) => model.convertToPesos(comparable.valor, comparable.moneda, comparable.tipoCambio)).filter((value) => value > 0); return sum + (values.length ? values.reduce((subtotal, value) => subtotal + value, 0) / values.length : 0); }, 0);
    const seenSources = new Set();
    const sources = entries.flatMap((entry) => entry.source.split(/[;,\n]+/)).map((source) => source.trim()).filter((source) => {
      const key = source.toLocaleLowerCase("es-MX");
      if (!key || seenSources.has(key)) return false;
      seenSources.add(key);
      return true;
    });
    const sourceText = sources.length ? sources.join(", ") : "No se indicaron fuentes de consulta.";
    return `<section class="pdf-market-research"><div class="section-title"><span>IV.-</span><h2>INVESTIGACIÓN DE MERCADO</h2></div><h3 class="report-subtitle">Valor unitario aplicable</h3><p>Se consideran los valores de vehículos similares, por encontrarse en el mercado a la venta de la misma marca.</p><p>Los valores de mercado ya incluyen demérito y todo tipo de obsolescencias.</p><h3 class="report-subtitle">Valor de Mercado en la zona</h3><table class="market-research-table"><thead><tr><th>Nombre de la unidad</th><th>Valor moneda extranjera</th><th>Tipo de moneda</th><th>Valor moneda nacional</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="3">Total</th><th>${money(total)}</th></tr></tfoot></table><p class="market-sources">Los valores fueron consultados en diversas páginas de internet, tales como: <strong>${escapeHtml(sourceText)}</strong></p><p>No obstante que se reconoce que los valores de mercado generalmente castigan o premian según corresponde, en el presente caso, adicional al mercado se castiga el bien con un demérito adecuado al uso y mantenimiento, por la diferencia de edad entre el bien valuado y los comparables, propia del bien.</p><p>El mercado ya tiene los valores, con castigos o apreciaciones directas.</p></section>`;
  }

  function renderPdfValues(appraisal) {
    const values = Array.isArray(appraisal.valores) ? appraisal.valores : [];
    const cleanNumber = (value) => {
      const number = Number(value ?? 0);
      return Number.isFinite(number) ? String(Number(number.toFixed(4))) : "0";
    };
    const marketRows = values.length ? values.map((value, index) => {
      const market = value.mercado || {};
      const calculation = market.calculo || {};
      return `<tr><td>${escapeHtml(value.unidad || `Vehículo ${index + 1}`)}</td><td>${cleanNumber(calculation.quantity)}</td><td>${money(calculation.unitValue)}</td><td>${cleanNumber(calculation.coefficient)}</td><td>${(Number(calculation.demeritRate ?? 0) * 100).toFixed(2)} %</td><td>${escapeHtml(market.marketReason || "Condiciones intrínsecas y extrínsecas")}</td><td>${money(calculation.netValue)}</td></tr>`;
    }).join("") : `<tr><td colspan="7">No se registraron valores para las unidades.</td></tr>`;
    const replacementRows = values.length ? values.map((value, index) => {
      const replacement = value.reposicion || {};
      const calculation = replacement.calculo || {};
      return `<tr><td>${escapeHtml(value.unidad || `Vehículo ${index + 1}`)}</td><td>${cleanNumber(calculation.quantity)}</td><td>${money(calculation.unitValue)}</td><td>${(Number(calculation.coefficient ?? 0) * 100).toFixed(2)} %</td><td>${money((Number(calculation.demeritAmount ?? 0)) * (Number(calculation.quantity ?? 0)))}</td><td>${escapeHtml(replacement.replacementReason || "Condiciones intrínsecas y extrínsecas")}</td><td>${money(calculation.netValue)}</td></tr>`;
    }).join("") : `<tr><td colspan="7">No se registraron valores para las unidades.</td></tr>`;
    const marketTotal = model.roundToPeso(values.reduce((sum, value) => sum + (Number(value.mercado?.calculo?.netValue) || 0), 0));
    const replacementTotal = model.roundToPeso(values.reduce((sum, value) => sum + (Number(value.reposicion?.calculo?.netValue) || 0), 0));
    const selectedSource = appraisal.enfoqueValor === "replacement" ? "replacement" : "market";
    const selectedTotal = selectedSource === "replacement" ? replacementTotal : marketTotal;
    const selectedLabel = selectedSource === "replacement" ? "Total valor de reposición" : "Total valor de mercado";
    const amountInWords = model.amountInWords(selectedTotal);
    const marketTable = `<section class="report-value-table"><h3 class="report-subtitle">Valor de Mercado en la Zona</h3><p class="value-caption">VALOR PARA LICITACIÓN CONSIDERANDO EL USO, CONDICIONES Y ESTADO FÍSICO DE CADA BIEN</p><table class="appraisal-values-table"><thead><tr><th>Unidad</th><th>Cant.</th><th>Valor unitario</th><th>Coeficiente</th><th>Demerito</th><th>Motivo</th><th>Valor neto</th></tr></thead><tbody>${marketRows}</tbody><tfoot><tr><th colspan="6">Total valor de mercado</th><th>${money(marketTotal)}</th></tr></tfoot></table></section>`;
    const replacementTable = `<section class="report-value-table"><h3 class="report-subtitle">Valor de Reposición de la Zona (Enfoque de Costos)</h3><p class="value-caption">VALOR PARA LICITACIÓN CONSIDERANDO EL USO, CONDICIONES Y ESTADO FÍSICO DE CADA BIEN</p><table class="appraisal-values-table"><thead><tr><th>Unidad</th><th>Cant.</th><th>Valor unitario</th><th>Coeficiente</th><th>Demerito</th><th>Motivo</th><th>Valor neto</th></tr></thead><tbody>${replacementRows}</tbody><tfoot><tr><th colspan="6">Total valor de reposición</th><th>${money(replacementTotal)}</th></tr></tfoot></table></section>`;
    return `<section class="pdf-values"><div class="section-title"><span>V.-</span><h2>VALORES</h2></div>${marketTable}${replacementTable}<div class="selected-report-total"><p><strong>Total (no incluye impuestos):</strong> ${money(selectedTotal)}</p><p><strong>Total en números redondos:</strong> ${money(selectedTotal)}</p><p class="amount-in-words">SON: ${escapeHtml(amountInWords)}, PESOS MEXICANOS.</p></div><p class="values-legal-notice">EL PRESENTE AVALÚO TIENE VALIDEZ ÚNICAMENTE PARA EL OBJETO ESPECIFICADO EN LA CARÁTULA. Y LA DEPRECIACIÓN SE UBICA EN EL PORCENTAJE REFERIDO EN VIRTUD DE LA DEMANDA DE ESE TIPO DE BIENES.</p></section>`;
  }

  function selectedPdfTotal(appraisal) {
    const values = Array.isArray(appraisal.valores) ? appraisal.valores : [];
    const market = model.roundToPeso(values.reduce((sum, value) => sum + (Number(value.mercado?.calculo?.netValue) || 0), 0));
    const replacement = model.roundToPeso(values.reduce((sum, value) => sum + (Number(value.reposicion?.calculo?.netValue) || 0), 0));
    return appraisal.enfoqueValor === "replacement" ? replacement : market;
  }

  function renderPdfLegalConsiderations(appraisal) {
    const selectedSource = appraisal.enfoqueValor === "replacement" ? "Enfoque de costos" : "Valor de mercado";
    const total = selectedPdfTotal(appraisal);
    const words = model.amountInWords(total);
    return `<section class="pdf-legal-considerations"><div class="section-title"><span>VI.-</span><h2>CONSIDERACIONES PREVIAS A LA CONCLUSIÓN</h2></div><h3 class="report-subtitle">FUNDAMENTO LEGAL</h3><p>El presente avalúo se realizó de conformidad a los métodos aplicados para la realización del presente trabajo de acuerdo a servicios de valuación, con aplicación de la norma mexicana.</p><p>Este trabajo de acuerdo a inspección ocular y observaciones llevadas a cabo por el Suscrito.</p><p>Se extiende el presente avalúo en los términos del artículo seis (06) fracción II (segunda) de la Ley Federal de Correduría Pública.</p><p>Se han obtenido valores con diferentes enfoques, por lo que, considerando el Objeto y Propósito del presente avalúo, se concluye que el valor que le corresponde es el de: <strong>${selectedSource}</strong>.</p><p class="legal-value-statement">ESTAS CANTIDADES REPRESENTAN EL VALOR COMERCIAL DE CADA CONCEPTO AL DÍA: <strong>${formatDate(appraisal.fechaAvaluo)}</strong>. EL VALOR DEL BIEN A ESTA FECHA ES DE: <strong>${money(total)}</strong>. <strong>${escapeHtml(words)}, PESOS MEXICANOS.</strong></p><p class="values-legal-notice">EL PRESENTE AVALÚO TIENE VALIDEZ ÚNICAMENTE PARA EL OBJETO ESPECIFICADO EN LA CARÁTULA. Y LA DEPRECIACIÓN SE UBICA EN EL PORCENTAJE REFERIDO EN VIRTUD DE LA DEMANDA DE ESE TIPO DE BIENES.</p></section>`;
  }

  function renderPdfConclusion(appraisal) {
    const roundedTotal = selectedPdfTotal(appraisal);
    const amountInWords = model.amountInWords(roundedTotal);
    return `<section class="pdf-conclusion"><div class="section-title"><span>VII.-</span><h2>CONCLUSIÓN</h2></div><p><strong>Valor de los bienes al:</strong> ${formatDate(appraisal.fechaAvaluo)}</p><p><strong>Lote de bienes:</strong> ${money(roundedTotal)} (${escapeHtml(amountInWords)}), PESOS MEXICANOS.</p><div class="signature-block"><p>Correduría Pública No. 6<br />Plaza Coahuila</p><p>Titular de la Correduría</p><div class="signature-space"></div><strong>Lic. Juan Manuel Barrera Martínez</strong></div><footer class="conclusion-legal"><p>EL PRESENTE AVALÚO NO ES VÁLIDO SIN LA FIRMA Y SELLO DEL TITULAR DE LA CORREDURÍA.</p><p>EL PRESENTE AVALÚO TIENE VALIDEZ DE 6 MESES.</p></footer></section>`;
  }

  function previewTechnicalPdf(appraisal, options = {}) {
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) { window.alert("El navegador bloqueó la vista previa. Permite ventanas emergentes para ver el PDF."); return; }
    const logoUrl = new URL("assets/correduria-publica-6-logo.bmp", window.location.href).href;
    const locationPhoto = appraisal.localizacionFoto ? `<div class="antecedents-location"><p>Fotografía de ubicación de los bienes</p><figure><img src="${escapeHtml(appraisal.localizacionFoto)}" alt="Ubicación de los bienes" /></figure></div>` : `<div class="antecedents-location is-empty"><p>Fotografía de ubicación de los bienes</p><figure><span>Sin fotografía registrada</span></figure></div>`;
    if (!options.word) reportWindow.addEventListener("load", () => window.setTimeout(() => reportWindow.print(), 120), { once: true });
    reportWindow.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8" /><title>Avalúo ${escapeHtml(appraisal.numeroAvaluo)}</title><style>@page{size:letter;margin:22mm 18mm}*{box-sizing:border-box}body{color:#1f302f;font-family:Georgia,'Times New Roman',serif;font-size:11pt;line-height:1.45;margin:0}.report-header{align-items:center;border-bottom:2px solid #92753b;display:flex;gap:12px;justify-content:center;margin-bottom:22px;padding-bottom:13px;text-align:center}.report-logo{height:48px;object-fit:contain;width:62px}.report-header h1{font-size:20pt;margin:0}.report-header p{color:#69726e;font-size:12pt;margin:3px 0 0}.section-title{align-items:baseline;border-bottom:1px solid #c8c0b2;display:flex;gap:8px;margin:20px 0 13px;padding-bottom:7px}.section-title span{font-size:15pt;font-weight:700}.section-title h2{font-size:15pt;margin:0}.pdf-field{display:grid;grid-template-columns:205px 1fr;margin:7px 0}.pdf-field strong{font-size:10pt}.pdf-field span{border-bottom:1px dotted #aba396;min-height:17px;padding-bottom:1px}.legal-note{margin:12px 0}.legal-note strong{display:inline-block;min-width:220px}.location-title{font-size:11pt;font-weight:700;margin:18px 0 7px}.location-photo{margin:0}.location-photo img{border:1px solid #c8c0b2;display:block;max-height:390px;max-width:100%;object-fit:contain}.pdf-empty{color:#69726e;font-style:italic}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><header class="report-header"><img class="report-logo" src="${logoUrl}" alt="Logotipo Correduría Pública No. 6" /><div><h1>Correduría Pública No. 6</h1><p>Plaza Coahuila</p></div></header><section><div class="section-title"><span>I.-</span><h2>Antecedentes</h2></div>${pdfField("Solicitante:", appraisal.solicitante)}<p class="legal-note"><strong>Titular responsable del dictamen:</strong> Lic. Juan Manuel Barrera Martínez</p><p class="legal-note"><strong>Autorización:</strong> Habilitación de Corredor Público No. 6 para ejercer la función en la Plaza del Estado de Coahuila.</p><p class="legal-note"><strong>Autoridad que expide autorización:</strong> Secretaría de Economía.</p><p class="legal-note"><strong>Inscripción:</strong> Bajo el número 185, a Foja 69, del Libro de Registro de Corredores 2 de la Secretaría de Economía.</p><p class="legal-note"><strong>Fundamento:</strong> Se expide el presente avalúo, con las facultades que otorgan los artículos 5° y 6º fracción II de la Ley Federal de Correduría Pública.</p><p class="legal-note"><strong>Vigencia del Avalúo:</strong> El presente avalúo tiene una vigencia de 6 meses, a partir de la fecha de expedición.</p>${pdfField("Fecha de solicitud:", formatDate(appraisal.fechaSolicitud))}${pdfField("Fecha del Avalúo (visita):", formatDate(appraisal.fechaVisita))}${pdfField("Fecha del Avalúo:", formatDate(appraisal.fechaAvaluo))}${pdfField("Bienes a valuar:", appraisal.bienesAValuar)}${pdfField("Propietario:", appraisal.propietario)}${pdfField("Ubicación de los Bienes:", appraisal.ubicacionBienes)}${pdfField("Objeto del avalúo:", appraisal.objetivoAvaluo)}${pdfField("Propósito del avalúo:", appraisal.propositoAvaluo)}<div class="antecedents-bottom">${locationPhoto}<div class="signature-cover"><p class="signature-role">Titular de la Correduría</p><div class="signature-space"></div><strong>Lic. Juan Manuel Barrera Martínez</strong><p class="signature-office">Correduría Pública No. 6<br />Plaza Coahuila</p></div></div></section></body></html>`);
    reportWindow.document.head.insertAdjacentHTML("beforeend", `<style>
      @page{size:letter;margin:17mm 17mm 18mm}
      body{background:#fff;color:#233835;font-family:Georgia,'Times New Roman',serif;font-size:10.5pt;line-height:1.52}
      .report-header{background:linear-gradient(105deg,#f8f4ea 0%,#fffdfa 62%,#f5eee0 100%);border-bottom:1px solid #b49355;border-top:4px solid #26443f;box-shadow:0 2px 0 rgba(38,68,63,.05);gap:15px;margin-bottom:25px;padding:15px 17px 14px;text-align:left}
      .report-logo{background:#fffdf8;border:1px solid #d9caa9;border-radius:2px;height:56px;padding:4px;width:70px}
      .report-header h1{color:#183b38;font-family:Georgia,'Times New Roman',serif;font-size:22pt;font-weight:700;letter-spacing:-.025em;line-height:1.05}
      .report-header p{color:#8d7140;font-family:'Avenir Next',Avenir,'Segoe UI',sans-serif;font-size:8.5pt;font-weight:800;letter-spacing:.12em;margin-top:5px;text-transform:uppercase}
      .section-title{border-bottom:1px solid #bfaa7f;gap:9px;margin:22px 0 15px;padding-bottom:8px}
      .section-title span{color:#9a7b42;font-family:'Avenir Next',Avenir,'Segoe UI',sans-serif;font-size:13.5pt;font-weight:800;letter-spacing:.04em}
      .section-title h2{color:#173b38;font-size:16pt;font-weight:700;letter-spacing:-.01em}
      .pdf-field{align-items:baseline;border-bottom:1px solid #e9e3d8;grid-template-columns:215px 1fr;margin:0;padding:7px 9px}
      .pdf-field:nth-of-type(odd){background:#fbfaf6}
      .pdf-field strong,.legal-note strong{color:#556967;font-family:'Avenir Next',Avenir,'Segoe UI',sans-serif;font-size:7.7pt;font-weight:800;letter-spacing:.07em;text-transform:uppercase}
      .pdf-field span{border-bottom:0;color:#263d3a;font-size:10.4pt;padding:0}
      .legal-note{border-left:3px solid #c2aa76;margin:9px 0;padding:4px 0 4px 12px}
      .legal-note strong{display:block;margin-bottom:2px;min-width:0}
      .location-title{border-bottom:1px solid #bfaa7f;color:#556967;font-family:'Avenir Next',Avenir,'Segoe UI',sans-serif;font-size:8pt;font-weight:800;letter-spacing:.1em;margin-top:23px;padding-bottom:7px;text-transform:uppercase}
      .location-photo{background:#fbfaf6;border:1px solid #e0d8c9;padding:8px}
      .location-photo img{border:0;box-shadow:0 4px 12px rgba(29,50,46,.12);margin:0 auto}
      .pdf-empty{background:#fbfaf6;border-left:3px solid #c2aa76;font-family:'Avenir Next',Avenir,'Segoe UI',sans-serif;padding:10px 12px}
      @page{size:letter;margin:11mm 15mm}
      body{color:#233835;font-family:Georgia,'Times New Roman',serif;font-size:8.85pt;line-height:1.28}
      .report-header{align-items:flex-start;background:transparent;border-bottom:1px solid #b49355;border-top:3px solid #26443f;box-shadow:none;gap:16px;justify-content:space-between;margin-bottom:10px;padding:8px 0 7px;text-align:left}
      .report-header>div{flex:1;order:1;text-align:left}
      .report-logo{background:transparent;border:0;border-radius:0;height:47px;object-fit:contain;order:2;padding:0;width:66px}
      .report-header h1{color:#183b38;font-family:Georgia,'Times New Roman',serif;font-size:19pt;font-weight:500;letter-spacing:-.04em;line-height:1.02;margin:0}
      .report-header p,.section-title span,.pdf-field strong,.legal-note strong,.location-title,.pdf-empty{font-family:Georgia,'Times New Roman',serif}
      .report-header p{color:#6c6250;font-size:10pt;font-weight:400;letter-spacing:0;margin:2px 0 0;text-transform:none}
      .section-title{border-bottom:1px solid #bfaa7f;gap:7px;margin:9px 0 6px;padding-bottom:4px}
      .section-title span{color:#735b2f;font-size:11pt;font-weight:700;letter-spacing:0}
      .section-title h2{color:#173b38;font-family:Georgia,'Times New Roman',serif;font-size:13pt;font-weight:700;letter-spacing:0}
      .pdf-field{align-items:baseline;background:transparent!important;border-bottom:1px solid #e9e3d8;grid-template-columns:178px 1fr;margin:0;padding:5px 0}
      .pdf-field strong,.legal-note strong{color:#354744;font-size:8.55pt;font-weight:700;letter-spacing:0;text-transform:none}
      .pdf-field span{color:#263d3a;font-size:8.85pt;line-height:1.28;padding:0}
      .legal-note{align-items:baseline;border-left:0;display:grid;gap:8px;grid-template-columns:178px 1fr;margin:5px 0;padding:2px 0}
      .legal-note strong{display:block;margin:0;min-width:0}
      .location-title{border-bottom:1px solid #bfaa7f;color:#354744;font-size:9pt;font-weight:700;letter-spacing:0;margin:8px 0 4px;padding-bottom:3px;text-transform:none}
      .location-photo{aspect-ratio:16/9;background:transparent;border:0;break-inside:avoid;margin:0 auto;padding:0;width:min(100%,575px)}
      .location-photo img{border:0;box-shadow:none;height:100%!important;margin:0!important;max-height:none!important;max-width:none!important;object-fit:cover;width:100%!important}
      .pdf-empty{background:#fbfaf6;border-left:2px solid #c2aa76;font-size:8.8pt;padding:6px 9px}
      .report-header{border:0;margin-bottom:5px;padding:3px 0 5px}
      .report-header h1{font-size:21pt}
      .report-folio{color:#354744;font-family:Georgia,'Times New Roman',serif;font-size:9.5pt;margin:4px 0 19px;text-align:left}
      .report-folio strong{font-weight:700}
      .section-title{border-bottom:1px solid #bfaa7f;border-top:3px solid #26443f;margin:0 0 10px;padding:10px 0 6px}
      .section-title{padding-top:22px}
      .pdf-field{display:block;padding:5px 0}
      .pdf-field strong{display:inline;margin-right:6px}
      .pdf-field span{display:inline}
      .legal-note{display:block;margin:5px 0;padding:2px 0}
      .legal-note strong{display:inline;margin-right:6px}
      .report-folio{font-size:10.6pt;position:relative;top:9px}
      .pdf-field,.legal-note{font-size:11.2pt;line-height:1.32}
      .pdf-field strong,.legal-note strong{font-size:11.2pt}
      .pdf-field span{font-size:11.2pt}
      .location-title{margin:14px 0 15px}
      .location-photo{margin:0;width:100%}
      .pdf-characteristics{break-before:page;page-break-before:always}
      .pdf-characteristics .section-title{margin-bottom:13px;padding-top:12px}
      .characteristics-lead{font-size:11.2pt;line-height:1.32;margin:0 0 14px}
      .characteristics-lead strong,.vehicle-unit-name strong{font-weight:700}
      .pdf-vehicle{break-inside:avoid;margin:0 0 18px;page-break-inside:avoid}
      .pdf-vehicle+.pdf-vehicle{border-top:1px solid #bfaa7f;padding-top:13px}
      .vehicle-unit-name{font-size:11.2pt;margin:0 0 8px}
      .vehicle-characteristics-table{border-collapse:collapse;font-size:8.6pt;table-layout:fixed;width:100%}
      .vehicle-characteristics-table th{background:#e8e2d4;border:1px solid #bfae8c;color:#263d3a;font-size:8pt;font-weight:700;padding:5px;text-align:left}
      .vehicle-characteristics-table td{border:1px solid #d7cdb9;padding:6px 5px;vertical-align:top;word-break:break-word}
      .vehicle-characteristics-table th:nth-child(1),.vehicle-characteristics-table th:nth-child(2){width:12%}
      .vehicle-characteristics-table th:nth-child(3){width:7%}
      .vehicle-characteristics-table th:nth-child(4){width:25%}
      .vehicle-characteristics-table th:nth-child(5){width:12%}
      .vehicle-characteristics-table th:nth-child(6){width:25%;font-size:8.2pt}
      .vehicle-photos-title{border-bottom:1px solid #bfaa7f;font-size:9.5pt;font-weight:700;margin:12px 0 10px;padding-bottom:4px}
      .vehicle-photo-grid{display:grid;gap:9px;grid-template-columns:repeat(2,minmax(0,1fr));width:100%}
      .vehicle-report-photo{aspect-ratio:16/10;border:1px solid #cfc2a7;margin:0;overflow:hidden}
      .vehicle-report-photo img{display:block;height:100%;object-fit:cover;width:100%}
      .vehicle-report-photo.is-empty{align-items:center;background:#fbfaf6;color:#7c817a;display:flex;font-size:8.5pt;font-style:italic;justify-content:center;padding:9px;text-align:center}
      .depreciation-title{border-bottom:1px solid #bfaa7f;color:#263d3a;font-size:9.4pt;font-weight:700;margin:15px 0 8px;padding-bottom:4px}
      .depreciation-grid{display:grid;gap:7px;grid-template-columns:repeat(2,minmax(0,1fr))}
      .depreciation-grid>div{align-items:baseline;border-bottom:1px solid #e0d7c7;display:flex;justify-content:space-between;padding:5px 0}
      .depreciation-grid span{color:#354744;font-size:9.4pt}
      .depreciation-grid strong{color:#183b38;font-size:10.3pt}
      .depreciation-detail{break-inside:avoid;margin-top:2px;page-break-inside:avoid}
      .depreciation-group{margin:0 0 10px}
      .depreciation-group h3{color:#354744;font-size:9.5pt;font-weight:700;margin:0 0 6px}
      .depreciation-factor-grid{display:grid;gap:5px;grid-template-columns:repeat(3,minmax(0,1fr))}
      .depreciation-factor{align-items:baseline;border-bottom:1px solid #e4dccd;display:flex;gap:6px;justify-content:space-between;padding:3px 0}
      .depreciation-factor span{color:#4a5b57;font-size:8.8pt}
      .depreciation-factor strong{color:#183b38;font-size:9.4pt}
      .depreciation-factor.is-empty{grid-column:1 / -1}
      .depreciation-average{font-size:9.3pt;margin:6px 0 0;text-align:right}
      .depreciation-summary{border-top:2px solid #26443f;display:grid;gap:7px;grid-template-columns:repeat(2,minmax(0,1fr));margin-top:13px;padding-top:8px}
      .depreciation-summary>div{align-items:baseline;display:flex;justify-content:space-between;gap:8px}
      .depreciation-summary span{color:#354744;font-size:9.4pt;font-weight:700}
      .depreciation-summary strong{color:#183b38;font-size:10.4pt}
      .obsolescence-averages{display:grid;gap:5px;margin-top:10px}
      .obsolescence-averages>div{align-items:baseline;display:flex;gap:8px;justify-content:flex-start}
      .obsolescence-averages span{color:#354744;font-size:9.4pt;font-weight:700}
      .obsolescence-averages strong{color:#183b38;font-size:10.4pt}
      .pdf-characteristics{font-size:11.2pt;line-height:1.32}
      .vehicle-characteristics-table{font-size:10.4pt}
      .vehicle-characteristics-table th{font-size:9.7pt}
      .vehicle-characteristics-table td{padding:7px 6px}
      .vehicle-photos-title{font-size:11.2pt}
      .vehicle-report-photo.is-empty{font-size:10pt}
      .depreciation-title{font-size:11.2pt}
      .depreciation-group h3{font-size:11.2pt}
      .depreciation-factor{padding:5px 0}
      .depreciation-factor span{font-size:10.4pt}
      .depreciation-factor strong{font-size:11.2pt}
      .depreciation-average{font-size:10.8pt}
      .obsolescence-averages span,.depreciation-summary span{font-size:10.8pt}
      .obsolescence-averages strong,.depreciation-summary strong{font-size:11.6pt}
      .vehicle-page{break-before:page;page-break-before:always}
      .pdf-considerations{break-before:page;display:flex;flex-direction:column;min-height:246mm;page-break-before:always}
      .pdf-considerations .section-title,.pdf-market-research .section-title,.pdf-values .section-title{padding-top:12px}
      .considerations-list{font-size:12pt;line-height:1.55;margin:12px 0 18px;padding-left:28px}
      .considerations-list li{margin:0 0 12px;padding-left:5px}
      .considerations-closing{border-top:2px solid #26443f;margin-top:auto;padding-top:12px}
      .considerations-closing p{font-size:11pt;font-weight:700;line-height:1.4;margin:0 0 8px}
      .pdf-market-research,.pdf-values{break-before:page;font-size:11.2pt;line-height:1.4;page-break-before:always}
      .pdf-market-research p{margin:0 0 11px}
      .report-subtitle{color:#263d3a;font-size:12pt;font-weight:700;margin:17px 0 8px}
      .market-research-table,.appraisal-values-table{border-collapse:collapse;font-size:10.3pt;margin:8px 0 15px;table-layout:fixed;width:100%}
      .market-research-table thead,.appraisal-values-table thead{display:table-header-group}
      .market-research-table th,.appraisal-values-table th{background:#e8e2d4;border:1px solid #bfae8c;color:#263d3a;font-size:9.5pt;font-weight:700;padding:6px;text-align:left}
      .market-research-table td,.appraisal-values-table td{border:1px solid #d7cdb9;padding:7px 6px;vertical-align:top;word-break:break-word}
      .market-research-table th:nth-child(1){width:31%}
      .market-research-table th:nth-child(2){width:22%}
      .market-research-table th:nth-child(3){width:24%}
      .market-research-table th:nth-child(4){width:23%}
      .market-research-table tfoot th,.appraisal-values-table tfoot th{background:#f6f1e5;font-size:10.6pt;padding:7px;text-align:right}
      .market-sources{border-top:1px solid #bfaa7f;margin-top:16px!important;padding-top:10px}
      .report-value-table{break-inside:avoid;margin:0 0 25px;page-break-inside:avoid}
      .value-caption{color:#4a5b57;font-size:9.7pt;font-weight:700;line-height:1.28;margin:0 0 9px}
      .appraisal-values-table{font-size:8.9pt}
      .appraisal-values-table th{font-size:8.25pt;padding:5px}
      .appraisal-values-table td{padding:6px 5px}
      .appraisal-values-table th:nth-child(1){width:15%}
      .appraisal-values-table th:nth-child(2){width:6%;white-space:nowrap}
      .appraisal-values-table th:nth-child(3){width:14%}
      .appraisal-values-table th:nth-child(4){width:13%}
      .appraisal-values-table th:nth-child(5){width:12%;white-space:nowrap}
      .appraisal-values-table th:nth-child(6){width:23%}
      .appraisal-values-table th:nth-child(7){width:17%}
      .amount-in-words{color:#354744;font-size:10.3pt;font-weight:700;margin:6px 0 0}
      .replacement-summary{border-top:2px solid #26443f;margin-top:3px;padding-top:9px}
      .replacement-summary p{font-size:10.6pt;margin:0 0 5px}
      .replacement-summary .tax-note{color:#596763;font-size:9.5pt;font-style:italic}
      .replacement-summary .amount-in-words{font-size:10.8pt}
      .pdf-legal-considerations{break-before:page;page-break-before:always;min-height:230mm;font-size:13pt;line-height:1.65}.pdf-legal-considerations .section-title h2{font-size:16pt}.pdf-legal-considerations .section-title span{font-size:13.5pt}.pdf-legal-considerations .values-legal-notice{margin-top:30px}.values-legal-notice{border-top:1px solid #bfaa7f;font-size:10.1pt;font-weight:700;line-height:1.38;margin:18px 0 0;padding-top:10px}
      .pdf-conclusion{break-before:page;display:flex;flex-direction:column;font-size:11.2pt;line-height:1.42;min-height:246mm;page-break-before:always}
      .pdf-conclusion .section-title{padding-top:12px}
      .pdf-conclusion>p{margin:0 0 10px}
      .signature-block{margin:48px auto 0;text-align:center}
      .signature-block p{margin:0 0 8px}
      .signature-block strong{display:block;font-size:12.2pt;margin-top:28px}
      .antecedents-bottom{align-items:end;break-inside:avoid;display:grid;gap:12mm;grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr);margin-top:12mm;page-break-inside:avoid}.antecedents-location>p{color:#354744;font-size:9.5pt;font-weight:700;margin:0 0 6px}.antecedents-location figure{align-items:center;aspect-ratio:16/10;border:1px solid #c8c0b2;display:flex;justify-content:center;margin:0;overflow:hidden}.antecedents-location img{display:block;height:100%;object-fit:cover;width:100%}.antecedents-location.is-empty figure{background:#fbfaf6;color:#777;font-style:italic}.signature-cover{text-align:center;margin:0}.signature-cover .signature-role{font-size:10pt;font-weight:400;margin:0}.signature-cover .signature-space{height:22mm}.signature-cover strong{display:block;font-size:10.5pt}.signature-cover .signature-office{font-size:10.5pt;font-weight:700;line-height:1.35;margin:8px 0 0}.pdf-conclusion{break-before:page;display:flex;flex-direction:column;min-height:246mm;page-break-before:always}.pdf-conclusion .signature-block{margin-top:auto;margin-bottom:22mm;text-align:center}.pdf-conclusion .signature-block p{font-size:11.2pt;font-weight:700;line-height:1.35;margin:0 0 5px}.pdf-conclusion .signature-space{height:22mm}.pdf-conclusion .signature-block strong{font-size:11pt}.conclusion-legal{border-top:2px solid #26443f;margin-top:auto;padding-top:10px}
      .conclusion-legal p{font-size:10.2pt;font-weight:700;line-height:1.36;margin:0 0 7px}
    </style>`);
    const reportHeader = reportWindow.document.querySelector(".report-header");
    if (reportHeader) reportHeader.insertAdjacentHTML("afterend", `<p class="report-folio"><strong>Número de avalúo:</strong> ${escapeHtml(appraisal.numeroAvaluo)}</p>`);
    const antecedentesTitle = reportWindow.document.querySelector(".section-title h2");
    if (antecedentesTitle) antecedentesTitle.textContent = "ANTECEDENTES";
    reportWindow.document.body.insertAdjacentHTML("beforeend", [renderPdfCharacteristics(appraisal), renderPdfConsiderations(appraisal), renderPdfMarketResearch(appraisal), renderPdfValues(appraisal), renderPdfLegalConsiderations(appraisal), renderPdfConclusion(appraisal)].join(""));
    reportWindow.document.close();
    reportWindow.focus();
    if (options.word) window.setTimeout(() => { window.ControlAvaluosWord?.exportHtml(reportWindow.document.documentElement.outerHTML, appraisal.numeroAvaluo); reportWindow.close(); }, 250);
  }

  function openTechnicalCreation() {
    setSubsection("crear");
    resetTechnicalForm();
    typeSelect.value = "";
    editor.hidden = true;
    typeHint.hidden = false;
    typeHint.innerHTML = "<strong>Selecciona una modalidad para comenzar.</strong><span>La primera ficha disponible será Automotriz.</span>";
    setTechnicalCreationMode(true);
  }

  async function refreshTechnicalFolio() {
    const selectedDate = technicalDateInput.value || new Date().toISOString().slice(0, 10);
    const year = selectedDate.slice(0, 4) || String(new Date().getFullYear());
    folioInput.value = "Calculando…";
    try { folioInput.value = await app.getNextTechnicalFolio(year); }
    catch { folioInput.value = `0015/${year}`; }
  }

  function renderConsiderations() {
    considerationList.innerHTML = considerations.length ? considerations.map((consideration, index) => `<article class="consideration-item"><div><span>Consideración ${index + 1}</span><p>${escapeHtml(consideration)}</p></div><div class="consideration-actions"><button data-edit-consideration="${index}" class="text-action-button" type="button">Editar</button><button data-delete-consideration="${index}" class="text-action-button is-danger" type="button">Eliminar</button></div></article>`).join("") : `<p class="consideration-empty">Aún no agregas consideraciones previas.</p>`;
    considerationList.querySelectorAll("[data-edit-consideration]").forEach((button) => button.addEventListener("click", () => {
      editingConsiderationIndex = Number(button.dataset.editConsideration);
      considerationInput.value = considerations[editingConsiderationIndex] || "";
      addConsiderationButton.textContent = "✓ Guardar consideración";
      considerationMessage.textContent = `Editando la consideración ${editingConsiderationIndex + 1}.`;
      considerationInput.focus();
    }));
    considerationList.querySelectorAll("[data-delete-consideration]").forEach((button) => button.addEventListener("click", () => {
      const index = Number(button.dataset.deleteConsideration);
      considerations.splice(index, 1);
      if (editingConsiderationIndex === index) { editingConsiderationIndex = null; considerationInput.value = ""; addConsiderationButton.textContent = "✓ Agregar consideración"; }
      if (editingConsiderationIndex !== null && editingConsiderationIndex > index) editingConsiderationIndex -= 1;
      considerationMessage.textContent = "Consideración eliminada.";
      renderConsiderations();
    }));
  }

  function addOrUpdateConsideration() {
    const text = considerationInput.value.trim();
    if (!text) { considerationMessage.textContent = "Escribe una consideración antes de agregarla."; considerationInput.focus(); return; }
    if (editingConsiderationIndex === null) considerations.push(text);
    else considerations[editingConsiderationIndex] = text;
    considerationInput.value = "";
    editingConsiderationIndex = null;
    addConsiderationButton.textContent = "✓ Agregar consideración";
    considerationMessage.textContent = "Consideración guardada.";
    renderConsiderations();
  }

  function numericValue(value) { return Math.max(0, Number(String(value || "").replace(",", ".")) || 0); }
  function money(value) { return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(numericValue(value)); }
  function marketDataFor(id) {
    if (!marketResearchStore.has(id)) marketResearchStore.set(id, { comparables: [{ fuente: "", valor: "", moneda: "MXN", tipoCambio: "1" }] });
    const data = marketResearchStore.get(id);
    if (!Array.isArray(data.comparables) || !data.comparables.length) {
      data.comparables = [{ fuente: data.fuente || "", valor: data.valor || "", moneda: data.moneda || "MXN", tipoCambio: data.tipoCambio || "1" }];
    }
    return data;
  }

  function comparableValue(comparable) {
    return model.convertToPesos(comparable.valor, comparable.moneda, comparable.tipoCambio);
  }

  function marketAverage(data) {
    const values = data.comparables.map(comparableValue).filter((value) => Number.isFinite(value) && value > 0);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  function valuesDataFor(id) {
    if (!valueStore.has(id)) valueStore.set(id, {
      marketQuantity: "1",
      marketReason: "Condiciones intrínsecas y extrínsecas",
      replacementQuantity: "1",
      replacementCoefficient: "",
      replacementReason: "Condiciones intrínsecas y extrínsecas",
    });
    return valueStore.get(id);
  }

  function vehicleName(card, index) {
    const named = card.querySelector("[data-vehicle-field='nombreUnidad']")?.value.trim();
    if (named) return named;
    const brandAndModel = [card.querySelector("[data-vehicle-field='marca']")?.value, card.querySelector("[data-vehicle-field='modelo']")?.value].filter(Boolean).join(" ");
    return brandAndModel || `Vehículo ${index + 1}`;
  }

  function vehicleCalculation(card) {
    const values = (group) => [...card.querySelectorAll(`[data-factor-group="${group}"]`)].map((control) => Number(control.value));
    return model.calculateObsolescence({ functionalGroupOne: values("functionalGroupOne"), functionalGroupTwo: values("functionalGroupTwo"), economic: values("economic") });
  }

  function valueRows() {
    return [...vehiclesContainer.querySelectorAll(".vehicle-card")].map((card, index) => {
      const id = card.dataset.vehicleId;
      const inputs = valuesDataFor(id);
      const marketInfo = marketDataFor(id);
      const calculation = vehicleCalculation(card);
      const market = model.calculateMarketValue({ quantity: inputs.marketQuantity, unitValue: marketAverage(marketInfo), factor: calculation.factor });
      const replacement = model.calculateReplacementValue({ quantity: inputs.replacementQuantity, unitValue: market.netUnitValue, coefficient: inputs.replacementCoefficient });
      return { id, index, name: vehicleName(card, index), inputs, calculation, market, replacement };
    });
  }

  function bindValueControls(container) {
    container.querySelectorAll("[data-value-id]").forEach((control) => control.addEventListener("change", () => {
      const entry = valuesDataFor(control.dataset.valueId);
      entry[control.dataset.valueField] = control.value;
      renderValues();
    }));
  }

  function renderValues() {
    if (!marketValueRows || !replacementValueRows) return;
    const rows = valueRows();
    marketValueRows.innerHTML = rows.map(({ id, name, inputs, market }) => `<tr><td class="value-unit-name">${escapeHtml(name)}</td><td><input data-value-id="${id}" data-value-field="marketQuantity" value="${escapeHtml(inputs.marketQuantity)}" type="number" min="0" step="1" inputmode="numeric" aria-label="Cantidad de ${escapeHtml(name)}" /></td><td>${money(market.unitValue)}</td><td>${market.coefficient.toFixed(4)}</td><td>${(market.demeritRate * 100).toFixed(2)} %</td><td><input data-value-id="${id}" data-value-field="marketReason" value="${escapeHtml(inputs.marketReason)}" aria-label="Motivo del coeficiente de ${escapeHtml(name)}" /></td><td>${money(market.netValue)}</td></tr>`).join("") || `<tr><td colspan="7" class="values-empty">Agrega un vehículo para calcular los valores.</td></tr>`;
    replacementValueRows.innerHTML = rows.map(({ id, name, inputs, market, replacement }) => `<tr><td class="value-unit-name">${escapeHtml(name)}</td><td><input data-value-id="${id}" data-value-field="replacementQuantity" value="${escapeHtml(inputs.replacementQuantity)}" type="number" min="0" step="1" inputmode="numeric" aria-label="Cantidad de reposición de ${escapeHtml(name)}" /></td><td>${money(market.netUnitValue)}</td><td><input data-value-id="${id}" data-value-field="replacementCoefficient" value="${escapeHtml(inputs.replacementCoefficient)}" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Ej. 10" aria-label="Coeficiente de ${escapeHtml(name)}" /></td><td>${money(replacement.demeritAmount * replacement.quantity)}</td><td><input data-value-id="${id}" data-value-field="replacementReason" value="${escapeHtml(inputs.replacementReason)}" aria-label="Motivo del coeficiente de reposición de ${escapeHtml(name)}" /></td><td>${money(replacement.netValue)}</td></tr>`).join("") || `<tr><td colspan="7" class="values-empty">Agrega un vehículo para calcular los valores.</td></tr>`;
    const marketTotal = model.roundToPeso(rows.reduce((total, row) => total + row.market.netValue, 0));
    const replacementTotal = model.roundToPeso(rows.reduce((total, row) => total + row.replacement.netValue, 0));
    marketValueTotal.textContent = money(marketTotal);
    replacementValueTotal.textContent = money(replacementTotal);
    marketValueWords.textContent = model.amountInWords(marketTotal);
    replacementValueWords.textContent = model.amountInWords(replacementTotal);
    const selectedSource = selectedValueSource?.value === "replacement" ? "replacement" : "market";
    const selectedTotal = selectedSource === "replacement" ? replacementTotal : marketTotal;
    if (selectedValueTotal) selectedValueTotal.textContent = money(selectedTotal);
    if (selectedValueWords) selectedValueWords.textContent = model.amountInWords(selectedTotal);
    bindValueControls(marketValueRows);
    bindValueControls(replacementValueRows);
  }

  selectedValueSource?.addEventListener("change", renderValues);

  function updateMarketValue(id) {
    const entry = marketDataFor(id);
    const card = marketResearchContainer.querySelector(`[data-market-vehicle-id="${id}"]`);
    if (!card) return;
    card.querySelectorAll("[data-market-row]").forEach((row, index) => {
      const comparable = entry.comparables[index] || (entry.comparables[index] = { fuente: "", valor: "", moneda: "MXN", tipoCambio: "1" });
      comparable.fuente = row.querySelector("[data-market-field='fuente']").value.trim();
      comparable.valor = row.querySelector("[data-market-field='valor']").value;
      comparable.moneda = row.querySelector("[data-market-field='moneda']").value;
      comparable.tipoCambio = comparable.moneda === "MXN" ? "1" : row.querySelector("[data-market-field='tipoCambio']").value;
      const exchange = comparable.moneda === "MXN" ? 1 : numericValue(comparable.tipoCambio);
      row.querySelector("[data-market-field='tipoCambio']").disabled = comparable.moneda === "MXN";
      row.querySelector("[data-market-value]").textContent = money(model.convertToPesos(comparable.valor, comparable.moneda, exchange));
    });
    entry.comparables = entry.comparables.slice(0, card.querySelectorAll("[data-market-row]").length);
    card.querySelector("[data-market-average]").textContent = money(marketAverage(entry));
    renderValues();
  }

  function renderMarketResearch() {
    const cards = [...vehiclesContainer.querySelectorAll(".vehicle-card")];
    marketResearchContainer.innerHTML = cards.map((vehicleCard, index) => {
      const id = vehicleCard.dataset.vehicleId;
      const data = marketDataFor(id);
      const title = vehicleName(vehicleCard, index);
      const rows = data.comparables.map((comparable, comparableIndex) => `<div class="market-comparable-row" data-market-row><div class="market-comparable-heading"><strong>Comparables ${comparableIndex + 1}</strong>${data.comparables.length > 1 ? `<button class="text-action-button is-danger" data-remove-market="${id}:${comparableIndex}" type="button">Eliminar</button>` : ""}</div><div class="form-grid technical-grid market-research-grid"><label>Fuente consultada<input data-market-field="fuente" value="${escapeHtml(comparable.fuente || "")}" placeholder="Ej. Seminuevos.com, Mercado Libre" /></label><label>Valor de mercado<input data-market-field="valor" value="${escapeHtml(comparable.valor || "")}" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" /></label><label>Moneda<select data-market-field="moneda"><option value="MXN"${comparable.moneda === "MXN" ? " selected" : ""}>Pesos mexicanos (MXN)</option><option value="USD"${comparable.moneda === "USD" ? " selected" : ""}>Dólares estadounidenses (USD)</option><option value="EUR"${comparable.moneda === "EUR" ? " selected" : ""}>Euros (EUR)</option></select></label><label>Tipo de cambio a MXN<input data-market-field="tipoCambio" value="${escapeHtml(comparable.tipoCambio || "1")}" type="number" min="0" step="0.0001" inputmode="decimal" placeholder="Ej. 17.80" /></label></div><div class="market-conversion"><span>Convertido a pesos mexicanos</span><strong data-market-value>${money(comparableValue(comparable))}</strong></div></div>`).join("");
      return `<article class="market-research-card" data-market-vehicle-id="${id}"><header><span>Vehículo ${index + 1}</span><strong>${escapeHtml(title)}</strong></header><div class="market-comparables-list">${rows}</div><div class="market-card-actions"><button class="subtle-action-button" data-add-market="${id}" type="button">＋ Agregar nuevo mercado</button><div class="market-average"><span>Promedio de mercado en pesos mexicanos</span><strong data-market-average>${money(marketAverage(data))}</strong></div></div></article>`;
    }).join("");
    marketResearchContainer.querySelectorAll(".market-research-card").forEach((card) => {
      const id = card.dataset.marketVehicleId;
      card.querySelectorAll("input, select").forEach((control) => control.addEventListener("input", () => updateMarketValue(id)));
      card.querySelectorAll("select[data-market-field='moneda']").forEach((control) => control.addEventListener("change", () => updateMarketValue(id)));
      card.querySelector("[data-add-market]").addEventListener("click", () => { marketDataFor(id).comparables.push({ fuente: "", valor: "", moneda: "MXN", tipoCambio: "1" }); renderMarketResearch(); });
      card.querySelectorAll("[data-remove-market]").forEach((button) => button.addEventListener("click", () => { const [, rawIndex] = button.dataset.removeMarket.split(":"); const data = marketDataFor(id); data.comparables.splice(Number(rawIndex), 1); renderMarketResearch(); }));
      updateMarketValue(id);
    });
  }

  function populateObjectives(selected = "") {
    const custom = app.getTechnicalObjectives().filter((value) => !baseObjectives.includes(value));
    objectiveSelect.innerHTML = `<option value="">Selecciona el objeto del avalúo</option>${baseObjectives.concat(custom).map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}<option value="Otro">Otro</option>`;
    if (selected && [...objectiveSelect.options].some((option) => option.value === selected)) objectiveSelect.value = selected;
  }

  function renderPhotoPreview(cardId) {
    const gallery = document.querySelector(`[data-photo-gallery="${cardId}"]`);
    const photos = photoStore.get(cardId) || [];
    gallery.innerHTML = photos.length ? photos.map((photo, index) => `<figure class="photo-preview"><img src="${escapeHtml(photo.url || photo.dataUrl || "")}" alt="Fotografía ${index + 1} del vehículo" /><button class="remove-photo-button" data-remove-photo="${cardId}:${index}" type="button" aria-label="Quitar fotografía ${index + 1}">×</button></figure>`).join("") : `<p class="photo-empty">Aún no se agregan fotografías.</p>`;
    gallery.querySelectorAll("[data-remove-photo]").forEach((button) => button.addEventListener("click", () => {
      const [, rawIndex] = button.dataset.removePhoto.split(":");
      const next = [...(photoStore.get(cardId) || [])];
      next.splice(Number(rawIndex), 1);
      photoStore.set(cardId, next);
      renderPhotoPreview(cardId);
    }));
  }

  function formatMetric(value) { return Number(value || 0).toFixed(4); }

  function updateVehicleCalculation(card) {
    const result = vehicleCalculation(card);
    card.querySelector("[data-metric='functional-one']").textContent = formatMetric(result.firstFunctionalAverage);
    card.querySelector("[data-metric='functional-two']").textContent = formatMetric(result.secondFunctionalAverage);
    card.querySelector("[data-metric='functional']").textContent = formatMetric(result.functional);
    card.querySelector("[data-metric='economic']").textContent = formatMetric(result.economic);
    card.querySelector("[data-metric='factor']").textContent = formatMetric(result.factor);
    card.querySelector("[data-metric='demerit']").textContent = `${(result.demerit * 100).toFixed(2)} %`;
  }

  function vehicleMarkup(id, position) {
    return `<article class="vehicle-card" data-vehicle-id="${id}">
      <header class="vehicle-card-header"><div><span class="vehicle-index">Vehículo ${position}</span><h4>Características del bien</h4></div><button class="remove-vehicle-button" data-remove-vehicle="${id}" type="button">Eliminar vehículo</button></header>
      <div class="form-grid technical-grid vehicle-basics">
        <label class="full-width">Nombre de la unidad *<input data-vehicle-field="nombreUnidad" required placeholder="Ej. Camioneta tipo pickup" /></label>
        <label>Marca *<input data-vehicle-field="marca" required placeholder="Ej. Toyota" /></label>
        <label>Modelo *<input data-vehicle-field="modelo" required placeholder="Ej. Hilux" /></label>
        <label>Año *<input data-vehicle-field="anio" required inputmode="numeric" maxlength="4" placeholder="Ej. 2022" /></label>
        <label>Número de serie *<input data-vehicle-field="numeroSerie" required placeholder="VIN o número de serie" /></label>
        <label>Placas *<input data-vehicle-field="placas" required placeholder="Ej. ABC-123-A" /></label>
        <label>Kilometraje<input data-vehicle-field="kilometraje" type="text" inputmode="numeric" placeholder="Ej. 85,000 km" /></label>
        <label class="full-width">Condiciones *<textarea data-vehicle-field="condiciones" rows="2" required placeholder="Describe las condiciones generales del vehículo"></textarea></label>
      </div>
      <section class="vehicle-photos"><div class="subsection-heading"><div><h5>Fotografías</h5><p>Hasta cuatro fotografías por vehículo. Se comprimen para guardarse en el servidor de la oficina.</p></div><label class="photo-upload-button">Agregar fotografías<input data-photo-input="${id}" accept="image/*" multiple type="file" /></label></div><div class="photo-preview-grid" data-photo-gallery="${id}"></div></section>
      <section class="obsolescence-panel"><div class="subsection-heading"><div><h5>Obsolescencia funcional</h5><p>Califica cada elemento según la escala: <span class="factor-scale">Muy malo: 0.5 · Malo: 0.75 · Regular: 0.9 · Bueno: 1.0 · Muy bueno: 1.15 · Excelente: 1.3</span></p></div></div><div class="obsolescence-groups"><section class="factor-group"><h6>Grupo 1 · Carrocería y motor</h6><div class="factor-grid">${factorControls(model.FUNCTIONAL_GROUPS.carroceria, "functionalGroupOne")}</div><p class="factor-result">Promedio del grupo: <strong data-metric="functional-one">1.0000</strong></p></section><section class="factor-group"><h6>Grupo 2 · Componentes</h6><div class="factor-grid">${factorControls(model.FUNCTIONAL_GROUPS.componentes, "functionalGroupTwo")}</div><p class="factor-result">Promedio del grupo: <strong data-metric="functional-two">1.0000</strong></p></section></div><div class="obsolescence-summary functional-summary"><span>Obsolescencia funcional</span><strong data-metric="functional">1.0000</strong></div></section>
      <section class="obsolescence-panel"><div class="subsection-heading"><div><h5>Obsolescencia económica</h5><p>Considera las condiciones de uso y del mercado.</p></div></div><div class="factor-grid economic-grid">${factorControls(model.ECONOMIC_FACTORS, "economic")}</div><div class="obsolescence-summary economic-summary"><span>Obsolescencia económica</span><strong data-metric="economic">1.0000</strong></div></section>
      <section class="demerit-summary"><div><span>Factor por demérito</span><strong data-metric="factor">1.0000</strong></div><div><span>Porcentaje de demérito</span><strong data-metric="demerit">0.00 %</strong></div></section>
    </article>`;
  }

  function renumberVehicles() {
    [...vehiclesContainer.querySelectorAll(".vehicle-card")].forEach((card, index) => {
      card.querySelector(".vehicle-index").textContent = `Vehículo ${index + 1}`;
      card.querySelector(".remove-vehicle-button").hidden = index === 0 && vehiclesContainer.children.length === 1;
    });
  }

  function addVehicle(initialVehicle = null, initialValues = null) {
    vehicleSequence += 1;
    const id = `vehiculo-${Date.now()}-${vehicleSequence}`;
    photoStore.set(id, []);
    marketDataFor(id);
    vehiclesContainer.insertAdjacentHTML("beforeend", vehicleMarkup(id, vehiclesContainer.children.length + 1));
    const card = vehiclesContainer.lastElementChild;
    card.querySelectorAll(".factor-select").forEach((input) => input.addEventListener("change", () => { updateVehicleCalculation(card); renderValues(); }));
    card.querySelectorAll("[data-vehicle-field='nombreUnidad'], [data-vehicle-field='marca'], [data-vehicle-field='modelo']").forEach((input) => input.addEventListener("input", () => { renderMarketResearch(); renderValues(); }));
    card.querySelectorAll("[data-vehicle-field='kilometraje']").forEach((input) => input.addEventListener("input", () => {
      card.querySelectorAll("[data-vehicle-field='kilometraje']").forEach((other) => { if (other !== input) other.value = input.value; });
    }));
    card.querySelector(`[data-photo-input="${id}"]`).addEventListener("change", (event) => addPhotos(id, event.target.files));
    card.querySelector(`[data-remove-vehicle="${id}"]`).addEventListener("click", () => {
      if (vehiclesContainer.children.length === 1) return;
      photoStore.delete(id);
      marketResearchStore.delete(id);
      valueStore.delete(id);
      card.remove();
      renumberVehicles();
      renderMarketResearch();
      renderValues();
    });
    if (initialVehicle) {
      ["nombreUnidad", "marca", "modelo", "anio", "numeroSerie", "placas", "kilometraje", "condiciones"].forEach((field) => {
        const input = card.querySelector(`[data-vehicle-field="${field}"]`);
        if (input) input.value = initialVehicle[field] || "";
      });
      const setFactors = (group, factors) => card.querySelectorAll(`[data-factor-group="${group}"]`).forEach((control, index) => { control.value = String(factors?.[index]?.valor ?? 1); });
      setFactors("functionalGroupOne", initialVehicle.factores?.funcionalGrupoUno);
      setFactors("functionalGroupTwo", initialVehicle.factores?.funcionalGrupoDos);
      setFactors("economic", initialVehicle.factores?.economica);
      photoStore.set(id, Array.isArray(initialVehicle.fotografias) ? initialVehicle.fotografias : []);
      const savedMarket = initialVehicle.investigacionMercado || {};
      marketResearchStore.set(id, { comparables: Array.isArray(savedMarket.comparables) && savedMarket.comparables.length ? savedMarket.comparables : [{ fuente: savedMarket.fuente || "", valor: savedMarket.valor || "", moneda: savedMarket.moneda || "MXN", tipoCambio: savedMarket.tipoCambio || "1" }] });
      valueStore.set(id, {
        marketQuantity: initialValues?.mercado?.marketQuantity || "1",
        marketReason: initialValues?.mercado?.marketReason || "Condiciones intrínsecas y extrínsecas",
        replacementQuantity: initialValues?.reposicion?.replacementQuantity || "1",
        replacementCoefficient: initialValues?.reposicion?.replacementCoefficient || "",
        replacementReason: initialValues?.reposicion?.replacementReason || "Condiciones intrínsecas y extrínsecas",
      });
    }
    renderPhotoPreview(id);
    updateVehicleCalculation(card);
    renumberVehicles();
    renderMarketResearch();
    renderValues();
    window.requestAnimationFrame(() => {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.querySelector("[data-vehicle-field='nombreUnidad']")?.focus();
    });
  }

  function readAndCompressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("No se pudo leer una de las fotografías."));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("Una fotografía no tiene un formato compatible."));
        image.onload = () => {
          const maxDimension = 1100;
          const ratio = Math.min(1, maxDimension / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * ratio));
          canvas.height = Math.max(1, Math.round(image.height * ratio));
          canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve({ name: file.name, dataUrl: canvas.toDataURL("image/jpeg", 0.72) });
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function addPhotos(id, rawFiles) {
    const current = photoStore.get(id) || [];
    const files = [...rawFiles].filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;
    if (current.length + files.length > 4) {
      message.textContent = "Cada vehículo admite un máximo de cuatro fotografías.";
      return;
    }
    message.textContent = "Preparando fotografías…";
    try {
      const prepared = await Promise.all(files.map(readAndCompressImage));
      photoStore.set(id, current.concat(prepared));
      renderPhotoPreview(id);
      message.textContent = "";
    } catch (error) {
      message.textContent = error.message;
    }
  }

  function renderLocationImage() {
    if (!locationPreview) return;
    locationPreview.innerHTML = locationDataUrl ? `<figure class="automotriz-location-figure"><img src="${locationDataUrl}" alt="Ubicación de los bienes" /><button id="removeAutomotrizLocationPhoto" class="remove-photo-button" type="button" aria-label="Quitar fotografía de ubicación">×</button></figure>` : "";
    locationPreview.querySelector("#removeAutomotrizLocationPhoto")?.addEventListener("click", () => { locationDataUrl = ""; if (locationPhotoInput) locationPhotoInput.value = ""; renderLocationImage(); });
  }

  function collectFactors(card, group) {
    return [...card.querySelectorAll(`[data-factor-group="${group}"]`)].map((control) => ({ nombre: control.dataset.factorName, calificacion: control.options[control.selectedIndex].text, valor: Number(control.value) }));
  }

  function collectVehicle(card) {
    const get = (name) => card.querySelector(`[data-vehicle-field="${name}"]`).value.trim();
    const functionalGroupOne = collectFactors(card, "functionalGroupOne");
    const functionalGroupTwo = collectFactors(card, "functionalGroupTwo");
    const economic = collectFactors(card, "economic");
    const calculation = model.calculateObsolescence({
      functionalGroupOne: functionalGroupOne.map((item) => item.valor),
      functionalGroupTwo: functionalGroupTwo.map((item) => item.valor),
      economic: economic.map((item) => item.valor),
    });
    return {
      nombreUnidad: get("nombreUnidad"), marca: get("marca"), modelo: get("modelo"), anio: get("anio"), numeroSerie: get("numeroSerie"), placas: get("placas"), kilometraje: get("kilometraje"), condiciones: get("condiciones"),
      fotografias: photoStore.get(card.dataset.vehicleId) || [],
      investigacionMercado: { comparables: marketDataFor(card.dataset.vehicleId).comparables, valor: marketAverage(marketDataFor(card.dataset.vehicleId)), moneda: "MXN", tipoCambio: "1", valorEnPesos: marketAverage(marketDataFor(card.dataset.vehicleId)) },
      factores: { funcionalGrupoUno: functionalGroupOne, funcionalGrupoDos: functionalGroupTwo, economica: economic },
      calculo: calculation,
    };
  }
  async function persistAutomotiveImages(appraisal) {
    const utils = window.ControlAvaluosImageUtils;
    if (!utils) return appraisal;
    appraisal.localizacionFoto = appraisal.localizacionFoto?.startsWith?.("data:") ? (await utils.uploadDataUrl(appraisal.localizacionFoto, `localizacion-${appraisal.numeroAvaluo}.jpg`))?.url || "" : appraisal.localizacionFoto;
    appraisal.vehiculos = await Promise.all(appraisal.vehiculos.map(async (vehicle, vehicleIndex) => ({
      ...vehicle,
      fotografias: await Promise.all((vehicle.fotografias || []).map(async (photo, photoIndex) => {
        if (photo?.url) return photo;
        const stored = await utils.uploadDataUrl(photo?.dataUrl, `vehiculo-${vehicleIndex + 1}-${photoIndex + 1}.jpg`);
        return stored ? { name: stored.name, type: stored.type, size: stored.size, url: stored.url, storageName: stored.storageName } : null;
      })).then((photos) => photos.filter(Boolean)),
    })));
    return appraisal;
  }

  function resetTechnicalForm() {
    form.reset();
    document.querySelector(".appraisal-type-panel")?.classList.remove("is-hidden");
    if (selectedTypeMessage) { selectedTypeMessage.hidden = true; selectedTypeMessage.textContent = ""; }
    message.textContent = "";
    photoStore.clear();
    marketResearchStore.clear();
    valueStore.clear();
    editingTechnicalId = null;
    editingTechnicalCreatedAt = null;
    locationDataUrl = "";
    if (locationPhotoInput) locationPhotoInput.value = "";
    renderLocationImage();
    vehiclesContainer.innerHTML = "";
    considerations = [];
    editingConsiderationIndex = null;
    considerationInput.value = "";
    considerationMessage.textContent = "";
    addConsiderationButton.textContent = "✓ Agregar consideración";
    otherObjectiveField.hidden = true;
    otherObjectiveInput.required = false;
    populateObjectives();
    addVehicle();
    renderConsiderations();
    refreshTechnicalFolio();
  }

  function setFormValue(name, value) {
    const field = form.elements.namedItem(name);
    if (field) field.value = value || "";
  }

  function openTechnicalEdit(appraisal) {
    if (appraisal?.tipo === "mobiliario" || appraisal?.tipo === "maquinaria") { window.dispatchEvent(new CustomEvent("control-avaluos:open-mobiliario-edit", { detail: appraisal })); return; }
    if (!app.canEdit()) { window.alert("Tu rol es de solo lectura y no puede editar avalúos."); return; }
    form.reset();
    photoStore.clear();
    marketResearchStore.clear();
    valueStore.clear();
    vehiclesContainer.innerHTML = "";
    considerations = [...(appraisal.consideraciones || [])];
    editingConsiderationIndex = null;
    editingTechnicalId = appraisal.id;
    editingTechnicalCreatedAt = appraisal.creadoEn || appraisal.createdAt || null;
    setSubsection("crear");
    setTechnicalCreationMode(true);
    typeSelect.value = appraisal?.tipo === "maquinaria" ? "maquinaria-equipo" : "automotriz";
    document.querySelector(".appraisal-type-panel")?.classList.add("is-hidden");
    if (selectedTypeMessage) { selectedTypeMessage.hidden = false; selectedTypeMessage.textContent = `Tipo de avalúo: ${typeSelect.options[typeSelect.selectedIndex]?.text || "Automotriz"}`; }
    editor.hidden = false;
    typeHint.hidden = true;
    setupTechnicalWizard();
    form._technicalWizardGoTo?.(0);
    folioInput.value = appraisal.numeroAvaluo || "";
    setFormValue("solicitante", appraisal.solicitante);
    setFormValue("fechaSolicitud", appraisal.fechaSolicitud);
    setFormValue("fechaVisita", appraisal.fechaVisita);
    setFormValue("fechaAvaluo", appraisal.fechaAvaluo);
    setFormValue("bienesAValuar", appraisal.bienesAValuar);
    setFormValue("propietario", appraisal.propietario);
    setFormValue("ubicacionBienes", appraisal.ubicacionBienes);
    setFormValue("propositoAvaluo", appraisal.propositoAvaluo);
    locationDataUrl = appraisal.localizacionFoto || "";
    renderLocationImage();
    populateObjectives(appraisal.objetivoAvaluo);
    if ([...objectiveSelect.options].some((option) => option.value === appraisal.objetivoAvaluo)) objectiveSelect.value = appraisal.objetivoAvaluo;
    else { objectiveSelect.value = "Otro"; otherObjectiveField.hidden = false; otherObjectiveInput.required = true; otherObjectiveInput.value = appraisal.objetivoAvaluo || ""; }
    if (selectedValueSource) selectedValueSource.value = appraisal.enfoqueValor === "replacement" ? "replacement" : "market";
    (appraisal.vehiculos || []).forEach((vehicle, index) => addVehicle(vehicle, appraisal.valores?.[index]));
    if (!vehiclesContainer.children.length) addVehicle();
    renderConsiderations();
    form._technicalWizardMarkSaved?.(appraisal);
    message.classList.remove("is-error", "is-success");
    message.textContent = `Editando el avalúo ${appraisal.numeroAvaluo}.`;
  }

  document.querySelectorAll("[data-avaluos-section]").forEach((button) => button.addEventListener("click", () => setSubsection(button.dataset.avaluosSection)));
  window.addEventListener("control-avaluos:section", (event) => setSubsection(event.detail));
  window.addEventListener("control-avaluos:open-technical-appraisal", openTechnicalCreation);
  window.addEventListener("control-avaluos:open-technical-edit", (event) => { if (event.detail) openTechnicalEdit(event.detail); });
  window.addEventListener("control-avaluos:open-technical-creation", openTechnicalCreation);
  window.addEventListener("control-avaluos:close-technical-creation", () => {
    typeSelect.value = "";
    typeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    editor.hidden = true;
    const mobiliarioEditor = document.querySelector("#mobiliarioEditor");
    if (mobiliarioEditor) mobiliarioEditor.hidden = true;
    document.querySelector(".appraisal-type-panel")?.classList.remove("is-hidden");
    typeHint.hidden = false;
    setTechnicalCreationMode(false);
    renderTechnicalList();
  });
  window.addEventListener("control-avaluos:technical-appraisals-updated", () => { refreshTechnicalFolio(); renderTechnicalList(); });
  technicalSearchInput.addEventListener("input", renderTechnicalList);
  technicalDateInput.addEventListener("change", refreshTechnicalFolio);
  typeSelect.addEventListener("change", () => {
    const automotriz = typeSelect.value === "automotriz";
    const mobiliario = typeSelect.value === "muebles-varios";
    const maquinaria = typeSelect.value === "maquinaria-equipo";
    const mobiliarioEditor = document.querySelector("#mobiliarioEditor");
    editor.hidden = !automotriz;
    if (mobiliarioEditor) mobiliarioEditor.hidden = !mobiliario;
    typeHint.hidden = automotriz || mobiliario || maquinaria;
    document.querySelector(".appraisal-type-panel")?.classList.add("is-hidden");
    if (selectedTypeMessage) { selectedTypeMessage.hidden = !typeSelect.value; selectedTypeMessage.textContent = typeSelect.value ? `Tipo de avalúo: ${typeSelect.options[typeSelect.selectedIndex]?.text || typeSelect.value}` : ""; }
    if (automotriz) { setupTechnicalWizard(); form._technicalWizardGoTo?.(0); }
    if (mobiliario || maquinaria) window.dispatchEvent(new CustomEvent("control-avaluos:open-mobiliario-edit", { detail: { tipo: maquinaria ? "maquinaria" : "mobiliario" } }));
    if (!automotriz && !mobiliario && !maquinaria) typeHint.innerHTML = typeSelect.value ? `<strong>La ficha de ${escapeHtml(typeSelect.options[typeSelect.selectedIndex].text)} estará disponible próximamente.</strong><span>Por ahora puedes crear avalúos Automotrices y de Mobiliario.</span>` : "<strong>Selecciona una modalidad para comenzar.</strong><span>Las fichas técnicas disponibles son Automotriz y Mobiliario y Bienes Diversos.</span>";
  });
  objectiveSelect.addEventListener("change", () => {
    const other = objectiveSelect.value === "Otro";
    otherObjectiveField.hidden = !other;
    otherObjectiveInput.required = other;
    if (other) otherObjectiveInput.focus();
  });
  addConsiderationButton.addEventListener("click", addOrUpdateConsideration);
  document.querySelector("#addVehicleButton").addEventListener("click", addVehicle);
  locationPhotoInput?.addEventListener("change", async () => {
    const file = locationPhotoInput.files?.[0];
    if (!file) return;
    message.textContent = "Preparando fotografía de ubicación…";
    try { const prepared = await readAndCompressImage(file); locationDataUrl = prepared.dataUrl; renderLocationImage(); message.textContent = "Fotografía de ubicación agregada."; }
    catch (error) { message.textContent = error.message || "No se pudo preparar la fotografía de ubicación."; }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!app.canEdit()) { message.textContent = "Tu rol es de solo lectura y no puede crear avalúos."; return; }
    if (!form.reportValidity()) return;
    const customObjective = otherObjectiveInput.value.trim();
    const objective = objectiveSelect.value === "Otro" ? customObjective : objectiveSelect.value;
    if (!objective) { message.textContent = "Especifica el objeto del avalúo."; return; }
    if (objectiveSelect.value === "Otro") {
      const options = app.getTechnicalObjectives();
      app.saveTechnicalObjectives([...options, customObjective]);
      populateObjectives(customObjective);
    }
    const data = new FormData(form);
    const appraisal = {
      id: editingTechnicalId || `tecnico-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      tipo: typeSelect.value === "maquinaria-equipo" ? "maquinaria" : "automotriz",
      solicitante: String(data.get("solicitante") || "").trim(),
      fechaSolicitud: String(data.get("fechaSolicitud") || ""),
      fechaVisita: String(data.get("fechaVisita") || ""),
      fechaAvaluo: String(data.get("fechaAvaluo") || ""),
      numeroAvaluo: folioInput.value,
      bienesAValuar: String(data.get("bienesAValuar") || "").trim(),
      propietario: String(data.get("propietario") || "").trim(),
      ubicacionBienes: String(data.get("ubicacionBienes") || "").trim(),
      objetivoAvaluo: objective,
      propositoAvaluo: String(data.get("propositoAvaluo") || "").trim(),
      localizacionFoto: locationDataUrl,
      creadoPor: app.getActiveUser(),
      creadoEn: editingTechnicalCreatedAt || undefined,
      consideraciones: [...considerations],
      vehiculos: [...vehiclesContainer.querySelectorAll(".vehicle-card")].map(collectVehicle),
      valores: valueRows().map((row) => ({ unidad: row.name, mercado: { ...row.inputs, calculo: row.market }, reposicion: { ...row.inputs, calculo: row.replacement } })),
      enfoqueValor: selectedValueSource?.value === "replacement" ? "replacement" : "market",
      estadoExpediente: "completo",
      estado: "Concluido",
    };
    try {
      const saveButton = document.querySelector("#saveAutomotrizButton");
      if (saveButton) saveButton.disabled = true;
      message.textContent = "Guardando el expediente técnico…";
      await persistAutomotiveImages(appraisal);
      const saved = await app.saveTechnicalAppraisal(appraisal);
      folioInput.value = saved.numeroAvaluo || folioInput.value;
      message.classList.remove("is-error");
      message.classList.add("is-success");
      message.innerHTML = `Avalúo automotriz ${escapeHtml(folioInput.value)} ${editingTechnicalId ? "actualizado" : "guardado"}. <button type="button" class="text-action-button" id="savedAutomotivePdf">Ver PDF</button> <button type="button" class="text-action-button" id="savedAutomotiveWord">Ver / Descargar Word</button>`;
      document.querySelector("#savedAutomotivePdf")?.addEventListener("click", () => previewTechnicalPdf(saved));
      document.querySelector("#savedAutomotiveWord")?.addEventListener("click", () => previewTechnicalPdf(saved, { word: true }));
      window.setTimeout(() => { resetTechnicalForm(); setTechnicalCreationMode(false); renderTechnicalList(); }, 900);
    } catch (error) {
      message.classList.remove("is-success");
      message.classList.add("is-error");
      message.textContent = error.message || "No se pudo guardar el avalúo técnico.";
    } finally {
      const saveButton = document.querySelector("#saveAutomotrizButton");
      if (saveButton) saveButton.disabled = false;
    }
  });

  populateObjectives();
  setupTechnicalWizard();
  addVehicle();
  renderConsiderations();
  refreshTechnicalFolio();
  renderTechnicalList();
  setSubsection("inicio");
})();
