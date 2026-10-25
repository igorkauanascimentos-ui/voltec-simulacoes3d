// Adiciona um projeto novo ao site. Uso: npm run novo -- 00003 caminho/do/arquivo.html
// Confere se o HTML está no padrão, guarda em obras-src/ junto com a senha e gera o site.
// Para publicar no GitHub, depois rode: npm run publicar
import { existsSync } from "node:fs";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { construirSite } from "./build.mjs";

// Elementos que a simulação precisa ter para entrar no padrão do app.
const IDS_PADRAO = ["scene", "allW", "allC", "allH", "verdict"];

export function ehSimulacaoPadrao(html) {
  return IDS_PADRAO.every((id) => new RegExp(`\\bid="${id}"`).test(html));
}

export function conferirRG(rg) {
  if (!/^\d{5}$/.test(rg || "")) throw new Error("O RG precisa ter 5 números, como 00003.");
}

// Guarda o projeto e a senha em obras-src/ e devolve o resultado do build.
export async function adicionarProjeto({ rg, arquivo, senha, origem, senhas }) {
  conferirRG(rg);
  if (!existsSync(arquivo)) throw new Error(`Arquivo não encontrado: ${arquivo}`);
  const html = await readFile(arquivo, "utf8");
  if (!ehSimulacaoPadrao(html)) {
    throw new Error("Este arquivo não tem a estrutura da simulação Voltec. Ajuste antes de adicionar.");
  }
  if (!senha) throw new Error("A senha não pode ser vazia.");

  await copyFile(arquivo, join(origem, `${rg}.html`));
  senhas[rg] = senha;
  await writeFile(join(origem, "senhas.json"), JSON.stringify(senhas, null, 2));
  return html;
}

const aqui = fileURLToPath(import.meta.url);
const raiz = resolve(dirname(aqui), "..");
if (process.argv[1] && resolve(process.argv[1]) === aqui) {
  const [rg, arquivo] = process.argv.slice(2);
  const origem = join(raiz, "obras-src");
  const senhasArquivo = join(origem, "senhas.json");
  const senhas = existsSync(senhasArquivo) ? JSON.parse(await readFile(senhasArquivo, "utf8")) : {};
  const leitor = createInterface({ input: process.stdin, output: process.stdout });
  try {
    conferirRG(rg);
    if (!arquivo) throw new Error("Informe o arquivo HTML: npm run novo -- 00003 caminho/do/arquivo.html");
    const senha = await leitor.question(`Senha da obra ${rg}: `);
    await adicionarProjeto({ rg, arquivo: resolve(arquivo), senha, origem, senhas });
    const obras = await construirSite();
    console.log(`Projeto ${rg} adicionado. Obras no site: ${obras.join(", ")}`);
    console.log("Para a equipe e os clientes verem, rode: npm run publicar");
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    leitor.close();
  }
}
