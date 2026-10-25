import test from "node:test";
import assert from "node:assert/strict";
import { encryptObra, decryptObra } from "../app/js/crypto.js";

test("roundtrip devolve o HTML original", async () => {
  const html = "<p>Garagem · 75 lux</p>".repeat(5000); // ~120 KB, passa do limite de argumentos
  const obj = await encryptObra(html, "senha-de-teste-123");
  assert.equal(await decryptObra(obj, "senha-de-teste-123"), html);
});

test("senha errada rejeita", async () => {
  const obj = await encryptObra("<p>x</p>", "certa-1234567");
  await assert.rejects(decryptObra(obj, "errada-1234567"));
});

test("senha com espaço no fim não abre", async () => {
  const obj = await encryptObra("<p>x</p>", "certa-1234567");
  await assert.rejects(decryptObra(obj, "certa-1234567 "));
});

test("duas cifragens do mesmo texto saem diferentes", async () => {
  const a = await encryptObra("<p>x</p>", "certa-1234567");
  const b = await encryptObra("<p>x</p>", "certa-1234567");
  assert.notEqual(a.ct, b.ct);
  assert.notEqual(a.salt, b.salt);
});
