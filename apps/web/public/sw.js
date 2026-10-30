const SW_VERSION = "usemint-pwa-1";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Chrome só abre em standalone (sem barra de endereço) se o site for instalável.
 * O handler de fetch existe por esse critério. Não faz cache: a rede segue normal,
 * exceto o manifesto, que recebe o start_url da academia atual (/a/{slug}).
 */
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname !== "/manifest.json") return;
  if (url.searchParams.has("raw")) return;

  event.respondWith(manifestFor(event.request.referrer));
});

function academyStartUrl(referrer) {
  try {
    const path = new URL(referrer).pathname;
    const match = path.match(/^\/a\/([a-z0-9-]+)(?=\/|$)/i);
    if (match) return `/a/${match[1].toLowerCase()}/`;
  } catch {
    // referrer ausente: usa a raiz do manifesto estático
  }
  return null;
}

async function manifestFor(referrer) {
  const response = await fetch("/manifest.json?raw=1", { cache: "no-cache" });
  const manifest = await response.json();
  const start = academyStartUrl(referrer);
  if (start) {
    manifest.start_url = start;
    manifest.id = start;
  }
  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "no-cache",
      "X-Pwa-Version": SW_VERSION,
    },
  });
}
