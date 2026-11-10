(() => {
  const API = "https://api.cp6coahuila.com/api";
  const INTERNAL_SESSION = "control-avaluos.desktop.session.v1";
  const esc = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const firstName = (name) => String(name || "Usuario").trim().split(/\s+/)[0] || "Usuario";
  const displayName = (name) => /juan manuel barrera martinez/i.test(String(name || "")) && !/^Lic\.\s/i.test(String(name || "")) ? `Lic. ${String(name).trim()}` : String(name || "Usuario").trim();
  const initials = (name) => String(name || "CP6").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const time = (value) => value ? new Date(value).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "";
  let currentUser = null;
  let contacts = [], messages = [], activeConversation = "general", activeContact = null, timer = null, loadedIds = new Set(), lastSeenByConversation = new Map(), unreadByConversation = new Map();
  const unreadStorageKey = "control-avaluos.messaging.unread.v1";
  let audioContext = null;
  function playIncomingSound() {
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      audioContext ||= new AudioCtor();
      if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
      const start = audioContext.currentTime;
      [[880, 0], [1175, 0.13]].forEach(([frequency, offset]) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, start + offset);
        gain.gain.setValueAtTime(0.0001, start + offset);
        gain.gain.exponentialRampToValueAtTime(0.16, start + offset + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.22);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start(start + offset);
        oscillator.stop(start + offset + 0.24);
      });
    } catch {}
  }
  function openMessagingPopup() {
    const layer = document.querySelector("#messagingPopupLayer");
    if (layer) { layer.hidden = false; document.body.classList.add("messaging-popup-open"); }
    window.setTimeout(() => document.querySelector("#messagingInput")?.focus(), 40);
  }
  function closeMessagingPopup() {
    const layer = document.querySelector("#messagingPopupLayer");
    if (layer) layer.hidden = true;
    document.body.classList.remove("messaging-popup-open");
  }

  function getIdentity() {
    const internal = sessionStorage.getItem(INTERNAL_SESSION);
    return internal ? { headers: { "x-user-name": encodeURIComponent(internal) }, name: internal, fullName: internal, kind: "internal" } : null;
  }
  async function api(path, options = {}) {
    const identity = getIdentity();
    const headers = { ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...(identity?.headers || {}), ...(options.headers || {}) };
    const response = await fetch(`${API}${path}`, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "No fue posible conectar con Mensajería.");
    return data;
  }
  const administrativeContacts = (list) => (Array.isArray(list) ? list : []).filter((item) => item && item.id !== "admin" && (item.kind === "channel" || item.kind === "internal"));
  const isMine = (item) => Boolean(currentUser && item.sender_kind === "internal" && item.sender_id === currentUser.id);
  function loadUnreadState() {
    try { unreadByConversation = new Map(Object.entries(JSON.parse(sessionStorage.getItem(unreadStorageKey) || "{}"))); } catch { unreadByConversation = new Map(); }
  }
  function saveUnreadState() {
    try { sessionStorage.setItem(unreadStorageKey, JSON.stringify(Object.fromEntries(unreadByConversation))); } catch {}
  }
  function updateChatIcon() {
    const button = document.querySelector("#messagingHeaderButton"); if (!button) return;
    const total = [...unreadByConversation.values()].reduce((sum, value) => sum + Number(value || 0), 0);
    button.classList.toggle("has-unread", total > 0);
    button.dataset.unread = total > 99 ? "99+" : String(total);
    button.title = total ? `Mensajes nuevos (${total})` : "Mensajes";
    button.setAttribute("aria-label", total ? `Mensajes nuevos (${total})` : "Mensajes");
    saveUnreadState();
  }

  function viewMarkup() {
    return `<div class="messaging-popup-layer" id="messagingPopupLayer" role="dialog" aria-modal="true" aria-label="Mensajería administrativa"><div class="messaging-popup-window"><button class="messaging-popup-close" id="messagingPopupClose" type="button" aria-label="Cerrar mensajería">×</button><div class="messaging-shell" id="messagingShellReady"><aside class="messaging-sidebar"><div class="messaging-sidebar-head"><div class="messaging-self-avatar" id="messagingSelfAvatar">CP</div><div><span class="messaging-eyebrow">MENSAJERÍA INTERNA</span><strong id="messagingSelfName">Usuario CP6</strong><small id="messagingSelfEmail">Correo no registrado</small></div></div><div class="messaging-sidebar-caption"><i class="fa-solid fa-users"></i><span>Chat general para usuarios administrativos</span></div><div class="messaging-search-row"><label class="messaging-search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input id="messagingSearch" type="search" placeholder="Buscar usuario administrativo..." autocomplete="off"></label></div><div id="messagingContacts" class="messaging-contacts"></div></aside><section class="messaging-conversation"><header class="messaging-conversation-head" id="messagingConversationHead"><div id="messagingContactAvatar" class="messaging-contact-avatar">CG</div><div><span class="messaging-eyebrow">CONVERSACIÓN ACTIVA</span><strong id="messagingContactName">Chat General</strong><small id="messagingContactRole">Canal administrativo CP6</small></div><button id="messagingInfoButton" class="messaging-info-button" type="button" aria-label="Ver información"><i class="fa-solid fa-circle-info" aria-hidden="true"></i></button></header><div id="messagingMessages" class="messaging-messages" aria-live="polite"></div><form id="messagingForm" class="messaging-compose"><textarea id="messagingInput" rows="1" maxlength="2000" placeholder="Escribe un mensaje para el equipo administrativo..." required></textarea><button type="submit" aria-label="Enviar mensaje" title="Enviar"><i class="fa-solid fa-arrow-up" aria-hidden="true"></i></button></form></section></div></div></div><div id="messagingProfileCard" class="messaging-profile-card" hidden></div>`;
  }
  function renderContacts() {
    const target = document.querySelector("#messagingContacts"); if (!target) return;
    const query = String(document.querySelector("#messagingSearch")?.value || "").toLocaleLowerCase("es-MX");
    const visible = administrativeContacts(contacts).filter((item) => !query || `${item.name} ${item.role} ${item.lastMessage}`.toLocaleLowerCase("es-MX").includes(query));
    target.innerHTML = visible.map((item) => `<button class="messaging-contact${item.id === activeConversation ? " is-active" : ""}" type="button" data-conversation="${esc(item.id)}"><span class="messaging-avatar">${esc(initials(item.name))}</span><span class="messaging-contact-copy"><strong>${esc(item.name)}</strong><small>${esc(item.lastMessage || item.preview || "")}</small></span><time>${esc(time(item.lastAt))}</time></button>`).join("") || `<p class="messaging-empty">No hay coincidencias.</p>`;
    target.querySelectorAll("[data-conversation]").forEach((button) => button.addEventListener("click", () => selectConversation(button.dataset.conversation)));
  }
  function renderMessages() {
    const target = document.querySelector("#messagingMessages"); if (!target) return;
    target.innerHTML = messages.length ? messages.map((item) => { const mine = isMine(item); return `<article class="messaging-message ${mine ? "is-sent" : "is-received"}"><div class="messaging-message-author">${mine ? "Tú" : esc(displayName(item.sender_name))}</div><div class="messaging-bubble">${esc(item.message).replace(/\n/g, "<br>")}</div><div class="messaging-meta">${esc(time(item.created_at))}${mine ? " · ✓✓" : ""}</div></article>`; }).join("") : `<div class="messaging-empty-state"><strong>Inicia la conversación</strong><span>Comparte información de forma segura con el equipo administrativo.</span></div>`;
    target.scrollTop = target.scrollHeight;
  }
  function updateHeader() {
    const c = activeContact || contacts.find((item) => item.id === activeConversation) || contacts[0]; if (!c) return;
    activeContact = c;
    const avatar = document.querySelector("#messagingContactAvatar"); const name = document.querySelector("#messagingContactName"); const role = document.querySelector("#messagingContactRole");
    if (avatar) avatar.textContent = initials(c.name); if (name) name.textContent = c.name; if (role) role.textContent = c.role || "Usuario administrativo";
  }
  async function selectConversation(id) {
    activeConversation = id; activeContact = contacts.find((item) => item.id === id) || null; loadedIds = new Set(); unreadByConversation.delete(id); updateChatIcon();
    const target = document.querySelector("#messagingMessages"); if (target) target.innerHTML = ""; renderContacts(); updateHeader();
    try { messages = await api(`/messaging/messages?conversationId=${encodeURIComponent(id)}`); messages.forEach((item) => loadedIds.add(item.id)); renderMessages(); }
    catch (error) { if (target) target.innerHTML = `<p class="messaging-error">${esc(error.message)}</p>`; }
  }
  function chatIsVisible() {
    const layer = document.querySelector("#messagingPopupLayer");
    return Boolean(layer && !layer.hidden && document.visibilityState !== "hidden");
  }
  function showToast(item) {
    if (!item || isMine(item) || (chatIsVisible() && item.conversation_id === activeConversation)) return;
    let toast = document.querySelector("#messagingToast");
    if (!toast) { toast = document.createElement("div"); toast.id = "messagingToast"; toast.className = "messaging-toast messenger-style-toast"; document.body.appendChild(toast); }
    const contact = contacts.find((entry) => entry.id === item.conversation_id);
    toast.innerHTML = `<button class="messaging-toast-close" type="button" aria-label="Cerrar">×</button><span class="messaging-toast-avatar">${esc(initials(item.sender_name))}</span><div><strong>${esc(displayName(item.sender_name))}</strong><small>${esc(contact?.name || "Mensajería administrativa")}</small><span>${esc(item.message)}</span></div>`;
    toast.onclick = (event) => { if (event.target.closest(".messaging-toast-close")) { toast.hidden = true; return; } toast.hidden = true; const layer = document.querySelector("#messagingPopupLayer"); if (layer) { openMessagingPopup(); selectConversation(item.conversation_id); } else { loadMessaging(document.querySelector("#messagingApp")).then(() => selectConversation(item.conversation_id)); } };
    toast.hidden = false; clearTimeout(toast._timer); toast._timer = setTimeout(() => { toast.hidden = true; }, 8000);
  }
  async function pollMessages() {
    if (!currentUser || !getIdentity()) return;
    try {
      const data = await api("/messaging/contacts");
      const nextContacts = administrativeContacts(data.contacts || []);
      for (const contact of nextContacts) {
        const previous = lastSeenByConversation.get(contact.id);
        const changed = Boolean(previous && contact.lastAt && contact.lastAt !== previous);
        if (!contact.lastAt) continue;
        lastSeenByConversation.set(contact.id, contact.lastAt);
        if (!changed) continue;
        const latest = await api(`/messaging/messages?conversationId=${encodeURIComponent(contact.id)}`);
        const incoming = latest.filter((item) => !isMine(item));
        const newIncoming = previous ? incoming.filter((item) => item.created_at && new Date(item.created_at).getTime() > new Date(previous).getTime()) : incoming;
        const newest = incoming.at(-1);
        const conversationIsOpen = chatIsVisible() && contact.id === activeConversation;
        if (newest && !conversationIsOpen && newIncoming.length) { playIncomingSound(); const previousUnread = Number(unreadByConversation.get(contact.id) || 0); unreadByConversation.set(contact.id, previousUnread + newIncoming.length); showToast(newIncoming.at(-1)); }
        if (contact.id === activeConversation && document.querySelector(".messaging-shell")) { unreadByConversation.delete(contact.id); messages = latest; latest.forEach((item) => loadedIds.add(item.id)); renderMessages(); }
      }
      contacts = nextContacts; renderContacts(); updateHeader(); updateChatIcon();
    } catch {}
  }
  async function startBackgroundMessaging() {
    if (timer || !getIdentity()) return;
    try {
      const data = await api("/messaging/contacts");
      currentUser = data.me || null;
      loadUnreadState();
      contacts = administrativeContacts(data.contacts || []);
      lastSeenByConversation = new Map(contacts.filter((item) => item.lastAt).map((item) => [item.id, item.lastAt]));
      timer = setInterval(pollMessages, 2000);
    } catch {}
  }
  async function loadMessaging(root) {
    const identity = getIdentity();
    if (!identity) { if (root) root.innerHTML = `<div class="messaging-access-blocked"><i class="fa-solid fa-lock"></i><strong>Mensajería administrativa</strong><span>Inicia sesión con un usuario administrativo para acceder.</span></div>`; return; }
    if (timer) { clearInterval(timer); timer = null; }
    document.querySelectorAll("#messagingPopupLayer, #messagingProfileCard").forEach((node) => node.remove());
    root.innerHTML = viewMarkup();
    const popupLayer = root.querySelector("#messagingPopupLayer");
    const profileCard = root.querySelector("#messagingProfileCard");
    if (popupLayer) document.body.appendChild(popupLayer);
    if (profileCard) document.body.appendChild(profileCard);
    document.querySelector("#messagingPopupClose")?.addEventListener("click", closeMessagingPopup);
    openMessagingPopup();
    try {
      const data = await api("/messaging/contacts"); currentUser = data.me || null; contacts = administrativeContacts(data.contacts || []); loadUnreadState(); updateChatIcon(); lastSeenByConversation = new Map(contacts.filter((item) => item.lastAt).map((item) => [item.id, item.lastAt]));
      const self = document.querySelector("#messagingSelfAvatar"); if (self) self.textContent = initials(currentUser?.name || identity.name);
      const selfName = document.querySelector("#messagingSelfName"); const selfEmail = document.querySelector("#messagingSelfEmail"); if (selfName) selfName.textContent = displayName(currentUser?.name || identity.name) || "Usuario CP6"; if (selfEmail) selfEmail.textContent = currentUser?.email || "Correo no registrado";
      renderContacts(); await selectConversation(contacts[0]?.id || "general");
      document.querySelector("#messagingSearch")?.addEventListener("input", renderContacts);
      document.querySelector("#messagingInput")?.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); document.querySelector("#messagingForm")?.requestSubmit(); } });
      document.querySelector("#messagingForm")?.addEventListener("submit", async (event) => { event.preventDefault(); const input = document.querySelector("#messagingInput"); const text = input.value.trim(); if (!text) return; input.disabled = true; try { const sent = await api("/messaging/messages", { method: "POST", body: JSON.stringify({ conversationId: activeConversation, message: text }) }); messages.push(sent); loadedIds.add(sent.id); unreadByConversation.delete(activeConversation); lastSeenByConversation.set(activeConversation, sent.created_at); updateChatIcon(); input.value = ""; renderMessages(); const refreshed = await api("/messaging/contacts"); contacts = administrativeContacts(refreshed.contacts || contacts); renderContacts(); } catch (error) { window.alert(error.message); } finally { input.disabled = false; input.focus(); } });
      document.querySelector("#messagingInfoButton")?.addEventListener("click", () => { const card = document.querySelector("#messagingProfileCard"); const c = activeContact || {}; card.innerHTML = `<strong>${esc(c.fullName || c.name || "Chat General")}</strong>${c.email ? `<span>${esc(c.email)}</span>` : ""}`; card.hidden = !card.hidden; });
    } catch (error) { root.innerHTML = `<div class="messaging-error">${esc(error.message)}</div>`; }
    timer = setInterval(pollMessages, 2000);
  }
  function boot() {
    window.addEventListener("control-avaluos:open-messaging-popup", () => loadMessaging(document.querySelector("#messagingApp")));
    window.addEventListener("control-avaluos:authenticated", () => { document.querySelector('[data-app-view="mensajeria"]')?.classList.remove("is-hidden"); startBackgroundMessaging(); });
    document.addEventListener("pointerdown", () => { if (audioContext?.state === "suspended") audioContext.resume().catch(() => {}); }, { once: true });
    loadUnreadState(); updateChatIcon(); startBackgroundMessaging();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
