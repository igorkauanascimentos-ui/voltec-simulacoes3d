import { decryptComChave } from "./crypto.js";

const $ = (id) => document.getElementById(id);
const rg = new URLSearchParams(location.search).get("rg");
const chave = location.hash.slice(1) || null;

// O eletricista fala uma vez, depois some. A simulação aparece inteira, com os mesmos botões da equipe.
const FALA = "Esta é a simulação 3D do seu projeto. Você pode girar a cena, aproximar e mexer nos botões de potência e cor.";
const ESPERA = "Preparando sua simulação. Um instante.";

function falar(texto) {
  const balao = document.querySelector(".balao");
  $("falaTexto").textContent = texto;
  balao.classList.remove("trocando");
  void balao.offsetWidth; // reinicia a animação de entrada
  balao.classList.add("trocando");
}

function mostrarErro(texto) {
  $("avisoTexto").textContent = texto;
  $("avisoTexto").hidden = false;
  $("ver").hidden = true;
}

$("entendi").addEventListener("click", () => {
  $("painel").style.display = "none";
});

// A simulação começa a carregar assim que a página abre, sem esperar o toque.
const preparo = carregarSimulacao();
preparo.catch((err) => mostrarErro(err.message));

// O botão responde na hora. Se a simulação ainda não estiver pronta, o eletricista avisa e espera.
$("ver").addEventListener("click", async () => {
  $("inicio").hidden = true;
  $("painel").style.display = "";
  falar(ESPERA);
  try {
    await preparo;
    falar(FALA);
  } catch (err) {
    falar(err.message);
  }
});

async function carregarSimulacao() {
  if (!rg || !chave) {
    throw new Error("Este link não está completo. Peça um novo link à Voltec.");
  }
  $("rgTopo").textContent = `RG ${rg}`;
  $("rgInicio").textContent = `RG ${rg}`;
  if (!window.isSecureContext) {
    throw new Error("Este endereço é http. Abra pelo endereço seguro (https) para ver sua simulação.");
  }
  let html;
  try {
    const resposta = await fetch(`obras/${rg}.cliente.json`);
    if (!resposta.ok) throw new TypeError(`obras/${rg}.cliente.json ${resposta.status}`);
    html = await decryptComChave(await resposta.json(), chave);
  } catch (err) {
    const chaveErrada = err.name === "OperationError" || err.name === "DataError";
    throw new Error(
      chaveErrada
        ? "Este link não abre a simulação. Peça um novo link à Voltec."
        : "Não foi possível abrir sua simulação. Confira a internet e tente de novo.",
    );
  }

  // marca que é o cliente: a simulação pula o que só a equipe usa (miniaturas)
  html = html.replace(/<head([^>]*)>/i, (abre) => abre + "<script>window.__cliente=true</script>");
  const quadro = $("obraCliente");
  const carregou = new Promise((ok) => {
    quadro.onload = ok;
  });
  quadro.srcdoc = html;
  await carregou;
}
