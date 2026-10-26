import { decryptObra, encryptComChave, encryptObra, gerarChave } from "./crypto.js";
import { mensagemDeErro } from "./erros.js";
import { comChaveCliente, ehSimulacaoPadrao, embutirThree, lerChaveCliente } from "./padrao.js";
import { criarApi, ErroPublicacao, publicarProjeto } from "./publicar.js";

const $ = (seletor) => document.querySelector(seletor);
const telas = { lista: $("#lista"), senha: $("#senha"), visor: $("#visor") };
const obra = $("#obra");
const dialogo = $("#dialogoNova");
const CACHE_DADOS = "voltec-dados"; // o mesmo nome que o sw.js usa para lista e obras

// Nesta aba: o HTML de cada obra já aberta, para abrir de novo sem pedir a senha.
const htmlDaSessao = new Map();
// Arquivo cifrado de cada obra. Começa a baixar ao tocar no cartão, enquanto a pessoa digita a senha.
const arquivos = new Map();
let config = { repositorio: "", branch: "gh-pages" };
let rgAtual = null;

function mostrar(nome) {
  for (const [chave, el] of Object.entries(telas)) el.hidden = chave !== nome;
}

function mostrarAviso(texto) {
  const aviso = $("#aviso");
  aviso.textContent = texto;
  aviso.hidden = !texto;
}

async function carregarConfig() {
  try {
    config = { ...config, ...(await (await fetch("config.json", { cache: "no-cache" })).json()) };
  } catch (_) {
    // sem config a lista ainda abre; só o "+" fica indisponível
  }
}

async function carregarLista() {
  try {
    const resposta = await fetch("index.json", { cache: "no-cache" });
    if (!resposta.ok) throw new TypeError(`index.json ${resposta.status}`);
    desenharLista((await resposta.json()).obras);
  } catch (err) {
    mostrarAviso(mensagemDeErro(err));
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
    botao.addEventListener("click", () => (htmlDaSessao.has(rg) ? mostrarObra(rg, htmlDaSessao.get(rg)) : pedirSenha(rg)));
    cards.append(botao);
  }
}

function buscarArquivo(rg) {
  if (!arquivos.has(rg)) {
    const busca = (async () => {
      const resposta = await fetch(`obras/${rg}.json`);
      if (!resposta.ok) throw new TypeError(`obras/${rg}.json ${resposta.status}`);
      return resposta.json();
    })();
    busca.catch(() => arquivos.delete(rg));
    arquivos.set(rg, busca);
  }
  return arquivos.get(rg);
}

const MSG_HTTP = "Este endereço é http, e o celular não libera a criptografia. Ative o endereço como seguro (veja as instruções da Voltec) ou abra pelo https do site.";

function pedirSenha(rg) {
  rgAtual = rg;
  $("#senhaRG").textContent = `Obra ${rg}`;
  $("#campoSenha").value = "";
  $("#erroSenha").textContent = MSG_HTTP;
  $("#erroSenha").hidden = window.isSecureContext;
  mostrar("senha");
  $("#campoSenha").focus();
  buscarArquivo(rg).catch(() => {});
}

async function abrirObra(rg, senha) {
  if (htmlDaSessao.has(rg)) return htmlDaSessao.get(rg);
  const html = await decryptObra(await buscarArquivo(rg), senha);
  htmlDaSessao.set(rg, html);
  return html;
}

// A faixa de cima é a única da tela: o cabeçalho da própria simulação fica escondido.
// No computador o resumo fica ao lado da cena; no celular, embaixo. Cada grade continua valendo.
const ESTILO_VISOR = `
  #hdr{display:none!important}
  @media (min-width:900px){#app{grid-template-rows:1fr!important}#view,#side{grid-row:1!important}}
  @media (max-width:899px){#app{grid-template-rows:1fr auto!important}#view{grid-row:1!important}#side{grid-row:2!important;max-height:56vh!important}#side.min{max-height:none!important}#side.min #tabs,#side.min #pages{display:flex!important}#side.min #pages{display:block!important}}
  :root{color-scheme:light}
  /* leitura para a equipe: sem caixa-alta, texto legível, um só destaque de estado (amarelo) */
  #ttl small{font-size:12px;font-weight:600;letter-spacing:0;text-transform:none;color:#C8CBD0}
  #ttl h1{font-size:22px;font-weight:700;margin:2px 0 0}
  #ttl p{font-size:12px;color:#C8CBD0}
  #side{background:#0A2B4E!important;border-left:1px solid rgba(255,255,255,.08)!important}
  .ptop{padding:14px 16px 10px!important}
  .ptop h2{font-size:17px!important;font-weight:700!important}
  #resumoMin{font-size:12px;color:#C8CBD0;line-height:1.45;margin:4px 0 0}
  #tabs{padding:0 10px;gap:0}
  .tab{flex:1 1 auto!important;min-width:0;font-size:12.5px!important;font-weight:600!important;letter-spacing:0!important;text-transform:none!important;color:#AEB8C6!important;padding:12px 2px 11px!important;white-space:nowrap!important;text-align:center}
  .tab[aria-selected="true"]{color:#FFFFFF!important;border-bottom-color:#FDB50B!important}
  .page,.pane{padding:16px!important}
  .verdict{font-size:14px!important;line-height:1.55!important;border-radius:0 12px 12px 0!important;background:rgba(255,255,255,.06)!important}
  .kpi{gap:8px!important;background:none!important;border:0!important}
  .kpi div{background:rgba(255,255,255,.05)!important;border-radius:12px;padding:12px 14px!important}
  .kpi small{font-size:11px!important;letter-spacing:0!important;text-transform:none!important;font-weight:600!important;color:#C8CBD0!important}
  .kpi b{font-size:21px!important}
  .chips{gap:8px!important}
  .chip{border-radius:999px!important;font-size:13px!important;padding:9px 14px!important}
  .sw .n{font-size:14px!important}
  h3{font-size:14px!important;letter-spacing:0!important;text-transform:none!important;color:#FFFFFF!important;margin:18px 0 8px!important}
  .note{font-size:12px!important;line-height:1.55!important;color:#C8CBD0!important}
  .btn{border-radius:10px!important;font-size:13px!important}
  #modeSeg button,#segMode button{font-size:13px!important}
`;

function mostrarObra(rg, html) {
  rgAtual = rg;
  $("#visorRG").textContent = `Obra ${rg}`;
  $("#compartilhar").textContent = "Compartilhar";
  obra.onload = () => {
    const doc = obra.contentDocument;
    if (window.matchMedia("(max-width:899px)").matches) doc.getElementById("side").classList.remove("min");
    const estilo = obra.contentDocument.createElement("style");
    estilo.textContent = ESTILO_VISOR;
    obra.contentDocument.head.appendChild(estilo);
    obra.contentWindow.dispatchEvent(new Event("resize"));
  };
  obra.srcdoc = html;
  mostrar("visor");
}

$("#formSenha").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const rg = rgAtual;
  const botao = $("#formSenha .botao");
  const senha = $("#campoSenha").value; // exata: sem trim, porque o build cifrou com a senha digitada
  botao.disabled = true;
  botao.textContent = "Abrindo…";
  $("#erroSenha").hidden = true;
  try {
    mostrarObra(rg, await abrirObra(rg, senha));
  } catch (err) {
    $("#erroSenha").textContent = window.isSecureContext ? mensagemDeErro(err) : MSG_HTTP;
    $("#erroSenha").hidden = false;
  } finally {
    botao.disabled = false;
    botao.textContent = "Abrir simulação";
  }
});

$("#voltarLista").addEventListener("click", () => mostrar("lista"));

$("#trocar").addEventListener("click", () => {
  obra.srcdoc = "";
  mostrar("lista");
});

// Compartilhar: o link leva a chave do cliente no #, então o cliente não digita senha.
// No celular abre o menu do aparelho (WhatsApp etc.); no computador copia o link.
$("#compartilhar").addEventListener("click", async () => {
  const botao = $("#compartilhar");
  const chave = lerChaveCliente(obra.contentDocument);
  if (!chave) {
    botao.textContent = "Link indisponível";
    return;
  }
  const link = new URL(`cliente.html?rg=${rgAtual}#${chave}`, location.href).href;
  try {
    if (navigator.share) {
      await navigator.share({ title: "Simulação de iluminação Voltec", text: `Veja a luz da sua casa (RG ${rgAtual}).`, url: link });
      return;
    }
    if (!navigator.clipboard) {
      // sem endereço seguro o navegador não copia sozinho: a pessoa copia na caixa
      window.prompt("Copie o link para enviar ao cliente:", link);
      return;
    }
    await navigator.clipboard.writeText(link);
    botao.textContent = "Link copiado";
    setTimeout(() => (botao.textContent = "Compartilhar"), 2500);
  } catch (_) {
    // cancelado pela pessoa ou sem permissão de copiar: nada a fazer
  }
});

// Adicionar projeto: precisa de internet. Depois de enviado, o projeto fica guardado
// neste aparelho e abre sem internet.
const CHAVE_TOKEN = "voltec.tokenGitHub";

function tokenSalvo() {
  try {
    return localStorage.getItem(CHAVE_TOKEN) || "";
  } catch (_) {
    return "";
  }
}

function guardarToken(token) {
  try {
    localStorage.setItem(CHAVE_TOKEN, token);
  } catch (_) {
    // sem armazenamento, o token é pedido de novo na próxima vez
  }
}

function mostrarProgresso(texto) {
  $("#progressoNova").textContent = texto;
  $("#progressoNova").hidden = !texto;
}

function mostrarErroNova(texto) {
  $("#erroNova").textContent = texto;
  $("#erroNova").hidden = false;
}

$("#novaObra").addEventListener("click", () => {
  $("#formNova").reset();
  $("#erroNova").hidden = true;
  mostrarProgresso("");
  $("#campoToken").hidden = Boolean(tokenSalvo());
  dialogo.showModal();
});

$("#cancelarNova").addEventListener("click", () => dialogo.close());

// Guarda o projeto neste aparelho: a obra e a lista. Sem isso ele só abriria depois da publicação.
async function guardarNoAparelho(rg, staff, cliente, obras) {
  const cache = await caches.open(CACHE_DADOS);
  await cache.put(`obras/${rg}.json`, Response.json(staff));
  await cache.put(`obras/${rg}.cliente.json`, Response.json(cliente));
  await cache.put("index.json", Response.json({ obras }));
}

$("#formNova").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const rg = $("#novoRG").value.trim();
  const senha = $("#novaSenha").value;
  const arquivo = $("#novoArquivo").files[0];
  const token = tokenSalvo() || $("#tokenGitHub").value.trim();

  if (!/^\d{5}$/.test(rg)) return mostrarErroNova("O RG precisa ter 5 números, como 00003.");
  if (!senha) return mostrarErroNova("Digite a senha que essa obra vai usar.");
  if (!arquivo) return mostrarErroNova("Anexe o arquivo HTML da simulação.");
  if (!navigator.onLine) return mostrarErroNova("Sem internet agora. Conecte e tente de novo.");
  if (!config.repositorio) return mostrarErroNova("Falta o nome do repositório em config.json.");
  if (!token) return mostrarErroNova("Digite o token do GitHub.");

  const botao = $("#enviarNova");
  botao.disabled = true;
  $("#erroNova").hidden = true;
  try {
    mostrarProgresso("Conferindo o arquivo…");
    const bruto = await arquivo.text();
    if (!ehSimulacaoPadrao(bruto)) {
      throw new ErroPublicacao("Este arquivo não tem a estrutura da simulação Voltec. Ajuste antes de adicionar.");
    }
    mostrarProgresso("Preparando e cifrando…");
    const chave = gerarChave();
    const html = comChaveCliente(await embutirThree(bruto), chave);
    const staff = await encryptObra(html, senha);
    const cliente = await encryptComChave(html, chave);

    mostrarProgresso("Enviando para a Voltec…");
    const api = criarApi({ repositorio: config.repositorio, branch: config.branch, token });
    const obras = await publicarProjeto(api, { rg, staff, cliente });
    if (!tokenSalvo()) guardarToken(token);
    await guardarNoAparelho(rg, staff, cliente, obras);

    desenharLista(obras);
    mostrarProgresso(`Projeto ${rg} enviado. Ele aparece para todos em um ou dois minutos, quando o site atualizar.`);
  } catch (err) {
    const proprio = err instanceof ErroPublicacao;
    mostrarErroNova(proprio ? err.message : "Não foi possível enviar. Confira a internet e tente de novo.");
    mostrarProgresso("");
  } finally {
    botao.disabled = false;
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {
    // Sem service worker o app continua funcionando, só não abre offline.
  });
}

// Fora de https o navegador não libera a criptografia. Mostrar a causa, não "precisa de internet".
if (!window.isSecureContext) {
  mostrarAviso("Este endereço é http. O celular só libera a criptografia em https: abra pelo endereço seguro do site, ou libere este endereço no navegador como seguro.");
}

// A lista é a tela inicial. Não trocar de tela aqui: a carga pode terminar depois de um toque.
await carregarConfig();
await carregarLista();
