import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prepararObra } from "../scripts/obra.mjs";

const PROJ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fonte = await readFile(join(PROJ, "obras-src", "00001.html"), "utf8");
const pronta = await prepararObra(fonte, join(PROJ, "app"));

test("a obra pronta não tem o editor que fala com o claude.ai", () => {
  assert.ok(!pronta.includes("window.claude"));
  assert.ok(!pronta.includes("publishProj"));
  assert.ok(!pronta.includes("artifactNS"));
});

test("a obra pronta não tem nenhuma URL externa", () => {
  // http://www.w3.org/1999/xhtml é namespace de XML dentro do Three.js, não conexão de rede
  assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(pronta), "ainda tem URL externa");
});

test("Three.js e as fontes estão embutidos", () => {
  assert.ok(pronta.includes("THREE.WebGLRenderer"));
  assert.ok(pronta.includes("@font-face"));
  assert.ok(pronta.includes("data:font/woff2;base64,"));
});

test("os dados do projeto (coqueiros e refletores) continuam na obra", () => {
  assert.ok(pronta.includes('"trees"'));
  assert.ok(pronta.includes('"fix"'));
});

const abas = [...pronta.matchAll(/<button [^>]*role="tab"[^>]*>([^<]+)<\/button>/g)].map((m) => m[1]);

test("as abas são Resumo, Tabelas, Ajustar, Luminárias e Cena, nessa ordem", () => {
  assert.deepEqual(abas, ["Resumo", "Tabelas", "Ajustar", "Luminárias", "Cena"]);
});

test("não sobrou aba antiga (Vagas, Coqueiros, Ajustes, Refletores)", () => {
  for (const antiga of ["Vagas", "Coqueiros", "Ajustes", "Refletores", "Resultado"]) {
    assert.ok(!abas.includes(antiga), `ainda existe a aba ${antiga}`);
  }
});

test("cada aba tem o painel correspondente", () => {
  for (const id of ["proj", "res", "luz", "fix", "cena"]) {
    assert.ok(pronta.includes(`id="pane-${id}"`), `falta pane-${id}`);
  }
});
