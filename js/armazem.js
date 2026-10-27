// Projetos adicionados neste aparelho. Ficam no IndexedDB, então abrem sem internet.
const BANCO = "voltec";
const LOJA = "obras";

function abrirBanco() {
  return new Promise((ok, falha) => {
    const pedido = indexedDB.open(BANCO, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(LOJA, { keyPath: "rg" });
    pedido.onsuccess = () => ok(pedido.result);
    pedido.onerror = () => falha(pedido.error);
  });
}

async function operar(modo, fazer) {
  const banco = await abrirBanco();
  return new Promise((ok, falha) => {
    const transacao = banco.transaction(LOJA, modo);
    const pedido = fazer(transacao.objectStore(LOJA));
    transacao.oncomplete = () => {
      banco.close();
      ok(pedido.result);
    };
    transacao.onerror = () => {
      banco.close();
      falha(transacao.error);
    };
  });
}

export function listarRGsLocais() {
  return operar("readonly", (loja) => loja.getAllKeys());
}

export function lerLocal(rg) {
  return operar("readonly", (loja) => loja.get(rg));
}

export function salvarLocal(obra) {
  return operar("readwrite", (loja) => loja.put(obra));
}
