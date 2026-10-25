# App Voltec de simulações 3D, offline: desenho

Data: 25/10/2026. Status: aprovado pelo Igor na conversa.

## Intenção
Um app próprio da Voltec, instalado no celular ou no notebook, que abre as simulações 3D de cada obra pelo número de RG (00001, 00002...) e funciona sem internet na obra. Custo zero. Cada obra só abre com a senha dela.

## Objetivos
- Lista de obras por RG na tela inicial.
- Senha por obra. Sem a senha certa, nada da obra aparece.
- Funciona offline depois de instalado e aberto uma vez com internet.
- Interface única para todas as obras, com a barra de abas dos prints: Projeto, Resultados, Luz, Luminárias, Cena. Modos Realista, Lux e Isolinhas.
- Obra 00001: garagem da pousada (Touros/RN), a partir do HTML "Estudo Luminotécnico da Garagem".

## Não-objetivos
- Modo de edição no app do cliente. A edição fica no Claude, e o app só mostra.
- Obra 00002 agora. Ela ainda está em construção. Entra depois, pelo mesmo pipeline.
- Publicação em loja (Play Store, App Store).
- Analytics, login de usuário, banco de dados.

## Restrições
- Custo zero: GitHub Pages para hospedar, sem serviço pago.
- Dados de cliente (fotos, endereço, planta) não ficam em texto aberto no endereço público. Cada obra vai criptografada.
- Identidade: cores e fontes da identidade visual v3 (`01-Marca/identidade-visual-v3.md`) na casca do app. As cores próprias da simulação ficam como estão.
- Português do Brasil.

## Decisões (minha escolha, pode trocar)
- Criptografia: AES-GCM 256 com chave PBKDF2-SHA256, 310 mil iterações, salt e IV aleatórios por obra. Feita com WebCrypto, que funciona no navegador e no Node.
- Arquivo público por obra: `obras/<RG>.json` com salt, IV e texto cifrado. O índice `index.json` lista só os números de RG.
- Senhas ficam em `obras-src/senhas.json`, fora do Git. O build lê esse arquivo.
- A simulação roda num `iframe` com `srcdoc` e `sandbox="allow-scripts allow-same-origin"`. O `allow-same-origin` é necessário para o `localStorage` da simulação.
- Pede a senha uma vez por obra, até fechar o app.
- Service worker pré-carrega a casca, o Three.js, as fontes e as obras criptografadas.
- Three.js r128 e as fontes (Barlow, Barlow Condensed, IBM Plex Mono) ficam dentro do app, em `app/vendor/`.
- Abas da 00001: Resultados recebe a aba Resultado. Luz recebe Ajustes de exposição e cor. Luminárias recebe Refletores e Vagas. Cena recebe Vista e Coqueiros. Projeto recebe o veredito, os números-chave e o Realista/Lux/Isolinhas.
- Miniaturas de ângulo (Frente, Lateral, Fundos, Piscina, Garagem) são renders da própria simulação. As fotos do mockup são ilustrativas e não entram no app.

## Fora do escopo desta fase
- Atualização automática de obra quando o cliente já tem a versão antiga instalada (o service worker atualiza na próxima abertura com internet).
- Número de RG da obra fora de 00001 e 00002.

## Deixado para o construtor
- Escolha de bibliotecas de build (Node puro basta).
- Tamanho e posição exatos dos botões no celular, desde que sigam o mockup.
