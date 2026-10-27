// Envia um projeto novo para o repositório da Voltec pela API do GitHub.
// O fetch entra como parâmetro para o teste rodar sem internet.

export class ErroPublicacao extends Error {}

export function paraBase64(texto) {
  const bytes = new TextEncoder().encode(texto);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(bin);
}

export function deBase64(base64) {
  const bytes = Uint8Array.from(atob(base64.replace(/\s/g, "")), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function mensagemDoStatus(status, caminho) {
  if (status === 401 || status === 403) return "O token do GitHub não tem permissão para gravar neste repositório.";
  if (status === 404) return "Repositório não encontrado. Confira o nome em app/config.json.";
  if (status === 409 || status === 422) return `Conflito ao gravar ${caminho}. Tente de novo.`;
  return `O GitHub não aceitou ${caminho} (código ${status}).`;
}

export function criarApi({ repositorio, branch, token, fetch: buscar = fetch }) {
  const base = `https://api.github.com/repos/${repositorio}/contents`;
  const cabecalhos = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  async function lerArquivo(caminho) {
    const resposta = await buscar(`${base}/${caminho}?ref=${encodeURIComponent(branch)}`, { headers: cabecalhos });
    if (resposta.status === 404) return null;
    if (!resposta.ok) throw new ErroPublicacao(mensagemDoStatus(resposta.status, caminho));
    return resposta.json();
  }

  async function gravarArquivo(caminho, texto, mensagem) {
    const atual = await lerArquivo(caminho);
    const corpo = { message: mensagem, content: paraBase64(texto), branch };
    if (atual) corpo.sha = atual.sha;
    const resposta = await buscar(`${base}/${caminho}`, {
      method: "PUT",
      headers: { ...cabecalhos, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    if (!resposta.ok) throw new ErroPublicacao(mensagemDoStatus(resposta.status, caminho));
  }

  return { lerArquivo, gravarArquivo };
}

// Grava a obra da equipe, a do cliente e, por último, a lista de obras. Assim a lista
// só mostra o projeto quando os dois arquivos dele já existem no repositório.
export async function publicarProjeto(api, { rg, staff, cliente }) {
  const indice = await api.lerArquivo("index.json");
  const atuais = indice ? JSON.parse(deBase64(indice.content)).obras : [];
  const obras = [...new Set([...atuais, rg])].sort();

  await api.gravarArquivo(`obras/${rg}.json`, JSON.stringify(staff), `Projeto ${rg}: simulação da equipe`);
  await api.gravarArquivo(`obras/${rg}.cliente.json`, JSON.stringify(cliente), `Projeto ${rg}: simulação do cliente`);
  await api.gravarArquivo("index.json", JSON.stringify({ obras }), `Lista de obras: inclui ${rg}`);
  return obras;
}
