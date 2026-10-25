import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Deixa a obra autocontida: o srcdoc não acha arquivos vizinhos, então o Three.js
// e as fontes entram dentro do próprio HTML antes de a obra ser cifrada.
export async function prepararObra(html, casca) {
  const three = await readFile(join(casca, "vendor", "three.min.js"), "utf8");
  const fontsCss = await embutirFontes(join(casca, "vendor"));

  return html
    .replace(/<link rel="preconnect"[^>]*>\s*/g, "")
    .replace(/<link href="https:\/\/fonts\.googleapis\.com[^"]*" rel="stylesheet">/, () => `<style>${fontsCss}</style>`)
    .replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/[^"]*three\.min\.js"><\/script>/, () => `<script>${three}</script>`);
}

async function embutirFontes(vendor) {
  let css = await readFile(join(vendor, "fonts.css"), "utf8");
  const arquivos = [...new Set([...css.matchAll(/url\((fonts\/[^)]+)\)/g)].map((m) => m[1]))];
  for (const rel of arquivos) {
    const base64 = (await readFile(join(vendor, rel))).toString("base64");
    css = css.split(`url(${rel})`).join(`url(data:font/woff2;base64,${base64})`);
  }
  return css;
}
