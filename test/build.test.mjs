import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildObras } from "../scripts/build.mjs";
import { decryptObra } from "../app/js/crypto.js";

const PROJ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function preparar(obras, senhas) {
  const raiz = await mkdtemp(join(tmpdir(), "voltec-build-"));
  const origem = join(raiz, "obras-src");
  const destino = join(raiz, "dist");
  await mkdir(origem, { recursive: true });
  for (const [rg, html] of Object.entries(obras)) {
    await writeFile(join(origem, `${rg}.html`), html);
  }
  return { origem, destino, senhas };
}

test("gera obras cifradas e índice em ordem", async () => {
  const cfg = await preparar(
    { "00002": "<p>dois</p>", "00001": "<p>um</p>" },
    { "00001": "senha-um-123456", "00002": "senha-dois-1234" },
  );
  await buildObras(cfg);
  const idx = JSON.parse(await readFile(join(cfg.destino, "index.json"), "utf8"));
  assert.deepEqual(idx, { obras: ["00001", "00002"] });
  const obj = JSON.parse(await readFile(join(cfg.destino, "obras", "00001.json"), "utf8"));
  assert.equal(await decryptObra(obj, "senha-um-123456"), "<p>um</p>");
});

test("publica a casca e uma lista de pré-cache que inclui obras e exclui o sw.js", async () => {
  const cfg = await preparar({ "00001": "<p>um</p>" }, { "00001": "senha-um-123456" });
  const casca = join(PROJ, "app");
  await buildObras({ ...cfg, casca });
  const pre = JSON.parse(await readFile(join(cfg.destino, "precache.json"), "utf8"));
  assert.ok(pre.arquivos.includes("index.html"));
  assert.ok(pre.arquivos.includes("js/app.js"));
  assert.ok(pre.arquivos.includes("img/icon-192.png"));
  assert.ok(pre.arquivos.includes("obras/00001.json"));
  assert.ok(pre.arquivos.includes("index.json"));
  assert.ok(!pre.arquivos.includes("sw.js"));
  assert.ok(!pre.arquivos.some((f) => f.startsWith("dist/")));
});

test("sw.js leva a versão do build, e obra diferente gera versão diferente", async () => {
  const a = await preparar({ "00001": "<p>um</p>" }, { "00001": "senha-um-123456" });
  await buildObras({ ...a, casca: join(PROJ, "app") });
  const b = await preparar({ "00001": "<p>outra</p>" }, { "00001": "senha-um-123456" });
  await buildObras({ ...b, casca: join(PROJ, "app") });
  const swA = await readFile(join(a.destino, "sw.js"), "utf8");
  const swB = await readFile(join(b.destino, "sw.js"), "utf8");
  assert.ok(!swA.includes("__VERSAO__"));
  assert.notEqual(swA, swB);
});

test("falha com o RG da obra que não tem senha", async () => {
  const cfg = await preparar(
    { "00001": "<p>x</p>", "00002": "<p>y</p>" },
    { "00001": "senha-um-123456" },
  );
  await assert.rejects(buildObras(cfg), /00002/);
});
