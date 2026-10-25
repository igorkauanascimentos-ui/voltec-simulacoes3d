import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { adicionarProjeto, conferirRG, ehSimulacaoPadrao } from "../scripts/novo.mjs";
import { conferirSemFontes } from "../scripts/publicar.mjs";

const PADRAO = `<html><body><canvas id="scene"></canvas><b id="allW"></b><b id="allC"></b><b id="allH"></b><p id="verdict"></p></body></html>`;

test("reconhece a simulação no padrão e recusa a que tem outra estrutura", () => {
  assert.equal(ehSimulacaoPadrao(PADRAO), true);
  assert.equal(ehSimulacaoPadrao(`<html><body><div id="dimSl"></div></body></html>`), false);
});

test("RG tem 5 números", () => {
  assert.doesNotThrow(() => conferirRG("00003"));
  assert.throws(() => conferirRG("3"), /5 números/);
  assert.throws(() => conferirRG("0000A"), /5 números/);
});

test("adicionar guarda o HTML e a senha em obras-src, sem gerar nada fora dela", async () => {
  const raiz = await mkdtemp(join(tmpdir(), "voltec-novo-"));
  const origem = join(raiz, "obras-src");
  await mkdir(origem);
  const arquivo = join(raiz, "entrada.html");
  await writeFile(arquivo, PADRAO);
  const senhas = { "00001": "antiga-1234567" };
  await adicionarProjeto({ rg: "00003", arquivo, senha: "nova-senha-123", origem, senhas });
  assert.equal(await readFile(join(origem, "00003.html"), "utf8"), PADRAO);
  const gravadas = JSON.parse(await readFile(join(origem, "senhas.json"), "utf8"));
  assert.equal(gravadas["00003"], "nova-senha-123");
  assert.equal(gravadas["00001"], "antiga-1234567");
});

test("adicionar recusa arquivo fora do padrão e senha vazia", async () => {
  const raiz = await mkdtemp(join(tmpdir(), "voltec-novo-"));
  const origem = join(raiz, "obras-src");
  await mkdir(origem);
  const arquivo = join(raiz, "fora.html");
  await writeFile(arquivo, "<p>outra coisa</p>");
  await assert.rejects(adicionarProjeto({ rg: "00004", arquivo, senha: "x-1234567", origem, senhas: {} }), /estrutura/);
  await writeFile(arquivo, PADRAO);
  await assert.rejects(adicionarProjeto({ rg: "00004", arquivo, senha: "", origem, senhas: {} }), /senha/);
});

test("publicar só aceita obras cifradas (.json) na pasta do site", async () => {
  const pasta = await mkdtemp(join(tmpdir(), "voltec-dist-"));
  await mkdir(join(pasta, "obras"));
  await writeFile(join(pasta, "obras", "00001.json"), "{}");
  assert.doesNotThrow(() => conferirSemFontes(pasta));
  await writeFile(join(pasta, "obras", "00002.html"), "<p>texto puro</p>");
  assert.throws(() => conferirSemFontes(pasta), /00002\.html/);
});
