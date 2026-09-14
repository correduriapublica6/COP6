(() => {
  const app = window.ControlAvaluosDesktop;
  if (!app) return;

  const typeSelect = document.querySelector('#technicalTypeSelect');
  const typePanel = document.querySelector('.appraisal-type-panel');
  const hint = document.querySelector('#technicalTypeHint');
  const editor = document.querySelector('#mobiliarioEditor');
  const form = document.querySelector('#mobiliarioForm');
  if (!typeSelect || !editor || !form) return;

  const folio = document.querySelector('#mobiliarioFolioInput');
  const items = document.querySelector('#mobiliarioItems');
  const values = document.querySelector('#mobiliarioValueRows');
  const message = document.querySelector('#mobiliarioMessage');
  const locationPhoto = document.querySelector('#mobiliarioLocationPhoto');
  const locationPreview = document.querySelector('#mobiliarioLocationPreview');
  const itemQuantity = document.querySelector('#mobiliarioItemQuantity');
  const itemDescription = document.querySelector('#mobiliarioItemDescription');
  const itemBrand = document.querySelector('#mobiliarioItemBrand');
  const itemSeries = document.querySelector('#mobiliarioItemSeries');
  const itemCondition = document.querySelector('#mobiliarioItemCondition');
  const itemPhoto = document.querySelector('#mobiliarioItemPhoto');
  const itemPhotoPreview = document.querySelector('#mobiliarioItemPhotoPreview');
  const itemMessage = document.querySelector('#mobiliarioItemMessage');
  const addItemButton = document.querySelector('#addMobiliarioItemButton');
  const cancelItemEditButton = document.querySelector('#cancelMobiliarioItemEditButton');
  const objectiveSelect = document.querySelector('#mobiliarioObjectiveSelect');
  const otherObjectiveField = document.querySelector('#mobiliarioOtherObjectiveField');
  const otherObjectiveInput = document.querySelector('#mobiliarioOtherObjectiveInput');
  const considerations = { before: [], conclusion: [] };
  const itemRecords = [];
  const valueInputs = new Map();
  let locationDataUrl = '';
  let editingId = null;
  let editingCreatedAt = null;
  let step = 0;
  let wizardReady = false;
  let saved = new Set();
  let editingItemId = null;
  let itemPhotoDataUrl = '';

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[c]));
  const money = (value) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0);
  const number = (value) => Math.max(0, Number(value) || 0);
  const dateText = (value) => value ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${String(value).slice(0, 10)}T12:00:00`)) : 'Sin fecha';

  function readItems() {
    return itemRecords.map((item) => ({ ...item }));
  }

  function updateValueSummary() {
    const total = itemRecords.reduce((sum, item) => {
      const pricing = valueInputs.get(item.id) || {};
      return sum + number(pricing.valorUnitario) * number(item.cantidad) * number(pricing.factorDepreciacion ?? 1);
    }, 0);
    document.querySelector('#mobiliarioValueTotal').textContent = money(total);
    document.querySelector('#mobiliarioReplacementMarket').textContent = money(Math.round(total));
    const functional = number(document.querySelector('#mobiliarioFunctional').value || 1);
    const economic = number(document.querySelector('#mobiliarioEconomic').value || 1);
    const factor = (functional + economic) / 2;
    document.querySelector('#mobiliarioObsolescenceFactor').textContent = factor.toFixed(2);
    document.querySelector('#mobiliarioApplicableMarket').textContent = money(Math.round(total) * factor);
  }

  function updateValueRow(row) {
    const item = itemRecords.find((candidate) => candidate.id === row.dataset.valueId);
    if (!item) return;
    const pricing = valueInputs.get(item.id) || { unidad: 'Pieza', valorUnitario: '', factorDepreciacion: '1' };
    const total = number(pricing.valorUnitario) * number(item.cantidad);
    const actual = total * number(pricing.factorDepreciacion ?? 1);
    row.querySelector('[data-value-output="total"]').textContent = money(total);
    row.querySelector('[data-value-output="actual"]').textContent = money(actual);
    updateValueSummary();
  }

  function renderValues() {
    values.innerHTML = itemRecords.length ? itemRecords.map((item) => {
      const pricing = valueInputs.get(item.id) || { unidad: 'Pieza', valorUnitario: '', factorDepreciacion: '1' };
      const total = number(pricing.valorUnitario) * number(item.cantidad);
      const actual = total * number(pricing.factorDepreciacion ?? 1);
      return `<tr data-value-id="${esc(item.id)}"><td>${esc(item.descripcion || 'Sin descripción')}</td><td><input data-field="unidad" value="${esc(pricing.unidad || 'Pieza')}" /></td><td>${item.cantidad}</td><td><input data-field="valorUnitario" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(pricing.valorUnitario ?? '')}" /></td><td data-value-output="total">${money(total)}</td><td><input data-field="factorDepreciacion" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(pricing.factorDepreciacion ?? '1')}" /></td><td data-value-output="actual">${money(actual)}</td></tr>`;
    }).join('') : '<tr><td colspan="7" class="values-empty">Agrega al menos un bien en Características para capturar sus valores.</td></tr>';
    values.querySelectorAll('tr[data-value-id]').forEach((row) => {
      row.querySelectorAll('input').forEach((input) => input.addEventListener('input', () => {
        const pricing = valueInputs.get(row.dataset.valueId) || { unidad: 'Pieza', valorUnitario: '', factorDepreciacion: '1' };
        pricing[input.dataset.field] = input.value;
        valueInputs.set(row.dataset.valueId, pricing);
        updateValueRow(row);
      }));
    });
    updateValueSummary();
  }

  function renderItemPhotoPreview() {
    itemPhotoPreview.innerHTML = itemPhotoDataUrl ? `<img src="${esc(itemPhotoDataUrl)}" alt="Fotografía del bien" />` : '';
  }

  function clearItemEditor() {
    editingItemId = null;
    itemPhotoDataUrl = '';
    if (itemPhoto) itemPhoto.value = '';
    renderItemPhotoPreview();
    itemQuantity.value = '1';
    itemDescription.value = '';
    itemBrand.value = '';
    itemSeries.value = '';
    itemCondition.value = '';
    addItemButton.textContent = '+ Agregar bien';
    cancelItemEditButton.classList.add('is-hidden');
    itemMessage.textContent = '';
  }

  function renderItems() {
    items.innerHTML = itemRecords.length ? `<div class="mobiliario-list-heading"><strong>Bienes agregados</strong><span>${itemRecords.length} ${itemRecords.length === 1 ? 'bien' : 'bienes'}</span></div><div class="operational-table-wrap"><table class="operational-table operational-table-compact mobiliario-items-table"><thead><tr><th>Cantidad</th><th>Descripción</th><th>Marca</th><th>Número de serie</th><th>Condiciones</th><th>Acciones</th></tr></thead><tbody>${itemRecords.map((item) => `<tr><td>${item.cantidad}</td><td>${esc(item.descripcion)}</td><td>${esc(item.marca || '—')}</td><td>${esc(item.serie || '—')}</td><td>${esc(item.condiciones || '—')}</td><td><div class="technical-row-actions"><button class="text-action-button" data-edit-mobiliario-item="${esc(item.id)}" type="button">Editar</button><button class="text-action-button is-danger" data-remove-mobiliario-item="${esc(item.id)}" type="button">Eliminar</button></div></td></tr>`).join('')}</tbody></table></div>` : '<p class="mobiliario-items-empty">Todavía no has agregado bienes.</p>';
    items.querySelectorAll('[data-edit-mobiliario-item]').forEach((button) => button.addEventListener('click', () => editItem(button.dataset.editMobiliarioItem)));
    items.querySelectorAll('[data-remove-mobiliario-item]').forEach((button) => button.addEventListener('click', () => removeItem(button.dataset.removeMobiliarioItem)));
  }

  function addItem(item = {}) {
    const id = item.id || `bien-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    itemRecords.push({ id, cantidad: Math.min(999, Math.max(1, number(item.cantidad) || 1)), descripcion: item.descripcion || '', marca: item.marca || '', serie: item.serie || '', condiciones: item.condiciones || '', fotografia: item.fotografia || item.foto || '' });
    valueInputs.set(id, { unidad: item.unidad || 'Pieza', valorUnitario: item.valorUnitario ?? '', factorDepreciacion: item.factorDepreciacion ?? '1' });
    renderItems();
    renderValues();
  }

  function saveItemFromEditor() {
    const quantity = Math.min(999, Math.max(1, number(itemQuantity.value) || 1));
    const description = itemDescription.value.trim();
    if (!description) { itemMessage.textContent = 'Escribe la descripción del bien.'; itemDescription.focus(); return; }
    const record = { cantidad: quantity, descripcion: description, marca: itemBrand.value.trim(), serie: itemSeries.value.trim(), condiciones: itemCondition.value.trim(), fotografia: itemPhotoDataUrl };
    if (editingItemId) {
      const index = itemRecords.findIndex((item) => item.id === editingItemId);
      if (index >= 0) itemRecords[index] = { ...itemRecords[index], ...record };
    } else addItem(record);
    if (editingItemId) { renderItems(); renderValues(); }
    clearItemEditor();
  }

  function editItem(id) {
    const item = itemRecords.find((candidate) => candidate.id === id);
    if (!item) return;
    editingItemId = id;
    itemQuantity.value = String(item.cantidad || 1);
    itemDescription.value = item.descripcion || '';
    itemBrand.value = item.marca || '';
    itemSeries.value = item.serie || '';
    itemCondition.value = item.condiciones || '';
    itemPhotoDataUrl = item.fotografia || '';
    renderItemPhotoPreview();
    addItemButton.textContent = 'Guardar cambios';
    cancelItemEditButton.classList.remove('is-hidden');
    itemMessage.textContent = 'Editando el bien seleccionado.';
    itemDescription.focus();
  }

  function removeItem(id) {
    const index = itemRecords.findIndex((item) => item.id === id);
    if (index < 0) return;
    itemRecords.splice(index, 1);
    valueInputs.delete(id);
    if (editingItemId === id) clearItemEditor();
    renderItems();
    renderValues();
  }

  function renderConsiderations(kind) {
    const target = document.querySelector(kind === 'before' ? '#mobiliarioConsiderationList' : '#mobiliarioConclusionConsiderationList');
    target.innerHTML = considerations[kind].map((text, index) => `<article class="consideration-item"><span>${esc(text)}</span><button type="button" class="text-action-button is-danger" data-remove-consideration="${index}">Eliminar</button></article>`).join('');
    target.querySelectorAll('[data-remove-consideration]').forEach((button) => button.addEventListener('click', () => { considerations[kind].splice(Number(button.dataset.removeConsideration), 1); renderConsiderations(kind); }));
  }

  function addConsideration(kind, inputId) {
    const input = document.querySelector(inputId); const text = input.value.trim(); if (!text) return;
    considerations[kind].push(text); input.value = ''; renderConsiderations(kind);
  }

  function setLocationPreview() {
    locationPreview.innerHTML = locationDataUrl ? `<img src="${locationDataUrl}" alt="Localización de los bienes" />` : '';
  }

  function createWizard() {
    if (wizardReady) return;
    wizardReady = true;
    const sections = [...form.querySelectorAll(':scope > .technical-form-section')];
    const labels = ['Antecedentes', 'Características de los bienes', 'Consideraciones previas', 'Valores', 'Consideraciones a la conclusión'];
    const nav = document.createElement('nav'); nav.className = 'technical-stepper mobiliario-stepper'; nav.setAttribute('aria-label', 'Pasos de Mobiliario y Bienes Diversos');
    nav.innerHTML = labels.map((label, index) => `<button type="button" class="technical-step" data-mobiliario-step="${index}"><span>${index + 1}</span><strong>${label}</strong><small>Pendiente</small></button>`).join('');
    form.parentElement.insertBefore(nav, form);
    const render = () => { sections.forEach((section, index) => { section.hidden = index !== step; }); nav.querySelectorAll('.technical-step').forEach((button, index) => { const done = saved.has(index); button.classList.toggle('is-current', step === index); button.classList.toggle('is-complete', done); button.querySelector('small').textContent = done ? 'Completado' : step === index ? 'En curso' : 'Pendiente'; }); form.querySelectorAll('.mobiliario-step-actions').forEach((actions, index) => { actions.hidden = index !== step; }); };
    const go = (index) => { step = Math.max(0, Math.min(sections.length - 1, index)); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    sections.forEach((section, index) => { const actions = document.createElement('div'); actions.className = 'technical-step-actions mobiliario-step-actions'; actions.innerHTML = `${index ? '<button type="button" class="secondary-button mobiliario-back">← Anterior</button>' : ''}<button type="button" class="subtle-action-button mobiliario-save">${index === sections.length - 1 ? 'Revisar y guardar avalúo' : 'Guardar y continuar'}</button>`; section.appendChild(actions); actions.querySelector('.mobiliario-back')?.addEventListener('click', () => go(index - 1)); actions.querySelector('.mobiliario-save').addEventListener('click', async () => { if (index === 0 && ![...section.querySelectorAll('input,select,textarea')].every((control) => control.checkValidity())) { section.querySelector(':invalid')?.reportValidity(); return; } if (index < sections.length - 1) { const stored = await saveProgress(index); if (!stored) return; saved.add(index); render(); go(index + 1); } else form.requestSubmit(); }); });
    nav.querySelectorAll('[data-mobiliario-step]').forEach((button) => button.addEventListener('click', () => go(Number(button.dataset.mobiliarioStep))));
    form._mobiliarioGoTo = go; form._mobiliarioRender = render; render();
  }

  async function refreshFolio() { if (editingId) return; try { const nextFolio = await app.getNextTechnicalFolio(new Date(`${form.elements.namedItem('fechaAvaluo').value || new Date().toISOString().slice(0, 10)}T12:00:00`).getFullYear()); if (!editingId) folio.value = nextFolio; } catch { if (!editingId) folio.value = ''; } }

  function currentObjective() { return objectiveSelect.value === 'Otro' ? otherObjectiveInput.value.trim() : objectiveSelect.value; }

  function buildAppraisal(estadoExpediente = 'borrador') {
    const data = new FormData(form);
    const bienes = readItems().map((item) => { const pricing = valueInputs.get(item.id) || {}; const valorUnitario = number(pricing.valorUnitario); const factorDepreciacion = number(pricing.factorDepreciacion ?? 1); const total = valorUnitario * item.cantidad; return { ...item, unidad: pricing.unidad || 'Pieza', valorUnitario, factorDepreciacion, total, valorActual: total * factorDepreciacion }; });
    const valorActualTotal = bienes.reduce((sum, item) => sum + item.valorActual, 0);
    const functional = number(document.querySelector('#mobiliarioFunctional').value || 1);
    const economic = number(document.querySelector('#mobiliarioEconomic').value || 1);
    const factor = (functional + economic) / 2;
    return { id: editingId || `mobiliario-${Date.now()}-${Math.random().toString(16).slice(2)}`, tipo: 'mobiliario', tipoAvaluo: 'Mobiliario y Bienes Diversos', estadoExpediente, numeroAvaluo: folio.value, solicitante: String(data.get('solicitante') || '').trim(), fechaSolicitud: String(data.get('fechaSolicitud') || ''), fechaVisita: String(data.get('fechaVisita') || ''), fechaAvaluo: String(data.get('fechaAvaluo') || ''), bienesAValuar: String(data.get('bienesAValuar') || '').trim(), propietario: String(data.get('propietario') || '').trim(), ubicacionBienes: String(data.get('ubicacionBienes') || '').trim(), objetivoAvaluo: currentObjective(), propositoAvaluo: String(data.get('propositoAvaluo') || '').trim(), localizacionFoto: locationDataUrl, bienes, valoresMobiliario: bienes, valorActualTotal, valorMercado: Math.round(valorActualTotal), valorMercadoAplicable: Math.round(valorActualTotal) * factor, obsolescencia: { descripcion: document.querySelector('#mobiliarioReplacementDescription').value, cantidad: number(document.querySelector('#mobiliarioReplacementQuantity').value || 1), funcional: functional, economica: economic, factor }, consideraciones: [...considerations.before], consideracionesConclusion: [...considerations.conclusion], creadoPor: app.getActiveUser(), creadoEn: editingCreatedAt || undefined };
  }

  async function saveProgress(index) {
    if (!currentObjective()) { message.textContent = 'Especifica el objeto del avalúo.'; form._mobiliarioGoTo?.(0); return null; }
    if (!folio.value) await refreshFolio();
    message.classList.remove('is-error', 'is-success');
    message.textContent = index === 0 ? 'Generando folio y guardando Antecedentes…' : 'Guardando avance del expediente…';
    try {
      const stored = await app.saveTechnicalAppraisal(buildAppraisal('borrador'));
      editingId = stored.id;
      editingCreatedAt = stored.creadoEn || stored.createdAt || editingCreatedAt;
      folio.value = stored.numeroAvaluo || folio.value;
      message.classList.add('is-success');
      message.textContent = index === 0 ? `Antecedentes guardados. Se generó el avalúo ${folio.value} y ya está disponible en Gestión.` : `Avance del avalúo ${folio.value} guardado.`;
      return stored;
    } catch (error) {
      message.classList.add('is-error');
      message.textContent = error.message || 'No se pudo guardar el avance del avalúo.';
      return null;
    }
  }

  function reset() { form.reset(); objectiveSelect.value = ''; objectiveSelect.dispatchEvent(new Event('change', { bubbles: true })); editingId = null; editingCreatedAt = null; editingItemId = null; itemRecords.splice(0, itemRecords.length); valueInputs.clear(); locationDataUrl = ''; setLocationPreview(); itemPhotoDataUrl = ''; renderItemPhotoPreview(); considerations.before.length = 0; considerations.conclusion.length = 0; renderConsiderations('before'); renderConsiderations('conclusion'); clearItemEditor(); renderItems(); renderValues(); saved = new Set(); step = 0; form._mobiliarioRender?.(); refreshFolio(); }

  function openEditor(appraisal = null) {
    if (!app.canEdit()) { window.alert('Tu rol no tiene permiso para crear o editar avalúos técnicos.'); return; }
    document.querySelector('#technicalListPanel').hidden = true; document.querySelector('#technicalCreationPanel').hidden = false; typePanel.classList.add('is-hidden'); hint.hidden = true; editor.hidden = false; document.querySelector('#automotrizEditor').hidden = true; typeSelect.value = 'muebles-varios'; createWizard();
    reset();
    if (!appraisal) return;
    editingId = appraisal.id; editingCreatedAt = appraisal.creadoEn || appraisal.createdAt || null; valueInputs.clear(); const set = (name, value) => { const field = form.elements.namedItem(name); if (field) field.value = value || ''; };
    folio.value = appraisal.numeroAvaluo || ''; set('solicitante', appraisal.solicitante); set('fechaSolicitud', appraisal.fechaSolicitud); set('fechaVisita', appraisal.fechaVisita); set('fechaAvaluo', appraisal.fechaAvaluo); set('bienesAValuar', appraisal.bienesAValuar); set('propietario', appraisal.propietario); set('ubicacionBienes', appraisal.ubicacionBienes); set('propositoAvaluo', appraisal.propositoAvaluo); if ([...objectiveSelect.options].some((option) => option.value === appraisal.objetivoAvaluo)) { objectiveSelect.value = appraisal.objetivoAvaluo || ''; otherObjectiveField.hidden = objectiveSelect.value !== 'Otro'; otherObjectiveInput.value = ''; } else { objectiveSelect.value = 'Otro'; otherObjectiveField.hidden = false; otherObjectiveInput.value = appraisal.objetivoAvaluo || ''; } objectiveSelect.dispatchEvent(new Event('change', { bubbles: true })); locationDataUrl = appraisal.localizacionFoto || ''; setLocationPreview(); itemRecords.splice(0, itemRecords.length); items.innerHTML = ''; (appraisal.bienes || []).forEach((item) => addItem(item)); renderItems(); renderValues(); considerations.before.push(...(appraisal.consideraciones || [])); considerations.conclusion.push(...(appraisal.consideracionesConclusion || [])); renderConsiderations('before'); renderConsiderations('conclusion'); saved = new Set([0, ...(appraisal.bienes?.length ? [1] : []), ...(appraisal.consideraciones?.length ? [2] : []), ...(appraisal.valoresMobiliario?.length ? [3] : []), ...(appraisal.consideracionesConclusion?.length ? [4] : [])]); form._mobiliarioRender?.(); message.textContent = `Editando el avalúo ${appraisal.numeroAvaluo}.`;
  }

  function printPdf(appraisal) {
    const rows = (appraisal.bienes || []).map((item) => `<tr><td>${esc(item.descripcion)}</td><td>${esc(item.unidad || 'Pieza')}</td><td>${item.cantidad}</td><td>${money(item.valorUnitario)}</td><td>${money(item.total)}</td><td>${Number(item.factorDepreciacion || 0).toFixed(2)}</td><td>${money(item.valorActual)}</td></tr>`).join('');
    const total = number(appraisal.valorActualTotal);
    const factor = number(appraisal.obsolescencia?.factor || 1);
    const applicable = number(appraisal.valorMercadoAplicable || Math.round(total) * factor);
    const words = window.AutomotrizModel?.amountInWords ? window.AutomotrizModel.amountInWords(Math.round(applicable)) : `SON: ${Math.round(applicable).toLocaleString('es-MX')} PESOS 00/100 M.N.`;
    const photo = appraisal.localizacionFoto ? `<div class="location-photo"><img src="${esc(appraisal.localizacionFoto)}" alt="Fotografía de ubicación de los bienes" /></div>` : '<div class="pdf-empty">Sin fotografía de ubicación registrada.</div>';
    const considerations = (appraisal.consideraciones || []).map((item) => `<li>${esc(item)}</li>`).join('') || '<li>No se registraron consideraciones previas.</li>';
    const conclusionConsiderations = (appraisal.consideracionesConclusion || []).map((item) => `<li>${esc(item)}</li>`).join('') || '<li>No se registraron consideraciones previas a la conclusión.</li>';
    const itemPhotos = (appraisal.bienes || []).map((item) => item.fotografia || item.foto ? `<figure class="item-photo"><img src="${esc(item.fotografia || item.foto)}" alt="${esc(item.descripcion)}" /><figcaption>${esc(item.descripcion)}</figcaption></figure>` : `<figure class="item-photo is-empty"><span>Sin fotografía</span><figcaption>${esc(item.descripcion)}</figcaption></figure>`).join('');
    const field = (label, value) => `<div class="pdf-field"><strong>${esc(label)}</strong><span>${esc(value || 'No especificado')}</span></div>`;
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>Avalúo ${esc(appraisal.numeroAvaluo)}</title><style>
      @page{size:letter;margin:11mm 15mm}*{box-sizing:border-box}body{background:#fff;color:#233835;font-family:Georgia,'Times New Roman',serif;font-size:10.6pt;line-height:1.34;margin:0}.report-header{align-items:flex-start;border-bottom:1px solid #b49355;border-top:3px solid #26443f;display:flex;gap:16px;justify-content:space-between;margin-bottom:7px;padding:6px 0 7px}.report-header>div{flex:1;order:1}.report-logo{height:47px;object-fit:contain;order:2;width:66px}.report-header h1{color:#183b38;font-size:20pt;font-weight:500;line-height:1.04;margin:0}.report-header p{color:#6c6250;font-size:10pt;margin:2px 0 0}.report-folio{color:#354744;font-size:10.5pt;margin:4px 0 18px}.pdf-page{page-break-before:always}.pdf-page:first-of-type{page-break-before:auto}.section-title{border-bottom:1px solid #bfaa7f;border-top:3px solid #26443f;display:flex;gap:7px;align-items:baseline;margin:0 0 10px;padding:9px 0 6px}.section-title span{color:#735b2f;font-size:11.5pt;font-weight:700}.section-title h2{color:#173b38;font-size:13.5pt;font-weight:700;margin:0;text-transform:uppercase}.pdf-field{border-bottom:1px solid #e9e3d8;display:block;margin:0;padding:4px 0}.pdf-field strong{color:#354744;font-size:10.7pt;font-weight:700;margin-right:6px}.pdf-field span{font-size:10.7pt}.legal-note{border-left:3px solid #c2aa76;margin:7px 0;padding:4px 0 4px 10px}.legal-note strong{display:inline;font-size:9.2pt;margin-right:5px}.antecedents-bottom{display:grid;gap:18px;grid-template-columns:1.45fr .85fr;margin-top:14px;align-items:start}.location-title{border-bottom:1px solid #bfaa7f;font-size:9.4pt;font-weight:700;margin:0 0 6px;padding-bottom:4px}.location-photo{aspect-ratio:16/9;background:#fbfaf6;border:1px solid #e0d8c9;margin:0;overflow:hidden}.location-photo img{display:block;height:100%;object-fit:cover;width:100%}.pdf-empty{background:#fbfaf6;border-left:2px solid #c2aa76;font-size:9.2pt;padding:8px}.signature-cover{font-size:10.5pt;text-align:center;padding-top:40px}.signature-role{font-weight:700;margin:0}.signature-space{height:70px}.signature-office{border-top:1px solid #b49355;margin:10px 0 0;padding-top:7px}.data-table{border-collapse:collapse;width:100%;font-size:9.3pt}.data-table th,.data-table td{border:1px solid #cfc2a7;padding:5px;vertical-align:top}.data-table th{background:#e8e2d4;color:#263d3a;font-weight:700}.characteristics-lead{margin:0 0 10px}.item-photo-grid{display:grid;gap:9px;grid-template-columns:repeat(2,minmax(0,1fr));margin-top:12px}.item-photo{aspect-ratio:16/10;border:1px solid #cfc2a7;margin:0;overflow:hidden;position:relative}.item-photo img{display:block;height:100%;object-fit:cover;width:100%}.item-photo.is-empty{align-items:center;background:#fbfaf6;color:#7c817a;display:flex;justify-content:center}.item-photo figcaption{background:rgba(255,255,255,.9);bottom:0;font-size:8.5pt;left:0;padding:3px 5px;position:absolute;right:0}.notes{margin:8px 0 0 20px}.notes li{margin:4px 0}.values-legal-notice,.conclusion-legal{font-size:9.6pt;font-weight:700;line-height:1.35;margin-top:14px}.amount-in-words{font-weight:700;margin:8px 0}.total{font-size:13pt;font-weight:700;margin:10px 0}.conclusion-page{page-break-before:always}.conclusion-page .section-title{margin-top:0}.signature-block{text-align:center;margin:48px auto 0;max-width:320px}.signature-block .space{height:58px}.conclusion-legal{border-top:1px solid #bfaa7f;margin-top:62px;padding-top:9px}.small{font-size:9pt}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>
      <header class="report-header"><div><h1>Correduría Pública No. 6</h1><p>Plaza Coahuila</p></div><img class="report-logo" src="${new URL('assets/correduria-publica-6-logo.bmp', window.location.href).href}" alt="Logotipo Correduría Pública No. 6"/></header>
      <p class="report-folio"><strong>Número de avalúo:</strong> ${esc(appraisal.numeroAvaluo)}</p>
      <section class="pdf-page"><div class="section-title"><span>I.-</span><h2>ANTECEDENTES</h2></div>${field('Solicitante:', appraisal.solicitante)}<p class="legal-note"><strong>Titular responsable del dictamen:</strong> Lic. Juan Manuel Barrera Martínez</p><p class="legal-note"><strong>Autorización:</strong> Habilitación de Corredor Público No. 6 para ejercer la función en la Plaza del Estado de Coahuila.</p><p class="legal-note"><strong>Autoridad que expide autorización:</strong> Secretaría de Economía.</p><p class="legal-note"><strong>Registro:</strong> Correduría Pública No. 6.</p><p class="legal-note"><strong>Inscripción:</strong> Bajo el número 185, a Foja 69, del Libro de Registro de Corredores 2 de la Secretaría de Economía.</p><p class="legal-note"><strong>Fundamento:</strong> Se expide el presente avalúo, con las facultades que otorgan los artículos 5° y 6º fracción II de la Ley Federal de Correduría Pública.</p><p class="legal-note"><strong>Vigencia del avalúo:</strong> El presente avalúo tiene una vigencia de 6 meses, a partir de la fecha de expedición.</p>${field('Fecha de solicitud:', dateText(appraisal.fechaSolicitud))}${field('Fecha del Avalúo (visita):', dateText(appraisal.fechaVisita))}${field('Fecha del avalúo:', dateText(appraisal.fechaAvaluo))}${field('Bienes a valuar:', appraisal.bienesAValuar)}${field('Propietario:', appraisal.propietario)}${field('Ubicación de los bienes:', appraisal.ubicacionBienes)}${field('Objeto del avalúo:', appraisal.objetivoAvaluo)}${field('Propósito del avalúo:', appraisal.propositoAvaluo)}<div class="antecedents-bottom"><div><div class="location-title">Fotografía de ubicación de los bienes</div>${photo}</div><div class="signature-cover"><p class="signature-role">Titular de la Correduría</p><div class="signature-space"></div><strong>Lic. Juan Manuel Barrera Martínez</strong><p class="signature-office">Correduría Pública No. 6<br/>Plaza Coahuila</p></div></div></section>
      <section class="pdf-page"><div class="section-title"><span>II.-</span><h2>CARACTERÍSTICAS DE LOS BIENES</h2></div><p class="characteristics-lead"><strong>Bienes que se valúan:</strong> ${esc(appraisal.bienesAValuar || 'Mobiliario y Bienes Diversos')}</p><table class="data-table"><thead><tr><th>Cantidad</th><th>Descripción</th><th>Marca</th><th>Número de serie</th><th>Condiciones</th></tr></thead><tbody>${(appraisal.bienes || []).map((item) => `<tr><td>${item.cantidad}</td><td>${esc(item.descripcion)}</td><td>${esc(item.marca)}</td><td>${esc(item.serie)}</td><td>${esc(item.condiciones)}</td></tr>`).join('')}</tbody></table><div class="item-photo-grid">${itemPhotos || '<div class="pdf-empty">Sin fotografías individuales registradas.</div>'}</div></section>
      <section class="pdf-page"><div class="section-title"><span>III.-</span><h2>CONSIDERACIONES PREVIAS AL AVALÚO</h2></div><ul class="notes">${considerations}</ul><footer class="values-legal-notice"><p>EL PRESENTE AVALÚO SE RINDE TENIENDO EN CUENTA LOS VALORES DE MERCADO EN LA ZONA.</p><p>EL PRESENTE AVALÚO SE RINDE SIN DOLO NI MALA FE.-</p></footer></section>
      <section class="pdf-page"><div class="section-title"><span>IV.-</span><h2>VALORES</h2></div><table class="data-table"><thead><tr><th>DESCRIPCIÓN</th><th>UNIDAD</th><th>CANTIDAD</th><th>VALOR UNITARIO</th><th>TOTAL</th><th>FACTOR DE DEPRECIACIÓN</th><th>VALOR ACTUAL</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="6">TOTAL</th><td>${money(total)}</td></tr></tfoot></table><p class="total">Total: ${money(total)}</p><p class="small">(No incluye impuestos)</p><p><strong>Total en números redondos:</strong> ${money(Math.round(total))}</p><p class="amount-in-words">${words}</p><h3>VALORES DE REPOSICIÓN RESUMEN</h3><table class="data-table"><tbody><tr><th>DESCRIPCIÓN</th><td>${esc(appraisal.obsolescencia?.descripcion || 'Mobiliario y Bienes Diversos')}</td><th>UNIDAD</th><td>LOTE</td><th>CANTIDAD</th><td>${appraisal.obsolescencia?.cantidad || 1}</td></tr><tr><th>VALOR DE MERCADO</th><td>${money(Math.round(total))}</td><th>FUNCIONAL</th><td>${Number(appraisal.obsolescencia?.funcional || 1).toFixed(2)}</td><th>ECONÓMICA</th><td>${Number(appraisal.obsolescencia?.economica || 1).toFixed(2)}</td></tr><tr><th>FACTOR</th><td>${factor.toFixed(2)}</td><th>VALOR DE MERCADO APLICABLE</th><td colspan="3">${money(applicable)}</td></tr></tbody></table><p class="values-legal-notice">EL PRESENTE AVALÚO TIENE VALIDEZ ÚNICAMENTE PARA EL OBJETO ESPECIFICADO EN LA CARÁTULA. Y LA DEPRECIACIÓN SE UBICA EN EL PORCENTAJE REFERIDO EN VIRTUD DE LA DEMANDA DE ESE TIPO DE BIENES.</p></section>
      <div class="conclusion-page"><section><div class="section-title"><span>V.-</span><h2>CONSIDERACIONES PREVIAS A LA CONCLUSIÓN</h2></div><ul class="notes">${conclusionConsiderations}</ul></section><section><div class="section-title"><span>VI.-</span><h2>CONCLUSIÓN</h2></div><p><strong>Valor de los bienes al:</strong> ${dateText(appraisal.fechaAvaluo)}</p><p class="total"><strong>Lote de bienes:</strong> ${money(Math.round(applicable))} (${esc(words)}), PESOS MEXICANOS.</p><div class="signature-block"><p>Correduría Pública No. 6<br/>Plaza Coahuila</p><p>Titular de la Correduría</p><div class="space"></div><strong>Lic. Juan Manuel Barrera Martínez</strong></div><footer class="conclusion-legal"><p>EL PRESENTE AVALÚO NO ES VÁLIDO SIN LA FIRMA Y SELLO DEL TITULAR DE LA CORREDURÍA.</p><p>EL PRESENTE AVALÚO TIENE VALIDEZ DE 6 MESES.</p></footer></section></div>
    </body></html>`;
    const win = window.open('', '_blank', 'width=1000,height=900'); if (!win) return; win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 250);
  }

  locationPhoto.addEventListener('change', () => { const file = locationPhoto.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { locationDataUrl = String(reader.result); setLocationPreview(); }; reader.readAsDataURL(file); });
  itemPhoto?.addEventListener('change', () => { const file = itemPhoto.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { itemPhotoDataUrl = String(reader.result); renderItemPhotoPreview(); }; reader.readAsDataURL(file); });
  addItemButton.addEventListener('click', saveItemFromEditor);
  cancelItemEditButton.addEventListener('click', clearItemEditor);
  itemQuantity.addEventListener('input', () => { if (itemQuantity.value.length > 3) itemQuantity.value = itemQuantity.value.slice(0, 3); });
  document.querySelector('#addMobiliarioConsiderationButton').addEventListener('click', () => addConsideration('before', '#mobiliarioConsiderationInput'));
  document.querySelector('#addMobiliarioConclusionConsiderationButton').addEventListener('click', () => addConsideration('conclusion', '#mobiliarioConclusionConsiderationInput'));
  document.querySelector('#mobiliarioFunctional').addEventListener('input', updateValueSummary); document.querySelector('#mobiliarioEconomic').addEventListener('input', updateValueSummary); document.querySelector('#mobiliarioReplacementQuantity').addEventListener('input', updateValueSummary);
  objectiveSelect.addEventListener('change', () => { const other = objectiveSelect.value === 'Otro'; otherObjectiveField.hidden = !other; otherObjectiveInput.required = other; if (!other) otherObjectiveInput.value = ''; });
  form.addEventListener('submit', async (event) => { event.preventDefault(); if (!app.canEdit()) return; if (!itemRecords.length) { message.textContent = 'Agrega al menos un bien en Características antes de guardar.'; form._mobiliarioGoTo?.(1); return; } if (!currentObjective()) { message.textContent = 'Especifica el objeto del avalúo.'; form._mobiliarioGoTo?.(0); return; } const appraisal = buildAppraisal('completo'); message.textContent = 'Guardando el expediente técnico…'; try { const stored = await app.saveTechnicalAppraisal(appraisal); editingId = stored.id; editingCreatedAt = stored.creadoEn || stored.createdAt || editingCreatedAt; folio.value = stored.numeroAvaluo || folio.value; message.classList.remove('is-error'); message.classList.add('is-success'); message.textContent = `Avalúo de Mobiliario y Bienes Diversos ${folio.value} guardado.`; window.setTimeout(() => { document.querySelector('#technicalListPanel').hidden = false; document.querySelector('#technicalCreationPanel').hidden = true; editor.hidden = true; typeSelect.value = ''; typeSelect.dispatchEvent(new Event('change', { bubbles: true })); typePanel.classList.remove('is-hidden'); }, 800); } catch (error) { message.classList.remove('is-success'); message.classList.add('is-error'); message.textContent = error.message || 'No se pudo guardar el avalúo.'; } });

  window.addEventListener('control-avaluos:open-mobiliario-edit', (event) => openEditor(event.detail));
  window.addEventListener('control-avaluos:preview-mobiliario', (event) => printPdf(event.detail));
  window.addEventListener('control-avaluos:open-technical-creation', () => { if (typeSelect.value === 'muebles-varios') openEditor(); });
  window.addEventListener('control-avaluos:technical-appraisals-updated', () => { if (typeSelect.value === 'muebles-varios') refreshFolio(); });
  typeSelect.addEventListener('change', () => { if (typeSelect.value !== 'muebles-varios') return; typePanel.classList.add('is-hidden'); hint.hidden = true; editor.hidden = true; document.querySelector('#automotrizEditor').hidden = true; createWizard(); openEditor(); });
  createWizard(); reset();
})();
