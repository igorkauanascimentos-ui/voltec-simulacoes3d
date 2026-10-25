import test from "node:test";
import assert from "node:assert/strict";
import { criarApi, deBase64, ErroPublicacao, paraBase64, publicarProjeto } from "../app/js/publicar.js";

// Simula a API do GitHub guardando os arquivos em memória.
function github({ existentes = {}, status = 200 } = {}) {
  const arquivos = { ...existentes };
  const chamadas = [];
  const buscar = async (url, opcoes = {}) => {
    const caminho = url.split("/contents/")[1].split("?")[0];
    chamadas.push({ metodo: opcoes.method || "GET", caminho, corpo: opcoes.body ? JSON.parse(opcoes.body) : null });
    if (status !== 200) return new Response("", { status });
    if (!opcoes.method) {
      if (!(caminho in arquivos)) return new Response("", { status: 404 });
      return Response.json({ sha: arquivos[caminho].sha, content: paraBase64(arquivos[caminho].texto) });
    }
    arquivos[caminho] = { sha: `sha-${caminho}`, texto: deBase64(JSON.parse(opcoes.body).content) };
    return Response.json({ content: {} }, { status: 201 });
  };
  return { buscar, arquivos, chamadas };
}

test("base64 ida e volta com acentos e textos grandes", () => {
  const texto = "Garagem · então 75 lux ".repeat(20000);
  assert.equal(deBase64(paraBase64(texto)), texto);
});

test("publica obra, versão do cliente e lista, nesta ordem", async () => {
  const gh = github({ existentes: { "index.json": { sha: "s0", texto: JSON.stringify({ obras: ["00001", "00002"] }) } } });
  const api = criarApi({ repositorio: "voltec/simulacoes", branch: "gh-pages", token: "t", fetch: gh.buscar });
  const obras = await publicarProjeto(api, { rg: "00003", staff: { v: 1 }, cliente: { v: 2 } });
  assert.deepEqual(obras, ["00001", "00002", "00003"]);
  const gravacoes = gh.chamadas.filter((c) => c.metodo === "PUT").map((c) => c.caminho);
  assert.deepEqual(gravacoes, ["obras/00003.json", "obras/00003.cliente.json", "index.json"]);
  assert.equal(gh.arquivos["index.json"].texto, JSON.stringify({ obras: ["00001", "00002", "00003"] }));
});

test("envia o sha do arquivo que já existe, para atualizar sem conflito", async () => {
  const gh = github({ existentes: { "index.json": { sha: "s0", texto: '{"obras":["00003"]}' }, "obras/00003.json": { sha: "antigo", texto: "{}" } } });
  const api = criarApi({ repositorio: "voltec/simulacoes", branch: "gh-pages", token: "t", fetch: gh.buscar });
  await publicarProjeto(api, { rg: "00003", staff: {}, cliente: {} });
  const put = gh.chamadas.find((c) => c.metodo === "PUT" && c.caminho === "obras/00003.json");
  assert.equal(put.corpo.sha, "antigo");
  const novo = gh.chamadas.find((c) => c.metodo === "PUT" && c.caminho === "obras/00003.cliente.json");
  assert.equal(novo.corpo.sha, undefined);
  assert.equal(novo.corpo.branch, "gh-pages");
});

test("token sem permissão mostra a mensagem certa", async () => {
  const api = criarApi({ repositorio: "voltec/simulacoes", branch: "gh-pages", token: "t", fetch: github({ status: 403 }).buscar });
  await assert.rejects(publicarProjeto(api, { rg: "00003", staff: {}, cliente: {} }), (err) => {
    assert.ok(err instanceof ErroPublicacao);
    return /permissão/.test(err.message);
  });
});

test("repositório errado mostra onde corrigir", async () => {
  const api = criarApi({ repositorio: "x/y", branch: "gh-pages", token: "t", fetch: github({ status: 404 }).buscar });
  await assert.rejects(publicarProjeto(api, { rg: "00003", staff: {}, cliente: {} }), /app\/config\.json/);
});
