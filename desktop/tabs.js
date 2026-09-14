(() => {
  const buttons = Array.from(document.querySelectorAll("[data-dashboard-tab]"));
  const activityPanel = document.querySelector("#activityTabPanel");
  const consultationPanel = document.querySelector("#consultationTabPanel");

  function selectTab(tab) {
    const isActivity = tab === "actividad";
    activityPanel.hidden = !isActivity;
    consultationPanel.hidden = isActivity;
    activityPanel.classList.toggle("is-active", isActivity);
    consultationPanel.classList.toggle("is-active", !isActivity);
    buttons.forEach((button) => {
      const active = button.dataset.dashboardTab === tab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
  }

  buttons.forEach((button) => button.addEventListener("click", () => selectTab(button.dataset.dashboardTab)));
  document.addEventListener("control-avaluos:show-consultation", () => selectTab("consulta"));
})();
