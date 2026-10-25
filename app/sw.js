// O build troca __VERSAO__ pelo hash do conteúdo. Cada build muda este arquivo,
// e é isso que faz o navegador instalar o service worker novo.
const VERSAO = "__VERSAO__";
const CACHE = `voltec-${VERSAO}`;

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    (async () => {
      const { arquivos } = await (await fetch("precache.json", { cache: "no-cache" })).json();
      const cache = await caches.open(CACHE);
      await cache.addAll(arquivos);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      for (const nome of await caches.keys()) {
        if (nome.startsWith("voltec-") && nome !== CACHE) await caches.delete(nome);
      }
      await self.clients.claim();
    })(),
  );
});

// Cache primeiro: é isso que deixa o app abrir sem internet.
self.addEventListener("fetch", (evento) => {
  if (evento.request.method !== "GET") return;
  evento.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const chave = evento.request.mode === "navigate" ? "index.html" : evento.request;
      const achado = await cache.match(chave, { ignoreSearch: true });
      return achado || fetch(evento.request);
    })(),
  );
});
