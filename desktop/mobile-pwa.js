(() => {
  let deferredInstallPrompt = null;
  const installButton = () => document.querySelector("#mobileInstallButton");
  const installCard = () => document.querySelector("#mobileInstallCard");
  const isInstalledApp = () => Boolean(window.navigator.standalone || window.matchMedia?.("(display-mode: standalone)").matches || window.matchMedia?.("(display-mode: fullscreen)").matches);

  const showInstallAction = () => {
    const button = installButton();
    if (button) button.hidden = false;
    const card = installCard();
    if (card) card.hidden = false;
  };

  const hideInstallAction = () => {
    const button = installButton();
    if (button) button.hidden = true;
    const card = installCard();
    if (card && document.body.classList.contains("mobile-mode")) card.hidden = true;
  };

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showInstallAction();
  });

  // Algunos navegadores no exponen beforeinstallprompt, pero sí permiten
  // instalar desde su menú. Mantener visible la opción evita que desaparezca.
  const revealInstallOptionWhenReady = () => {
    if (isInstalledApp()) {
      hideInstallAction();
      try { window.screen?.orientation?.lock?.("portrait")?.catch?.(() => {}); } catch {}
      return;
    }
    showInstallAction();
  };
  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", revealInstallOptionWhenReady, { once: true });
  else revealInstallOptionWhenReady();
  window.addEventListener("pageshow", revealInstallOptionWhenReady);

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    hideInstallAction();
  });

  document.addEventListener("click", async (event) => {
    const button = event.target.closest?.("#mobileInstallButton");
    if (!button) return;
    if (!deferredInstallPrompt) {
      window.alert("Para instalar la aplicación, abre el menú del navegador y selecciona “Agregar a pantalla de inicio” o “Instalar aplicación”.");
      return;
    }
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    if (choice?.outcome === "accepted") hideInstallAction();
    deferredInstallPrompt = null;
  });
})();
