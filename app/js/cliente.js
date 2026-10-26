import { decryptComChave } from "./crypto.js";

const $ = (id) => document.getElementById(id);
const rg = new URLSearchParams(location.search).get("rg");
const chave = location.hash.slice(1) || null;

// Cada passo é uma fala do eletricista. Os controles aparecem no passo em que ele os apresenta.
const passos = [
  {
    fala: "Oi, eu sou o eletricista da Voltec. Este é o seu projeto à noite, com a luz desenhada para ele. Vou te mostrar como ajustar.",
    mostra: [],
  },
  {
    fala: "Primeiro, a potência. Ela define o quanto a luz ilumina. Toque numa opção e veja a cena mudar.",
    mostra: ["intensidade"],
  },
  {
    fala: "Agora, a cor. A luz quente deixa o ambiente acolhedor. A neutra deixa tudo mais nítido. Escolha a que preferir.",
    mostra: ["intensidade", "temperatura"],
  },
  {
    fala: "Pronto. Este é o resultado da sua escolha. Se quiser, volte e teste outra combinação.",
    mostra: ["intensidade", "temperatura"],
    resultado: true,
  },
];

// O cliente mexe só nos controles que a simulação marca com data-cliente (potência e cor).
// Cada um aciona o botão equivalente da simulação, que tem o mesmo data-v.
const grupos = {
  intensidade: { seletor: "#allW", opcoes: [] },
  temperatura: { seletor: "#allC", opcoes: [] },
};

let passo = 0;
let doc = null;

function falar(texto) {
  const balao = document.querySelector(".balao");
  $("falaTexto").textContent = texto;
  balao.classList.remove("trocando");
  void balao.offsetWidth; // reinicia a animação de entrada
  balao.classList.add("trocando");
}

function montarOpcoes() {
  for (const [nome, grupo] of Object.entries(grupos)) {
    const caixa = document.querySelector(`[data-grupo="${nome}"] .opcoes`);
    caixa.replaceChildren();
    grupo.opcoes = [];
    for (const chip of doc.querySelectorAll(`${grupo.seletor} [data-cliente]`)) {
      const opcao = { v: chip.dataset.v, nome: chip.dataset.cliente, reacao: chip.dataset.reacao };
      grupo.opcoes.push(opcao);
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "opcao";
      botao.dataset.v = opcao.v;
      botao.textContent = opcao.nome;
      botao.setAttribute("aria-pressed", "false");
      botao.addEventListener("click", () => escolher(nome, opcao));
      caixa.append(botao);
    }
  }
}

// Os botões mostram o que a simulação está mostrando, inclusive no primeiro carregamento.
function sincronizar() {
  for (const [nome, grupo] of Object.entries(grupos)) {
    const marcado = doc.querySelector(`${grupo.seletor} [aria-pressed="true"]`);
    const valor = marcado ? marcado.dataset.v : null;
    document.querySelectorAll(`[data-grupo="${nome}"] .opcao`).forEach((botao) => {
      botao.setAttribute("aria-pressed", String(botao.dataset.v === valor));
    });
  }
}

function escolher(nome, opcao) {
  if (!doc) return;
  const el = doc.querySelector(`${grupos[nome].seletor} [data-v="${opcao.v}"]`);
  if (el) el.click();
  sincronizar();
  falar(opcao.reacao);
  setTimeout(mostrarResultado, 250);
}

function mostrarResultado() {
  const verdict = doc && doc.getElementById("verdict");
  const frase = verdict ? verdict.textContent.split(". ")[0].trim() : "";
  $("resultadoTexto").textContent = frase ? `${frase}.` : "";
  $("resultado").hidden = !frase || !passos[passo].resultado;
}

function mostrarProgresso() {
  document.querySelectorAll(".progresso span").forEach((traco, i) => {
    traco.classList.toggle("on", i <= passo);
  });
}

function mostrarPasso() {
  const atual = passos[passo];
  falar(atual.fala);
  document.querySelectorAll(".grupo").forEach((grupo) => {
    grupo.hidden = !atual.mostra.includes(grupo.dataset.grupo);
  });
  $("proximo").textContent = passo === passos.length - 1 ? "Testar de novo" : "Próximo";
  mostrarProgresso();
  if (atual.resultado) mostrarResultado();
  else $("resultado").hidden = true;
}

$("proximo").addEventListener("click", () => {
  passo = passo === passos.length - 1 ? 1 : passo + 1;
  mostrarPasso();
});

// Esconde o que é só da equipe: a cena e o eletricista ficam, o resto some.
function limparParaCliente(janela) {
  const estilo = janela.document.createElement("style");
  estilo.textContent = `
    #hdr,#hud,#strip,#side,#ttl,#legend,#movebar,#editbar,#stubs{display:none!important}
    :root{color-scheme:light}
    #app{grid-template-rows:1fr!important;grid-template-columns:minmax(0,1fr)!important}
    #view{grid-row:1;grid-column:1}`;
  janela.document.head.appendChild(estilo);
  setTimeout(() => janela.dispatchEvent(new Event("resize")), 200);
}

function mostrarErro(texto) {
  $("avisoTexto").textContent = texto;
  $("avisoTexto").hidden = false;
  $("ver").hidden = true;
}

// A tela "Ver" só libera quando a simulação já está na página, para o toque abrir direto.
$("ver").addEventListener("click", () => {
  $("inicio").hidden = true;
  mostrarPasso();
});

async function carregarSimulacao() {
  $("ver").textContent = "Preparando…";
  if (!rg || !chave) {
    mostrarErro("Este link não está completo. Peça um novo link à Voltec.");
    return;
  }
  $("rgTopo").textContent = `RG ${rg}`;
  $("rgInicio").textContent = `RG ${rg}`;
  if (!window.isSecureContext) {
    mostrarErro("Este endereço é http. Abra pelo endereço seguro (https) para ver sua simulação.");
    return;
  }
  let html;
  try {
    const resposta = await fetch(`obras/${rg}.cliente.json`);
    if (!resposta.ok) throw new TypeError(`obras/${rg}.cliente.json ${resposta.status}`);
    html = await decryptComChave(await resposta.json(), chave);
  } catch (err) {
    const chaveErrada = err.name === "OperationError" || err.name === "DataError";
    mostrarErro(
      chaveErrada
        ? "Este link não abre a simulação. Peça um novo link à Voltec."
        : "Não foi possível abrir sua simulação. Confira a internet e tente de novo.",
    );
    return;
  }

  const quadro = $("obraCliente");
  quadro.onload = () => {
    doc = quadro.contentDocument;
    limparParaCliente(quadro.contentWindow);
    montarOpcoes();
    sincronizar();
    mostrarResultado();
  };
  quadro.srcdoc = html;
  $("ver").disabled = false;
  $("ver").textContent = "Ver meu projeto";
}

carregarSimulacao();
