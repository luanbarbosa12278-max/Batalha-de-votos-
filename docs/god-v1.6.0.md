# GOD independente — v1.6.0

- **R** alterna GOD de Lula; **U** alterna GOD de Bolsonaro. Também é possível clicar/tocar no botão de GOD no HUD de cada personagem, inclusive em tela cheia nativa e no modo alternativo de tela cheia.
- O botão mostra **GOD ATIVO** em dourado ou **GOD OFF**, com estado acessível `aria-pressed`. Os dois modos são independentes e podem ficar ativos juntos. A seleção do lutador nos controles mobile não altera GOD.
- GOD remove recargas e bloqueios de ações por animações, dano e knockback. Pode repetir ou combinar socos, Hadoukens, Bolsa Pancada e Tá OK!; cada golpe aceito mantém seu próprio impacto e dano. Ativar durante uma reação a dano libera imediatamente o lutador.
- **Não concede invulnerabilidade:** vida continua em 500; soco causa 10, Hadouken 20 e Bolsa Pancada/Tá OK! 25. O lutador ainda pode sofrer K.O. O outro personagem continua sujeito às regras normais enquanto seu próprio GOD estiver desligado.
- Animações e tempos até o impacto são preservados. Não é necessário esperar a animação terminar para iniciar outra ação com GOD. Os limites de áudio continuam evitando sobreposição de falas.
- Os escudos existentes continuam independentes do GOD: bloqueiam os danos normalmente e expiram após 5 segundos. A cena de debate pausa todos os golpes em andamento, inclusive os GOD, e os retoma ao sair; GOD não ignora essa pausa do jogo.
- Desativar restaura os bloqueios normais para novas ações; golpes já lançados terminam normalmente. GOD permanece entre rounds; reiniciar a luta, trocar a conta ou recarregar a página o desliga para ambos.
- Os atalhos de combate continuam Q/W/E para Lula e I/O/P para Bolsonaro. Atalhos não atuam em campos de texto, com Ctrl/Alt/Meta ou repetição automática da tecla.

## Verificação

`node --test tests/*.test.js` cobre GOD de cada lado, simultaneidade, dano único, recargas, reações, desativação, K.O./empate, reset e conservação de votos, incluindo 1.200 socos através de rounds.

Com um servidor HTTP local e Playwright 1.62.1: `node tests/god-mode.browser.mjs` verifica teclado, clique/toque, HUD, estado acessível e tela cheia nativa/alternativa em desktop 1440×1000 e mobile 844×390, 390×844 e 667×375. `node tests/lula-visual.browser.mjs` verifica a paleta, tamanho e animação de Lula e o dano/recarga normais de Bolsa Pancada.

Os testes de navegador interceptam a API TikTok. Mobile é emulado no Chromium; aparelho físico e Safari/iOS não foram testados. `BASE_URL`, `CHROMIUM_PATH` e `REVIEW_OUTPUT` permitem configurar o servidor, navegador e diretório de capturas.
