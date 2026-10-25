import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const APP = resolve(dirname(fileURLToPath(import.meta.url)), "..", "app");

test("nenhum arquivo da casca aponta para fora (CDN ou Google Fonts)", async () => {
  const arquivos = ["index.html", "sw.js", "manifest.webmanifest", "css/app.css", "js/app.js", "js/crypto.js", "js/erros.js"];
  for (const rel of arquivos) {
    const texto = await readFile(join(APP, rel), "utf8");
    assert.ok(!/https?:\/\//.test(texto), `${rel} tem URL externa`);
  }
});

test("Three.js r128 está dentro do app", async () => {
  const texto = await readFile(join(APP, "vendor", "three.min.js"), "utf8");
  assert.ok(texto.includes("WebGLRenderer"));
});

test("fontes estão dentro do app, com @font-face apontando para arquivos locais", async () => {
  const css = await readFile(join(APP, "vendor", "fonts.css"), "utf8");
  assert.ok(css.includes("@font-face"));
  assert.ok(!/https?:\/\//.test(css), "fonts.css tem URL externa");
  const woff2 = (await readdir(join(APP, "vendor", "fonts"))).filter((f) => f.endsWith(".woff2"));
  assert.ok(woff2.length >= 5, `só ${woff2.length} arquivos woff2`);
});
