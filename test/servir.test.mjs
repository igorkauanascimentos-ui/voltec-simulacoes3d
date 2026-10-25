import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { criarServidor } from "../scripts/servir.mjs";

async function subir() {
  const pasta = await mkdtemp(join(tmpdir(), "voltec-servir-"));
  await writeFile(join(pasta, "index.html"), "<!doctype html><title>ok</title>");
  await writeFile(join(pasta, "app.js"), "console.log(1)");
  const servidor = criarServidor(pasta);
  await new Promise((r) => servidor.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  return { servidor, base };
}

test("serve o index.html na raiz com tipo text/html", async () => {
  const { servidor, base } = await subir();
  try {
    const r = await fetch(`${base}/`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type"), /text\/html/);
    assert.match(await r.text(), /ok/);
  } finally {
    servidor.close();
  }
});

test("serve JavaScript com tipo correto para módulos", async () => {
  const { servidor, base } = await subir();
  try {
    const r = await fetch(`${base}/app.js`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type"), /javascript/);
  } finally {
    servidor.close();
  }
});

test("arquivo que não existe responde 404", async () => {
  const { servidor, base } = await subir();
  try {
    assert.equal((await fetch(`${base}/nao-existe.json`)).status, 404);
  } finally {
    servidor.close();
  }
});

test("não sai da pasta servida", async () => {
  const { servidor, base } = await subir();
  try {
    const r = await fetch(`${base}/..%2Fpackage.json`);
    assert.notEqual(r.status, 200);
  } finally {
    servidor.close();
  }
});
