const CACHE_NAME = "control-operativo-cp6-v5-visual-base";
const APP_SHELL = ["./", "./index.html", "./styles.css", "./dashboard.css", "./override.css", "./app.js", "./automotriz-form.js", "./automotriz-model.js", "./mobiliario-form.js", "./solicitudes-form.js", "./image-utils.js", "./word-export.js", "./vendor/html-docx.js", "./manifest.webmanifest", "./assets/fondo.jpg", "./assets/pwa-icon-512.png"];

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
    const headers = new Headers(event.request.headers);
    const apiRequest = new Request(event.request, { headers });
    event.respondWith(fetch(apiRequest, { cache: "no-store" }));
    return;
  }
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    if (event.request.mode === "navigate") return caches.match("./index.html");
    throw new Error("Recurso no disponible sin conexión.");
  }));
});
