import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mesclarComPublicado } from "../scripts/publicar.mjs";

const git = (args, cwd) => execFileSync("git", ["-c", "user.name=teste", "-c", "user.email=t@t", ...args], { cwd, stdio: "ignore" });

// Cria um repositório com a branch gh-pages já publicada, com uma obra que só existe lá.
function repositorioPublicado() {
  const raiz = mkdtempSync(join(tmpdir(), "voltec-remoto-"));
  const remoto = join(raiz, "remoto.git");
  git(["init", "-q", "--bare", remoto], raiz);
  const trabalho = join(raiz, "trabalho");
  mkdirSync(join(trabalho, "obras"), { recursive: true });
  writeFileSync(join(trabalho, "obras", "00009.json"), '{"publicada":true}');
  writeFileSync(join(trabalho, "obras", "00001.json"), '{"antiga":true}');
  writeFileSync(join(trabalho, "index.json"), JSON.stringify({ obras: ["00001", "00009"] }));
  git(["init", "-q", "-b", "gh-pages"], trabalho);
  git(["add", "-A"], trabalho);
  git(["commit", "-q", "-m", "site"], trabalho);
  git(["push", "-q", remoto, "gh-pages"], trabalho);
  return { raiz, remoto };
}

test("traz do GitHub as obras que só existem lá e mantém as locais", () => {
  const { raiz, remoto } = repositorioPublicado();
  const pasta = join(raiz, "dist");
  mkdirSync(join(pasta, "obras"), { recursive: true });
  writeFileSync(join(pasta, "obras", "00001.json"), '{"local":true}');
  writeFileSync(join(pasta, "index.json"), JSON.stringify({ obras: ["00001"] }));

  const trazidas = mesclarComPublicado(remoto, pasta);

  assert.deepEqual(trazidas, ["00009.json"]);
  assert.equal(readFileSync(join(pasta, "obras", "00009.json"), "utf8"), '{"publicada":true}');
  assert.equal(readFileSync(join(pasta, "obras", "00001.json"), "utf8"), '{"local":true}');
  assert.deepEqual(JSON.parse(readFileSync(join(pasta, "index.json"), "utf8")).obras, ["00001", "00009"]);
});

test("sem a branch gh-pages no GitHub, não mexe em nada", () => {
  const raiz = mkdtempSync(join(tmpdir(), "voltec-vazio-"));
  const remoto = join(raiz, "vazio.git");
  git(["init", "-q", "--bare", remoto], raiz);
  const pasta = join(raiz, "dist");
  mkdirSync(join(pasta, "obras"), { recursive: true });
  writeFileSync(join(pasta, "index.json"), JSON.stringify({ obras: ["00001"] }));
  assert.deepEqual(mesclarComPublicado(remoto, pasta), []);
  assert.deepEqual(readdirSync(join(pasta, "obras")), []);
});
