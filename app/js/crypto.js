export const ITER = 310000;

const enc = new TextEncoder();
const dec = new TextDecoder();

// String.fromCharCode(...bytes) estoura a pilha com textos grandes, por isso em blocos.
function toBase64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(bin);
}

function fromBase64(str) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

async function deriveKey(senha, salt, iter) {
  const base = await crypto.subtle.importKey("raw", enc.encode(senha), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptObra(html, senha) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(senha, salt, ITER);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(html)));
  return { v: 1, iter: ITER, salt: toBase64(salt), iv: toBase64(iv), ct: toBase64(ct) };
}

export async function decryptObra(obj, senha) {
  const key = await deriveKey(senha, fromBase64(obj.salt), obj.iter);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(obj.iv) }, key, fromBase64(obj.ct));
  return dec.decode(pt);
}

// Chave do cliente: 32 bytes aleatórios, em base64url. Vai no link (#chave), sem senha.
export function gerarChave() {
  return paraBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

function paraBase64Url(bytes) {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deBase64Url(str) {
  const padrao = str.replace(/-/g, "+").replace(/_/g, "/");
  return fromBase64(padrao + "=".repeat((4 - (padrao.length % 4)) % 4));
}

function chaveAes(chave) {
  return crypto.subtle.importKey("raw", deBase64Url(chave), "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptComChave(html, chave) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await chaveAes(chave), enc.encode(html)));
  return { v: 2, iv: toBase64(iv), ct: toBase64(ct) };
}

export async function decryptComChave(obj, chave) {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(obj.iv) }, await chaveAes(chave), fromBase64(obj.ct));
  return dec.decode(pt);
}
