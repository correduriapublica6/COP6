/* Presentation-only adapter. No credentials, API writes, calculations or persistence are changed. */
(() => {
  const $ = (query) => document.querySelector(query);
  const set = (id, text) => { const el = document.getElementById(id); if (el && el.textContent !== text) el.textContent = text; };
  const titles = { inicio: ['Inicio', 'Todo tu trabajo, en un solo lugar.'], avaluos: ['Avalúos', 'Gestiona cada etapa de tu operación.'], solicitudes: ['Solicitudes', 'Encargos, documentación y seguimiento.'], 'fe-publica': ['Fe Pública', 'El espacio de trabajo de tu correduría.'], resumen: ['Resumen general', 'Una visión clara de tu operación.'], usuarios: ['Usuarios', 'Tu equipo, conectado.'], configuracion: ['Configuración', 'Todo listo para trabajar.'], perfil: ['Mi espacio de trabajo', 'Métricas y progreso personal.'], mensajeria: ['Mensajes', 'Mantén a tu equipo conectado.'], juegos: ['Juegos', 'Un momento para despejar la mente.'] };
  const currentView = () => $('.app-view.is-active')?.id.replace(/View$/, '') || 'inicio';
  const refreshContext = (view = currentView()) => {
    const [title, description] = titles[view] || titles.inicio;
    set('v2ContextTitle', title); set('v2ContextDescription', description);
    document.querySelectorAll('.v2-operation-nav button').forEach(button => button.classList.remove('v2-active'));
  };
  function syncSession() {
    set('v2SessionName', $('#activeUser')?.textContent.trim() || 'Mi cuenta');
    set('v2SessionRole', $('#activeUserRole')?.textContent.trim() || 'Sesión administrativa');
    const status = document.body.dataset.serverStatus;
    set('v2ServerStatus', status === 'online' ? 'Servidor conectado' : status === 'checking' ? 'Comprobando conexión' : 'Sin conexión');
    $('.v2-online')?.classList.toggle('offline', status !== 'online');
    const total = Number($('#homeTotalRequests')?.textContent || 0);
    const done = Number($('#homeCompletedRequests')?.textContent || 0);
    const ratio = total ? Math.round(done / total * 100) : 0;
    const state = ratio < 50 ? {
      key: 'attention',
      title: 'Atención Requerida',
      description: 'Alta acumulación en proceso'
    } : ratio < 80 ? {
      key: 'stable',
      title: 'Estable',
      description: 'Flujo de trabajo regular dentro de los parámetros aceptables.'
    } : {
      key: 'excellent',
      title: 'Cumplimiento excelente',
      description: ''
    };
    set('v2CompletionRatio', `${ratio}%`);
    set('v2CompletionStateTitle', state.title);
    set('v2CompletionStateDescription', state.description);
    const ring = $('#v2CompletionRing');
    const stateSection = ring?.closest('.v2-ring-section');
    ring?.style.setProperty('--ratio', `${ratio}%`);
    stateSection?.classList.remove('is-attention', 'is-stable', 'is-excellent');
    stateSection?.classList.add(`is-${state.key}`);
  }
  document.querySelectorAll('[data-v2-route]').forEach(button => button.addEventListener('click', () => {
    const route = button.dataset.v2Route;
    document.querySelector('.v2-nav [data-app-view="avaluos"]')?.click();
    if (route === 'cotizaciones') {
      document.querySelector('.avaluos-choice-grid [data-cotizaciones-open]')?.click();
      set('v2ContextTitle', 'Cotizaciones'); set('v2ContextDescription', 'Prepara, calcula y consulta tus propuestas.');
      button.classList.add('v2-active');
    }
  }));
  window.addEventListener('control-avaluos:view', event => { refreshContext(event.detail); syncSession(); });
  window.addEventListener('control-avaluos:authenticated', () => { refreshContext('inicio'); syncSession(); });
  window.addEventListener('control-avaluos:subsection-change', event => {
    const section = typeof event.detail === "string" ? event.detail : event.detail?.section;
    const labels = { recepcion: ['Recepción','Registro de expedientes y recepción de pagos.'], crear: ['Gestión de Avalúos','Elabora y consulta tus expedientes técnicos.'], validacion: ['Validación','Folios autorizados y seguimiento de Recepción.'] };
    if (!labels[section]) return;
    set('v2ContextTitle', labels[section][0]); set('v2ContextDescription', labels[section][1]);
    const actions = { recepcion: 'recepcion', crear: 'gestion', validacion: 'validacion' };
    document.querySelectorAll('.v2-operation-nav button').forEach(button => button.classList.toggle('v2-active', button.dataset.homeAction === actions[section]));
  });
  const observer = new MutationObserver(syncSession);
  ['activeUser', 'activeUserRole', 'homeTotalRequests', 'homeCompletedRequests'].forEach(id => { const target = document.getElementById(id); if (target) observer.observe(target, {childList:true, subtree:true, characterData:true}); });
  observer.observe(document.body, { attributes: true, attributeFilter:['data-server-status'] });
  refreshContext(); syncSession();
})();
