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
