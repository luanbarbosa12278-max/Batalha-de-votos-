# Street Vote Fighter

Jogo fictício e caricatural de luta 2D, controlado por comentários do TikTok LIVE. Não é pesquisa eleitoral nem material oficial de candidatos.

## Revisão, sem publicação

Esta versão está na branch `codex/street-vote-fighter`. Não integrar em `main` sem revisão. O workflow gera sprites, relatórios e capturas somente nessa branch; não publica GitHub Pages nem altera o Render.

Abra `preview.html` para conferir os recortes e `index.html` para jogar. As capturas ficam em `review/desktop.jpg`, `review/mobile.jpg`, `review/knockout.jpg` e `review/animations.jpg`.

Para testar a branch no computador:
```sh
git clone --branch codex/street-vote-fighter https://github.com/luanbarbosa12278-max/Batalha-de-votos-.git
cd Batalha-de-votos-
python -m http.server 8000
```
Abra http://localhost:8000. Use um servidor HTTP; os módulos não devem ser abertos via `file://`.

## Sprites reais e limitações visuais

As duas spritesheets originais têm 1536 × 1024 pixels e alfa real. O cenário original `cenário.png` (com acento) tem 1672 × 941 pixels. Originais preservados.

`tools/inspect_assets.py` registra dimensão, modo e distribuição do alfa. `tools/extract_sprites.py` extrai poses selecionadas usando Pillow, remove componentes desconectados, franjas com alfa abaixo de 96 e fragmentos de sapatos vizinhos fora da guarda. Normaliza para telas RGBA 280 × 256, linha dos pés y=240 e guarda com 180 pixels de altura. A escala é fixa por personagem, inclusive no soco.

A seleção final usa **uma guarda de Lula e uma guarda e um soco de Bolsonaro**. Os candidatos sobrepostos ou cortados de caminhada, dano, vitória e derrota foram descartados, assim como os dois ataques candidatos do Lula. Detalhes coloridos que fazem parte da arte original permanecem; não houve redesenho por IA.

Parado, movimento, ataque de Lula, dano, vitória e derrota usam transformações simples das guardas selecionadas. Não há uma sequência completa de desenhos para cada ação. Lula olha para a direita; Bolsonaro é espelhado para a esquerda. Prévia disponível em `preview.html`.

## Regras e contagem

- Comentário 13: ataque de Lula; 22: ataque de Bolsonaro.
- Cada aumento nos contadores gera um golpe, inclusive comentários repetidos.
- Vida 100, dano 10 para os dois lados.
- A fila é compactada em lotes, sem limite arbitrário de 500 e sem descarte no K.O. Comentários durante a pausa ficam para o próximo round.
- Dentro de uma consulta com votos dos dois lados, o jogo alterna os golpes. A API fornece totais e não a ordem temporal dos comentários.
- A primeira consulta estabelece uma linha de base, sem reproduzir comentários anteriores à abertura da página.
- Queda dos contadores é tratada como reinício conjunto do servidor. Sem IDs de evento ou identificador de sessão, não é possível recuperar eventos perdidos em reinícios não observados.
- Troca de conta inicia uma luta e uma linha de base novas. Reinício local confirmado pelo usuário descarta explicitamente a fila local.
- Golpes de teste são contados separadamente dos comentários da live.

## Contrato existente do Render

`GET https://tiktok-live-servidor.onrender.com/votos`:
```json
{"13": 0, "22": 0, "usuario": "@conta", "status": "Conectado"}
```

`POST https://tiktok-live-servidor.onrender.com/configurar`: corpo JSON com `usuario`, `Content-Type: application/json` e cabeçalho `X-Admin-Password` com o valor digitado. Nenhuma senha é gravada no código, URL, armazenamento local ou relatório. O campo é apagado ao fim da tentativa. Como no cliente original, uma configuração bem-sucedida pressupõe contadores reiniciados pelo backend. Requisições antigas de consulta são abortadas/invalidadas ao configurar.

O código Python do Render não é alterado. Testes automatizados interceptam a API; nenhuma conta de live real é reconfigurada. A conexão com TikTok real exige validação manual pelo administrador.

## Testes

```sh
node --test tests/engine.test.js
python -m pip install Pillow==11.3.0
python tools/inspect_assets.py
python tools/extract_sprites.py
npm install --no-save --package-lock=false playwright@1.51.1
npx playwright install chromium
# Com o servidor HTTP ativo na porta 8000:
node tests/browser.mjs
```

Testes cobrem contagem repetida, 1.200 golpes e rounds, fila durante K.O., equilíbrio de dano, linha de base, mudança de conta, contagem inválida, reset, configuração autenticada simulada, limpeza do campo de senha, erro de imagem, viewport desktop/celular e ausência de erros JavaScript. Chromium é automatizado; Safari/iOS e live real ainda exigem teste manual.

GitHub Pages: HTML/CSS/JS e PNG estáticos com caminhos relativos, sem build necessário. Após revisão e integração, o fluxo de publicação existente pode servir os arquivos normalmente.
