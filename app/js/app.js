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
    botao.innerHTML = `<span><span class="rg">RG ${rg}</span><span class="sub" style="display:block">Toque para abrir</span></span><span class="seta" aria-hidden="true">→</span>`;
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
