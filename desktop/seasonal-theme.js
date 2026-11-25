(() => {
  const IS_MOBILE_ENTRY = /\/mobile(?:\/|$)/.test(window.location.pathname);
  const CONFIG_URL = IS_MOBILE_ENTRY ? "../desktop/seasonal-events.json" : "seasonal-events.json";
  const OVERRIDE_KEY = "cp6.seasonal.manual-mode.v1";
  const body = document.body;

  const normalizeMonthDay = (value) => {
    const match = String(value || "").match(/^(\d{2})-(\d{2})$/);
    return match ? Number(match[1]) * 100 + Number(match[2]) : null;
  };

  const todayMonthDay = () => {
    const now = new Date();
    return (now.getMonth() + 1) * 100 + now.getDate();
  };

  const isInRange = (today, start, end) => {
    if (start <= end) return today >= start && today <= end;
    return today >= start || today <= end;
  };

  const getManualMode = () => {
    try { return localStorage.getItem(OVERRIDE_KEY) || ""; } catch { return ""; }
  };

  const setManualMode = (mode) => {
    try {
      if (!mode || mode === "automatic") localStorage.removeItem(OVERRIDE_KEY);
      else localStorage.setItem(OVERRIDE_KEY, mode);
    } catch { /* almacenamiento opcional */ }
    window.location.reload();
  };

  const clearSeasonalMode = () => setManualMode("automatic");

  const selectEvent = (config) => {
    const events = Array.isArray(config?.events) ? config.events : [];
    const manual = getManualMode();
    if (manual === "none") return null;
    if (manual) return events.find((event) => event.enabled && event.id === manual) || null;
    if (config?.mode === "off") return null;
    const today = todayMonthDay();
    return events
      .filter((event) => event.enabled && event.image)
      .filter((event) => {
        const start = normalizeMonthDay(event.start);
        const end = normalizeMonthDay(event.end);
        return start !== null && end !== null && isInRange(today, start, end);
      })
      .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))[0] || null;
  };

  const applyEvent = (config, event) => {
    body.classList.remove("cp6-season-active", "cp6-season-halloween", "cp6-season-dia-de-muertos", "cp6-season-navidad");
    body.removeAttribute("data-cp6-season");
    document.documentElement.style.removeProperty("--cp6-season-image");
    document.documentElement.style.removeProperty("--cp6-season-opacity");
    if (!event || config?.showLoginDecoration === false) return;
    body.classList.add("cp6-season-active", `cp6-season-${event.id}`);
    body.dataset.cp6Season = event.id;
    const imagePath = IS_MOBILE_ENTRY ? `../desktop/${event.image}` : event.image;
    document.documentElement.style.setProperty("--cp6-season-image", `url("${imagePath}")`);
    document.documentElement.style.setProperty("--cp6-season-opacity", String(event.opacity ?? 0.22));
  };

  const init = async () => {
    try {
      const response = await fetch(`${CONFIG_URL}?v=1`, { cache: "no-store" });
      if (!response.ok) return;
      const config = await response.json();
      applyEvent(config, selectEvent(config));
      window.CP6SeasonalTheme = {
        config,
        setMode: setManualMode,
        clearMode: clearSeasonalMode,
        refresh: () => applyEvent(config, selectEvent(config))
      };
    } catch (error) {
      console.warn("No se pudo cargar la configuración estacional", error);
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
