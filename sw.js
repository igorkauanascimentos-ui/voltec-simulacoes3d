// O build troca 87a53438eba3 pelo hash do conteúdo. Cada build muda este arquivo,
// e é isso que faz o navegador instalar o service worker novo.
const VERSAO = "87a53438eba3";
const CACHE = `voltec-${VERSAO}`;
// Obras e lista: ficam de um build para o outro, para o projeto abrir sem internet para sempre.
const CACHE_DADOS = "voltec-dados";

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
        if (nome.startsWith("voltec-") && nome !== CACHE && nome !== CACHE_DADOS) await caches.delete(nome);
      }
      await self.clients.claim();
    })(),
  );
});

// Vai à internet primeiro (pega a versão nova) e guarda a cópia. Sem internet, usa a cópia guardada.
async function redeDepoisDoCache(pedido, nomeCache) {
  const cache = await caches.open(nomeCache);
  try {
    const resposta = await fetch(pedido, { cache: "no-cache" });
    if (resposta.ok) {
      cache.put(pedido, resposta.clone());
      return resposta;
    }
  } catch (_) {
    // sem internet: segue para a cópia guardada
  }
  const guardado = await cache.match(pedido, { ignoreSearch: true });
  if (guardado) return guardado;
  if (pedido.mode === "navigate") {
    const casca = await cache.match("index.html");
    if (casca) return casca;
  }
  return Response.error();
}

self.addEventListener("fetch", (evento) => {
  if (evento.request.method !== "GET") return;
  const url = new URL(evento.request.url);
  if (url.pathname.includes("/obras/") || url.pathname.endsWith("/index.json")) {
    evento.respondWith(redeDepoisDoCache(evento.request, CACHE_DADOS));
    return;
  }
  if (url.origin !== self.location.origin) return;
  evento.respondWith(redeDepoisDoCache(evento.request, CACHE));
});
