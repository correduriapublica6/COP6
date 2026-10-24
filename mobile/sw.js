const CACHE_NAME = "cp6-final-design-mobile-20261024";
const APP_SHELL = ["../desktop/cotizacion.html", "../desktop/cp6-presentation.js", "../desktop/cp6-cotizaciones.css", "../desktop/cp6-components.css", "../desktop/cp6-final.css", "../desktop/cp6-system.css", "../desktop/cp6-foundation.css",
  "./", "./index.html", "./mobile.css", "./manifest.webmanifest", "./sw.js",
  "../desktop/styles.css", "../desktop/dashboard.css", "../desktop/override.css",
  "../desktop/app.js", "../desktop/automotriz-form.js", "../desktop/automotriz-model.js",
  "../desktop/mobiliario-form.js", "../desktop/solicitudes-form.js", "../desktop/messaging.js",
  "../desktop/image-utils.js", "../desktop/word-export.js", "../desktop/mobile-pwa.js",
  "../desktop/assets/pwa-icon-192.png", "../desktop/assets/pwa-icon-512.png"
];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
    return response;
  }).catch(async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    if (event.request.mode === "navigate") return caches.match("./index.html");
    throw new Error("Recurso no disponible sin conexión.");
  }));
});
