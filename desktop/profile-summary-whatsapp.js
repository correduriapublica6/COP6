(() => {
  const button = document.querySelector("#sendProfileSummaryWhatsApp");
  const message = document.querySelector("#profileSummaryWhatsAppMessage");
  const api = window.ControlAvaluosDesktop?.apiRequest;
  if (!button || !message || typeof api !== "function") return;
  button.addEventListener("click", async () => {
    const activeUser = String(window.ControlAvaluosDesktop?.getActiveUser?.() || "");
    const isAdmin = document.querySelector("#appShell")?.dataset.role === "admin";
    const selectedUser = isAdmin ? (document.querySelector("#profileMetricsFilter")?.value || "__all") : activeUser;
    const period = document.querySelector("#profilePeriodFilter")?.value || "all";
    button.disabled = true;
    message.textContent = "Enviando resumen…";
    try {
      await api("/profile-summary/whatsapp", { method: "POST", body: JSON.stringify({ selectedUser, period, startDate: document.querySelector("#profileStartDate")?.value || "", endDate: document.querySelector("#profileEndDate")?.value || "" }) });
      message.textContent = selectedUser === "__all" ? "Resumen enviado a los usuarios configurados." : "Resumen enviado por WhatsApp.";
      message.className = "form-message is-success";
    } catch (error) {
      message.textContent = error.message || "No se pudo enviar el resumen.";
      message.className = "form-message is-error";
    } finally { button.disabled = false; }
  });
})();
