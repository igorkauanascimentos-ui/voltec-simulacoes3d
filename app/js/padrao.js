// Padrão de todas as simulações do app: a mesma estrutura de telas, para o cliente e para a equipe.
// A chave do cliente fica dentro da simulação e o link de compartilhamento leva essa chave no #.

export const META_CHAVE = "voltec-chave-cliente";

// Elementos que a simulação precisa ter para entrar no padrão.
const IDS_PADRAO = ["scene", "allW", "allC", "allH", "verdict"];

export function comChaveCliente(html, chave) {
  const meta = `<meta name="${META_CHAVE}" content="${chave}">`;
  return /<head[^>]*>/i.test(html)
    ? html.replace(/<head[^>]*>/i, (abre) => abre + meta)
    : meta + html;
}

// Para o build: a chave que já vem no HTML (um projeto novo), sem DOM.
export function chaveDoTexto(html) {
  const achado = html.match(new RegExp(`<meta name="${META_CHAVE}" content="([^"]+)">`));
  return achado ? achado[1] : null;
}

export function tirarChaveCliente(html) {
  return html.replace(new RegExp(`<meta name="${META_CHAVE}" content="[^"]+">`), "");
}

export function lerChaveCliente(doc) {
  const meta = doc.querySelector(`meta[name="${META_CHAVE}"]`);
  return meta ? meta.content : null;
}

export function ehSimulacaoPadrao(html) {
  return IDS_PADRAO.every((id) => new RegExp(`\\bid="${id}"`).test(html));
}

// O HTML anexado pode apontar para o three.js na internet. Dentro do app ele precisa
// estar no próprio arquivo, senão a simulação não abre sem internet.
export async function embutirThree(html) {
  const three = await (await fetch("vendor/three.min.js", { cache: "no-cache" })).text();
  return html.replace(
    /<script src="https:\/\/cdnjs\.cloudflare\.com\/[^"]*three\.min\.js"><\/script>/,
    () => `<script>${three}</script>`,
  );
}
