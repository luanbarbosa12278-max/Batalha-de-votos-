# Street Vote Fighter — menu arcade v1.7.0

O menu é a primeira tela. JOGAR mostra uma transição de aproximadamente 1,5 segundo; CONTINUAR preserva a luta. ESC e o botão MENU abrem novamente o menu. As cinco opções aceitam teclado e toque.

## Integração

- `src/arcade-state.js`: preferências, mixer de áudio, relógio e estatísticas locais.
- `src/menu.js` e `src/menu.css`: navegação, telas, foco, transição e apresentação responsiva.
- `src/game.js`: pontos de integração nos disparos/especiais reais, vitórias e relógio de pausa. O arquivo `src/engine.js` permanece intacto.
- `index.html`: estrutura do menu, trilha no mixer, controle PULAR acessível pelo teclado, entrada/saída do debate. Cenário, sprites, falas, MP3 e final com raio continuam os mesmos.
- `src/style.css`: espaço para o acesso ao menu no cabeçalho.
- `package.json` e `package-lock.json`: versão 1.7.0, sem novas dependências de execução.

## Estados e eventos da live

O motor conserva uma única cadeia de requestAnimationFrame. Menu, transição, debate e aba oculta pausam a simulação. Ao retomar, os timestamps de escudos, recargas, especiais e reações são compensados. Projéteis, HP e fila de votos não são reiniciados ao abrir o menu.

A consulta a `https://tiktok-live-servidor.onrender.com/votos` continua a cada 2 segundos. Deltas válidos entram nos lotes comprimidos existentes e são executados ao voltar à arena. O primeiro snapshot continua sendo a referência inicial; troca de conta e reinício dos contadores mantêm o contrato existente.

Em `?live=1`, o EventSource `/live/stream` permanece conectado. Os comandos são validados e aguardam na fila existente: até 500 comandos, cada um válido por 60 segundos a partir do recebimento. Comandos vencidos são descartados; quando cheia, a fila rejeita novos comandos. A expiração também é verificada ao receber eventos, inclusive com a aba oculta. Após retomar, são respeitados os bloqueios e recargas normais do combate. Nenhum dado do servidor é alterado por preferências ou estatísticas.

## Preferências e estatísticas

- `svf-arcade-settings-v1`: volume geral, vozes, efeitos, animações e partículas.
- `svf-arcade-stats-v1`: ataques de cada lutador, debates iniciados, vitórias e tempo.
- `svf-volume-musica`: volume individual da trilha original, preservado e multiplicado pelo volume geral.

As vozes do combate, as vozes do debate e a música usam ganhos Web Audio, com volume HTML como fallback. O efeito de tiro e o som de navegação respeitam os volumes geral e de efeitos. Animações decorativas e partículas podem ser desligadas sem alterar os golpes. A preferência de movimento reduzido do sistema tem prioridade.

Ataques normais contam quando o projétil é disparado; especiais contam quando a execução é aceita. Teclas bloqueadas, votos apenas recebidos e escudos não inflam o contador. Uma vitória é contada uma única vez; empate não conta. O tempo inclui arena e debate com a aba visível, excluindo menu e transição. Estatísticas são gravadas a cada 5 segundos e ao mudar de estado, ocultar ou sair da página. Reiniciar a luta não apaga o histórico. Storage inválido ou bloqueado não impede jogar.

## Debate

O menu usa a cutscene existente. Só PULAR aparece dentro dela, e aceita toque, Enter e espaço; ESC também pula. O modo de tela cheia escolhido antes da cena é preservado. Pular não aplica o golpe final. Concluir todas as falas mantém o raio, o hit-kill e a vitória; a abertura do menu fica bloqueada por 2,7 segundos para apresentar o desfecho.

Também foi corrigido um listener de metadados que podia permanecer após o término/pulo da fala. As seis requisições a poses opcionais ausentes agora são dispensadas quando os seis quadros de disparo instalados já cobrem a animação.

## Verificação executada

Base examinada: commit `653e144de71e37801bd610f5e6217372b27bac98`.

- 21 testes direcionados passaram: estado/preferências/áudio, motor e servidor de eventos.
- Suíte completa antes: 37 testes, 26 passaram e 11 falharam.
- Suíte completa após: 43 testes, 32 passaram e as mesmas 11 falhas permaneceram. Nenhum teste antigo foi apagado, desativado ou alterado para ocultar essas falhas.
- As falhas anteriores estão em `basic-projectiles.integration.test.js` (1), `basic-projectiles.test.js` (1), `bolsa-pancada.test.js` (1) e `god-mode.test.js` (8). Incluem expectativas do modo GOD já desativado e tempos/expectativas de projéteis anteriores.
- `tests/arcade-menu.browser.mjs`: 13 grupos passaram em Chromium. Menu inicial, teclado/foco, tutorial, votos no menu, transição, seis ataques, pausa, escudos, volumes, persistência, padrões, tela cheia nativa, debate/PULAR/final, vitória, contrato de configuração do Render, quatro viewports, controles mobile, EventSource simulado, ausência de exceções JS e assets ausentes.
- `tests/arcade-compat.browser.mjs`: 5 grupos passaram com emulação de toque. Tela cheia alternativa, pausa no meio de um especial sem duplicar dano, troca de lutador, PULAR, uma única cadeia de animação, limite/expiração da fila, opções visíveis em 320×568 / 390×844 / 667×375 / 844×390 e armazenamento bloqueado.
- Sem alterações no motor, arquivos do servidor ou assets existentes.

A API TikTok foi simulada nos testes de navegador; o contrato HTTP/autenticação/SSE do servidor foi testado localmente. Não foi realizada uma live TikTok real nem validação em dispositivos Android/iPhone físicos ou Safari.

## Reproduzir

Com Node e Playwright disponíveis, sirva a raiz em `http://127.0.0.1:8000`, por exemplo com `python -m http.server 8000 --bind 127.0.0.1`.

Execute separadamente:

- `npm run test:arcade`
- `npm run test:arcade:browser`
- `npm run test:arcade:touch`
- `npm test` para conferir também as falhas anteriores.

Os scripts de navegador aceitam `TEST_URL`, `TEST_OUTPUT`, `PLAYWRIGHT_MODULE` e `CHROMIUM_PATH`. O padrão de saída é `review/menu-v1.7`. Instrumentação de testes e simulação da live são injetadas apenas pelo Playwright; não existem atalhos de teste no código entregue ao jogador.

