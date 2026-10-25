import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { encryptComChave, encryptObra, gerarChave } from "../app/js/crypto.js";
import { chaveDoTexto, comChaveCliente, tirarChaveCliente } from "../app/js/padrao.js";
import { prepararObra } from "./obra.mjs";

// Obras cifradas e índice. Cada obra sai em duas versões: a da equipe (com senha)
// e a do cliente (com a chave do link). `chaves` guarda as chaves do cliente,
// para o link não mudar a cada build. Com `casca` (pasta app/), também publica
// a casca, a lista de pré-cache e o sw.js com a versão deste build.
export async function buildObras({ origem, destino, senhas, chaves, casca }) {
  const obras = (await readdir(origem))
    .filter((f) => f.endsWith(".html"))
    .map((f) => basename(f, ".html"))
    .sort();

  for (const rg of obras) {
    if (!senhas[rg]) throw new Error(`Sem senha para a obra ${rg} em senhas.json`);
  }

  await mkdir(join(destino, "obras"), { recursive: true });
  for (const rg of obras) {
    const bruto = await readFile(join(origem, `${rg}.html`), "utf8");
    if (!chaves[rg]) chaves[rg] = chaveDoTexto(bruto) || gerarChave();
    const preparado = casca ? await prepararObra(bruto, casca) : bruto;
    const html = comChaveCliente(tirarChaveCliente(preparado), chaves[rg]);
    const obj = await encryptObra(html, senhas[rg]);
    await writeFile(join(destino, "obras", `${rg}.json`), JSON.stringify(obj));
    const cliente = await encryptComChave(html, chaves[rg]);
    await writeFile(join(destino, "obras", `${rg}.cliente.json`), JSON.stringify(cliente));
  }
  await writeFile(join(destino, "index.json"), JSON.stringify({ obras }));

  if (casca) await publicarCasca({ casca, destino, obras });
  return obras;
}

async function listarArquivos(pasta) {
  const arquivos = [];
  for (const rel of await readdir(pasta, { recursive: true })) {
    if ((await stat(join(pasta, rel))).isFile()) arquivos.push(rel.split(sep).join("/"));
  }
  return arquivos;
}

async function publicarCasca({ casca, destino, obras }) {
  const arquivos = (await listarArquivos(casca)).filter(
    (p) => p !== "sw.js" && !p.startsWith("dist/"),
  );

  for (const rel of arquivos) {
    await mkdir(dirname(join(destino, rel)), { recursive: true });
    await copyFile(join(casca, rel), join(destino, rel));
  }

  const geradosPorBuild = [
    "index.json",
    ...obras.flatMap((rg) => [`obras/${rg}.json`, `obras/${rg}.cliente.json`]),
  ];
  const lista = [...arquivos, ...geradosPorBuild].sort();

  const hash = createHash("sha256");
  for (const rel of lista) hash.update(await readFile(join(destino, rel)));
  const versao = hash.digest("hex").slice(0, 12);

  await writeFile(join(destino, "precache.json"), JSON.stringify({ versao, arquivos: lista }));
  const sw = await readFile(join(casca, "sw.js"), "utf8");
  await writeFile(join(destino, "sw.js"), sw.replaceAll("__VERSAO__", versao));
}

const aqui = fileURLToPath(import.meta.url);
const raiz = resolve(dirname(aqui), "..");

// Gera o site inteiro a partir de obras-src/ (com senhas.json e chaves.json locais).
export async function construirSite() {
  const origem = join(raiz, "obras-src");
  const senhas = JSON.parse(await readFile(join(origem, "senhas.json"), "utf8"));
  const arquivoChaves = join(origem, "chaves.json");
  const chaves = JSON.parse(await readFile(arquivoChaves, "utf8").catch(() => "{}"));
  const obras = await buildObras({
    origem,
    destino: join(raiz, "app", "dist"),
    senhas,
    chaves,
    casca: join(raiz, "app"),
  });
  await writeFile(arquivoChaves, JSON.stringify(chaves, null, 2));
  return obras;
}

if (process.argv[1] && resolve(process.argv[1]) === aqui) {
  const obras = await construirSite();
  console.log(`Build: ${obras.join(", ")}`);
}
