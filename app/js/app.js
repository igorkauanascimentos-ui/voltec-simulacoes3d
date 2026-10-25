import { decryptObra } from "./crypto.js";
import { mensagemDeErro } from "./erros.js";

const $ = (seletor) => document.querySelector(seletor);
const telas = { lista: $("#lista"), senha: $("#senha"), visor: $("#visor") };
const obra = $("#obra");

// Senhas ficam só na memória desta aba: o app pede de novo ao fechar.
const senhasDaSessao = new Map();
let rgAtual = null;

function mostrar(nome) {
  for (const [chave, el] of Object.entries(telas)) el.hidden = chave !== nome;
}

function mostrarAviso(texto) {
  const aviso = $("#aviso");
  aviso.textContent = texto;
  aviso.hidden = !texto;
}

async function carregarIndice() {
  try {
    const resposta = await fetch("index.json", { cache: "no-cache" });
    if (!resposta.ok) throw new TypeError(`index.json ${resposta.status}`);
    return (await resposta.json()).obras;
  } catch (err) {
    mostrarAviso(mensagemDeErro(err));
    return [];
  }
}

function desenharLista(obras) {
  const cards = $("#cards");
  cards.replaceChildren();
  for (const rg of obras) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "card";
    botao.innerHTML = `<span><span class="rg">RG ${rg}</span><span class="sub">Abrir simulação</span></span><span class="seta" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></span>`;
    botao.addEventListener("click", () => (senhasDaSessao.has(rg) ? reabrir(rg) : pedirSenha(rg)));
    cards.append(botao);
  }
}

async function reabrir(rg) {
  try {
    mostrarObra(rg, await abrirObra(rg, senhasDaSessao.get(rg)));
  } catch (err) {
    senhasDaSessao.delete(rg);
    pedirSenha(rg);
    $("#erroSenha").textContent = mensagemDeErro(err);
    $("#erroSenha").hidden = false;
  }
}

function pedirSenha(rg) {
  rgAtual = rg;
  $("#senhaRG").textContent = `Obra ${rg}`;
  $("#campoSenha").value = "";
  $("#erroSenha").hidden = true;
  mostrar("senha");
  $("#campoSenha").focus();
}

async function abrirObra(rg, senha) {
  const resposta = await fetch(`obras/${rg}.json`);
  if (!resposta.ok) throw new TypeError(`obras/${rg}.json ${resposta.status}`);
  const html = await decryptObra(await resposta.json(), senha);
  senhasDaSessao.set(rg, senha);
  return html;
}

function mostrarObra(rg, html) {
  rgAtual = rg;
  $("#visorRG").textContent = `Obra ${rg}`;
  obra.srcdoc = html;
  mostrar("visor");
}

$("#formSenha").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const rg = rgAtual;
  const senha = $("#campoSenha").value; // exata: sem trim, porque o build cifrou com a senha digitada
  try {
    mostrarObra(rg, await abrirObra(rg, senha));
  } catch (err) {
    $("#erroSenha").textContent = mensagemDeErro(err);
    $("#erroSenha").hidden = false;
  }
});

$("#voltarLista").addEventListener("click", () => mostrar("lista"));

$("#trocar").addEventListener("click", () => {
  obra.srcdoc = "";
  mostrar("lista");
});

desenharLista(await carregarIndice());
mostrar("lista");

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {
    // Sem service worker o app continua funcionando, só não abre offline.
  });
}

// Compartilhar: no celular abre o menu do aparelho (WhatsApp etc.); no computador copia o link.
$("compartilhar").addEventListener("click", async () => {
  const link = new URL(`cliente.html?rg=${rgAtual}`, location.href).href;
  const botao = $("compartilhar");
  try {
    if (navigator.share) {
      await navigator.share({ title: "Simulação de iluminação Voltec", text: `Veja a luz da sua obra (RG ${rgAtual}).`, url: link });
      return;
    }
    await navigator.clipboard.writeText(link);
    botao.textContent = "Link copiado";
    setTimeout(() => (botao.textContent = "Compartilhar"), 2500);
  } catch (_) {
    // cancelado pela pessoa ou sem permissão de copiar: nada a fazer
  }
});
