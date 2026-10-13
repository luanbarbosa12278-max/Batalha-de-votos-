# Ataques básicos — v1.6.14

Q/PICANHA e I/BANDEIRA usam o mesmo agendador de votos, 10 HP e ciclo de 240 ms. O disparo ocorre aos 100 ms, viaja a 1800 px/s e só causa dano ao colidir. Escudos absorvem os tiros; K.O., troca de round e reset descartam projéteis antigos. O debate pausa a simulação. Layout, especiais e cutscenes foram preservados.

## Pendência visual: seis PNGs transparentes

Os sprites aprovados têm luvas, não dedos visíveis. Até receber as poses abaixo, o ataque usa o idle original: não há mão desenhada por cima, deformação nem animação de soco. A mecânica funciona, mas a pose de arminha e o recuo da mão ainda dependem destas artes.

Salvar em `assets/fighters/`, RGBA transparente, canvas **280 × 256**, pixels nítidos. Corpo com 180 px da cabeça às solas; centro entre os pés em **(140, 240)** em todos os quadros. Não recortar cada quadro separadamente. Lula olha para a direita; Bolsonaro para a esquerda. Preservar exatamente rosto, cabelo, proporções e roupas de `lula-idle.png` e `bolsonaro-idle.png`. Apenas a mão que dispara fica sem a luva. Nenhum projétil ou efeito embutido.

| Arquivo | Pose |
|---|---|
| lula-finger-aim.png | Indicador para a direita, polegar para cima, outros dedos recolhidos; ponta do indicador em (187, 137). |
| lula-finger-fire.png | Mesma pose, mão recua 3 px para a esquerda e 1 px para cima; pés e cabeça fixos. |
| lula-finger-recovery.png | Braço parcialmente recolhido, transição de volta ao idle. |
| bolsonaro-finger-aim.png | Indicador para a esquerda, polegar para cima, outros dedos recolhidos; ponta em (93, 137). |
| bolsonaro-finger-fire.png | Mesma pose, mão recua 3 px para a direita e 1 px para cima; pés e cabeça fixos. |
| bolsonaro-finger-recovery.png | Braço parcialmente recolhido, transição de volta ao idle. |

O carregamento é opcional e automático: aim 0–100 ms, fire 100–154 ms, recovery 154–240 ms. Os frames são desenhados sem normalização individual para manter a âncora fixa. O idle permanece inalterado.

## Verificação

`node --test tests/engine.test.js tests/basic-projectiles*.test.js` verifica colisão, dano, cadência, escudos, invulnerabilidade, saída da arena, K.O., reset, empate e votos. `node tests/basic-projectiles.browser.mjs` requer Playwright e servidor local na porta 8000, com API de votos simulada. A suíte histórica completa contém falhas já presentes na revisão base (testes do GOD removido e duração antiga do K.O.); esta alteração não reativa GOD para satisfazê-los.

Resultado desta revisão: 18 testes de lógica/integração passaram; as mesmas 8 falhas históricas foram reproduzidas na revisão base a62f9cf. A execução visual desktop/mobile não foi concluída: o Chromium não estava instalado e seu download retornou um arquivo inválido. Não há validação visual ou de áudio em dispositivo real nesta revisão.
