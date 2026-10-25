import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { encryptObra } from "../app/js/crypto.js";

export async function buildObras({ origem, destino, senhas }) {
  const obras = (await readdir(origem))
    .filter((f) => f.endsWith(".html"))
    .map((f) => basename(f, ".html"))
    .sort();

  for (const rg of obras) {
    if (!senhas[rg]) throw new Error(`Sem senha para a obra ${rg} em senhas.json`);
  }

  await mkdir(join(destino, "obras"), { recursive: true });
  for (const rg of obras) {
    const html = await readFile(join(origem, `${rg}.html`), "utf8");
    const obj = await encryptObra(html, senhas[rg]);
    await writeFile(join(destino, "obras", `${rg}.json`), JSON.stringify(obj));
  }
  await writeFile(join(destino, "index.json"), JSON.stringify({ obras }));
  return obras;
}

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const senhas = JSON.parse(await readFile(join(raiz, "obras-src", "senhas.json"), "utf8"));
  const obras = await buildObras({
    origem: join(raiz, "obras-src"),
    destino: join(raiz, "app", "dist"),
    senhas,
  });
  console.log(`Build: ${obras.join(", ")}`);
}
