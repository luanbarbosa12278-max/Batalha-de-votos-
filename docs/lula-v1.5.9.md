# Lula / Bolsa Pancada — v1.5.9

O encaixe antigo usava a altura total da imagem, incluindo braço e brilho.
Depois, `fighter()` aplicava fatores 1.18 / 1.30 / 0.98, que também deslocavam
a sola em relação ao chão. A preparação e a invocação ficavam menores que o idle.

A normalização agora mede o corpo do topo do cabelo até a sola e aplica um
único fator X/Y para obter os mesmos 180 pixels do idle. Os quadros crescem
verticalmente para acomodar o braço. Todos usam a âncora central dos pés,
16 pixels acima da borda inferior, sem multiplicadores adicionais ao desenhar.

| Pose | PNG original | Topo do cabelo (Y) | Sola (Y exclusivo) | Quadro |
|---|---|---:|---:|---|
| Idle, referência | 1312 × 1199 | 214 | 1106 | 280 × 256 |
| Preparo | 1241 × 1267 | 317 | 1253 | 280 × 272 |
| Invocação | 1118 × 1407 | 390 | 1396 | 280 × 282 |
| Final | 1312 × 1199 | 22 | 1192 | 280 × 256 |

Os marcos em `LULA_BOLSA_BODY_TOP` pertencem às artes atuais. Se os PNGs forem
substituídos ou redimensionados, recalibrar esses marcos e repetir a revisão visual.
As poses, a orientação e a anatomia dos arquivos originais são preservadas.

A paleta é corrigida uma vez durante o carregamento. `lulaSuitPalette()` extrai
tons do tecido de `lula-idle.png`; `matchBolsaSuit()` mapeia somente o azul
saturado dos três especiais para essa paleta, mantendo a ordem de luminosidade
dos sombreados. Não há filtro global, CSS novo nem processamento por frame.
Os PNGs permanecem intactos. A máscara exclui tons neutros, vermelhos, pele,
cabelo e contornos pretos; o canal alpha nunca é modificado.

## Verificação

`node --check src/game.js` e `git diff --check` passaram.

Com servidor local na porta 8000 e Playwright instalado:

```sh
node tests/lula-visual.browser.mjs
```

O teste aceita `CHROMIUM_PATH` para um executável Chromium existente e
`REVIEW_OUTPUT` para o diretório das capturas. Não insere hooks no jogo publicado;
as funções de inspeção são expostas apenas na resposta interceptada pelo teste.

Verificado no Chromium: sequência preparo → invocação → impacto → final → idle;
tecla E, clique, controle da tela cheia em viewport 844 × 390; dano único de 25
aos 730 ms; cooldown de 1400 ms; ausência de erros JavaScript. TikTok simulado.
Comparação visual feita com o código original e o corrigido, incluindo o idle.

As verificações por pixel confirmaram zero alterações fora da máscara do terno,
zero alterações de alpha e uso exclusivo de cores da paleta do idle nos pixels
corrigidos. A geometria confirmou escala uniforme, corpo de 180 pixels e
recorte completo das três poses, com pés ancorados ao mesmo chão.

A suíte legada `node --test tests/*.test.js` já tinha 7 falhas em 12 testes no
commit de origem `f69bb47`: expectativas antigas de 100 HP (o jogo usa 500),
fila de votos, cooldown de 5 segundos, pose única do Bolsa Pancada e Shoryuken.
Essas regras e testes legados não foram alterados neste ajuste visual.
Não foi testado aparelho físico nem a integração real com TikTok.
