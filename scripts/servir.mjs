import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
};

// Serve a pasta como o GitHub Pages faria: arquivo certo, tipo certo, nada fora dela.
export function criarServidor(pasta) {
  const raiz = resolve(pasta);
  return createServer(async (req, res) => {
    const url = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    let caminho = normalize(join(raiz, url));
    if (caminho !== raiz && !caminho.startsWith(raiz + sep)) {
      res.writeHead(403).end("Proibido");
      return;
    }
    if (url.endsWith("/")) caminho = join(caminho, "index.html");
    try {
      const corpo = await readFile(caminho);
      res.writeHead(200, {
        "content-type": MIME[extname(caminho)] || "application/octet-stream",
        "cache-control": "no-cache",
      });
      res.end(corpo);
    } catch {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Não encontrado");
    }
  });
}

const aqui = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === aqui) {
  const porta = Number(process.env.PORTA || 8080);
  const pasta = resolve(dirname(aqui), "..", "app", "dist");
  criarServidor(pasta).listen(porta, "127.0.0.1", () => {
    console.log(`Abra no navegador: http://localhost:${porta}`);
    console.log("Para parar: Ctrl+C neste terminal.");
  });
}
