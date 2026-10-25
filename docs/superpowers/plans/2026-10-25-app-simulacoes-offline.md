# App Voltec de simulações 3D offline: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um app PWA, hospedado no GitHub Pages, que lista obras por RG, pede a senha de cada uma, abre a simulação criptografada e funciona offline depois de instalado.

**Architecture:** Um build em Node transforma as simulações-fonte em arquivos cifrados (AES-GCM, chave por PBKDF2) e gera o índice e a lista de pré-cache. A casca do app (lista, senha, visualizador) é HTML, CSS e JS puros. Cada simulação roda num `iframe` com `srcdoc`, a partir do texto decifrado no navegador. Um service worker guarda tudo para uso offline.

**Tech Stack:** Node 20+ (build e testes com `node:test`), WebCrypto, Service Worker, Web App Manifest, Three.js r128, HTML/CSS/JS sem framework.

**Spec:** `docs/superpowers/specs/2026-10-25-app-simulacoes-offline-design.md`

## Global Constraints

- Custo zero: sem serviço pago em nenhuma etapa.
- Obra publicada: só o `.json` cifrado e o índice com números de RG. Nada em texto aberto.
- PBKDF2-SHA256, 310000 iterações, AES-GCM 256, salt de 16 bytes, IV de 12 bytes.
- RG válidos nesta fase: `00001` e `00002`. Formato sempre com 5 dígitos.
- Senhas só em `obras-src/senhas.json`, nunca no Git.
- Português do Brasil em todo texto visível.
- Cores da casca: marinho `#12233A`, marinho-profundo `#0A1626`, dourado `#C9A24E`, papel `#F5F1E8`. Fontes: Barlow Condensed 700 e Barlow 400/500.
- Nenhuma URL externa no build final: nada de cdnjs, Google Fonts ou CDN.

## Review Focus

- Senha errada: nada da obra aparece, e a mensagem de erro aparece na tela. Teste: `decryptObra` rejeita com senha errada, sem devolver texto parcial.
- Senha com espaço no fim ou maiúscula: o app compara exatamente o que foi digitado. Teste: senha com espaço final falha, senha idêntica abre.
- Primeira abertura sem internet: o app mostra "precisa de internet na primeira vez" em vez de tela branca. Teste manual: modo avião antes da primeira carga.
- Obra atualizada depois de instalada: o service worker entrega a versão nova na próxima abertura com internet. Teste manual.
- `localStorage` bloqueado ou cheio dentro do `iframe`: a simulação continua funcionando. Teste: a 00001 com `localStorage` lançando erro abre e calcula.

---

### Task 0: Preparar o ambiente e os arquivos de origem

**Files:**
- Create: `obras-src/.gitignore`
- Create: `obras-src/senhas.json` (local, não versionado)
- Place by hand: `obras-src/00001.html` (HTML baixado da interface do Claude, "Estudo Luminotécnico da Garagem")
- Create: `.gitignore` (raiz do projeto)

**Interfaces:**
- Consumes: nada.
- Produces: `obras-src/<RG>.html` para cada obra; `obras-src/senhas.json` no formato `{"00001": "senha"}`.

- [ ] **Step 1: Confirmar Node 20 ou mais novo**

Run: `node --version`
Expected: `v20.` ou superior. Se não, instalar Node LTS antes de seguir.

- [ ] **Step 2: Colocar o HTML da 00001 em `obras-src/00001.html`**

Igor salva o arquivo baixado com esse nome exato. Nenhum outro passo depende do conteúdo ainda.

- [ ] **Step 3: Criar `.gitignore` na raiz com `obras-src/` e `senhas.json`**

Conteúdo:

```
obras-src/
obras-src/senhas.json
```

- [ ] **Step 4: Criar `obras-src/senhas.json` com a senha da 00001**

Formato: `{"00001": "<senha forte escolhida pelo Igor>"}`. Senha forte: mínimo 12 caracteres, misturando letras, números e símbolos.

- [ ] **Step 5: Git**

Run: `git init` na raiz do `02-Simulacao-3D`.
Expected: repositório criado. A partir daqui, os commits das tarefas seguintes valem.

- [ ] **Step 6: Commit**

```bash
git add .gitignore
git commit -m "chore: prepara ignorados para obras-src e senhas"
```

---

### Task 1: Cifrar e decifrar uma obra

**Files:**
- Create: `app/js/crypto.js`
- Create: `test/crypto.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `encryptObra(html: string, senha: string) => Promise<{v: 1, iter: number, salt: string, iv: string, ct: string}>`
  - `decryptObra(obj: {iter, salt, iv, ct}, senha: string) => Promise<string>`; rejeita com `OperationError` se a senha estiver errada.
  - `ITER = 310000`, constante exportada.

- [ ] **Step 1: Escrever os testes que falham**

```js
// test/crypto.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { encryptObra, decryptObra } from "../app/js/crypto.js";

test("roundtrip devolve o HTML original", async () => {
  const html = "<p>Garagem · 75 lux</p>".repeat(5000); // ~120 KB, passa do limite de argumentos
  const obj = await encryptObra(html, "senha-de-teste-123");
  assert.equal(await decryptObra(obj, "senha-de-teste-123"), html);
});

test("senha errada rejeita", async () => {
  const obj = await encryptObra("<p>x</p>", "certa-1234567");
  await assert.rejects(decryptObra(obj, "errada-1234567"));
});

test("senha com espaço no fim não abre", async () => {
  const obj = await encryptObra("<p>x</p>", "certa-1234567");
  await assert.rejects(decryptObra(obj, "certa-1234567 "));
});

test("duas cifragens do mesmo texto saem diferentes", async () => {
  const a = await encryptObra("<p>x</p>", "certa-1234567");
  const b = await encryptObra("<p>x</p>", "certa-1234567");
  assert.notEqual(a.ct, b.ct);
  assert.notEqual(a.salt, b.salt);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test test/crypto.test.mjs`
Expected: FAIL com "Cannot find module ... crypto.js".

- [ ] **Step 3: Implementar `app/js/crypto.js`**

Assinaturas exatas da seção Interfaces. O corpo segue o padrão WebCrypto:
- `deriveKey(senha, salt, iter)` importa a senha como `raw` (PBKDF2) e deriva AES-GCM 256.
- `encryptObra` gera salt e IV com `crypto.getRandomValues`, cifra o HTML codificado em UTF-8 e devolve base64.
- Conversão base64 em blocos de 8192 bytes. `String.fromCharCode(...bytes)` estoura a pilha com textos grandes.
- `decryptObra` lê `obj.iter`, não a constante, para que obras antigas continuem abrindo se o número mudar.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test test/crypto.test.mjs`
Expected: PASS, 4 testes.

- [ ] **Step 5: Commit**

```bash
git add app/js/crypto.js test/crypto.test.mjs
git commit -m "feat: cifra e decifra obra com AES-GCM e PBKDF2"
```

---

### Task 2: Build que gera as obras cifradas e o índice

**Files:**
- Create: `scripts/build.mjs`
- Create: `test/build.test.mjs`
- Create: `test/fixtures/obras-src/00001.html`, `test/fixtures/obras-src/senhas.json` (fixtures para teste, não entram no build real)

**Interfaces:**
- Consumes: `encryptObra` de Task 1.
- Produces: `buildObras({ origem, destino, senhas })` escreve, dentro de `destino`:
  - `obras/<RG>.json` para cada `<RG>.html` em `origem`;
  - `index.json` com `{"obras": ["00001", ...]}`, em ordem.
  - Falha com erro claro se alguma obra não tiver senha em `senhas`.

- [ ] **Step 1: Escrever o teste que falha**

O teste cria uma pasta temporária com um `00001.html` pequeno e um `senhas.json`, roda `buildObras`, e confere:
- `index.json` contém `["00001"]`;
- `obras/00001.json` existe e `decryptObra` com a senha certa devolve o HTML original;
- sem senha para `00002`, `buildObras` rejeita com mensagem contendo `00002`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test test/build.test.mjs`
Expected: FAIL, módulo `scripts/build.mjs` não existe.

- [ ] **Step 3: Implementar `scripts/build.mjs`**

- Lê `obras-src/*.html`, ordena pelo nome.
- Para cada RG, pega a senha de `senhas.json`; sem senha, lança erro.
- Escreve `obras/<RG>.json` com `encryptObra`.
- Escreve `index.json`.
- Função exportada `buildObras`. Quando rodado direto (`node scripts/build.mjs`), usa `obras-src/`, `app/dist/` e `obras-src/senhas.json`.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test test/build.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/build.mjs test/build.test.mjs test/fixtures
git commit -m "feat: build gera obras cifradas e índice por RG"
```

---

### Task 3: Casca do app: lista de RG, senha e visualizador

**Files:**
- Create: `app/index.html`
- Create: `app/css/app.css`
- Create: `app/js/app.js`

**Interfaces:**
- Consumes: `decryptObra` de `app/js/crypto.js`; `obras/<RG>.json` e `index.json` de Task 2.
- Produces: tela inicial com lista de RG; ao escolher uma obra, pede a senha; depois de decifrar, monta `<iframe sandbox="allow-scripts allow-same-origin" srcdoc="...">` em tela cheia, com botão "Trocar obra" no topo.

- [ ] **Step 1: Escrever a casca**

Requisitos da tela (do mockup):
- Topo: logo do selo (`app/img/selo.svg`) e "RG Elétrico" à direita.
- Lista: cada RG em um cartão com o número em Barlow Condensed 700. Título do cartão: "Obra 00001" (sem nome do cliente).
- Tela de senha: campo `type="password"`, botão "Abrir". Erro: "Senha não confere. Confira com a Voltec." Sem tentativa limitada nesta fase.
- Se `index.json` não carregar (primeira abertura sem internet): "Precisa de internet na primeira vez para baixar as obras."
- Pelo modo avião, a lista e a senha precisam funcionar depois do primeiro carregamento.
- `localStorage` dentro do try/catch. A senha nunca vai para o `localStorage`.

- [ ] **Step 2: Verificação manual no navegador**

Run: `npx serve app` ou abrir `app/index.html` por um servidor local (`python -m http.server` na pasta `app`).
Expected: lista aparece com a 00001 (depois do build da Task 2 gerar `dist`). Senha errada mostra erro. Senha certa abre a 00001 em tela cheia.

- [ ] **Step 3: Commit**

```bash
git add app/index.html app/css/app.css app/js/app.js
git commit -m "feat: casca do app com lista de RG, senha e visualizador"
```

---

### Task 4: Service worker, manifest e instalação

**Files:**
- Create: `app/sw.js`
- Create: `app/manifest.webmanifest`
- Create: `app/img/icon-192.png`, `app/img/icon-512.png` (a partir de `01-Marca/Logo Voltec - selo.jpeg`, fundo marinho)
- Modify: `app/index.html` (registrar o service worker e linkar o manifest)
- Modify: `scripts/build.mjs` (gera `app/dist/precache.json` com a lista de arquivos)

**Interfaces:**
- Consumes: lista de arquivos do build.
- Produces: `sw.js` com cache `voltec-v<hash>`, que pré-carrega tudo da lista, responde do cache primeiro e busca na rede para atualizar.

- [ ] **Step 1: Escrever o teste da lista de pré-cache**

`test/build.test.mjs` ganha um caso: depois de `buildObras`, `precache.json` contém `index.json`, `obras/00001.json` e nenhum arquivo `.html` de `obras-src`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test test/build.test.mjs`
Expected: FAIL na asserção nova.

- [ ] **Step 3: Implementar a geração da lista e o `sw.js`**

- `build.mjs` escreve `precache.json` com os caminhos relativos.
- `sw.js` usa `install` (pré-carrega a lista), `activate` (apaga caches antigos) e `fetch` (cache primeiro, rede depois, atualiza o cache).
- Nome do cache: `voltec-` mais o número de versão do build, gravado em `precache.json`.

- [ ] **Step 4: Rodar teste e ver passar**

Run: `node --test test/build.test.mjs`
Expected: PASS.

- [ ] **Step 5: Verificação manual de instalação**

Chrome no Windows e Chrome no Android: o app aparece como "Instalar aplicativo". Depois de instalado e aberto uma vez com internet, ativar o modo avião e abrir o app pelo ícone: lista e 00001 funcionam.

- [ ] **Step 6: Commit**

```bash
git add app/sw.js app/manifest.webmanifest app/img scripts/build.mjs app/index.html test/build.test.mjs
git commit -m "feat: service worker e manifest para uso offline"
```

---

### Task 5: Dependências locais (Three.js e fontes)

**Files:**
- Create: `app/vendor/three.min.js` (r128, baixado do cdnjs uma vez, sem CDN no app)
- Create: `app/vendor/fonts/*.woff2` (Barlow 400/500/600, Barlow Condensed 500/600/700, IBM Plex Mono 400/500)
- Create: `app/vendor/fonts.css` (`@font-face` apontando para `fonts/`)

**Interfaces:**
- Consumes: nada.
- Produces: `app/vendor/three.min.js` e `app/vendor/fonts.css` carregados pela casca e pela simulação.

- [ ] **Step 1: Escrever o teste de URLs externas**

`test/build.test.mjs` ganha um caso: varre `app/` e falha se achar `https://`, `http://` (fora de comentário) ou `cdnjs`, `googleapis`, `gstatic`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test test/build.test.mjs`
Expected: FAIL: a 00001 ainda não foi adaptada (Task 6), mas o teste varre só `app/`, então deve passar só depois que o `index.html` da casca não tiver CDN. Se falhar por causa do `fonts.css` antigo, corrigir na Step 3.

- [ ] **Step 3: Baixar e apontar**

- Baixar `three.min.js` r128 de `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js` para `app/vendor/`.
- Baixar os woff2 das famílias listadas (Google Fonts, `gstatic`) para `app/vendor/fonts/`.
- Escrever `app/vendor/fonts.css`.
- Trocar as tags de CDN da casca por caminhos locais.

- [ ] **Step 4: Rodar teste e ver passar**

Run: `node --test test/build.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/vendor app/index.html test/build.test.mjs
git commit -m "chore: três.js e fontes locais, sem CDN"
```

---

### Task 6: Adaptar a 00001 para o build

**Files:**
- Modify: `obras-src/00001.html` (ou criar uma cópia tratada em `obras-src/00001.html` a partir do original, mantendo o original em `obras-src/originais/00001.html`)
- Create: `test/obra00001.test.mjs`

**Interfaces:**
- Consumes: `obras-src/00001.html` de Task 0.
- Produces: `obras-src/00001.html` sem editor, sem chamadas ao claude.ai, com `./vendor/three.min.js` e `./vendor/fonts.css` no lugar dos CDNs. Dentro do `srcdoc`, os caminhos relativos não funcionam. Por isso o build embute o Three.js e o `fonts.css` na obra antes de cifrar (ver Step 3).

- [ ] **Step 1: Escrever os testes que falham**

`test/obra00001.test.mjs` lê a obra tratada (depois do build de teste) e confere:
- não contém `window.claude`;
- não contém `cdnjs`, `googleapis`, `gstatic`;
- contém o Three.js embutido (`THREE.WebGLRenderer` presente) e `@font-face`;
- contém `"trees"` e `"fix"` no JSON do projeto (dados preservados).

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test test/obra00001.test.mjs`
Expected: FAIL, a obra ainda tem editor e CDNs.

- [ ] **Step 3: Tratar a obra**

Mudanças no HTML da 00001:
- Remover o bloco que usa `window.claude`, `artifactNS`, `publishProj` e `SRC`, e o IIFE de `window.claude.use`. O modo de edição some; `canEditProj` fica `false`.
- Substituir a tag de cdnjs por um `<script>` com o conteúdo de `app/vendor/three.min.js`. Feito pelo build: `buildObras` injeta o Three.js e o `fonts.css` no lugar das tags `<script src="https://...">` e `<link href="https://fonts...">`.
- Manter o JSON `projeto`, a lógica de cálculo e a cena.
- Manter o original em `obras-src/originais/00001.html` para comparação.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test test/obra00001.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add obras-src/originais test/obra00001.test.mjs scripts/build.mjs
git commit -m "feat: adapta a obra 00001 para o app, sem editor e com três.js embutido"
```

Nota: `obras-src/` está no `.gitignore`. O commit acima só vale para `test/` e `scripts/`. A obra tratada não vai para o Git.

---

### Task 7: Reorganizar a interface da simulação nas abas dos prints

**Files:**
- Modify: `obras-src/00001.html` (ou o arquivo tratado de Task 6): painel e barra inferior.
- Test: `test/obra00001.test.mjs` (novos casos)

**Interfaces:**
- Consumes: os elementos de painel já existentes (`#pane-res`, `#pane-fix`, `#pane-vaga`, `#pane-tree`, `#pane-set`).
- Produces: barra inferior com cinco abas (Projeto, Resultados, Luz, Luminárias, Cena). Mapa das abas:
  - Projeto: veredito (`#verdict`), números-chave (`.kpis`) e o seletor Realista/Lux/Isolinhas (`#segMode`).
  - Resultados: tabela de potências (`#tblW`) e tabela das vagas (`#tblV`).
  - Luz: potência (`#allW`), cor (`#allC`), exposição (`#expoMain`), intensidade.
  - Luminárias: refletores (`#fixList`) e balizadores (`#vagaList`), sem edição.
  - Cena: vistas (`#sLabels`, `#sAims`, `#sVals`, `#sRoutes`), coqueiros (`#treeList`), 3D e planta (`#segCam`).

- [ ] **Step 1: Escrever os testes que falham**

Dentro de `test/obra00001.test.mjs`, lendo o HTML tratado:
- existem exatamente cinco botões de aba com os textos "Projeto", "Resultados", "Luz", "Luminárias", "Cena";
- não existe mais "Vagas", "Coqueiros", "Ajustes" nem "Refletores" como aba;
- `#segMode` contém "Realista", "Lux", "Isolinhas".

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test test/obra00001.test.mjs`
Expected: FAIL, as abas ainda são as antigas.

- [ ] **Step 3: Reorganizar**

- Trocar os seis botões de `#tabs` pelos cinco da lista acima. Mover os blocos existentes de HTML para as abas do mapa, sem reescrever o conteúdo deles.
- Trocar `#modebar` e os botões "Salvar para todos" e "Voltar ao projeto" por nada. Não há edição no cliente.
- Recolher o painel no celular, como já funciona.
- Usar as cores e fontes da casca nos textos novos, sem mexer no visual da cena.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test test/obra00001.test.mjs`
Expected: PASS.

- [ ] **Step 5: Verificação manual no celular e no notebook**

Abrir a 00001 no app: as cinco abas funcionam; Realista, Lux e Isolinhas trocam o mapa; o painel recolhe no celular; sem rolagem horizontal da página. Em largura de 390 px, a barra inferior cabe.

- [ ] **Step 6: Commit**

```bash
git add test/obra00001.test.mjs
git commit -m "feat: abas da simulação no padrão Projeto, Resultados, Luz, Luminárias, Cena"
```

Nota: a edição do arquivo da obra fica em `obras-src/`, fora do Git.

---

### Task 8: Miniaturas de ângulo e pacote final

**Files:**
- Modify: `app/js/app.js` (barra de ângulos no visualizador)
- Create: `scripts/render-thumbs.mjs` (gera PNG pequeno de cada ângulo a partir da obra, rodando no navegador headless)
- Create: `app/dist/thumbs/<RG>/<angulo>.webp`

**Interfaces:**
- Consumes: obra decifrada e o botão de câmera da cena.
- Produces: miniaturas `Frente`, `Lateral`, `Fundos`, `Piscina`, `Garagem` por RG, usadas na barra de ângulos do visualizador.

- [ ] **Step 1: Verificar o que existe**

Nesta fase, a 00001 tem vistas 3D e planta, sem presets de ângulo. Antes de escrever o render, confirmar com o Igor quais cinco ângulos valem para a garagem: Frente, Lateral, Fundos, Piscina, Garagem. Se a garagem não tiver piscina, substituir por "Portão" e avisar na entrega.

- [ ] **Step 2: Escrever o teste da barra de ângulos**

Lendo `app/js/app.js`: a barra usa a lista de ângulos do índice (campo `angulos` em `index.json`, opcional). Sem `angulos`, a barra some. Teste em `test/build.test.mjs`.

- [ ] **Step 3: Implementar a barra e o render**

- `app.js`: se houver `angulos`, mostra a barra; clique manda `postMessage({ cam: "<nome>" })` para o `iframe`.
- A obra recebe um listener de `postMessage` que muda a câmera para o preset.
- `render-thumbs.mjs`: abre a obra no Chrome headless (Playwright ou puppeteer, instalado só para o build), tira um screenshot por preset, salva em `app/dist/thumbs/`.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test test/build.test.mjs`
Expected: PASS. Depois, `node scripts/render-thumbs.mjs` gera cinco arquivos para a 00001.

- [ ] **Step 5: Commit**

```bash
git add app/js/app.js scripts/render-thumbs.mjs test/build.test.mjs
git commit -m "feat: barra de ângulos com miniaturas renderizadas da simulação"
```

---

### Task 9: Publicar no GitHub Pages e aceitação offline

**Files:**
- Create: `README.md` (raiz, uma página: como gerar o build, onde ficam as senhas, como publicar)

**Interfaces:**
- Consumes: `app/dist/` gerado pelo build.
- Produces: URL pública `https://<usuario>.github.io/<repo>/` com o app.

- [ ] **Step 1: Gerar o build**

Run: `node scripts/build.mjs`
Expected: `app/dist/index.json` com `["00001"]`, `app/dist/obras/00001.json`, `app/dist/precache.json`.

- [ ] **Step 2: Conferir que o build não tem texto aberto da obra**

Run: buscar por "Garagem" e "lux" em `app/dist/obras/`.
Expected: nenhuma ocorrência. O JSON é só texto cifrado em base64.

- [ ] **Step 3: Publicar**

Igor cria o repositório no GitHub (público, para o Pages gratuito). Publicar a pasta `app/dist/` na branch `gh-pages`, ou configurar o Pages para a pasta de build. Anotar a URL.

- [ ] **Step 4: Aceitação offline (checklist)**

- [ ] Abrir a URL com internet no celular e instalar o app.
- [ ] Ativar o modo avião e abrir pelo ícone: lista aparece.
- [ ] Senha errada: mensagem de erro, nenhum conteúdo da obra.
- [ ] Senha certa: a 00001 abre, as cinco abas funcionam, Realista/Lux/Isolinhas funcionam.
- [ ] Repetir no notebook pelo Chrome instalado.
- [ ] Desligar o modo avião, mudar a senha ou a obra num novo build, publicar, abrir com internet: a versão nova aparece.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: como gerar o build e publicar o app de simulações"
```

---

## Self-Review

**Cobertura do spec:** tela inicial por RG (Task 3), senha por obra (Tasks 1, 3), GitHub Pages e PWA (Tasks 4, 9), abas dos prints (Task 7), Realista/Lux/Isolinhas (Task 7), miniaturas com renders (Task 8), 00001 sem editor e com dependências locais (Tasks 5, 6), custo zero (Global Constraints), 00002 fora desta fase (spec, não-objetivos).

**Consistência de tipos:** `encryptObra` e `decryptObra` têm a mesma forma em Tasks 1, 2 e 3. Campo `iter` fica no objeto cifrado e é lido em `decryptObra`. `buildObras` usado em Task 2 e chamado em Task 6.

**Review Focus:** cada linha tem teste ou verificação manual na tarefa dona (senha errada e espaço final em Task 1; primeira abertura sem internet em Task 3; atualização em Task 9; `localStorage` bloqueado em Task 6 e 7).

**Lacunas abertas:** o `iframe` com `allow-same-origin` deixa a obra acessar o storage do app. Aceito, porque o conteúdo é nosso. Anotado no spec.

## Execution Handoff

Plano salvo em `docs/superpowers/plans/2026-10-25-app-simulacoes-offline.md`, com o desenho em `docs/superpowers/specs/2026-10-25-app-simulacoes-offline-design.md`.

Uma observação: não rodei a checagem de construtor sobre o desenho, então algumas perguntas podem aparecer durante a implementação.

Antes de começar, preciso de duas coisas:
1. O HTML baixado da 00001 salvo como `obras-src/00001.html` (Task 0).
2. A escolha de execução. A opção **subagent-driven** dá um subagente por tarefa, com revisão a cada uma; é mais segura, mas gasta mais contexto. A opção **nativa** faço eu mesmo nesta sessão, mais rápido e barato, com revisão só no fim.

Recomendo a **nativa**, porque as tarefas se encadeiam (o build alimenta o app, o app alimenta a obra), e um erro de interface seria pego melhor vendo a tela. Qual você prefere?
