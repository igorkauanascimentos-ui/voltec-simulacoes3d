// Publica o site no GitHub Pages. Uso: npm run publicar
// Gera o site e envia só app/dist (obras cifradas) para a branch gh-pages do repositório.
// Projetos adicionados pelo app, que existem só no GitHub, são mantidos.
// O código-fonte das simulações (obras-src/) nunca sai da sua máquina.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { construirSite } from "./build.mjs";

const aqui = fileURLToPath(import.meta.url);
const raiz = resolve(dirname(aqui), "..");
const dist = join(raiz, "app", "dist");

function git(args, cwd = raiz) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

// Segurança: nenhum HTML de simulação pode estar no que vai para o site.
export function conferirSemFontes(pasta) {
  const soltos = readdirSync(join(pasta, "obras")).filter((f) => !f.endsWith(".json"));
  if (soltos.length) throw new Error(`Arquivos que não podem ser publicados: ${soltos.join(", ")}`);
}

// Traz do GitHub as obras que não estão na sua máquina (adicionadas pelo app).
// As que você tem localmente prevalecem. Se a branch ainda não existe, não faz nada.
export function mesclarComPublicado(remoto, pasta) {
  const copia = mkdtempSync(join(tmpdir(), "voltec-publicado-"));
  try {
    git(["clone", "-q", "--depth", "1", "--branch", "gh-pages", remoto, copia]);
  } catch {
    rmSync(copia, { recursive: true, force: true });
    return [];
  }
  const trazidas = [];
  const obrasPublicadas = join(copia, "obras");
  if (existsSync(obrasPublicadas)) {
    for (const arquivo of readdirSync(obrasPublicadas)) {
      if (existsSync(join(pasta, "obras", arquivo))) continue;
      cpSync(join(obrasPublicadas, arquivo), join(pasta, "obras", arquivo));
      trazidas.push(arquivo);
    }
  }
  const indiceLocal = join(pasta, "index.json");
  const indicePublicado = join(copia, "index.json");
  if (existsSync(indicePublicado)) {
    const de = (f) => JSON.parse(readFileSync(f, "utf8")).obras;
    const todas = [...new Set([...de(indicePublicado), ...de(indiceLocal)])].sort();
    writeFileSync(indiceLocal, JSON.stringify({ obras: todas }));
  }
  rmSync(copia, { recursive: true, force: true });
  return trazidas;
}

if (process.argv[1] && resolve(process.argv[1]) === aqui) {
  let remoto;
  try {
    remoto = git(["remote", "get-url", "origin"]);
  } catch {
    console.error("O repositório ainda não está ligado ao GitHub.");
    console.error("Crie um repositório vazio no GitHub e rode: git remote add origin <endereço>");
    process.exitCode = 1;
  }

  if (remoto) {
    try {
      const obras = await construirSite();
      const trazidas = mesclarComPublicado(remoto, dist);
      conferirSemFontes(dist);

      const temporario = mkdtempSync(join(tmpdir(), "voltec-site-"));
      cpSync(dist, temporario, { recursive: true });
      git(["init", "-q", "-b", "gh-pages"], temporario);
      git(["add", "-A"], temporario);
      const data = new Date().toLocaleString("pt-BR");
      git(["commit", "-q", "-m", `Publica o site (${data})`], temporario);
      git(["push", "-q", "--force", remoto, "gh-pages"], temporario);
      rmSync(temporario, { recursive: true, force: true });
      const extra = trazidas.length ? ` Mantidas do GitHub: ${trazidas.join(", ")}.` : "";
      console.log(`Publicado: ${obras.join(", ")}.${extra} Em um ou dois minutos o site atualiza para todos.`);
    } catch (err) {
      console.error(`Não foi publicado: ${err.message}`);
      process.exitCode = 1;
    }
  }
}
