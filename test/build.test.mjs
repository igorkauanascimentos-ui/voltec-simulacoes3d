import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildObras } from "../scripts/build.mjs";
import { decryptObra } from "../app/js/crypto.js";

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

test("falha com o RG da obra que não tem senha", async () => {
  const cfg = await preparar(
    { "00001": "<p>x</p>", "00002": "<p>y</p>" },
    { "00001": "senha-um-123456" },
  );
  await assert.rejects(buildObras(cfg), /00002/);
});
