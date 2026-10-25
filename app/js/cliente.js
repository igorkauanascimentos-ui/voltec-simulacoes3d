import { decryptObra } from "./crypto.js";
import { mensagemDeErro } from "./erros.js";

const $ = (id) => document.getElementById(id);
const rg = new URLSearchParams(location.search).get("rg") || "00001";
$("rgTopo").textContent = `RG ${rg}`;

// O que o eletricista fala em cada passo. Uma fala por vez, em frases curtas.
const falas = [
  "Esta é a sua garagem à noite. Cada ponto de luz é um refletor.",
  "Escolha a intensidade. Mais forte ilumina melhor, mas consome mais energia.",
  "A temperatura muda o clima. Aconchegante deixa a luz mais amarelada. Neutra fica mais branca.",
  "Escolha a altura dos refletores. O resultado aparece aqui, logo abaixo.",
];
let passo = 0;
let doc = null;

function mostrarFala() {
  $("falaTexto").textContent = falas[passo];
  $("proximo").textContent = passo === falas.length - 1 ? "Recomeçar" : "Próximo";
  $("resultadoTexto").hidden = true;
}

function resultadoDaObra() {
  const v = doc && doc.getElementById("verdict");
  if (!v) return;
  const frase = v.textContent.split(". ")[0].trim();
  $("resultadoTexto").textContent = frase ? `Resultado: ${frase}.` : "";
  $("resultadoTexto").hidden = !frase;
}

// Os controles do cliente apenas acionam os controles da própria simulação.
function acionar(acao, valor) {
  if (!doc) return;
  const alvo = {
    potencia: `#allW [data-v="${valor}"]`,
    cor: `#allC [data-v="${valor}"]`,
    altura: `#allH [data-v="${valor}"]`,
  }[acao];
  const el = alvo && doc.querySelector(alvo);
  if (el) el.click();
  document.querySelectorAll(`[data-acao="${acao}"]`).forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.v === String(valor)));
  });
  setTimeout(resultadoDaObra, 250);
}

// Esconde o que é só da equipe, deixando só a cena e a explicação.
function limparParaCliente(janela) {
  const estilo = janela.document.createElement("style");
  estilo.textContent = `
    #hdr,#hud,#strip,#side,#ttl,#legend,#movebar,#editbar{display:none!important}
    #app{grid-template-rows:1fr!important;grid-template-columns:minmax(0,1fr)!important}
    #view{grid-row:1;grid-column:1}`;
  janela.document.head.appendChild(estilo);
  setTimeout(() => janela.dispatchEvent(new Event("resize")), 200);
}

$("formCliente").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  try {
    const resposta = await fetch(`obras/${rg}.json`);
    if (!resposta.ok) throw new TypeError(`obras/${rg}.json ${resposta.status}`);
    const html = await decryptObra(await resposta.json(), $("senhaCliente").value);
    const quadro = $("obraCliente");
    quadro.onload = () => {
      doc = quadro.contentDocument;
      limparParaCliente(quadro.contentWindow);
      resultadoDaObra();
    };
    quadro.srcdoc = html;
    $("entrada").hidden = true;
    $("palco").style.display = "flex";
    mostrarFala();
  } catch (err) {
    $("erroCliente").textContent = mensagemDeErro(err);
    $("erroCliente").hidden = false;
  }
});

document.querySelectorAll("[data-acao]").forEach((b) => {
  b.addEventListener("click", () => acionar(b.dataset.acao, b.dataset.v));
});

$("proximo").addEventListener("click", () => {
  passo = passo === falas.length - 1 ? 0 : passo + 1;
  mostrarFala();
});
